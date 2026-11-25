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
const { buildCorrectionResult, buildReversalResult } = await import("../src/mobile/models/transactionResult.js");
const { eligibleToCorrect, eligibleToReverse } = await import("../src/mobile/forms/workflows.js");

/*
 * Phase 2C: correcting and reversing a transaction from Mobile (PATCH /transactions/{id}, POST /transactions/{id}/reverse).
 *
 * A correction is NOT an edit: UpdateTransactionAction reverses the original and posts a replacement (a new id,
 * related_transaction_id = the original), in one DB transaction. It carries an Idempotency-Key (same key + same request
 * replays the replacement, a different request is a 409). A reversal (ReverseTransactionAction) carries no key: it is once-only
 * (a second one is a 409 "already reversed"), refuses debt money, a reversal and anything not posted, and refuses a reversal
 * that would overdraw an account that forbids a negative balance (422).
 *
 * Both writes are CLOSED in the product (APPROVED is empty): these tests open them only through the test runner's switch,
 * against a fake backend that follows those rules.
 */

after(() => dom.window.close());

const OPERATIONS = { correct: "transaction.correct", reverse: "transaction.reverse" };
let api;
let view;
let server;

const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");
const pendingKeys = () => Object.keys(window.localStorage).filter((key) => /pending/i.test(key));
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
const refuse = (message, status = 422) => ({ status, body: { status: false, message, errors: {} } });

/* A backend with balances, transactions, ledger legs and an idempotency table, answering the way TransactionController does. */
function changeServer({ onWrite, afterApply, walletBalance = "1000.0000" } = {}) {
  const accounts = [
    account({ id: 1, name: "Wallet", currency_code: "ILS", current_balance: walletBalance }),
    account({ id: 2, name: "Dollar account", type: "bank", currency_code: "USD", current_balance: "500.0000" }),
    account({ id: 5, name: "Second wallet", currency_code: "ILS", current_balance: "300.0000" }),
  ];
  const categories = [
    { id: 4, name: "Food", type: "expense", is_system: false, is_active: true },
    { id: 5, name: "Transport", type: "expense", is_system: false, is_active: true },
    { id: 6, name: "Salary", type: "income", is_system: false, is_active: true },
  ];
  const owner = (id) => accounts.find((row) => row.id === id);
  const sign = (type) => (type === "income" ? 1n : -1n);
  let nextId = 700;

  const make = (over) => {
    const { accountId = 1, categoryId = null, ...rest } = over;
    const holder = owner(accountId);
    const category = categories.find((row) => row.id === categoryId);
    return {
      id: 0,
      workspace_id: 1,
      transfer_id: null,
      category_id: categoryId,
      reversal_of_id: null,
      related_transaction_id: null,
      type: "expense",
      status: "posted",
      amount: "100.0000",
      currency_code: holder.currency_code,
      source: "manual",
      description: null,
      reference_number: null,
      occurred_at: "2026-11-10T10:00:00.000000Z",
      posted_at: "2026-11-10T10:00:01.000000Z",
      reversed_at: null,
      reversal_reason: null,
      category: category ? { id: category.id, name: category.name, type: category.type } : null,
      ...rest,
      ledger_entries: [{ id: rest.id * 10, account_id: holder.id, signed_amount: fromMinor(sign(rest.type ?? "expense") * toMinor(rest.amount ?? "100.0000")), currency_code: holder.currency_code, entry_role: rest.type ?? "expense", account: { id: holder.id, name: holder.name, currency_code: holder.currency_code } }],
    };
  };

  const transactions = [
    make({ id: 31, type: "expense", amount: "100.0000", categoryId: 4, description: "Lunch" }),
    make({ id: 32, type: "income", amount: "500.0000", categoryId: 6, description: "Salary" }),
    make({ id: 33, type: "expense", amount: "40.0000", categoryId: 4, status: "reversed", reversed_at: "2026-11-11T10:00:00.000000Z", reversal_reason: "Duplicate" }),
    make({ id: 34, type: "expense", amount: "60.0000", categoryId: 4, source: "statement_import", description: "CARD 1234" }),
    make({ id: 35, type: "debt_payment", amount: "70.0000" }),
    make({ id: 36, type: "transfer", amount: "80.0000", transfer_id: 9 }),
    make({ id: 37, type: "reversal", amount: "40.0000", reversal_of_id: 33 }),
  ];
  const find = (id) => transactions.find((row) => row.id === Number(id));
  const keys = new Map();
  const log = { corrections: [], reversals: [] };

  const balanceAfterReversing = (original) => toMinor(owner(Number(original.ledger_entries[0].account_id)).current_balance) - sign(original.type) * toMinor(original.amount);
  const reverseIt = (original, reason) => {
    const holder = owner(original.ledger_entries[0].account_id);
    holder.current_balance = fromMinor(balanceAfterReversing(original));
    original.status = "reversed";
    original.reversed_at = "2026-11-16T09:00:00.000000Z";
    original.reversal_reason = reason;
    const reversal = make({ id: ++nextId, type: "reversal", amount: original.amount, accountId: holder.id, reversal_of_id: original.id, categoryId: original.category_id, source: "system" });
    reversal.ledger_entries[0].signed_amount = fromMinor(-sign(original.type) * toMinor(original.amount));
    reversal.ledger_entries[0].entry_role = "reversal";
    transactions.push(reversal);
    return reversal;
  };
  const overdraws = (original) => {
    const holder = owner(original.ledger_entries[0].account_id);
    return !holder.allow_negative_balance && balanceAfterReversing(original) < 0n;
  };

  const correct = (call) => {
    const key = call.headers["Idempotency-Key"];
    const id = Number(call.path.split("/")[2]);
    if (!key) return refuse("The provided data is invalid.");
    const body = call.body ?? {};
    const hash = JSON.stringify({ id, body });
    const known = keys.get(key);
    if (known) return known.hash === hash ? { status: 200, body: envelope({ transaction: known.replacement }) } : refuse("The idempotency key was previously used with different request data.", 409);
    const original = find(id);
    if (!original) return refuse("Not found", 404);
    if (typeof body.reason !== "string" || body.reason.length < 3) return refuse("The reason field must be at least 3 characters.");
    if (original.status === "reversed") return refuse("This transaction has already been reversed.", 409);
    if (original.status !== "posted") return refuse("Only posted transactions can be reversed.");
    if (!["income", "expense"].includes(original.type)) return refuse("Only income and expense transactions can be updated.");
    if (original.transfer_id !== null) return refuse("Transfer transactions cannot be updated using the transaction update endpoint.");
    const target = owner(body.account_id ?? original.ledger_entries[0].account_id);
    if (!target) return refuse("The selected account is invalid.");
    if (target.currency_code !== original.currency_code) return refuse(`Account currency is ${target.currency_code}, while operation currency is ${original.currency_code}.`);
    const categoryId = Object.hasOwn(body, "category_id") ? body.category_id : original.category_id;
    const category = categories.find((row) => row.id === categoryId);
    if (original.type === "expense" && !category) return refuse("An expense transaction requires a category.");
    if (category && category.type !== original.type) return refuse(`The selected category is not an ${original.type} category.`);
    const amount = body.amount ?? original.amount;
    if (overdraws(original)) return refuse("Insufficient balance: the original cannot be taken back.");

    // Reverse the original, then post the replacement, as one unit: a refusal leaves everything as it was.
    const snapshot = accounts.map((row) => row.current_balance);
    const first = owner(original.ledger_entries[0].account_id);
    first.current_balance = fromMinor(balanceAfterReversing(original));
    if (original.type === "expense" && !target.allow_negative_balance && toMinor(target.current_balance) < toMinor(amount)) {
      accounts.forEach((row, index) => { row.current_balance = snapshot[index]; });
      return refuse(`Insufficient balance in account [${target.name}]. Required: ${amount} ${target.currency_code}, available: ${target.current_balance} ${target.currency_code}.`);
    }
    first.current_balance = snapshot[accounts.indexOf(first)];
    reverseIt(original, body.reason);
    target.current_balance = fromMinor(toMinor(target.current_balance) + sign(original.type) * toMinor(amount));
    const replacement = make({
      id: ++nextId,
      type: original.type,
      amount: fixed(amount),
      accountId: target.id,
      categoryId: categoryId ?? null,
      related_transaction_id: original.id,
      description: Object.hasOwn(body, "description") ? body.description : original.description,
      reference_number: Object.hasOwn(body, "reference_number") ? body.reference_number : original.reference_number,
      occurred_at: body.occurred_at ? `${body.occurred_at.slice(0, 10)}T10:00:00.000000Z` : original.occurred_at,
    });
    transactions.push(replacement);
    keys.set(key, { hash, replacement });
    log.corrections.push({ original: original.id, replacement: replacement.id });
    return { status: 200, body: envelope({ transaction: replacement }) };
  };

  const reverse = (call) => {
    const id = Number(call.path.split("/")[2]);
    const body = call.body ?? {};
    const original = find(id);
    if (!original) return refuse("Not found", 404);
    if (typeof body.reason !== "string" || body.reason.length < 3) return refuse("The reason field must be at least 3 characters.");
    if (original.type === "reversal") return refuse("A reversal transaction cannot be reversed.");
    if (original.status === "reversed") return refuse("This transaction has already been reversed.", 409);
    if (original.status !== "posted") return refuse("Only posted transactions can be reversed.");
    if (original.type.startsWith("debt_")) return { status: 409, body: { status: false, message: "This transaction is a debt payment. Reverse it through the debt payment instead.", code: "debt_transaction_requires_domain_reversal" } };
    if (overdraws(original)) return refuse(`Insufficient balance in account [${owner(original.ledger_entries[0].account_id).name}].`);
    const reversal = reverseIt(original, body.reason);
    log.reversals.push(original.id);
    return { status: 200, body: envelope({ original_transaction: { ...original, ledger_entries: undefined, category: undefined }, reversals: [reversal] }) };
  };

  const handler = (call) => {
    if (call.method === "GET") {
      if (call.path === "/accounts") return { body: envelope({ accounts }) };
      if (call.path === "/categories") return { body: envelope({ categories }) };
      const one = /^\/accounts\/(\d+)$/.exec(call.path);
      if (one) {
        const found = accounts.find((row) => String(row.id) === one[1]);
        return found ? { body: envelope({ account: found }) } : refuse("Not found", 404);
      }
      const tx = /^\/transactions\/(\d+)$/.exec(call.path);
      if (tx) return find(tx[1]) ? { body: envelope({ transaction: find(tx[1]) }) } : refuse("Not found", 404);
      return refuse("Not found", 404);
    }
    const write = call.method === "PATCH" ? correct : /\/reverse$/.test(call.path) ? reverse : null;
    if (!write) return refuse("Not found", 404);
    if (onWrite) return onWrite(call, () => write(call));
    const answer = write(call);
    return afterApply ? afterApply(answer, call) : answer;
  };
  return { handler, accounts, transactions, keys, log, find };
}

async function open(kind, id, serverOptions = {}, { approve = [OPERATIONS[kind]], language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = serverOptions.server ?? changeServer(serverOptions);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES[kind]] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: `/m/activity/${id}/${kind === "correct" ? "correct" : "reverse"}` });
}

const reloadAt = async (kind, id) => {
  await view.unmount();
  const shared = server;
  view = await mountMobile({ entry: `/m/activity/${id}/${kind}` });
  server = shared;
};

async function correctWith({ amount = "120", description, date, category, account: accountId, reason = "Wrong amount" } = {}) {
  if (accountId !== undefined) await change(field("account_id"), accountId);
  if (category !== undefined) await change(field("category_id"), category);
  if (amount !== null) await change(field("amount"), amount);
  if (description !== undefined) await change(field("description"), description);
  if (date !== undefined) await change(field("occurred_at"), date);
  await change(field("reason"), reason);
  await submit(q("form.sm-draft-form"));
}

const reverseWith = async (reason = "Entered twice") => {
  await change(field("reason"), reason);
  await submit(q("form.sm-draft-form"));
};

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
  it("correct is key-fix-pending and reverse is once-only, both money writes, both closed", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES["transaction.correct"] }, { endpoint: "PATCH /transactions/{id}", moves: true, key: "client", serverDedup: "key-fix-pending" });
    assert.deepEqual({ ...gate.MOBILE_WRITES["transaction.reverse"] }, { endpoint: "POST /transactions/{id}/reverse", moves: true, key: "none", serverDedup: "once-only" });
    assert.equal(gate.isWriteOpen("transaction.correct"), false);
    assert.equal(gate.isWriteOpen("transaction.reverse"), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the sender refuses without a request while closed; correct also refuses without a key when open", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [FORM_WRITES.correct, FORM_WRITES.reverse] });
    const correct = { operation: OPERATIONS.correct, ids: { transactionId: "31" }, input: { reason: "Wrong amount", amount: "1.0000" } };
    const reverse = { operation: OPERATIONS.reverse, ids: { transactionId: "31" }, input: { reason: "Entered twice" } };
    assert.throws(() => sendWorkflowWrite(correct, "mobile-correct-12345678"), (error) => error.name === "WriteClosedError");
    assert.throws(() => sendWorkflowWrite(reverse), (error) => error.name === "WriteClosedError");
    gate.setWriteApprovalsForTests([OPERATIONS.correct]);
    assert.throws(() => sendWorkflowWrite(correct), /needs an Idempotency-Key/);
    assert.deepEqual(api.calls, []);
  });
});

describe("gate closed (the product)", () => {
  it("a correction can be filled in and reviewed, with what each detail was, but Confirm is disabled and nothing is sent", async () => {
    await open("correct", 31, {}, { approve: null });
    await correctWith({ amount: "120", description: "" });
    assert.ok(q("[data-sm-step='review']"));
    assert.equal(action("send").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='transaction.correct']"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes(), []);
  });

  it("a reversal can be reviewed, but Confirm is disabled and nothing is sent", async () => {
    await open("reverse", 31, {}, { approve: null });
    await reverseWith();
    assert.ok(q("[data-sm-step='review']"));
    assert.equal(action("send").disabled, true);
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='transaction.reverse']"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes(), []);
  });
});

describe("who can be corrected or reversed", () => {
  const reasonOf = () => q("[data-sm-note='ineligible']")?.dataset.smReason;

  it("an already reversed transaction, a reversal, a transfer's leg: neither action is offered", async () => {
    for (const [id, correct, reverse] of [[33, "notCorrectable", "notReversible"], [37, "notCorrectable", "notReversible"], [36, "notCorrectable", "notReversible"]]) {
      await open("correct", id);
      assert.equal(reasonOf(), correct, `#${id} correct`);
      assert.equal(q("form.sm-draft-form"), null);
      await view.unmount();
      api.restore();
      await open("reverse", id);
      assert.equal(reasonOf(), reverse, `#${id} reverse`);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
  });

  it("an imported transaction is not corrected from Mobile, but it may be reversed", async () => {
    await open("correct", 34);
    assert.equal(reasonOf(), "importedCorrection");
    assert.equal(q("form.sm-draft-form"), null);
    await view.unmount();
    api.restore();
    await open("reverse", 34);
    assert.equal(reasonOf(), undefined);
    assert.ok(q("form.sm-draft-form"));
  });

  it("a debt's money is reversed through the debt, never here", async () => {
    await open("reverse", 35);
    assert.equal(reasonOf(), "debtMoney");
    assert.equal(q("form.sm-draft-form"), null);
  });

  it("an invalid id reaches no form and sends nothing", async () => {
    for (const id of ["abc", "0", "-3", "9999999999999999999999"]) {
      await open("correct", id);
      assert.equal(q("form.sm-draft-form"), null, id);
      await view.unmount();
      api.restore();
    }
    assert.deepEqual(writes(), []);
    assert.equal(api.calls.length, 0);
  });

  it("the rules are one function the page and the form share", () => {
    const plain = { status: "posted", type: "expense", isReversal: false, isTransfer: false, isImported: false, isDebtMoney: false };
    assert.equal(eligibleToCorrect(plain), null);
    assert.equal(eligibleToReverse(plain), null);
    assert.equal(eligibleToCorrect({ ...plain, isImported: true }), "importedCorrection");
    assert.equal(eligibleToReverse({ ...plain, isImported: true }), null);
    assert.equal(eligibleToReverse({ ...plain, isDebtMoney: true }), "debtMoney");
    assert.equal(eligibleToCorrect({ ...plain, type: "adjustment" }), "notCorrectable");
    assert.equal(eligibleToReverse({ ...plain, type: "adjustment" }), null);
    assert.equal(eligibleToReverse({ ...plain, status: "reversed" }), "notReversible");
  });

  it("the transaction page offers only what applies", async () => {
    for (const [id, expected] of [[31, "transaction-correct transaction-reverse"], [34, "transaction-reverse"], [35, null], [33, null], [36, null]]) {
      api?.restore();
      server = changeServer();
      api = installFakeApi(server.handler);
      view = await mountMobile({ entry: `/m/activity/${id}` });
      assert.equal(q("[data-sm-draft-links]")?.dataset.smDraftLinks ?? null, expected, `#${id}`);
      await view.unmount();
      view = null;
    }
  });
});

describe("a correction, with its write opened by the test switch", () => {
  it("loads the transaction as it is, and offers only same-currency accounts and expense categories", async () => {
    await open("correct", 31);
    assert.equal(field("amount").value, "100");
    assert.equal(field("account_id").value, "1");
    assert.equal(field("category_id").value, "4");
    assert.equal(field("description").value, "Lunch");
    assert.equal(field("occurred_at").value, "2026-11-10");
    assert.deepEqual(options("account_id"), ["", "1", "5"], "the dollar account would change the currency");
    assert.deepEqual(options("category_id"), ["", "4", "5"]);
  });

  it("reviews the original beside the proposed values, then sends the reason and only what changed with one key", async () => {
    await open("correct", 31);
    await correctWith({ amount: "120", description: "", date: "2026-11-12" });
    const review = q("[data-sm-step='review']");
    assert.match(text(q("[data-sm-field='amount']", review)), /120/);
    assert.match(text(q("[data-sm-was='amount']", review)), /Was:.*100/);
    assert.match(text(q("[data-sm-was='description']", review)), /Was:.*Lunch/);
    assert.match(text(q("[data-sm-field='description']", review)), /Not set/, "a cleared detail is listed, not hidden");
    assert.ok(q("[data-sm-was='occurred_at']", review));
    assert.equal(q("[data-sm-was='category_id']", review), null, "an unchanged detail has no 'was'");
    assert.match(text(review), /reversed and a replacement recorded/);

    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "PATCH");
    assert.equal(call.path, "/transactions/31");
    assert.match(call.headers["Idempotency-Key"], /^mobile-transaction-correct-[A-Za-z0-9-]{8,}$/);
    assert.deepEqual(call.body, { reason: "Wrong amount", amount: "120.0000", description: null, occurred_at: "2026-11-12 12:00:00" });
    assert.equal(Object.hasOwn(call.body, "account_id"), false);
    assert.equal(Object.hasOwn(call.body, "currency_code"), false);
  });

  it("shows the server's replacement, the original's status read again, and the balance after the correction", async () => {
    await open("correct", 31);
    await correctWith({ amount: "120" });
    await click(action("send"));
    await settle();

    const result = q("[data-sm-transaction-result]");
    assert.ok(result, "the replacement's own result");
    assert.equal(result.dataset.smTransactionResult, "702", "a NEW transaction, not the original's id");
    assert.equal(result.dataset.smReplaces, "31");
    assert.match(text(result), /Correction recorded/);
    assert.match(text(q("[data-sm-result-amount]")), /120\.00/);
    assert.match(text(q("[data-sm-result='account']")), /Wallet/);
    assert.match(text(q("[data-sm-result='category']")), /Food/);
    assert.equal(action("open-transaction").getAttribute("href"), "/m/activity/702");
    assert.equal(action("open-original").getAttribute("href"), "/m/activity/31");

    // The original is read again and is reversed on the server; the balance is the server's (1000 + 100 - 120), not worked out here.
    assert.equal(q("[data-sm-transaction-now='original']").dataset.smStatusNow, "reversed");
    assert.match(text(q("[data-sm-balance-now='account']")), /980\.00/);
    const reads = api.calls.filter((item) => item.method === "GET" && /^\/(accounts|transactions)\/\d+$/.test(item.path));
    assert.ok(api.calls.indexOf(reads.find((item) => item.path === "/transactions/31" && api.calls.indexOf(item) > api.calls.indexOf(writes()[0]))) > api.calls.indexOf(writes()[0]), "after the write");
    assert.equal(server.log.corrections.length, 1);
    assert.deepEqual(pendingKeys(), [], "nothing left to protect after a confirmed correction");
  });

  it("moving it to another account shows both balances as the server reads them", async () => {
    await open("correct", 31);
    await correctWith({ amount: null, account: "5" });
    await click(action("send"));
    await settle();
    assert.deepEqual(writes()[0].body, { reason: "Wrong amount", account_id: 5 });
    assert.match(text(q("[data-sm-balance-now='account']")), /200\.00/, "the second wallet paid it");
    assert.match(text(q("[data-sm-balance-now='previous']")), /1,100\.00/, "the first one got it back");
  });

  it("an income correction may clear its category (null) and is recorded as an income", async () => {
    await open("correct", 32);
    await correctWith({ amount: "450", category: "" });
    await click(action("send"));
    await settle();
    assert.deepEqual(writes()[0].body, { reason: "Wrong amount", amount: "450.0000", category_id: null });
    assert.equal(q("[data-sm-transaction-result]").dataset.smResultType, "income");
    assert.match(text(q("[data-sm-balance-now='account']")), /950\.00/);
  });

  it("nothing changed, a short reason, a zero, negative or over-precise amount, a missing expense category: none reach review or the server", async () => {
    await open("correct", 31);
    await change(field("reason"), "Wrong amount");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null, "no change");
    assert.ok(q("[data-sm-summary='local']"));
    for (const amount of ["0", "-5", "1.23456", "abc", ""]) {
      await change(field("amount"), amount);
      await change(field("reason"), "Wrong amount");
      await submit(q("form.sm-draft-form"));
      assert.equal(q("[data-sm-step='review']"), null, `"${amount}"`);
    }
    await change(field("amount"), "120");
    await change(field("reason"), "no");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null, "a two-character reason");
    await change(field("reason"), "Wrong amount");
    await change(field("category_id"), "");
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-step='review']"), null, "an expense needs a category");
    assert.deepEqual(writes(), []);
  });

  it("the server's refusal (insufficient balance for the replacement) is shown; the original stays posted and the key is let go", async () => {
    await open("correct", 31);
    await correctWith({ amount: "5000" });
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.match(text(outcome), /Insufficient balance in account \[Wallet\]/);
    assert.equal(q("[data-sm-transaction-result]"), null);
    assert.equal(server.find(31).status, "posted");
    assert.equal(server.accounts[0].current_balance, "1000.0000");
    assert.deepEqual(pendingKeys(), []);
    assert.equal(action("send").disabled, false);
  });

  it("a double tap sends one request and claims nothing before the answer", async () => {
    let release;
    await open("correct", 31, { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await correctWith();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    assert.equal(action("send").disabled, true);
    assert.equal(q("[data-sm-outcome]"), null);
    assert.equal(q("[data-sm-transaction-result]"), null, "no success before the server answers");
    await act(async () => release());
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(server.log.corrections.length, 1);
    assert.ok(q("[data-sm-transaction-result]"));
  });

  it("a lost answer after the server corrected it: the key is kept, nothing is claimed, and a reload shows it is already reversed (no second correction)", async () => {
    let first = true;
    await open("correct", 31, { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await correctWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-transaction-result]"), null);
    assert.equal(action("send"), null, "this form sends nothing more by itself");
    assert.equal(writes().length, 1, "never retried automatically");
    assert.equal(server.log.corrections.length, 1, "the server did correct it");
    assert.equal(pendingKeys().length, 1, "the key survives");

    await reloadAt("correct", 31);
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "notCorrectable", "the original is reversed now: the form is not offered again");
    assert.equal(writes().length, 1);
    assert.equal(server.log.corrections.length, 1);
    assert.equal(server.accounts[0].current_balance, "980.0000");
  });

  it("a lost request the server never saw: after a reload the same correction reuses the same key and is recorded once", async () => {
    let lose = true;
    await open("correct", 31, { onWrite: (call, apply) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : apply()) });
    await correctWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(server.log.corrections.length, 0);
    const firstKey = writes()[0].headers["Idempotency-Key"];

    await reloadAt("correct", 31);
    await correctWith();
    await click(action("send"));
    await settle();
    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey, "the same key");
    assert.equal(server.log.corrections.length, 1);
    assert.ok(q("[data-sm-transaction-result]"));
    assert.deepEqual(pendingKeys(), []);
  });

  it("a different correction after a reload gets its own key", async () => {
    let lose = true;
    await open("correct", 31, { onWrite: (call, apply) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : apply()) });
    await correctWith({ amount: "120" });
    await click(action("send"));
    await settle();
    const firstKey = writes()[0].headers["Idempotency-Key"];
    await reloadAt("correct", 31);
    await correctWith({ amount: "130" });
    await click(action("send"));
    await settle();
    assert.notEqual(writes()[1].headers["Idempotency-Key"], firstKey);
  });

  it("the same key and request replays the first replacement; the same key with a different request is a 409 and an unknown outcome", async () => {
    server = changeServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.correct] });
    gate.setWriteApprovalsForTests([OPERATIONS.correct]);
    const key = "mobile-transaction-correct-samekey-1234";
    const write = (amount) => ({ operation: OPERATIONS.correct, ids: { transactionId: "31" }, input: { reason: "Wrong amount", amount } });
    const first = await sendWorkflowWrite(write("120.0000"), key);
    const replay = await sendWorkflowWrite(write("120.0000"), key);
    assert.equal(replay.data.transaction.id, first.data.transaction.id, "replayed, not corrected twice");
    assert.equal(server.log.corrections.length, 1);
    const error = await sendWorkflowWrite(write("130.0000"), key).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(classifyWriteOutcome(error).kind, "unknown");
    assert.equal(server.log.corrections.length, 1);
    assert.equal(server.accounts[0].current_balance, "980.0000");
  });

  it("a 409 while processing, a timeout and a 504 are unknown outcomes and keep the key", async () => {
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "TIMEOUT" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "NETWORK_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR" })).kind, "unknown");
    await open("correct", 31, { onWrite: () => refuse("This operation is currently being processed.", 409) });
    await correctWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(pendingKeys().length, 1);
    await view.unmount();
    api.restore();
    window.localStorage.clear();
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    await open("correct", 31, { onWrite: () => ({ status: 504, body: { status: false, message: "Gateway Timeout" } }) });
    await correctWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(action("send"), null);
  });

  it("a 2xx that isn't provably the replacement of this transaction is acknowledged generically, with no figures", async () => {
    const wrong = (over) => ({ status: 200, body: envelope({ transaction: { id: 99, type: "expense", category_id: 4, amount: "120.0000", currency_code: "ILS", status: "posted", related_transaction_id: 31, ledger_entries: [{ account_id: 1 }], ...over } }) });
    for (const over of [{ related_transaction_id: 5 }, { id: 31 }, { amount: "12.0000" }, { type: "income" }, { ledger_entries: [{ account_id: 5 }] }]) {
      await open("correct", 31, { onWrite: () => wrong(over) });
      await correctWith();
      await click(action("send"));
      await settle();
      assert.equal(q("[data-sm-transaction-result]"), null, JSON.stringify(over));
      assert.match(text(q("[data-sm-outcome]")), /Recorded/);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("with amounts hidden the result masks them", async () => {
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await open("correct", 31);
    await correctWith({ amount: "120" });
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
    assert.doesNotMatch(text(q("[data-sm-transaction-result]")), /120|980/);
  });

  it("speaks Arabic", async () => {
    await open("correct", 31, {}, { language: "ar" });
    await correctWith({ amount: "120" });
    assert.match(text(q("[data-sm-was='amount']")), /كان/);
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-transaction-result]")), /تم تسجيل التصحيح/);
    assert.match(text(q("[data-sm-transaction-result]")), /الأرصدة الآن|الرصيد الآن/);
  });
});

describe("a reversal, with its write opened by the test switch", () => {
  it("explains what reversing means and shows the amount and the account before asking", async () => {
    await open("reverse", 31);
    assert.match(text(q("[data-sm-summary='record']")), /Wallet/);
    assert.match(text(q("[data-sm-summary='record']")), /100\.00/);
    await reverseWith();
    const review = q("[data-sm-step='review']");
    assert.match(text(q("[data-sm-effect='reverseEffect']", review)), /cancelled.*Nothing is deleted/);
    assert.match(text(review), /Entered twice/);
    assert.match(text(q("[data-sm-summary='record']", review)), /Wallet/);
  });

  it("sends only the reason, with no Idempotency-Key, then shows the server's reversal, the original's status and the balance read again", async () => {
    await open("reverse", 31);
    await reverseWith();
    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/transactions/31/reverse");
    assert.deepEqual(call.body, { reason: "Entered twice" });
    assert.equal(Object.hasOwn(call.headers, "Idempotency-Key"), false, "a reversal takes none: the server allows one reversal");

    const result = q("[data-sm-reversal-result]");
    assert.ok(result);
    assert.equal(result.dataset.smReversalResult, "31");
    assert.match(text(result), /Transaction reversed/);
    assert.match(text(q("[data-sm-result-amount]")), /100\.00/);
    assert.match(text(q("[data-sm-result='reason']")), /Entered twice/);
    assert.match(text(q("[data-sm-result='reversal']")), /#701/);
    assert.equal(q("[data-sm-transaction-now='original']").dataset.smStatusNow, "reversed", "read again from the server");
    assert.match(text(q("[data-sm-balance-now='1']")), /1,100\.00/, "the account got the money back, as the server reads it");
    assert.equal(action("open-transaction").getAttribute("href"), "/m/activity/31");
    assert.deepEqual(pendingKeys(), []);
    assert.equal(server.log.reversals.length, 1);
  });

  it("a reversal that would overdraw the account is refused by the server with its words, and nothing changes", async () => {
    await open("reverse", 32, { walletBalance: "300.0000" });
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "rejected");
    assert.match(text(q("[data-sm-outcome]")), /Insufficient balance in account \[Wallet\]/);
    assert.equal(server.find(32).status, "posted");
    assert.equal(server.accounts[0].current_balance, "300.0000");
    assert.equal(action("send").disabled, false);
  });

  it("a short reason never reaches review or the server", async () => {
    await open("reverse", 31);
    await reverseWith("no");
    assert.equal(q("[data-sm-step='review']"), null);
    await reverseWith("");
    assert.equal(q("[data-sm-step='review']"), null);
    assert.deepEqual(writes(), []);
  });

  it("a double tap sends one request", async () => {
    let release;
    await open("reverse", 31, { onWrite: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await reverseWith();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    assert.equal(q("[data-sm-reversal-result]"), null, "nothing is claimed before the answer");
    await act(async () => release());
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(server.log.reversals.length, 1);
  });

  it("a lost answer after the server reversed it: unknown, nothing claimed; the same request again is a 409 (reversed once) and still unknown", async () => {
    let first = true;
    await open("reverse", 31, { afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-reversal-result]"), null);
    assert.equal(action("send"), null);
    assert.equal(writes().length, 1);
    assert.equal(server.log.reversals.length, 1);

    // After a reload the transaction is read as reversed, so the form is not offered again; the money moved once.
    await reloadAt("reverse", 31);
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "notReversible");
    assert.equal(writes().length, 1);
    assert.equal(server.accounts[0].current_balance, "1100.0000");

    // The sender, if it were asked again, is refused by the server rather than reversing twice.
    const again = await sendWorkflowWrite({ operation: OPERATIONS.reverse, ids: { transactionId: "31" }, input: { reason: "Entered twice" } }).then(() => null, (failure) => failure);
    assert.equal(again.status, 409);
    assert.equal(classifyWriteOutcome(again).kind, "unknown");
    assert.equal(server.accounts[0].current_balance, "1100.0000");
    assert.equal(server.log.reversals.length, 1);
  });

  it("a lost request the server never saw: a reload and the same reversal is recorded once", async () => {
    let lose = true;
    await open("reverse", 31, { onWrite: (call, apply) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : apply()) });
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(server.log.reversals.length, 0);
    await reloadAt("reverse", 31);
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.equal(server.log.reversals.length, 1);
    assert.ok(q("[data-sm-reversal-result]"));
  });

  it("a 504 is an unknown outcome and a 409 is never read as success", async () => {
    await open("reverse", 31, { onWrite: () => refuse("This transaction has already been reversed.", 409) });
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-reversal-result]"), null);
  });

  it("a 2xx that isn't provably this reversal is acknowledged generically, with no figures", async () => {
    const answer = (original, reversals) => ({ status: 200, body: envelope({ original_transaction: original, reversals }) });
    const reversal = { id: 800, type: "reversal", reversal_of_id: 31, amount: "100.0000", currency_code: "ILS" };
    for (const body of [
      answer({ id: 31, status: "posted", amount: "100.0000", currency_code: "ILS" }, [reversal]),
      answer({ id: 32, status: "reversed", amount: "100.0000", currency_code: "ILS" }, [reversal]),
      answer({ id: 31, status: "reversed", amount: "100.0000", currency_code: "ILS" }, []),
      answer({ id: 31, status: "reversed", amount: "10.0000", currency_code: "ILS" }, [reversal]),
    ]) {
      await open("reverse", 31, { onWrite: () => body });
      await reverseWith();
      await click(action("send"));
      await settle();
      assert.equal(q("[data-sm-reversal-result]"), null);
      assert.match(text(q("[data-sm-outcome]")), /Recorded/);
      await view.unmount();
      api.restore();
      window.localStorage.clear();
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    }
  });

  it("with amounts hidden the result masks them", async () => {
    createExperienceStore({ userId: USER_A.id, workspaceId: 1, storage: window.localStorage, eventTarget: window }).update({ hiddenMoney: true });
    await open("reverse", 31);
    await reverseWith();
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-result-amount] .sm-money-hidden"));
    assert.doesNotMatch(text(q("[data-sm-reversal-result]")), /1,100|100\.00/);
  });

  it("speaks Arabic", async () => {
    await open("reverse", 31, {}, { language: "ar" });
    await reverseWith("أُدخلت مرتين");
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-reversal-result]")), /تم عكس المعاملة/);
    assert.match(text(q("[data-sm-reversal-result]")), /الأرصدة الآن/);
  });
});

describe("what the answers prove", () => {
  const record = { id: "31", type: "expense", currency: "ILS", amount: "100", accountId: "1", categoryId: "4" };
  const replacement = (over = {}) => ({ transaction: { id: 702, type: "expense", category_id: 4, amount: "120.0000", currency_code: "ILS", status: "posted", related_transaction_id: 31, occurred_at: "2026-11-10T10:00:00Z", category: { id: 4, name: "Food" }, ledger_entries: [{ account_id: 1, account: { id: 1, name: "Wallet", currency_code: "ILS" } }], ...over } });

  it("a correction's answer must be a NEW transaction that replaces this one, with what was asked for", () => {
    const input = { reason: "x y z", amount: "120.0000" };
    assert.equal(buildCorrectionResult(replacement(), input, record).replaces, "31");
    assert.equal(buildCorrectionResult(replacement({ id: 31 }), input, record), null, "the original's own id is not a replacement");
    assert.equal(buildCorrectionResult(replacement({ related_transaction_id: null }), input, record), null);
    assert.equal(buildCorrectionResult(replacement({ amount: "99.0000" }), input, record), null);
    assert.equal(buildCorrectionResult(replacement({ currency_code: "USD", ledger_entries: [{ account_id: 1, currency_code: "USD" }] }), input, record), null);
    assert.equal(buildCorrectionResult(replacement({ ledger_entries: [{ account_id: 5 }] }), input, record), null);
    assert.equal(buildCorrectionResult(replacement({ type: "income" }), input, record), null);
    // An unchanged amount is the original's; a cleared category must come back cleared.
    assert.equal(buildCorrectionResult(replacement({ amount: "100.0000" }), { reason: "x y z" }, record).amount, "100.0000");
    assert.equal(buildCorrectionResult(replacement({ type: "income", amount: "100.0000", category_id: null, category: null }), { reason: "x y z", category_id: null }, { ...record, type: "income", categoryId: "6" }).category, null);
    assert.equal(buildCorrectionResult(replacement({ category_id: 4 }), { reason: "x y z", category_id: null }, { ...record, type: "expense" }), null);
  });

  it("a reversal's answer must be this original, reversed, with a reversal entry of it and its amount", () => {
    const body = (over = {}) => ({ original_transaction: { id: 31, status: "reversed", type: "expense", amount: "100.0000", currency_code: "ILS", reversed_at: "2026-11-16T09:00:00Z", reversal_reason: "Entered twice" }, reversals: [{ id: 800, type: "reversal", reversal_of_id: 31, amount: "100.0000", currency_code: "ILS", ledger_entries: [{ account_id: 1, account: { id: 1, name: "Wallet" } }, { account_id: 1 }] }], ...over });
    const result = buildReversalResult(body(), record);
    assert.deepEqual(result.reversalIds, ["800"]);
    assert.deepEqual(result.accounts, [{ id: "1", name: "Wallet" }], "each affected account once");
    assert.equal(result.reason, "Entered twice");
    assert.equal(buildReversalResult({ ...body(), original_transaction: { ...body().original_transaction, id: 32 } }, record), null);
    assert.equal(buildReversalResult({ ...body(), original_transaction: { ...body().original_transaction, status: "posted" } }, record), null);
    assert.equal(buildReversalResult(body({ reversals: [] }), record), null);
    assert.equal(buildReversalResult(body({ reversals: [{ id: 800, type: "reversal", reversal_of_id: 99 }] }), record), null);
    assert.equal(buildReversalResult({ transaction_original: body().original_transaction, reversals: body().reversals }, record), null, "the backend's key is original_transaction");
    assert.equal(buildReversalResult({}, record), null);
  });
});
