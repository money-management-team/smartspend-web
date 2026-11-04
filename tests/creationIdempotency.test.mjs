import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { change, click, flush, installDom, render, submit } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

/*
 * POST /debts, POST /savings-goals and POST /recurring-transactions require an
 * Idempotency-Key (smartspend-backend fix/financial-idempotency-p0 @ 6b696d72:
 * StoreDebtRequest, StoreSavingsGoalRequest, StoreRecurringTransactionRequest).
 * No real network: every request is answered by mockFetch.
 */

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { debtsApi } = await import("../src/features/Dashboards/User/api/debtsApi.js");
const { savingsGoalsApi } = await import("../src/features/Dashboards/User/api/savingsGoalsApi.js");
const { recurringTransactionsApi } = await import("../src/features/Dashboards/User/api/recurringTransactionsApi.js");
const { createSubmissionAttempt } = await import("../src/features/Dashboards/User/FinancialOperations/transactionHelpers.js");
const { default: SavingsGoals } = await import("../src/features/Dashboards/User/SavingsGoals/SavingsGoals.jsx");
const { default: Debts } = await import("../src/features/Dashboards/User/Debts/Debts.jsx");
const { default: Recurring } = await import("../src/features/Dashboards/User/Recurring/Recurring.jsx");
const gate = await import("../src/mobile/data/writeGate.js");
const { sendWorkflowWrite } = await import("../src/mobile/data/writeApi.js");
const { WORKFLOWS, validateWorkflow } = await import("../src/mobile/forms/workflows.js");

const KEY = "test-key-0001";
const path = (call) => new URL(call.url, "http://localhost").pathname;
const created = (status = 201) => ({ status, body: envelope({}) });

beforeEach(() => installBrowserStubs());

/* ------------------------------------------------------------- API contract */

const CREATES = [
  {
    name: "debtsApi.create",
    endpoint: "/api/debts",
    send: (key) => debtsApi.create({ workspace_id: 1, direction: "payable", counterparty_name: "Sam", original_amount: "12.5", currency_code: "ILS", account_id: 3, user_id: 9 }, key),
    body: { workspace_id: 1, direction: "payable", counterparty_name: "Sam", original_amount: "12.5000", currency_code: "ILS", account_id: 3 },
  },
  {
    name: "savingsGoalsApi.create",
    endpoint: "/api/savings-goals",
    send: (key) => savingsGoalsApi.create({ workspace_id: 1, name: "Trip", target_amount: "900", currency_code: "ILS", status: "active" }, key),
    body: { workspace_id: 1, name: "Trip", target_amount: "900.0000", currency_code: "ILS" },
  },
  {
    name: "recurringTransactionsApi.create",
    endpoint: "/api/recurring-transactions",
    send: (key) => recurringTransactionsApi.create({ account_id: 3, category_id: 4, name: "Salary", type: "income", amount: "100", frequency: "monthly", start_date: "2026-11-01", next_due_date: "2026-12-01" }, key),
    body: { account_id: 3, category_id: 4, name: "Salary", type: "income", amount: "100.0000", frequency: "monthly", start_date: "2026-11-01" },
  },
];

describe("creation API contract", () => {
  for (const { name, endpoint, send, body } of CREATES) {
    it(`${name} sends one POST with the Idempotency-Key header and only the allowed fields`, async () => {
      const calls = mockFetch(() => created());
      await send(KEY);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, "POST");
      assert.equal(path(calls[0]), endpoint);
      assert.equal(calls[0].headers["Idempotency-Key"], KEY);
      assert.deepEqual(calls[0].body, body);
      assert.equal(Object.hasOwn(calls[0].body, "idempotency_key"), false, "the key travels in the header, not the body");
    });

    it(`${name} refuses to send without a key`, () => {
      const calls = mockFetch(() => created());
      assert.throws(() => send(undefined), /requires an Idempotency-Key/);
      assert.equal(calls.length, 0);
    });
  }
});

/* ------------------------------------------------------------- key lifetime */

describe("createSubmissionAttempt: one key per submission intent", () => {
  it("keeps the key after every uncertain outcome", () => {
    const attempt = createSubmissionAttempt("debt-create");
    const first = attempt.key();
    assert.match(first, /^debt-create-[A-Za-z0-9-]{8,}$/);
    for (const code of ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR", "CONFLICT", "RATE_LIMITED"]) {
      attempt.settle({ code });
      assert.equal(attempt.key(), first, `${code} must not renew the key`);
    }
  });

  it("renews the key after a success or a definitive rejection", () => {
    const attempt = createSubmissionAttempt("debt-create");
    const first = attempt.key();
    attempt.settle(null);
    const second = attempt.key();
    assert.notEqual(second, first);
    attempt.settle({ code: "VALIDATION_ERROR" });
    assert.notEqual(attempt.key(), second);
  });

  it("gives each new intent (a new opening of the form) its own key", () => {
    assert.notEqual(createSubmissionAttempt("x-create").key(), createSubmissionAttempt("x-create").key());
  });
});

/* ------------------------------------------------------------- Desktop page */

describe("Desktop: creating a savings goal", () => {
  let view;
  afterEach(async () => {
    await view?.unmount();
    view = null;
  });

  function serve(answers) {
    return mockFetch((url, init) => {
      const p = new URL(url, "http://localhost").pathname;
      if (p === "/api/dashboard") return { body: envelope({ scope: { workspace_id: 1, primary_currency_code: "ILS" } }) };
      if (p === "/api/savings-goals" && (init.method ?? "GET") === "GET") {
        return { body: envelope({ savings_goals: { data: [], current_page: 1, last_page: 1, per_page: 12, total: 0, from: null, to: null } }) };
      }
      if (p === "/api/savings-goals" && init.method === "POST") return answers.shift();
      throw new Error(`Unexpected request ${init.method ?? "GET"} ${url}`);
    });
  }

  async function openNewGoalForm() {
    const i18n = await createI18n("en");
    const router = createMemoryRouter(
      [{ path: "/dashboard/savings-goals", element: h(SavingsGoals, { smartSavingsEnabled: false }) }],
      { initialEntries: ["/dashboard/savings-goals?new=1"] },
    );
    view = await render(withI18n(i18n, h(RouterProvider, { router })));
    for (let i = 0; i < 6; i += 1) await flush();
  }

  async function fillAndSubmit() {
    const form = document.querySelector("form");
    assert.ok(form, "the create form is open");
    await change(form.querySelector("[name='name']"), "Trip");
    await change(form.querySelector("[name='target_amount']"), "900");
    await submit(form);
    for (let i = 0; i < 6; i += 1) await flush();
  }

  const posts = (calls) => calls.filter((call) => call.method === "POST");

  it("retries an uncertain outcome with the same key, then records the goal once", async () => {
    const calls = serve([
      { status: 503, body: { status: false, message: "Unavailable" } },
      { status: 201, body: envelope({ savings_goal: { id: 7, name: "Trip" } }) },
    ]);
    await openNewGoalForm();
    await fillAndSubmit();
    assert.ok(document.querySelector("form"), "the form stays open after the 503");
    await fillAndSubmit();

    const [first, retry] = posts(calls);
    assert.equal(posts(calls).length, 2);
    assert.match(first.headers["Idempotency-Key"], /^savings-goal-create-/);
    assert.equal(retry.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    assert.equal(first.body.workspace_id, 1);
    assert.equal(document.querySelector("form"), null, "the form closes after the 201");
  });

  it("uses a fresh key after a definitive 422", async () => {
    const calls = serve([
      { status: 422, body: { status: false, message: "The given data was invalid.", errors: { name: ["Taken."] } } },
      { status: 201, body: envelope({ savings_goal: { id: 8, name: "Trip" } }) },
    ]);
    await openNewGoalForm();
    await fillAndSubmit();
    await fillAndSubmit();

    const [first, second] = posts(calls);
    assert.equal(posts(calls).length, 2);
    assert.notEqual(second.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
  });
});

/* ------------------------------------------------------------- Desktop: debts and recurring */

async function mountPage(Page) {
  const i18n = await createI18n("en");
  const router = createMemoryRouter([{ path: "*", element: h(Page) }], { initialEntries: ["/dashboard/x"] });
  const view = await render(withI18n(i18n, h(RouterProvider, { router })));
  for (let i = 0; i < 6; i += 1) await flush();
  return view;
}

const settle = async () => {
  for (let i = 0; i < 8; i += 1) await flush();
};

const emptyPage = { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null };

/** Answers the page's reads, and each create POST to `endpoint` with the next of `answers`. */
function servePage(endpoint, answers, reads = {}) {
  return mockFetch((url, init) => {
    const p = new URL(url, "http://localhost").pathname;
    const method = init.method ?? "GET";
    if (p === endpoint && method === "POST") return answers.shift();
    if (method === "GET" && reads[p]) return { body: envelope(reads[p]) };
    if (method === "GET") return { body: envelope({}) };
    throw new Error(`Unexpected request ${method} ${url}`);
  });
}

const postsTo = (calls, endpoint) => calls.filter((call) => call.method === "POST" && path(call) === endpoint);
const unavailable = { status: 503, body: { status: false, message: "Unavailable" } };

describe("Desktop: recording a debt", () => {
  const reads = { "/api/dashboard": { scope: { workspace_id: 1, primary_currency_code: "ILS" } }, "/api/debts": { debts: emptyPage } };

  async function fillAndSubmit() {
    const form = document.querySelector("form");
    assert.ok(form, "the debt form is open");
    await click(form.querySelector("[name='direction'][value='payable']"));
    await change(form.querySelector("[name='counterparty_name']"), "Sam");
    await change(form.querySelector("[name='original_amount']"), "50");
    await submit(form);
    await settle();
  }

  it("keeps the key for a retry in the same form, and a new form gets a new key", async () => {
    const calls = servePage("/api/debts", [unavailable, created(), created()], reads);
    const view = await mountPage(Debts);
    await click(document.querySelector(".debts-header__button"));
    await fillAndSubmit();
    await fillAndSubmit();
    await click(document.querySelector(".debts-header__button"));
    await fillAndSubmit();

    const [first, retry, next] = postsTo(calls, "/api/debts");
    assert.equal(postsTo(calls, "/api/debts").length, 3);
    assert.match(first.headers["Idempotency-Key"], /^debt-create-/);
    assert.equal(retry.headers["Idempotency-Key"], first.headers["Idempotency-Key"], "the retry after a 503 reuses the key");
    assert.notEqual(next.headers["Idempotency-Key"], first.headers["Idempotency-Key"], "a new opening is a new intent");
    assert.equal(first.body.workspace_id, 1);
    await view.unmount();
  });
});

describe("Desktop: creating a recurring rule", () => {
  const reads = {
    "/api/recurring-transactions": { recurring_transactions: emptyPage },
    "/api/accounts": { accounts: [{ id: 3, name: "Bank", type: "bank", currency_code: "ILS", status: "active" }] },
    "/api/categories": { categories: [{ id: 4, name: "Salary", type: "income", status: "active", is_active: true }] },
  };

  it("sends the key with the income rule and reuses it after an uncertain outcome", async () => {
    const calls = servePage("/api/recurring-transactions", [unavailable, created()], reads);
    const view = await mountPage(Recurring);
    const addIncome = [...document.querySelectorAll(".recurring-header__button")].find((button) => /income/i.test(button.textContent));
    await click(addIncome);
    await settle();

    const form = document.querySelector("form");
    assert.ok(form, "the recurring form is open");
    await change(form.querySelector("[name='account_id']"), "3");
    await change(form.querySelector("[name='category_id']"), "4");
    await change(form.querySelector("[name='name']"), "Salary");
    await change(form.querySelector("[name='amount']"), "100");
    await submit(form);
    await settle();
    await submit(document.querySelector("form"));
    await settle();

    const [first, retry] = postsTo(calls, "/api/recurring-transactions");
    assert.equal(postsTo(calls, "/api/recurring-transactions").length, 2);
    assert.match(first.headers["Idempotency-Key"], /^recurring-create-/);
    assert.equal(retry.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    assert.equal(first.body.type, "income");
    assert.equal(first.body.category_id, 4);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- Mobile */

describe("Mobile: the three creates", () => {
  afterEach(() => gate.setWriteApprovalsForTests(null));

  const writes = {
    "debt.create": { operation: "debt.create", ids: {}, input: { workspace_id: 1, direction: "payable", counterparty_name: "Sam", original_amount: "1.0000", currency_code: "ILS" } },
    "goal.create": { operation: "goal.create", ids: {}, input: { workspace_id: 1, name: "Trip", target_amount: "9.0000", currency_code: "ILS" } },
    "recurring.create": { operation: "recurring.create", ids: {}, input: { account_id: 3, category_id: 4, name: "Rent", type: "expense", amount: "5.0000", frequency: "monthly", start_date: "2026-11-01" } },
  };

  it("stay closed in the shipped source", () => {
    for (const operation of Object.keys(writes)) {
      assert.equal(gate.MOBILE_WRITES[operation].key, "client");
      assert.equal(gate.isWriteOpen(operation), false);
      assert.throws(() => sendWorkflowWrite(writes[operation], KEY), { name: "WriteClosedError" });
    }
  });

  it("when opened for a test, send the submission's key and need one", async () => {
    gate.setWriteApprovalsForTests(Object.keys(writes));
    for (const [operation, write] of Object.entries(writes)) {
      const calls = mockFetch(() => created());
      assert.throws(() => sendWorkflowWrite(write), /needs an Idempotency-Key/);
      await sendWorkflowWrite(write, `mobile-${operation.replace(".", "-")}-0001`);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].headers["Idempotency-Key"], `mobile-${operation.replace(".", "-")}-0001`);
    }
  });

  it("the recurring form asks for a category for income too", () => {
    const ctx = { today: "2026-11-04", accounts: [{ id: "3", currency: "ILS" }], categories: [{ id: "4", type: "income" }] };
    const values = { ...WORKFLOWS.recurring.initial(ctx), name: "Salary", type: "income", account_id: "3", amount: "100" };
    assert.equal(validateWorkflow(WORKFLOWS.recurring, values, ctx).category_id, "required");
    assert.deepEqual(validateWorkflow(WORKFLOWS.recurring, { ...values, category_id: "4" }, ctx), {});
  });
});
