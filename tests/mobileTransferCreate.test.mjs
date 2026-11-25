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
const { buildTransferResult } = await import("../src/mobile/models/transferResult.js");

/*
 * Phase 2A: creating a transfer from Mobile (POST /transfers). The write is "key-atomic" (TransferMoneyAction, identical
 * on develop @ fd87531 and 6b696d72) and stays CLOSED in the product: APPROVED is empty. These tests open it only through
 * the test runner's switch, against a fake backend that follows the verified rules: the Idempotency-Key is required,
 * the same key with the same request replays the first transfer, the same key with a different request is a 409, the
 * accounts must differ and share a currency, and amount plus fee must not exceed the source balance (422 otherwise).
 */

after(() => dom.window.close());

const OPERATION = "transfer.create";
let api;
let view;
let server;

const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
const action = (name) => q(`[data-sm-action='${name}']`);
const writes = () => api.calls.filter((call) => call.method !== "GET");
const text = (node) => node.textContent.replace(/\s+/g, " ");
const pendingKeys = () => Object.keys(window.localStorage).filter((key) => /pending/i.test(key));

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

/* A backend with balances and an idempotency table, answering the way TransferController / TransferMoneyAction do. */
function transferServer({ onTransfer, afterApply } = {}) {
  const accounts = [
    account({ id: 1, name: "Wallet", currency_code: "ILS", current_balance: "1000.0000" }),
    account({ id: 2, name: "Bank Leumi", type: "bank", currency_code: "ILS", current_balance: "9000.0000" }),
    account({ id: 3, name: "Dollar account", type: "bank", currency_code: "USD", current_balance: "500.0000" }),
    account({ id: 9, name: "Laptop savings", type: "savings_goal", savings_goal: { id: 1 }, currency_code: "ILS", current_balance: "300.0000" }),
  ];
  const categories = [{ id: 4, name: "Bank fees", type: "expense", is_system: false, is_active: true }];
  const keys = new Map();
  const transfers = [];
  const refuse = (message) => ({ status: 422, body: { status: false, message, errors: {} } });

  const apply = (call) => {
    const key = call.headers["Idempotency-Key"];
    if (!key) return { status: 422, body: { status: false, message: "The provided data is invalid.", errors: { idempotency_key: ["required"] } } };
    const body = call.body ?? {};
    const hash = JSON.stringify(body);
    const known = keys.get(key);
    if (known) {
      if (known.hash !== hash) return { status: 409, body: { status: false, message: "The idempotency key was previously used with different request data." } };
      return { status: 201, body: envelope({ transfer: known.transfer }) };
    }
    const from = accounts.find((row) => row.id === body.from_account_id);
    const to = accounts.find((row) => row.id === body.to_account_id);
    if (!from || !to) return refuse("The selected account is invalid.");
    if (from.id === to.id) return refuse("The source and destination accounts must be different.");
    if (from.currency_code !== to.currency_code) return refuse("Cross-currency transfers are not supported in the MVP.");
    if (from.savings_goal || to.savings_goal) return refuse("Use the savings goal contribution or withdrawal endpoint for goal accounts.");
    const required = toMinor(body.amount) + toMinor(body.fee_amount ?? "0");
    if (toMinor(from.current_balance) < required) return refuse(`Insufficient balance in ${from.name}. Required: ${fromMinor(required)}, available: ${from.current_balance}.`);

    from.current_balance = fromMinor(toMinor(from.current_balance) - required);
    to.current_balance = fromMinor(toMinor(to.current_balance) + toMinor(body.amount));
    const transfer = {
      id: 500 + transfers.length + 1,
      workspace_id: 1,
      from_account_id: from.id,
      to_account_id: to.id,
      amount: body.amount,
      fee_amount: body.fee_amount ?? "0.0000",
      currency_code: from.currency_code,
      status: "posted",
      occurred_at: body.occurred_at,
      posted_at: "2026-11-15T10:00:00Z",
      from_account: { id: from.id, name: from.name, currency_code: from.currency_code },
      to_account: { id: to.id, name: to.name, currency_code: to.currency_code },
      transactions: [],
    };
    transfers.push(transfer);
    keys.set(key, { hash, transfer });
    return { status: 201, body: envelope({ transfer }) };
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
    if (call.path === "/transfers" && call.method === "POST") {
      if (onTransfer) return onTransfer(call, () => apply(call));
      const answer = apply(call);
      return afterApply ? afterApply(answer, call) : answer;
    }
    return { status: 404, body: { status: false, message: "Not found" } };
  };
  return { handler, accounts, transfers, keys };
}

async function openTransfer(options = {}, { approve = [OPERATION], language } = {}) {
  if (language) {
    await resetEnvironment(language);
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  }
  server = options.server ?? transferServer(options);
  api?.restore();
  api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.transfer] });
  gate.setWriteApprovalsForTests(approve);
  view = await mountMobile({ entry: "/m/add/transfer" });
}

async function fill({ from = "1", to = "2", amount = "150", description = "Rent share" } = {}) {
  await change(field("from_account_id"), from);
  await change(field("to_account_id"), to);
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
  it("is a money write with a client key, key-atomic, and closed by default", () => {
    assert.deepEqual({ ...gate.MOBILE_WRITES[OPERATION] }, { endpoint: "POST /transfers", moves: true, key: "client", serverDedup: "key-atomic" });
    assert.equal(gate.isWriteOpen(OPERATION), false);
    assert.match(readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8"), /const APPROVED = Object\.freeze\(\[\]\);/);
  });

  it("the sender refuses without a request while closed, and refuses without a key when open", () => {
    api = installFakeApi(() => ({ body: envelope({}) }), { allowWrites: [FORM_WRITES.transfer] });
    const write = { operation: OPERATION, input: { from_account_id: 1, to_account_id: 2, amount: "1.0000" } };
    assert.throws(() => sendWorkflowWrite(write, "mobile-transfer-create-12345678"), (error) => error.name === "WriteClosedError");
    gate.setWriteApprovalsForTests([OPERATION]);
    assert.throws(() => sendWorkflowWrite(write), /needs an Idempotency-Key/);
    assert.deepEqual(api.calls, []);
  });
});

describe("a new transfer, gate closed (the product)", () => {
  it("can be filled in and reviewed, but Confirm is disabled and nothing is sent", async () => {
    await openTransfer({}, { approve: null });
    await fill();
    assert.ok(q("[data-sm-step='review']"));
    assert.equal(action("send").disabled, true);
    assert.equal(action("send").dataset.smOpen, "false");
    assert.ok(q("[data-sm-note='write-closed'][data-sm-write='transfer.create']"));
    await click(action("send"));
    await settle();
    assert.deepEqual(writes(), []);
  });
});

describe("a new transfer, with its write opened by the test switch", () => {
  it("sends the backend's fields with one Idempotency-Key, then shows the server's transfer and its balances read again", async () => {
    await openTransfer();
    await fill();
    const review = text(q("[data-sm-step='review']"));
    assert.match(review, /Wallet/);
    assert.match(review, /Bank Leumi/);
    assert.match(review, /ILS/, "the currency is visible before confirming");

    await click(action("send"));
    await settle();

    assert.equal(writes().length, 1);
    const [call] = writes();
    assert.equal(call.path, "/transfers");
    assert.match(call.headers["Idempotency-Key"], /^mobile-transfer-create-[A-Za-z0-9-]{8,}$/);
    const { occurred_at: occurredAt, ...rest } = call.body;
    assert.deepEqual(rest, { from_account_id: 1, to_account_id: 2, amount: "150.0000", description: "Rent share" });
    assert.match(occurredAt, /^\d{4}-\d{2}-\d{2} 12:00:00$/);
    assert.equal(Object.hasOwn(call.body, "fee_amount"), false, "no fee fields without a fee");

    const result = q("[data-sm-transfer-result]");
    assert.ok(result, "the transfer's own result");
    assert.equal(result.dataset.smTransferResult, "501");
    assert.match(text(result), /Transfer completed/);
    assert.match(text(q("[data-sm-result-amount]")), /150\.00/);
    assert.match(text(q("[data-sm-result='from']")), /Wallet/);
    assert.match(text(q("[data-sm-result='to']")), /Bank Leumi/);
    assert.match(text(q("[data-sm-result='status']")), /Posted/);
    assert.equal(action("open-transfer").getAttribute("href"), "/m/transfers/501");

    // The balances are the server's, read after the transfer (not 1000 - 150 worked out here).
    const balanceReads = api.calls.filter((item) => item.method === "GET" && /^\/accounts\/[12]$/.test(item.path));
    assert.ok(balanceReads.length >= 2, "both accounts read again");
    assert.ok(api.calls.indexOf(balanceReads[0]) > api.calls.indexOf(call), "after the write");
    assert.equal(q("[data-sm-balance-now='from']").dataset.smState, "ready");
    assert.match(text(q("[data-sm-balance-now='from']")), /850\.00/);
    assert.match(text(q("[data-sm-balance-now='to']")), /9,150\.00/);
    assert.deepEqual(pendingKeys(), [], "nothing left to protect after a confirmed transfer");
  });

  it("sends a fee and its category only when there is a fee, and the result shows the server's fee", async () => {
    await openTransfer();
    await change(field("from_account_id"), "1");
    await change(field("to_account_id"), "2");
    await change(field("amount"), "100");
    await change(field("fee_amount"), "2.5");
    await change(field("fee_category_id"), "4");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();
    const { occurred_at: occurredAt, ...rest } = writes()[0].body;
    void occurredAt;
    assert.deepEqual(rest, { from_account_id: 1, to_account_id: 2, amount: "100.0000", fee_amount: "2.5000", fee_category_id: 4 });
    assert.match(text(q("[data-sm-result='fee']")), /2\.50/);
    assert.match(text(q("[data-sm-balance-now='from']")), /897\.50/);
  });

  it("an invalid amount never reaches review or the server", async () => {
    await openTransfer();
    for (const amount of ["0", "-5", "1.23456", "abc", "1,000", ""]) {
      await change(field("from_account_id"), "1");
      await change(field("to_account_id"), "2");
      await change(field("amount"), amount);
      await submit(q("form.sm-draft-form"));
      assert.equal(q("[data-sm-step='review']"), null, `"${amount}" stays in edit`);
      assert.ok(q("[data-sm-summary='local']"), `"${amount}" is explained`);
    }
    assert.deepEqual(writes(), []);
  });

  it("the same account, another currency or a savings goal's account is never offered as the destination", async () => {
    await openTransfer();
    await change(field("from_account_id"), "1");
    assert.deepEqual(qa("option", field("to_account_id")).map((option) => option.value), ["", "2"]);
    assert.ok(!qa("option", field("from_account_id")).some((option) => option.value === "9"), "a goal's account is not a source either");
  });

  it("the server's own refusals are shown as refusals: same account and another currency (422)", async () => {
    server = transferServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.transfer] });
    gate.setWriteApprovalsForTests([OPERATION]);
    for (const [input, message] of [
      [{ from_account_id: 1, to_account_id: 1, amount: "10.0000" }, /must be different/],
      [{ from_account_id: 1, to_account_id: 3, amount: "10.0000" }, /Cross-currency transfers are not supported/],
    ]) {
      const error = await sendWorkflowWrite({ operation: OPERATION, input }, `mobile-transfer-create-${input.to_account_id}-abcdefgh`).then(() => null, (failure) => failure);
      assert.equal(error.status, 422);
      assert.match(error.message, message);
      assert.equal(classifyWriteOutcome(error).kind, "rejected");
    }
    assert.equal(server.transfers.length, 0);
  });

  it("insufficient balance is refused by the server, with its words; nothing moves and the key is let go", async () => {
    await openTransfer();
    await fill({ amount: "5000" });
    await click(action("send"));
    await settle();
    const outcome = q("[data-sm-outcome]");
    assert.equal(outcome.dataset.smOutcome, "rejected");
    assert.equal(outcome.getAttribute("role"), "alert");
    assert.match(text(outcome), /Insufficient balance in Wallet/);
    assert.equal(q("[data-sm-transfer-result]"), null);
    assert.equal(server.accounts[0].current_balance, "1000.0000");
    assert.deepEqual(pendingKeys(), [], "a certain refusal leaves no key to reuse");
    assert.equal(action("send").disabled, false, "it may be changed and sent again");
  });

  it("a double tap sends one request, and nothing is claimed before the answer", async () => {
    let release;
    await openTransfer({ onTransfer: (call, apply) => new Promise((resolve) => { release = () => resolve(apply()); }) });
    await fill();
    await act(async () => {
      action("send").click();
      action("send").click();
    });
    assert.equal(writes().length, 1);
    assert.equal(action("send").disabled, true);
    assert.equal(action("send").getAttribute("aria-busy"), "true");
    assert.equal(q("[data-sm-outcome]"), null);
    await act(async () => release());
    await settle();
    assert.equal(writes().length, 1);
    assert.ok(q("[data-sm-transfer-result]"));
  });

  it("after an unknown outcome the key is kept; resending the same transfer replays the first one and moves money once", async () => {
    let first = true;
    // The server applies the first transfer, then the answer is lost (the network drops it).
    await openTransfer({ afterApply: (answer) => (first ? ((first = false), new TypeError("Failed to fetch")) : answer) });
    await fill();
    await click(action("send"));
    await settle();

    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(q("[data-sm-transfer-result]"), null, "nothing is claimed");
    assert.equal(action("send"), null, "this form sends nothing more by itself");
    assert.equal(writes().length, 1, "never retried automatically");
    assert.equal(server.transfers.length, 1, "the server did record it");
    const firstKey = writes()[0].headers["Idempotency-Key"];
    assert.equal(pendingKeys().length, 1, "the key survives for a deliberate retry");

    // The person comes back (a reload) and enters the same transfer again.
    await view.unmount();
    const shared = server;
    view = await mountMobile({ entry: "/m/add/transfer" });
    server = shared;
    await fill();
    await click(action("send"));
    await settle();

    assert.equal(writes().length, 2);
    assert.equal(writes()[1].headers["Idempotency-Key"], firstKey, "the same key");
    assert.equal(server.transfers.length, 1, "replayed, not posted twice");
    assert.equal(server.accounts[0].current_balance, "850.0000");
    assert.equal(q("[data-sm-transfer-result]").dataset.smTransferResult, "501", "the first transfer, as the server replays it");
  });

  it("a different transfer after a reload gets its own key; the same key with different data is a 409 and an unknown outcome", async () => {
    server = transferServer();
    api = installFakeApi(server.handler, { allowWrites: [FORM_WRITES.transfer] });
    gate.setWriteApprovalsForTests([OPERATION]);
    const key = "mobile-transfer-create-samekey-1234";
    await sendWorkflowWrite({ operation: OPERATION, input: { from_account_id: 1, to_account_id: 2, amount: "10.0000" } }, key);
    const error = await sendWorkflowWrite({ operation: OPERATION, input: { from_account_id: 1, to_account_id: 2, amount: "20.0000" } }, key).then(() => null, (failure) => failure);
    assert.equal(error.status, 409);
    assert.equal(classifyWriteOutcome(error).kind, "unknown", "the client can't tell this 409 apart: it claims nothing");
    assert.equal(server.transfers.length, 1, "the different request moved nothing");
    api.restore();

    // Through the screen: an unknown outcome, then a reload and a DIFFERENT amount, mints a new key.
    let lose = true;
    await openTransfer({ afterApply: (answer) => (lose ? ((lose = false), new TypeError("Failed to fetch")) : answer) });
    await fill({ amount: "40" });
    await click(action("send"));
    await settle();
    const firstKey = writes()[0].headers["Idempotency-Key"];
    await view.unmount();
    view = await mountMobile({ entry: "/m/add/transfer" });
    await fill({ amount: "45" });
    await click(action("send"));
    await settle();
    assert.notEqual(writes()[1].headers["Idempotency-Key"], firstKey, "a different transfer is a different intent");
  });

  it("a 409 while the first request is still processing is an unknown outcome, and the key is kept", async () => {
    await openTransfer({ onTransfer: () => ({ status: 409, body: { status: false, message: "This operation is currently being processed." } }) });
    await fill();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "unknown");
    assert.equal(pendingKeys().length, 1);
  });

  it("a timeout is an unknown outcome, never a failure", () => {
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "TIMEOUT" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("", { code: "NETWORK_ERROR" })).kind, "unknown");
    assert.equal(classifyWriteOutcome(new ApiError("x", { status: 500, code: "SERVER_ERROR" })).kind, "unknown");
  });

  it("a 2xx that isn't provably this transfer is acknowledged generically, with no figures", async () => {
    await openTransfer({ onTransfer: () => ({ status: 201, body: envelope({ transfer: { id: 77, from_account_id: 1, to_account_id: 3, amount: "150.0000", currency_code: "ILS" } }) }) });
    await fill();
    await click(action("send"));
    await settle();
    assert.equal(q("[data-sm-transfer-result]"), null);
    assert.equal(q("[data-sm-outcome]").dataset.smOutcome, "confirmed");
    assert.match(text(q("[data-sm-outcome]")), /Recorded/);
  });

  it("speaks Arabic", async () => {
    await openTransfer({}, { language: "ar" });
    await fill({ description: null });
    await click(action("send"));
    await settle();
    assert.match(text(q("[data-sm-transfer-result]")), /اكتمل التحويل/);
    assert.match(text(q("[data-sm-transfer-result]")), /الأرصدة الآن/);
  });
});

describe("what a transfer answer proves", () => {
  const input = { from_account_id: 1, to_account_id: 2, amount: "150.0000" };
  const answer = (over = {}) => ({ transfer: { id: 9, from_account_id: 1, to_account_id: 2, amount: "150.0000", fee_amount: "0.0000", currency_code: "ILS", status: "posted", from_account: { id: 1, name: "Wallet" }, to_account: { id: 2, name: "Bank" }, ...over } });

  it("needs the id, the two accounts and the amount that were sent", () => {
    assert.equal(buildTransferResult(answer(), input).id, "9");
    assert.equal(buildTransferResult(answer(), input).fee, null, "a zero fee is no fee");
    assert.equal(buildTransferResult(answer({ fee_amount: "2.5000" }), input).fee, "2.5000");
    assert.equal(buildTransferResult(answer({ amount: "15.0000" }), input), null);
    assert.equal(buildTransferResult(answer({ to_account_id: 3 }), input), null);
    assert.equal(buildTransferResult(answer({ id: null }), input), null);
    assert.equal(buildTransferResult(answer({ currency_code: null, from_account: { id: 1, name: "Wallet", currency_code: "ILS" } }), input).currency, "ILS");
    assert.equal(buildTransferResult({}, input), null);
  });
});
