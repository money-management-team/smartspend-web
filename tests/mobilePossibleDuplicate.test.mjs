import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, account, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";

const gate = await import("../src/mobile/data/writeGate.js");

/*
 * smartspend-backend fix/financial-idempotency-p0 @ 6b696d72: income, expense
 * and correction answer 409 `code: "possible_duplicate"` with
 * `data.matched_transaction` when config/finance.php's manual_duplicate_guard
 * is on (off by default — forward-looking handling, not a live production
 * behaviour). A resend over the SAME Idempotency-Key, with
 * `confirm_possible_duplicate: true` added to the SAME body, is the only
 * documented way to proceed.
 *
 * Exercised here with the write opened for the test only
 * (gate.setWriteApprovalsForTests); every test's afterEach puts it back, and
 * the standalone describe at the end reads the gate exactly as the product
 * ships it (APPROVED, never the test override).
 */

after(() => dom.window.close());

const MATCHED = {
  id: 501,
  type: "expense",
  amount: "40.0000",
  currency_code: "ILS",
  occurred_at: "2026-11-01T09:00:00+00:00",
  description: "Lunch",
  reference_number: "REF-1",
  source: "manual",
  created_at: "2026-11-01T09:00:00+00:00",
};

/** Exactly bootstrap/app.php's PossibleDuplicateTransactionException render. */
const possibleDuplicateBody = (matched = MATCHED) => ({
  status: false,
  message: "This looks like a payment that is already recorded. If it is a separate payment, send the request again with confirm_possible_duplicate set to true.",
  code: "possible_duplicate",
  data: { reason: "recent_description", matched_transaction: matched },
});

describe("Mobile: the possible-duplicate step (write opened for the test only)", () => {
  let api;
  let view;

  const backendAccounts = [account({ id: 1, name: "Wallet", currency_code: "ILS" })];
  const backendCategories = [{ id: 4, name: "Food", type: "expense", is_system: false, is_active: true }];

  function backend(onWrite) {
    return (call) => {
      if (call.method !== "GET") return onWrite(call);
      if (call.path === "/accounts") return { body: envelope({ accounts: backendAccounts }) };
      if (call.path === "/categories") return { body: envelope({ categories: backendCategories }) };
      return { status: 404, body: { status: false, message: "not found" } };
    };
  }

  const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
  const action = (name) => q(`[data-sm-action='${name}']`);
  const writes = () => api.calls.filter((call) => call.method !== "GET");

  async function openExpense(onWrite) {
    api = installFakeApi(backend(onWrite), { allowWrites: [FORM_WRITES.expense] });
    view = await mountMobile({ entry: "/m/add/expense" });
    await change(field("account_id"), "1");
    await change(field("category_id"), "4");
    await change(field("amount"), "40");
    await submit(q("form.sm-draft-form"));
    assert.ok(q("[data-sm-step='review']"));
  }

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

  it("a possible-duplicate answer shows the matched transaction and sends no further request by itself", async () => {
    await openExpense(() => ({ status: 409, body: possibleDuplicateBody() }));
    await click(action("send"));
    await settle();

    assert.ok(q("[data-sm-outcome='possibleDuplicate']"), "the possible-duplicate step is shown");
    assert.equal(writes().length, 1, "nothing was sent again by itself");
    assert.match(q("[data-sm-outcome='possibleDuplicate']").textContent, /Lunch|40/);
  });

  it("Cancel sends nothing more, and returns the form to idle", async () => {
    await openExpense(() => ({ status: 409, body: possibleDuplicateBody() }));
    await click(action("send"));
    await settle();

    await click(action("cancel-duplicate"));
    await settle();
    assert.equal(writes().length, 1, "cancelling sends nothing");
    assert.equal(q("[data-sm-outcome]"), null, "back to idle");
  });

  it("Confirm resends the SAME key and body, only adding the flag; a double tap sends one resend", async () => {
    let calls = 0;
    await openExpense((call) => {
      calls += 1;
      if (calls === 1) return { status: 409, body: possibleDuplicateBody() };
      return { status: 201, body: envelope({ transaction: { id: 900, status: "posted" } }) };
    });
    await click(action("send"));
    await settle();
    assert.ok(q("[data-sm-outcome='possibleDuplicate']"));

    await act(async () => {
      action("confirm-duplicate").click();
      action("confirm-duplicate").click();
    });
    await settle();

    assert.equal(writes().length, 2, "exactly one resend, however many taps");
    const [first, resend] = writes();
    assert.equal(resend.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    assert.deepEqual(resend.body, { ...first.body, confirm_possible_duplicate: true });
    assert.ok(q("[data-sm-outcome='confirmed']"));
  });

  it("any other 409 is the existing 'unknown outcome' handling, never this step", async () => {
    await openExpense(() => ({ status: 409, body: { status: false, message: "This operation is currently being processed." } }));
    await click(action("send"));
    await settle();

    assert.equal(q("[data-sm-outcome='possibleDuplicate']"), null);
    assert.ok(q("[data-sm-outcome='unknown']"));
  });
});

/*
 * Outside any describe block that opens a write for its own tests (each of
 * those resets the override to null in its own afterEach): this reads the
 * gate exactly as the product ships it, including for the three creates
 * possible-duplicate handling has no bearing on at all.
 */
describe("Mobile write gate: this feature opens nothing", () => {
  it("transaction.expense, transaction.income and transaction.correct stay closed by default", () => {
    for (const operation of ["transaction.expense", "transaction.income", "transaction.correct"]) {
      assert.equal(gate.isWriteOpen(operation), false, operation);
    }
  });
});
