import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

/*
 * Recurring confirm-next and skip-next name the occurrence they act on.
 *
 * The backend (smartspend-backend fix/financial-idempotency-p0 worktree,
 * RecurringTransactionController::namedOccurrence) requires `occurrence_id`
 * and refuses, changing nothing, unless it is still the rule's earliest open
 * occurrence. Before, the request had no body and the backend picked "the next
 * open occurrence" when it arrived, so a repeated request posted or skipped
 * the FOLLOWING period. Every caller now sends the id of the occurrence the
 * person was shown: the rule's schedule.next_occurrence.id.
 *
 * No real network: every request is answered by mockFetch.
 */

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { recurringTransactionsApi } = await import("../src/features/Dashboards/User/api/recurringTransactionsApi.js");
const { getNextOccurrenceId, getRecurringErrorMessage, getRuleActions } = await import("../src/features/Dashboards/User/Recurring/recurringHelpers.js");
const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
const { default: Recurring } = await import("../src/features/Dashboards/User/Recurring/Recurring.jsx");
const { default: RecurringDetails } = await import("../src/features/Dashboards/User/RecurringDetails/RecurringDetails.jsx");
const { AuthContext } = await import("../src/contexts/auth/authContext.js");
const { WORKFLOWS, RECORD_PICKERS } = await import("../src/mobile/forms/workflows.js");
const { buildWrite } = await import("../src/mobile/forms/writePayloads.js");
const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");

const pathOf = (call) => new URL(call.url, "http://localhost").pathname;
const posts = (calls) => calls.filter((call) => call.method === "POST");

const occurrence = (overrides = {}) => ({ id: 77, recurring_transaction_id: 5, due_date: "2026-11-20", status: "scheduled", is_open: true, is_overdue: false, amount: "500.0000", currency_code: "ILS", ...overrides });
const rule = (overrides = {}) => ({
  id: 5,
  name: "Rent",
  type: "expense",
  status: "active",
  amount: "500.0000",
  currency_code: "ILS",
  frequency: "monthly",
  interval: 1,
  processing_mode: "manual",
  account_id: 3,
  account: { id: 3, name: "Bank", currency_code: "ILS" },
  category_id: 4,
  category: { id: 4, name: "Rent", type: "expense" },
  schedule: { next_occurrence: occurrence(), open_occurrences_count: 3 },
  ...overrides,
});
const page = (data) => ({ data, current_page: 1, last_page: 1, per_page: 15, total: data.length, from: data.length ? 1 : null, to: data.length || null });

beforeEach(() => installBrowserStubs({ user: { id: 1 }, workspace: { id: 1 } }));

/* ------------------------------------------------------------- API wrapper */

describe("recurringTransactionsApi: confirm and skip name the occurrence", () => {
  it("confirmNext sends occurrence_id and no client key", async () => {
    const calls = mockFetch(() => ({ status: 201, body: envelope({ occurrence: occurrence({ status: "posted" }) }) }));
    await recurringTransactionsApi.confirmNext(5, 77);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(pathOf(calls[0]), "/api/recurring-transactions/5/confirm-next");
    assert.deepEqual(calls[0].body, { occurrence_id: 77 });
    assert.equal(calls[0].headers["Idempotency-Key"], undefined, "the key is the occurrence's own, derived by the backend");
  });

  it("skipNext sends occurrence_id, with the reason only when there is one", async () => {
    const calls = mockFetch(() => ({ body: envelope({ occurrence: occurrence({ status: "skipped" }) }) }));
    await recurringTransactionsApi.skipNext(5, 77, "Paid in cash");
    await recurringTransactionsApi.skipNext(5, "77");
    assert.deepEqual(calls.map((call) => [pathOf(call), call.body]), [
      ["/api/recurring-transactions/5/skip-next", { occurrence_id: 77, reason: "Paid in cash" }],
      ["/api/recurring-transactions/5/skip-next", { occurrence_id: 77 }],
    ]);
  });

  it("sends nothing without a valid occurrence id", () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    for (const bad of [undefined, null, 0, -1, 1.5, "abc", "", "07"]) {
      assert.throws(() => recurringTransactionsApi.confirmNext(5, bad), /requires the occurrence's id/, String(bad));
      assert.throws(() => recurringTransactionsApi.skipNext(5, bad, "x"), /requires the occurrence's id/, String(bad));
    }
    assert.deepEqual(calls, []);
  });
});

/* ------------------------------------------------------------- Desktop helpers */

describe("Desktop: which occurrence a rule offers", () => {
  it("is the schedule's next open occurrence, and nothing is offered without one", () => {
    assert.equal(getNextOccurrenceId(rule()), 77);
    assert.deepEqual([getRuleActions(rule()).canConfirm, getRuleActions(rule()).canSkip], [true, true]);

    for (const without of [rule({ schedule: undefined }), rule({ schedule: { next_occurrence: null, open_occurrences_count: 0 } }), rule({ schedule: { next_occurrence: occurrence({ id: null }) } }), rule({ schedule: { next_occurrence: occurrence({ is_open: false }) } })]) {
      assert.equal(getNextOccurrenceId(without), null);
      assert.equal(getRuleActions(without).canConfirm, false, "no confirm without an occurrence to name (the backend no longer picks one)");
      assert.equal(getRuleActions(without).canSkip, false);
    }
    assert.equal(getRuleActions(rule({ status: "paused" })).canConfirm, false);
  });

  it("explains the backend's two refusals, which changed nothing", () => {
    const t = (key) => key;
    const conflict = (serverCode) => new ApiError("server words", { status: 409, code: "CONFLICT", serverCode });
    assert.equal(getRecurringErrorMessage(conflict("recurring_occurrence_not_next"), t, "confirm"), "dashboard.recurring.errors.occurrenceNotNext");
    assert.equal(getRecurringErrorMessage(conflict("recurring_occurrence_not_open"), t, "skip"), "dashboard.recurring.errors.occurrenceNotOpen");
    assert.equal(getRecurringErrorMessage(conflict(null), t, "confirm"), "server words", "other conflicts are unchanged");
  });
});

/* ------------------------------------------------------------- Desktop pages */

const settle = async () => {
  for (let i = 0; i < 10; i += 1) await flush();
};

function serve({ list = [rule()], detail = rule(), confirm, skip } = {}) {
  return mockFetch((url, init) => {
    const p = new URL(url, "http://localhost").pathname;
    const method = init.method ?? "GET";
    if (method === "POST" && p === "/api/recurring-transactions/5/confirm-next") return confirm ?? { status: 201, body: envelope({ occurrence: occurrence({ status: "posted", transaction_id: 9 }), recurring_transaction: rule() }) };
    if (method === "POST" && p === "/api/recurring-transactions/5/skip-next") return skip ?? { body: envelope({ occurrence: occurrence({ status: "skipped" }), recurring_transaction: rule() }) };
    if (method === "GET" && p === "/api/recurring-transactions") return { body: envelope({ recurring_transactions: page(list) }) };
    if (method === "GET" && p === "/api/recurring-transactions/5") return { body: envelope({ recurring_transaction: detail }) };
    if (method === "GET" && p === "/api/recurring-transactions/5/occurrences") return { body: envelope({ occurrences: page([]) }) };
    if (method === "GET") return { body: envelope({}) };
    throw new Error(`Unexpected request ${method} ${url}`);
  });
}

async function mount(element, path, entry) {
  const i18n = await createI18n("en");
  const router = createMemoryRouter([{ path, element }], { initialEntries: [entry] });
  const auth = { initializing: false, isAuthenticated: true, user: { id: 1, name: "Test" }, workspace: { id: 1 } };
  const view = await render(withI18n(i18n, h(AuthContext.Provider, { value: auth }, h(RouterProvider, { router }))));
  await settle();
  return view;
}

const dialogSubmit = () => document.querySelector(".recurring-action-dialog footer button[type='submit']");

describe("Desktop: the pages send the occurrence they showed", () => {
  let view;
  afterEach(async () => {
    await view?.unmount();
    view = null;
  });

  it("the list's confirm posts the row's next occurrence", async () => {
    const calls = serve();
    view = await mount(h(Recurring), "*", "/dashboard/recurring");
    await click(document.querySelector(".recurring-row__confirm"));
    await settle();
    await click(dialogSubmit());
    await settle();

    const [sent] = posts(calls);
    assert.equal(pathOf(sent), "/api/recurring-transactions/5/confirm-next");
    assert.deepEqual(sent.body, { occurrence_id: 77 });
    assert.equal(posts(calls).length, 1, "one request");
  });

  it("a list row without an open occurrence offers no confirm", async () => {
    serve({ list: [rule({ schedule: { next_occurrence: null, open_occurrences_count: 0 } })] });
    view = await mount(h(Recurring), "*", "/dashboard/recurring");
    assert.equal(document.querySelector(".recurring-row__confirm"), null);
  });

  it("the details page's confirm and skip post the page's next occurrence", async () => {
    const calls = serve({ detail: rule({ schedule: { next_occurrence: occurrence({ id: 88 }), open_occurrences_count: 2 } }) });
    view = await mount(h(RecurringDetails), "/dashboard/recurring/:recurringTransactionId", "/dashboard/recurring/5");

    const [confirmButton, skipButton] = document.querySelectorAll(".recurring-details__occurrence-actions button");
    await click(confirmButton);
    await settle();
    await click(dialogSubmit());
    await settle();

    await click(skipButton.isConnected ? skipButton : document.querySelectorAll(".recurring-details__occurrence-actions button")[1]);
    await settle();
    await click(dialogSubmit());
    await settle();

    assert.deepEqual(posts(calls).map((call) => [pathOf(call), call.body]), [
      ["/api/recurring-transactions/5/confirm-next", { occurrence_id: 88 }],
      ["/api/recurring-transactions/5/skip-next", { occurrence_id: 88 }],
    ]);
  });

  it("a stale occurrence is explained in the dialog, and nothing is retried", async () => {
    const calls = serve({
      confirm: { status: 409, body: { status: false, message: "An earlier date is still open.", code: "recurring_occurrence_not_next", occurrence_id: 77, occurrence_status: "scheduled" } },
    });
    view = await mount(h(RecurringDetails), "/dashboard/recurring/:recurringTransactionId", "/dashboard/recurring/5");
    await click(document.querySelector(".recurring-details__occurrence-actions button"));
    await settle();
    await click(dialogSubmit());
    await settle();

    assert.match(document.querySelector(".recurring-action-dialog").textContent, /An earlier date of this recurring transaction is still open, so nothing was changed/);
    assert.equal(dialogSubmit().disabled, true, "the same request would get the same 409: no resend from the dialog");
    assert.equal(posts(calls).length, 1, "the 409 is not resent");
  });

  it("a failed occurrence is settled: the dialog offers no retry that could reach the next date", async () => {
    const calls = serve({
      confirm: { status: 422, body: { status: false, message: "The account balance is insufficient for this recurring occurrence.", data: { occurrence: occurrence({ status: "failed", is_open: false, attempts: 1, failure_reason: "The account balance is insufficient for this recurring occurrence." }) } } },
    });
    view = await mount(h(RecurringDetails), "/dashboard/recurring/:recurringTransactionId", "/dashboard/recurring/5");
    await click(document.querySelector(".recurring-details__occurrence-actions button"));
    await settle();
    await click(dialogSubmit());
    await settle();

    const text = document.querySelector(".recurring-action-dialog").textContent;
    assert.match(text, /insufficient/i);
    assert.match(text, /recorded as failed and the schedule moved on/);
    assert.equal(dialogSubmit().disabled, true);
    await click(dialogSubmit());
    await settle();
    assert.equal(posts(calls).length, 1, "nothing else was sent");
  });
});

/* ------------------------------------------------------------- Mobile */

describe("Mobile: the recurring confirm and skip forms name the occurrence", () => {
  const data = (overrides = {}) => ({ recurring_transaction: rule(overrides) });
  const ctx = (record) => ({ record, today: "2026-11-15", accounts: [], categories: [] });

  it("the rule's next open occurrence is what the record carries", () => {
    assert.equal(RECORD_PICKERS.rule(data(), "5").nextOccurrenceId, "77");
    assert.equal(RECORD_PICKERS.rule(data({ schedule: { next_occurrence: null } }), "5").nextOccurrenceId, null);
    assert.equal(RECORD_PICKERS.rule(data({ schedule: { next_occurrence: occurrence({ is_open: false }) } }), "5").nextOccurrenceId, null);
  });

  it("the payloads carry occurrence_id", () => {
    const record = RECORD_PICKERS.rule(data(), "5");
    assert.deepEqual(buildWrite(WORKFLOWS["recurring-confirm"], {}, ctx(record)), {
      operation: "recurring.confirmNext",
      ids: { ruleId: "5", occurrenceId: "77" },
      input: { occurrence_id: 77 },
    });
    assert.deepEqual(buildWrite(WORKFLOWS["recurring-skip"], { reason: " Paid in cash " }, ctx(record)), {
      operation: "recurring.skipNext",
      ids: { ruleId: "5", occurrenceId: "77" },
      input: { occurrence_id: 77, reason: "Paid in cash" },
    });
  });

  it("a rule with no open occurrence can't be confirmed or skipped", () => {
    const record = RECORD_PICKERS.rule(data({ schedule: { next_occurrence: null } }), "5");
    assert.equal(WORKFLOWS["recurring-confirm"].eligible(record), "noOpenOccurrence");
    assert.equal(WORKFLOWS["recurring-skip"].eligible(record), "noOpenOccurrence");
    assert.equal(WORKFLOWS["recurring-confirm"].eligible(RECORD_PICKERS.rule(data(), "5")), null);
  });

  it("both writes stay closed and never approvable: nothing is sent", () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    gate.setWriteApprovalsForTests(["recurring.confirmNext", "recurring.skipNext"]);
    try {
      const record = RECORD_PICKERS.rule(data(), "5");
      for (const id of ["recurring-confirm", "recurring-skip"]) {
        const write = buildWrite(WORKFLOWS[id], {}, ctx(record));
        assert.equal(gate.isWriteOpen(write.operation), false, write.operation);
        assert.throws(() => sendWorkflowWrite(write), { name: "WriteClosedError" });
      }
    } finally {
      gate.setWriteApprovalsForTests(null);
    }
    assert.deepEqual(calls, []);
  });
});
