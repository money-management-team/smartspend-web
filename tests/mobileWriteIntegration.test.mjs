import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, account, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite, SENDABLE_OPERATIONS } = await import("../src/mobile/data/writeApi.js");
const { buildWrite, wireAmount } = await import("../src/mobile/forms/writePayloads.js");
const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
const { WORKFLOWS } = await import("../src/mobile/forms/workflows.js");

/*
 * The forms' send path, prepared and closed (data/writeApi.js, forms/writePayloads.js,
 * forms/useWorkflowSubmit.js). Payloads are checked against the backend's FormRequests
 * (develop @ fd87531; fix/financial-idempotency-p0 @ c18d4ea changed no request).
 * The journeys open ONE write with the test switch and allow exactly its request in
 * the fake backend; the product's gate stays closed (tests/mobileWriteGate.test.mjs).
 * Fictional data only.
 */

after(() => dom.window.close());

const ACCOUNTS = [
  { id: "1", name: "Wallet", currency: "ILS", archived: false, isGoal: false },
  { id: "2", name: "Bank", currency: "ILS", archived: false, isGoal: false },
];
const CATEGORIES = [{ id: "4", name: "Food", type: "expense", active: true }, { id: "6", name: "Fees", type: "expense", active: true }];
const ctxFor = (extra = {}) => ({ today: "2026-11-01", accounts: ACCOUNTS, categories: CATEGORIES, workspaceId: 7, ...extra });
const build = (id, values, ctx = ctxFor()) => buildWrite(WORKFLOWS[id], { ...WORKFLOWS[id].initial(ctx), ...values }, ctx);

describe("what each form sends (exact backend fields)", () => {
  it("amounts go as the backend's MoneyAmount takes them, and nothing else is an amount", () => {
    assert.equal(wireAmount("12.5"), "12.5000");
    assert.equal(wireAmount("007.25"), "7.2500", "no leading zeros (MoneyAmount refuses them)");
    assert.equal(wireAmount("٣٠٫٧٥"), "30.7500", "Arabic digits");
    assert.equal(wireAmount("0"), "0.0000");
    for (const bad of ["", "1e3", "+5", "-5", "1.23456", "1,000"]) assert.equal(wireAmount(bad), null, bad);
  });

  it("an expense: numbers for ids, 4 decimals, the full version's occurred_at, empty optional fields left out", () => {
    assert.deepEqual(build("expense", { account_id: "2", category_id: "4", amount: "12.5", occurred_at: "2026-10-30", description: "  Lunch ", reference_number: "" }), {
      operation: "transaction.expense",
      ids: {},
      input: { account_id: 2, category_id: 4, amount: "12.5000", occurred_at: "2026-10-30 12:00:00", description: "Lunch" },
    });
    assert.deepEqual(build("income", { account_id: "1", category_id: "", amount: "100", occurred_at: "2026-11-01" }).input, { account_id: 1, amount: "100.0000", occurred_at: "2026-11-01 12:00:00" }, "income: the category is optional");
  });

  it("a transfer sends its fee fields only with a fee", () => {
    const base = { from_account_id: "1", to_account_id: "2", amount: "50", occurred_at: "2026-11-01" };
    assert.deepEqual(build("transfer", base).input, { from_account_id: 1, to_account_id: 2, amount: "50.0000", occurred_at: "2026-11-01 12:00:00" });
    assert.deepEqual(build("transfer", { ...base, fee_amount: "1.5", fee_category_id: "6", fee_description: "Bank fee" }).input, {
      from_account_id: 1, to_account_id: 2, amount: "50.0000", fee_amount: "1.5000", fee_category_id: 6, fee_description: "Bank fee", occurred_at: "2026-11-01 12:00:00",
    });
  });

  it("creates name their workspace where the backend asks for it; a budget's scope is never sent", () => {
    const general = build("budget", { name: "Food", scope: "general", category_id: "4", currency_code: "ILS", amount_limit: "800", period_start: "2026-11-01", period_end: "2026-11-30" });
    assert.deepEqual(general.input, { workspace_id: 7, name: "Food", currency_code: "ILS", amount_limit: "800.0000", period_start: "2026-11-01", period_end: "2026-11-30" }, "a general budget names no category");
    const one = build("budget", { name: "Food", scope: "category", category_id: "4", currency_code: "ILS", amount_limit: "800", period_start: "2026-11-01", period_end: "2026-11-30" });
    assert.equal(one.input.category_id, 4);
    assert.equal(Object.hasOwn(one.input, "scope"), false);
    assert.equal(build("account", { name: "Cash", type: "cash", currency_code: "ILS", opening_balance: "0" }).input.workspace_id, 7);
    assert.equal(Object.hasOwn(build("recurring", { name: "Rent", type: "expense", account_id: "1", category_id: "4", amount: "2000", interval: "1" }).input, "workspace_id"), false, "a rule's workspace is its account's");
    assert.deepEqual(build("recurring", { name: "Rent", type: "expense", account_id: "1", category_id: "4", amount: "2000", interval: "2", max_occurrences: "" }).input.interval, 2);
  });

  it("a correction sends the reason and only what changed; an emptied optional text is null", () => {
    const record = { id: "31", type: "expense", status: "posted", currency: "ILS", amount: "100", accountId: "1", categoryId: "4", description: "Lunch", referenceNumber: "", occurredAt: "2026-10-30" };
    const write = build("transaction-correct", { amount: "120", description: "", reason: "Wrong amount" }, ctxFor({ record }));
    assert.deepEqual(write, { operation: "transaction.correct", ids: { transactionId: "31" }, input: { reason: "Wrong amount", amount: "120.0000", description: null } });
  });

  it("a debt payment leaves today's date to the backend, like the full version", () => {
    const record = { id: "3", currency: "ILS", remaining: "500", direction: "payable" };
    assert.deepEqual(build("debt-payment", { account_id: "1", amount: "50", paid_at: "2026-11-01" }, ctxFor({ record })).input, { account_id: 1, amount: "50.0000" });
    assert.equal(build("debt-payment", { account_id: "1", amount: "50", paid_at: "2026-10-20" }, ctxFor({ record })).input.paid_at, "2026-10-20");
  });

  it("an export puts its range in filters; the password change uses the wrapper's names; reviews carry their version", () => {
    assert.deepEqual(build("export", { report: "overview", format: "pdf", from: "2026-10-01", to: "2026-10-31", currency: "" }).input, { report: "overview", format: "pdf", filters: { from: "2026-10-01", to: "2026-10-31" } });
    assert.deepEqual(build("password-change", { current_password: "old-pass-1", password: "new-pass-2", password_confirmation: "new-pass-2" }).input, { currentPassword: "old-pass-1", password: "new-pass-2", passwordConfirmation: "new-pass-2" });
    const record = { id: "42", reviewVersion: 3, status: "ready_for_review", review: { currency_code: "ILS", account_id: "1", category_id: "4", amount: "18", transaction_date: "2026-10-31", merchant_name: "", description: "", reference_number: "" } };
    const receipt = build("receipt-review", {}, ctxFor({ record }));
    assert.equal(receipt.reviewVersion, 3);
    assert.deepEqual(receipt.input, { account_id: 1, category_id: 4, merchant_name: null, amount: "18.0000", transaction_date: "2026-10-31", description: null, reference_number: null });
  });

  it("a form without a request definition cannot be sent", () => {
    assert.throws(() => buildWrite({ id: "nothing", fields: [] }, {}, ctxFor()), /No request is defined/);
  });
});

describe("the send path while the gate is closed (the product)", () => {
  let api;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("every operation refuses before any request exists, with or without a key", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: Object.values(FORM_WRITES) });
    for (const operation of SENDABLE_OPERATIONS) {
      assert.throws(() => sendWorkflowWrite({ operation, ids: { transactionId: "1", transferId: "1", accountId: "1", budgetId: "1", goalId: "1", ruleId: "1", debtId: "1", paymentId: "1", captureId: "1", draftId: "1" }, input: { reason: "x" }, reviewVersion: 1 }, "mobile-key-12345678"), (error) => error.name === "WriteClosedError", operation);
    }
    assert.deepEqual(api.calls, []);
  });

  it("a write the backend keys is not sent without a key, even when open", () => {
    gate.setWriteApprovalsForTests(["transaction.expense"]);
    try {
      api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [FORM_WRITES.expense] });
      assert.throws(() => sendWorkflowWrite({ operation: "transaction.expense", ids: {}, input: {} }), /needs an Idempotency-Key/);
      assert.deepEqual(api.calls, []);
    } finally {
      gate.setWriteApprovalsForTests(null);
    }
  });
});

describe("what an answer means", () => {
  it("only a certain refusal is 'rejected'; a 409, a 5xx, a timeout or the network is 'unknown'", () => {
    for (const code of ["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED"]) assert.equal(classifyWriteOutcome({ code }).kind, "rejected", code);
    for (const code of ["CONFLICT", "SERVER_ERROR", "TIMEOUT", "NETWORK_ERROR", "MALFORMED_RESPONSE", undefined]) assert.equal(classifyWriteOutcome({ code }).kind, "unknown", String(code));
    assert.equal(classifyWriteOutcome({ code: "UNAUTHENTICATED" }).kind, "identity");
    assert.equal(classifyWriteOutcome(new gate.WriteClosedError("transaction.expense")).code, "WRITE_CLOSED");
  });
});

/* ---------- Journeys with ONE write opened for the test ---------- */

const backendAccounts = [account({ id: 1, name: "Wallet", currency_code: "ILS" }), account({ id: 2, name: "Bank", type: "bank", currency_code: "ILS" })];
const backendCategories = [{ id: 4, name: "Food", type: "expense", is_system: false, is_active: true }];

let api;
let view;
const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");

function backend(onWrite) {
  return (call) => {
    if (call.method !== "GET") return onWrite(call);
    if (call.path === "/accounts") return { body: envelope({ accounts: backendAccounts }) };
    if (call.path === "/categories") return { body: envelope({ categories: backendCategories }) };
    return failure(404, "Not found");
  };
}

async function openExpense(onWrite) {
  api = installFakeApi(backend(onWrite), { allowWrites: [FORM_WRITES.expense] });
  view = await mountMobile({ entry: "/m/add/expense" });
  await change(field("account_id"), "2");
  await change(field("category_id"), "4");
  await change(field("amount"), "12.5");
  await submit(q("form.sm-draft-form"));
  assert.ok(q("[data-sm-step='review']"));
}

describe("a new expense, with its write opened for the test", () => {
  beforeEach(async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A });
    gate.setWriteApprovalsForTests(["transaction.expense"]);
  });

  afterEach(async () => {
    await view?.unmount();
    view = null;
    gate.setWriteApprovalsForTests(null);
    assert.deepEqual(api?.violations ?? [], [], "only the opened write");
    api?.restore();
    api = null;
  });

  it("sends exactly one POST with the backend's fields and an Idempotency-Key, and says so only after the answer", async () => {
    let release;
    await openExpense(() => new Promise((resolve) => { release = resolve; }));
    assert.equal(q("[data-sm-note='write-closed']"), null, "no 'not sent' card for an open write");

    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1, "a double tap sends one request");
    assert.equal(action("send").disabled, true);
    assert.equal(q("[data-sm-outcome]"), null, "nothing is claimed before the answer");

    const [call] = writes();
    assert.equal(call.path, "/transactions/expense");
    assert.match(call.headers["Idempotency-Key"], /^mobile-transaction-expense-[A-Za-z0-9-]{8,}$/);
    const { occurred_at: occurredAt, ...rest } = call.body;
    assert.deepEqual(rest, { account_id: 2, category_id: 4, amount: "12.5000" });
    assert.match(occurredAt, /^\d{4}-\d{2}-\d{2} 12:00:00$/, "today, preselected, sent the way the full version sends it");

    release({ status: 201, body: envelope({ transaction: { id: 90, status: "posted" } }) });
    await settle();
    const outcome = q("[data-sm-outcome='confirmed']");
    assert.ok(outcome);
    assert.equal(document.activeElement, outcome);
    assert.equal(action("send"), null, "nothing left to send");
  });

  it("an unknown answer (a 500) claims nothing either way and is never sent again", async () => {
    await openExpense(() => failure(500, "Server error"));
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome='unknown']");
    assert.ok(outcome);
    assert.match(text(outcome), /may or may not have been recorded.*won't send it again by itself/);
    assert.equal(action("send"), null);
    window.dispatchEvent(new window.Event("online"));
    window.dispatchEvent(new window.Event("focus"));
    await settle(20);
    assert.equal(writes().length, 1);
  });

  it("a 409 (the key still processing, or used with other values) is unknown, not a failure", async () => {
    await openExpense(() => failure(409, "This operation is currently being processed."));
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-outcome='unknown']"));
    assert.equal(writes().length, 1);
  });

  it("a 422 is a refusal: the server's words are shown, and a new send by hand gets a new key", async () => {
    let first = true;
    await openExpense(() => {
      if (first) {
        first = false;
        return { status: 422, body: { status: false, message: "Insufficient balance.", errors: { amount: ["The account balance is too low."] } } };
      }
      return { status: 201, body: envelope({ transaction: { id: 91, status: "posted" } }) };
    });
    await click(action("send"));
    await settle();
    const refused = q("[data-sm-outcome='rejected']");
    assert.ok(refused);
    assert.match(text(refused), /Nothing was recorded by this request.*Insufficient balance.*balance is too low/);

    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-outcome='confirmed']"));
    const [one, two] = writes();
    assert.notEqual(one.headers["Idempotency-Key"], two.headers["Idempotency-Key"], "a certain refusal ends that key");
  });
});

describe("a reviewed receipt, with its write opened for the test", () => {
  beforeEach(async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A });
    gate.setWriteApprovalsForTests(["receipt.confirm"]);
  });

  afterEach(() => {
    gate.setWriteApprovalsForTests(null);
    assert.deepEqual(api?.violations ?? [], []);
    api?.restore();
    api = null;
  });

  it("saves the reviewed values with the version read, then confirms with the version the save returned", async () => {
    api = installFakeApi((call) => {
      if (call.method === "PATCH") return { body: envelope({ capture: { id: 42, review_version: 4 } }) };
      return { status: 201, body: envelope({ capture: { id: 42, status: "confirmed" }, transaction: { id: 95 } }) };
    }, { allowWrites: [FORM_WRITES.receiptSave, FORM_WRITES.receiptConfirm] });

    await sendWorkflowWrite({ operation: "receipt.confirm", ids: { captureId: "42" }, reviewVersion: 3, input: { account_id: 1, amount: "18.0000" } }, "mobile-receipt-confirm-key-1");
    const [save, confirm] = api.calls;
    assert.equal(save.method, "PATCH");
    assert.deepEqual(save.body, { review_version: 3, account_id: 1, amount: "18.0000" });
    assert.equal(save.headers["Idempotency-Key"], undefined, "the save moves no money and takes no key");
    assert.equal(confirm.path, "/ai/expense-captures/42/confirm");
    assert.deepEqual(confirm.body, { review_version: 4 });
    assert.equal(confirm.headers["Idempotency-Key"], "mobile-receipt-confirm-key-1");
  });

  it("does not confirm when the save's answer names no version", async () => {
    api = installFakeApi(() => ({ body: envelope({ capture: { id: 42 } }) }), { allowWrites: [FORM_WRITES.receiptSave, FORM_WRITES.receiptConfirm] });
    await assert.rejects(sendWorkflowWrite({ operation: "receipt.confirm", ids: { captureId: "42" }, reviewVersion: 3, input: {} }, "mobile-receipt-confirm-key-2"), (error) => error.code === "MALFORMED_RESPONSE");
    assert.deepEqual(api.calls.map((call) => call.method), ["PATCH"]);
  });
});

describe("the product state", () => {
  it("every form write is closed (the reviews end at a disabled button: tests/mobileForms.test.mjs)", () => {
    for (const workflow of Object.values(WORKFLOWS)) assert.equal(gate.isWriteOpen(workflow.operation), false, workflow.operation);
  });
});
