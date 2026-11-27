import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, account, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");
const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { createExperienceStore } = await import("../src/features/Dashboards/User/Experience/experienceStore.js");
const { buildTransactionResult } = await import("../src/mobile/models/transactionResult.js");

/*
 * Phase 2B: creating an expense or an income from Mobile (POST /transactions/expense, /transactions/income).
 * PostExpenseAction / PostIncomeAction: the Idempotency-Key is required, the same key with the same request replays the
 * first transaction, the same key with a different request is a 409, the account must be active, not a savings goal's
 * and in the entry's currency, the category must be active, of the entry's type and in the account's workspace, and an
 * expense may not exceed the balance unless the account allows a negative one (422 with the server's message).
 *
 * Both writes are "key-fix-pending" (the completion of the key is atomic only on the unmerged 6b696d72) and stay CLOSED
 * in the product: APPROVED is empty. These tests open them only through the test runner's switch, against a fake
 * backend that follows those rules.
 */

after(() => dom.window.close());

const OPERATIONS = { expense: "transaction.expense", income: "transaction.income" };
let api;
let view;
let server;

const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");
const pendingKeys = () => Object.keys(window.localStorage).filter((key) => /pending/i.test(key));
// The select lists accounts in the app's own order; what matters is which are offered.
const options = (name) => qa("option", field(name)).map((option) => option.value).sort();

const fixed = (value) => {
  const [whole, fraction = ""] = String(value).split(".");
  return `${whole}.${fraction.padEnd(4, "0").slice(0, 4)}`;
};
const toMinor = (value) => BigInt(fixed(value).replace(".", ""));
const fromMinor = (minor) => {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(5, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`;
};

/* A backend with balances and an idempotency table, answering the way TransactionController / PostExpenseAction / PostIncomeAction do. */
function entryServer({ onPost, afterApply } = {}) {
  const accounts = [
    account({ id: 1, name: "Wallet", currency_code: "ILS", current_balance: "1000.0000" }),
    account({ id: 2, name: "Dollar account", type: "bank", currency_code: "USD", current_balance: "500.0000" }),
    account({ id: 3, name: "Old card", type: "bank", currency_code: "ILS", current_balance: "50.0000", status: "archived" }),
    account({ id: 4, name: "Laptop savings", type: "savings_goal", savings_goal: { id: 1 }, currency_code: "ILS", current_balance: "300.0000" }),
    account({ id: 5, name: "Overdraft", type: "bank", currency_code: "ILS", current_balance: "10.0000", allow_negative_balance: true }),
  ];
  const categories = [
    { id: 4, name: "Food", type: "expense", is_system: false, is_active: true },
    { id: 5, name: "Transport", type: "expense", is_system: false, is_active: true },
    { id: 6, name: "Salary", type: "income", is_system: false, is_active: true },
    { id: 7, name: "Retired", type: "expense", is_system: false, is_active: false },
  ];
  const keys = new Map();
  const transactions = [];
  const refuse = (message) => ({ status: 422, body: { status: false, message, errors: {} } });

  const apply = (call, type) => {
    const key = call.headers["Idempotency-Key"];
    if (!key) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { idempotency_key: ["The Idempotency-Key header is required."] } } };
    const body = call.body ?? {};
    const hash = JSON.stringify({ type, body });
    const known = keys.get(key);
    if (known) {
      if (known.hash !== hash) return { status: 409, body: { status: false, message: "The idempotency key was previously used with different request data." } };
      return { status: 201, body: envelope({ transaction: known.transaction }) };
    }
    const owner = accounts.find((row) => row.id === body.account_id);
    if (!owner) return refuse("The selected account is invalid.");
    if (owner.status !== "active") return refuse("The selected account is archived.");
    if (owner.savings_goal) return refuse(type === "expense" ? "Expenses cannot be posted directly from a savings goal account; use a withdrawal." : "Income cannot be posted directly to a savings goal account; use a contribution.");
    const category = categories.find((row) => row.id === body.category_id);
    if (type === "expense" && !category) return refuse("The selected category is invalid.");
    if (category && category.type !== type) return refuse(`The selected category is not an ${type} category.`);
    if (category && !category.is_active) return refuse("The selected category is inactive.");
    if (type === "expense" && !owner.allow_negative_balance && toMinor(owner.current_balance) < toMinor(body.amount)) {
      return refuse(`Insufficient balance in account [${owner.name}]. Required: ${body.amount} ${owner.currency_code}, available: ${owner.current_balance} ${owner.currency_code}.`);
    }

    const signed = type === "expense" ? -toMinor(body.amount) : toMinor(body.amount);
    owner.current_balance = fromMinor(toMinor(owner.current_balance) + signed);
    const transaction = {
      id: 700 + transactions.length + 1,
      workspace_id: 1,
      category_id: category?.id ?? null,
      type,
      status: "posted",
      amount: body.amount,
      currency_code: owner.currency_code,
      source: "manual",
      description: body.description ?? null,
      reference_number: body.reference_number ?? null,
      occurred_at: body.occurred_at ? `${body.occurred_at.slice(0, 10)}T10:00:00.000000Z` : "2026-11-15T10:00:00.000000Z",
      posted_at: "2026-11-15T10:00:01.000000Z",
      category: category ? { id: category.id, name: category.name, type: category.type } : null,
      ledger_entries: [{ id: 1, account_id: owner.id, signed_amount: fromMinor(signed), currency_code: owner.currency_code, entry_role: type, account: { id: owner.id, name: owner.name, currency_code: owner.currency_code } }],
    };
    transactions.push(transaction);
    keys.set(key, { hash, transaction });
    return { status: 201, body: envelope({ transaction }) };
  };

  const handler = (call) => {
    if (call.method === "GET") {
      if (call.path === "/accounts") return { body: envelope({ accounts }) };
      if (call.path === "/categories") return { body: envelope({ categories }) };
      const one = /^\/accounts\/(\d+)$/.exec(call.path);
      if (one) {
        const found = accounts.find((row) => String(row.id) === one[1]);
        return found ? { body: envelope({ account: found }) } : { status: 404, body: { status: false, message: "Not found" } };
      }
      return { status: 404, body: { status: false, message: "Not found" } };
    }
    const match = /^\/transactions\/(expense|income)$/.exec(call.path);
    if (match && call.method === "POST") {
      if (onPost) return onPost(call, () => apply(call, match[1]));
      const answer = apply(call, match[1]);
      return afterApply ? afterApply(answer, call) : answer;
    }
    return { status: 404, body: { status: false, message: "Not found" } };
  };
  return { handler, accounts, transactions, keys };
}

async function openEntry(type, serverOptions = {}, { approve = [OPERATIONS[type]], language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = serverOptions.server ?? entryServer(serverOptions);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES[type]] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: `/m/add/${type}` });
}

async function fillExpense({ account: accountId = "1", category = "4", amount = "150", description = "Groceries" } = {}) {
  await change(field("account_id"), accountId);
  if (category !== null) await change(field("category_id"), category);
  await change(field("amount"), amount);
  if (description !== null) await change(field("description"), description);
  await submit(q("form.sm-draft-form"));
}

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  gate.setWriteApprovalsForTests(null);
  assert.deepEqual(api?.violations ?? [], [], "only the opened write");
  api?.restore();
  api = null;
});

describe("the registration", () => {
  it("both are money writes with a client key, key-fix-pending, and closed by default", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES["transaction.expense"] }, { endpoint: "POST /transactions/expense", moves: true, key: "client", serverDedup: "key-fix-pending" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["transaction.income"] }, { endpoint: "POST /transactions/income", moves: true, key: "client", serverDedup: "key-fix-pending" });
    assert.equal(gate.isWriteOpen("transaction.expense"), false);
    assert.equal(gate.isWriteOpen("transaction.income"), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the sender refuses without a request while closed, and refuses without a key when open", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [FORM_WRITES.expense, FORM_WRITES.income] });
    for (const operation of Object.values(OPERATIONS)) {
      const write = { operation, input: { account_id: 1, category_id: 4, amount: "1.0000" } };
      assert.throws(() => sendWorkflowWrite(write, "mobile-entry-create-12345678"), (error) => error.name === "WriteClosedError");
      gate.setWriteApprovalsForTests([operation]);
      assert.throws(() => sendWorkflowWrite(write), /needs an Idempotency-Key/);
      gate.setWriteApprovalsForTests(null);
    }
    assert.deepEqual(api.calls, []);
  });
});

describe("a new expense or income, gate closed (the product)", () => {
  for (const type of ["expense", "income"]) {
    it(`${type}: can be filled in and reviewed, but Confirm is disabled and nothing is sent`, async () => {
      await openEntry(type, {}, { approve: null });
      await change(field("account_id"), "1");
      if (type === "expense") await change(field("category_id"), "4");
      await change(field("amount"), "25");
      await submit(q("form.sm-draft-form"));
      assert.ok(q("[data-sm-step='review']"));
      assert.equal(action("send").disabled, true);
      assert.equal(action("send").dataset.smOpen, "false");
      assert.ok(q(`[data-sm-note='write-closed'][data-sm-write='transaction.${type}']`));
      await click(action("send"));
      await settle();
      assert.deepEqual(writes(), []);
    });
  }
});

describe("a new expense, with its write opened by the test switch", () => {
  it("sends the backend's fields with one Idempotency-Key, then shows the server's transaction and the account balance read again", async () => {
    await openEntry("expense");
    assert.match(text(q("[data-sm-field='amount']")), /ILS|—/, "a currency chip sits beside the amount");
    await fillExpense({ amount: "150.5" });
    const review = text(q("[data-sm-step='review']"));
    assert.match(review, /Wallet/);
    assert.match(review, /Food/);
    assert.match(review, /ILS/, "the currency is visible before confirming");
    assert.match(review, /Groceries/);

    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.path, "/transactions/expense");
    assert.match(call.headers["Idempotency-Key"], /^mobile-transaction-expense-[A-Za-z0-9-]{8,}$/);
    const { occurred_at: occurredAt, ...rest } = call.body;
    assert.deepEqual(rest, { account_id: 1, category_id: 4, amount: "150.5000", description: "Groceries" });
    assert.match(occurredAt, /^\d{4}-\d{2}-\d{2} 12:00:00$/);
    assert.equal(Object.hasOwn(call.body, "currency_code"), false, "the currency is the account's, never sent");
    assert.equal(Object.hasOwn(call.body, "workspace_id"), false);

    const result = q("[data-sm-transaction-result]");
    assert.ok(result, "the transaction's own result");
    assert.equal(result.dataset.smTransactionResult, "701");
    assert.equal(result.dataset.smResultType, "expense");
    assert.match(text(result), /Expense recorded/);
    assert.match(text(q("[data-sm-result-amount]")), /150\.50/);
    assert.match(text(q("[data-sm-result='account']")), /Wallet/);
    assert.match(text(q("[data-sm-result='category']")), /Food/);
    assert.match(text(q("[data-sm-result='description']")), /Groceries/);
    assert.match(text(q("[data-sm-result='status']")), /Posted/);
    assert.equal(action("open-transaction").getAttribute("href"), "/m/activity/701");

    // The balance is the server's, read after the write (not 1000 - 150.5 worked out here).
    const balanceReads = api.calls.filter((item) => item.method === "GET" && item.path === "/accounts/1");
    assert.ok(balanceReads.length >= 1);
    assert.ok(api.calls.indexOf(balanceReads[0]) > api.calls.indexOf(call), "after the write");
    assert.equal(q("[data-sm-balance-now='account']").dataset.smState, "ready");
    assert.match(text(q("[data-sm-balance-now='account']")), /849\.50/);
    assert.deepEqual(pendingKeys(), [], "nothing left to protect after a confirmed expense");
  });

  it("only offers an active account that is not a savings goal's, and only active expense categories", async () => {
    await openEntry("expense");
    assert.deepEqual(options("account_id"), ["", "1", "2", "5"], "no archived account, no goal account");
    assert.deepEqual(options("category_id"), ["", "4", "5"], "no income category, no inactive one");
  });

  it("needs an account and a category; an income category is not an expense category", async () => {
    await openEntry("expense");
    await change(field("amount"), "10");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null);
    assert.match(text(q("[data-sm-summary='local']")), /Account/);
    assert.match(text(q("[data-sm-summary='local']")), /Category/);
    await change(field("account_id"), "1");
    await change(field("category_id"), "6");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null, "Salary is an income category");
    assert.deepEqual(writes(), []);
  });

  it("an invalid, zero or over-precise amount never reaches review or the server", async () => {
    await openEntry("expense");
    for (const amount of ["0", "0.00", "-5", "1.23456", "abc", "1,000", ""]) {
      await change(field("account_id"), "1");
      await change(field("category_id"), "4");
      await change(field("amount"), amount);
      await submit(q("form.sm-draft-form"));
      assert.equal(q("[data-sm-step='review']"), null, `"${amount}" stays in edit`);
      assert.ok(q("[data-sm-summary='local']"), `"${amount}" is explained`);
    }
    assert.deepEqual(writes(), []);
  });

  it("the amount's currency is the chosen account's, and the review and the result say so", async () => {
    await openEntry("expense");
    await change(field("account_id"), "2");
    assert.match(text(q("[data-sm-field='amount']")), /USD/);
    await change(field("category_id"), "5");
    await change(field("amount"), "20");
    await submit(q("form.sm-draft-form"));
    assert.match(text(q("[data-sm-step='review']")), /USD/);
    await click(action("send"));
    await settle();
    assert.equal(writes()[0].body.account_id, 2);
    assert.match(text(q("[data-sm-result-amount]")), /\$20\.00|USD/);
    assert.match(text(q("[data-sm-balance-now='account']")), /480\.00/);
  });

  it("insufficient balance is refused by the server, with its words; nothing moves and the key is let go", async () => {
    await openEntry("expense");
    await fillExpense({ amount: "5000" });
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.equal(outcome.getAttribute("role"), "alert");
    assert.match(text(outcome), /Insufficient balance in account \[Wallet\]/);
    assert.equal(q("[data-sm-transaction-result]"), null);
    assert.equal(server.accounts[0].current_balance, "1000.0000");
    assert.deepEqual(pendingKeys(), [], "a certain refusal leaves no key to reuse");
    assert.equal(action("send").disabled, false, "it may be changed and sent again");
  });

  it("an account that allows a negative balance is the server's call: it records the expense", async () => {
    await openEntry("expense");
    await fillExpense({ account: "5", amount: "100" });
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-transaction-result]"));
    assert.equal(server.accounts[4].current_balance, "-90.0000");
  });

  it("the server's refusals are shown as refusals: a goal's account, an archived one, an income category, an inactive category (422)", async () => {
    server = entryServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.expense] });
    gate.setWriteApprovalsForTests([OPERATIONS.expense]);
    const cases = [
      [{ account_id: 4, category_id: 4 }, /savings goal account/],
      [{ account_id: 3, category_id: 4 }, /archived/],
      [{ account_id: 1, category_id: 6 }, /not an expense category/],
      [{ account_id: 1, category_id: 7 }, /inactive/],
    ];
    for (const [input, message] of cases) {
      const error = await sendWorkflowWrite({ operation: OPERATIONS.expense, input: { ...input, amount: "10.0000" } }, `mobile-expense-refuse-${input.account_id}${input.category_id}-abcdefgh`).then(() => null, (failure) => failure);
      assert.equal(error.status, 422);
      assert.match(error.message, message);
      assert.equal(classifyWriteOutcome(error).kind, "rejected");
    }
    assert.equal(server.transactions.length, 0);
  });

  it("a double tap sends one request, and nothing is claimed before the answer", async () => {
    let release;
    await openEntry("expense", { onPost: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await fillExpense();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    assert.equal(action("send").disabled, true);
    assert.equal(action("send").getAttribute("aria-busy"), "true");
    assert.equal(q("[data-sm-outcome]"), null);
    assert.equal(q("[data-sm-transaction-result]"), null, "no success before the server answers");
    await act(async () => release());
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(server.transactions.length, 1);
    assert.ok(q("[data-sm-transaction-result]"));
  });

  it("after a lost answer the key is kept; after a reload the same entry replays the first transaction and the balance moves once", async () => {
    let first = true;
    // The server records the first expense, then the answer is lost (the network drops it).
    await openEntry("expense", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await fillExpense();
    await click(action("send"));
    await settle();

    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-transaction-result]"), null, "nothing is claimed");
    assert.equal(action("send"), null, "this form sends nothing more by itself");
    assert.equal(writes().length, 1, "never retried automatically");
    assert.equal(server.transactions.length, 1, "the server did record it");
    const firstKey = writes()[0].headers["Idempotency-Key"];
    assert.equal(pendingKeys().length, 1, "the key survives for a deliberate retry");

    // The person comes back (a reload) and enters the same expense again.
    await view.unmount();
    const shared = server;
    view = await mountMobile({ entry: "/m/add/expense" });
    server = shared;
    await fillExpense();
    await click(action("send"));
    await settle();

    assert.equal(writes().length, 2);
    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey, "the same key");
    assert.equal(server.transactions.length, 1, "replayed, not posted twice");
    assert.equal(server.accounts[0].current_balance, "850.0000");
    assert.equal(q("[data-sm-transaction-result]").dataset.smTransactionResult, "701", "the first transaction, as the server replays it");
    assert.deepEqual(pendingKeys(), [], "confirmed: the key is released");
  });

  it("a different expense after a reload gets its own key; the same key with different data is a 409 and an unknown outcome", async () => {
    server = entryServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.expense] });
    gate.setWriteApprovalsForTests([OPERATIONS.expense]);
    const key = "mobile-expense-samekey-1234";
    await sendWorkflowWrite({ operation: OPERATIONS.expense, input: { account_id: 1, category_id: 4, amount: "10.0000" } }, key);
    const error = await sendWorkflowWrite({ operation: OPERATIONS.expense, input: { account_id: 1, category_id: 4, amount: "20.0000" } }, key).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(classifyWriteOutcome(error).kind, "unknown", "the client can't tell this 409 apart: it claims nothing");
    assert.equal(server.transactions.length, 1, "the different request moved nothing");
    assert.equal(server.accounts[0].current_balance, "990.0000");
    api.restore();

    // Through the screen: an unknown outcome, then a reload and a DIFFERENT amount, mints a new key.
    let lose = true;
    await openEntry("expense", { afterApply: (answer) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : answer) });
    await fillExpense({ amount: "40" });
    await click(action("send"));
    await settle();
    const firstKey = writes()[0].headers["Idempotency-Key"];
    await view.unmount();
    view = await mountMobile({ entry: "/m/add/expense" });
    await fillExpense({ amount: "45" });
    await click(action("send"));
    await settle();
    assert.notEqual(writes()[1].headers["Idempotency-Key"], firstKey, "a different entry is a different intent");
  });

  it("a 409 while the first request is still processing is an unknown outcome, and the key is kept", async () => {
    await openEntry("expense", { onPost: () => ({ status: 409, body: { status: false, message: "This operation is currently being processed." } }) });
    await fillExpense();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(pendingKeys().length, 1);
    assert.equal(q("[data-sm-transaction-result]"), null);
  });

  it("a timeout, a dropped connection and a 5xx are unknown outcomes, never failures", async () => {
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "TIMEOUT" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "NETWORK_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR" })).kind, "unknown");

    // Through the screen: a 504 keeps the key and claims nothing; the form sends nothing more.
    await openEntry("expense", { onPost: () => ({ status: 504, body: { status: false, message: "Gateway Timeout" } }) });
    await fillExpense();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(pendingKeys().length, 1);
    assert.equal(action("send"), null);
    assert.equal(writes().length, 1);
  });

  it("a 2xx that isn't provably this expense is acknowledged generically, with no figures", async () => {
    const wrong = (over) => ({ status: 201, body: envelope({ transaction: { id: 77, type: "expense", category_id: 4, amount: "150.0000", currency_code: "ILS", status: "posted", ledger_entries: [{ account_id: 1 }], ...over } }) });
    for (const over of [{ amount: "15.0000" }, { type: "income" }, { ledger_entries: [{ account_id: 2 }] }, { category_id: 5 }, { id: null }]) {
      await openEntry("expense", { onPost: () => wrong(over) });
      await fillExpense();
      await click(action("send"));
      await settle();
      assert.equal(q("[data-sm-transaction-result]"), null, JSON.stringify(over));
      assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
      assert.match(text(q("[data-sm-outcome]")), /Recorded/);
      await view.unmount();
      view = null;
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("with amounts hidden the result masks the amount", async () => {
    // The full app's own device preference (Display preferences), which Mobile follows.
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await openEntry("expense");
    await fillExpense({ amount: "150" });
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-transaction-result]"));
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
    assert.doesNotMatch(text(q("[data-sm-result-amount]")), /150/);
    assert.doesNotMatch(text(q("[data-sm-balance-now='account']")), /850/);
  });

  it("speaks Arabic", async () => {
    await openEntry("expense", {}, { language: "ar" });
    await fillExpense({ description: null });
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-transaction-result]")), /تم تسجيل المصروف/);
    assert.match(text(q("[data-sm-transaction-result]")), /الرصيد الآن/);
  });
});

describe("a new income, with its write opened by the test switch", () => {
  const fillIncome = async ({ account: accountId = "1", category = "6", amount = "300", description = "March salary", reference = null } = {}) => {
    await change(field("account_id"), accountId);
    if (category !== null) await change(field("category_id"), category);
    await change(field("amount"), amount);
    if (description !== null) await change(field("description"), description);
    if (reference !== null) await change(field("reference_number"), reference);
    await submit(q("form.sm-draft-form"));
  };

  it("sends the backend's fields with one Idempotency-Key, then shows the server's transaction and the account balance read again", async () => {
    await openEntry("income");
    await fillIncome({ reference: "PAY-77" });
    assert.match(text(q("[data-sm-step='review']")), /Salary/);
    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.path, "/transactions/income");
    assert.match(call.headers["Idempotency-Key"], /^mobile-transaction-income-[A-Za-z0-9-]{8,}$/);
    const { occurred_at: occurredAt, ...rest } = call.body;
    assert.deepEqual(rest, { account_id: 1, category_id: 6, amount: "300.0000", description: "March salary", reference_number: "PAY-77" });
    assert.match(occurredAt, /^\d{4}-\d{2}-\d{2} 12:00:00$/);

    const result = q("[data-sm-transaction-result]");
    assert.equal(result.dataset.smResultType, "income");
    assert.match(text(result), /Income recorded/);
    assert.match(text(q("[data-sm-result-amount]")), /300\.00/);
    assert.match(text(q("[data-sm-result='category']")), /Salary/);
    assert.match(text(q("[data-sm-result='reference']")), /PAY-77/);
    assert.match(text(q("[data-sm-balance-now='account']")), /1,300\.00/);
    assert.deepEqual(pendingKeys(), []);
  });

  it("the category is optional for an income and is left out when none is chosen; only income categories are offered", async () => {
    await openEntry("income");
    assert.deepEqual(options("category_id"), ["", "6"]);
    assert.deepEqual(options("account_id"), ["", "1", "2", "5"]);
    await fillIncome({ category: null, description: null });
    await click(action("send"));
    await settle();
    assert.equal(Object.hasOwn(writes()[0].body, "category_id"), false);
    const result = q("[data-sm-transaction-result]");
    assert.ok(result);
    assert.equal(q("[data-sm-result='category']"), null, "no category, none shown");
  });

  it("an invalid or zero amount never reaches review or the server", async () => {
    await openEntry("income");
    for (const amount of ["0", "-1", "2.00001", "x", ""]) {
      await change(field("account_id"), "1");
      await change(field("amount"), amount);
      await submit(q("form.sm-draft-form"));
      assert.equal(q("[data-sm-step='review']"), null, `"${amount}" stays in edit`);
    }
    assert.deepEqual(writes(), []);
  });

  it("an income needs no balance: a large one on an account with a small balance is recorded", async () => {
    await openEntry("income");
    await fillIncome({ account: "5", amount: "99999" });
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-transaction-result]"));
    assert.equal(server.accounts[4].current_balance, "100009.0000");
  });

  it("a lost answer, then a reload and the same income: the same key, replayed, credited once", async () => {
    let first = true;
    await openEntry("income", { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await fillIncome();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(server.transactions.length, 1);
    const firstKey = writes()[0].headers["Idempotency-Key"];

    await view.unmount();
    const shared = server;
    view = await mountMobile({ entry: "/m/add/income" });
    server = shared;
    await fillIncome();
    await click(action("send"));
    await settle();

    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey);
    assert.equal(server.transactions.length, 1);
    assert.equal(server.accounts[0].current_balance, "1300.0000");
    assert.equal(q("[data-sm-transaction-result]").dataset.smTransactionResult, "701");
  });

  it("the same income key with a different amount is a 409 and claims nothing", async () => {
    server = entryServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.income] });
    gate.setWriteApprovalsForTests([OPERATIONS.income]);
    const key = "mobile-income-samekey-1234";
    await sendWorkflowWrite({ operation: OPERATIONS.income, input: { account_id: 1, category_id: 6, amount: "10.0000" } }, key);
    const error = await sendWorkflowWrite({ operation: OPERATIONS.income, input: { account_id: 1, category_id: 6, amount: "11.0000" } }, key).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(classifyWriteOutcome(error).kind, "unknown");
    assert.equal(server.transactions.length, 1);
  });

  it("the server's refusals are shown as refusals: a goal's account, an expense category (422)", async () => {
    server = entryServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.income] });
    gate.setWriteApprovalsForTests([OPERATIONS.income]);
    for (const [input, message] of [[{ account_id: 4, category_id: 6 }, /savings goal account/], [{ account_id: 1, category_id: 4 }, /not an income category/]]) {
      const error = await sendWorkflowWrite({ operation: OPERATIONS.income, input: { ...input, amount: "10.0000" } }, `mobile-income-refuse-${input.account_id}${input.category_id}-abcdefgh`).then(() => null, (failure) => failure);
      assert.equal(error.status, 422);
      assert.match(error.message, message);
      assert.equal(classifyWriteOutcome(error).kind, "rejected");
    }
    assert.equal(server.transactions.length, 0);
  });

  it("speaks Arabic", async () => {
    await openEntry("income", {}, { language: "ar" });
    await fillIncome({ description: null });
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-transaction-result]")), /تم تسجيل الدخل/);
  });
});

describe("what a transaction answer proves", () => {
  const input = { account_id: 1, category_id: 4, amount: "150.0000" };
  const answer = (over = {}) => ({ transaction: { id: 9, type: "expense", category_id: 4, amount: "150.0000", currency_code: "ILS", status: "posted", occurred_at: "2026-11-15T10:00:00.000000Z", category: { id: 4, name: "Food" }, ledger_entries: [{ account_id: 1, account: { id: 1, name: "Wallet", currency_code: "ILS" } }], ...over } });

  it("needs the id, the type, the account, the category and the amount that were sent", () => {
    const result = buildTransactionResult(answer(), input, "expense");
    assert.equal(result.id, "9");
    assert.equal(result.account.name, "Wallet");
    assert.equal(result.category.name, "Food");
    assert.equal(result.occurredAt, "2026-11-15");
    assert.equal(buildTransactionResult(answer({ amount: "15.0000" }), input, "expense"), null);
    assert.equal(buildTransactionResult(answer({ type: "income" }), input, "expense"), null);
    assert.equal(buildTransactionResult(answer(), input, "income"), null);
    assert.equal(buildTransactionResult(answer({ ledger_entries: [{ account_id: 2 }] }), input, "expense"), null);
    assert.equal(buildTransactionResult(answer({ category_id: 5, category: { id: 5, name: "x" } }), input, "expense"), null);
    assert.equal(buildTransactionResult(answer({ id: null }), input, "expense"), null);
    assert.equal(buildTransactionResult(answer({ currency_code: null, ledger_entries: [{ account_id: 1, account: { id: 1, currency_code: "USD" } }] }), input, "expense").currency, "USD");
    assert.equal(buildTransactionResult(answer({ currency_code: null, ledger_entries: [{ account_id: 1 }] }), input, "expense"), null, "no currency, no figure");
    assert.equal(buildTransactionResult({}, input, "expense"), null);
  });

  it("an income may have no category, and an equal amount written differently is the same amount", () => {
    const noCategory = answer({ type: "income", category_id: null, category: null, amount: "150.5000" });
    const result = buildTransactionResult(noCategory, { account_id: 1, amount: "150.50" }, "income");
    assert.equal(result.category, null);
    assert.equal(result.amount, "150.5000");
  });
});
