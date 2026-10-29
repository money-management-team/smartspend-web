import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import { byText, click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoalDetails } = await import("../src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx");

/* ------------------------------------------------------------- fixtures */

const goal = (over = {}) => ({
  id: 1,
  workspace_id: 3,
  name: "Emergency fund",
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: "2038-12-30",
  status: "active",
  account: { id: 101, name: "Emergency fund", type: "savings", currency_code: "ILS" },
  progress: { target_amount: "5000.0000", saved_amount: "1250.0000", remaining_amount: "3750.0000", percentage_funded: "25.0000", status: "in_progress", deadline_passed: false },
  ...over,
});

const row = (id, planId, sequence, over = {}) => ({
  id,
  savings_plan_id: planId,
  sequence,
  planned_date: `2037-${String(sequence).padStart(2, "0")}-01`,
  original_planned_date: null,
  postponed_count: 0,
  amount: "250.0000",
  status: "planned",
  from_account_id: 5,
  fulfilled_amount: null,
  fulfilled_at: null,
  fulfilled_goal_movement_id: null,
  skipped_at: null,
  resolution_reason: null,
  lock_version: 1,
  reversal_state: "none",
  confirmed_amount: null,
  effective_amount: null,
  reversed_amount: null,
  shortfall_amount: null,
  ...over,
});

// Active plan 9: installment 31 confirmed, 32–39 open (eight open rows).
const activeRows = [
  row(31, 9, 1, { status: "fulfilled", fulfilled_amount: "250.0000", fulfilled_goal_movement_id: 70, confirmed_amount: "250.0000", effective_amount: "250.0000" }),
  ...Array.from({ length: 8 }, (_, index) => row(32 + index, 9, 2 + index)),
];

const planData = ({ mode = "single", canManage = true } = {}) => ({
  savings_goal: goal(),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: {
    id: 9, savings_goal_id: 1, status: "active", intensity: "balanced", frequency: "monthly", interval: 1, currency_code: "ILS",
    installment_amount: "250.0000", final_installment_amount: "250.0000", installment_count: 9, start_date: "2037-01-01",
    expected_completion_date: "2037-09-01", target_date: "2038-12-30", funding_mode: mode, plan_version: 3, can_manage: canManage,
    funding_sources: [{ account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: mode === "allocated" ? 10000 : null }],
    next_installment: { ...activeRows[1], is_overdue: false },
    installments: activeRows,
  },
  plan_health: { executable: true, outstanding_amount: "2000.0000", outstanding_count: 8, overdue: { count: 0 }, reasons: [] },
});

const historyPlan = (id, status, over = {}) => ({
  id, savings_goal_id: 1, status, plan_version: id, intensity: "easy", frequency: "monthly", interval: 1, currency_code: "ILS",
  installment_amount: "100.0000", final_installment_amount: "100.0000", installment_count: 60, start_date: "2032-01-01",
  expected_completion_date: "2036-12-01", target_date: "2038-12-30", baseline_remaining: "6000.0000", funding_mode: "single",
  funding_sources: [], installments_summary: { total: 60, fulfilled: 55, open: 0, cancelled: 5 }, financial_summary: null, can_manage: true,
  closed_reason: status === "superseded" ? "plan_superseded" : status === "completed" ? "goal_achieved" : null,
  supersedes_plan_id: null, superseded_by_plan_id: null, funding_revisions: [], accepted_at: "2031-12-20T09:00:00Z",
  completed_at: status === "completed" ? "2036-11-21T09:00:00Z" : null, discontinued_at: null,
  superseded_at: status === "superseded" ? "2036-12-30T09:00:00Z" : null, capacity_snapshot: null,
  ...over,
});

const historyPage = (plans, page = 1, lastPage = 1) => ({
  savings_plans: { current_page: page, data: plans, last_page: lastPage, per_page: 5, total: 7 },
});

const installmentsPage = (planId, status, items, page, lastPage) => ({
  savings_plan: { id: planId, savings_goal_id: 1, status, plan_version: planId, currency_code: "ILS", can_manage: true },
  installments: { current_page: page, data: items, last_page: lastPage, per_page: 50, total: 60 },
});

// Plan 8's 60 installments over two pages of 50; the reminder's (id 856) is on page 2.
const plan8Rows = Array.from({ length: 60 }, (_, index) =>
  row(800 + index + 1, 8, index + 1, {
    planned_date: `2032-01-01`,
    status: index < 55 ? "fulfilled" : "cancelled",
    resolution_reason: index < 55 ? null : "plan_superseded",
    fulfilled_amount: index < 55 ? "100.0000" : null,
    fulfilled_goal_movement_id: index < 55 ? 5000 + index : null,
    confirmed_amount: index < 55 ? "100.0000" : null,
    effective_amount: index < 55 ? "100.0000" : null,
    amount: "100.0000",
  }),
);

const notFound = { status: 404, body: { status: false, message: "Not found." } };

function serve(routes = {}) {
  const queues = Object.fromEntries(Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));

  return mockFetch((url, init) => {
    const method = init.method ?? "GET";
    const parsed = new URL(url, "http://localhost");
    const path = parsed.pathname.replace(/^\/api/, "");
    const page = parsed.searchParams.get("page");
    const queue = queues[`${method} ${path}${page ? `?page=${page}` : ""}`] ?? queues[`${method} ${path}`];

    if (queue) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      const answer = typeof next === "function" ? next() : next;
      return answer.status ? answer : { body: envelope(answer) };
    }
    if (method !== "GET") throw new Error(`Unexpected write ${method} ${path}`);
    return { body: envelope({}) };
  });
}

const callsTo = (calls, method, path) =>
  calls.filter((call) => call.method === method && new URL(call.url, "http://localhost").pathname === `/api${path}`);
const param = (call, name) => new URL(call.url, "http://localhost").searchParams.get(name);

async function settle(times = 14) {
  for (let i = 0; i < times; i += 1) await flush();
}

async function renderDetails(path, { language = "en" } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [{ path: "/dashboard/savings-goals/:savingsGoalId", element: h(SavingsGoalDetails, { smartSavingsEnabled: true }) }],
    { initialEntries: [path] },
  );
  const view = await render(
    withI18n(i18n, h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, h(RouterProvider, { router }))),
  );
  await settle();
  return { ...view, i18n, router };
}

const writes = (calls) => calls.filter((call) => call.method !== "GET");
const banner = (view) => view.container.querySelector(".smart-plan__reminder");
const dialog = () => document.querySelector(".plan-dialog");

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- active plan */

describe("reminder for the active plan", () => {
  it("reveals an installment past the first four open rows and reviews it through a fresh preview", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plans": historyPage([historyPlan(9, "active")]),
      "GET /savings-goals/1/planned-contributions/38/confirmation-preview": {
        confirmation: {
          confirmable: true, blocker: null, warnings: [],
          savings_goal: { id: 1, name: "Emergency fund" },
          savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: "single" },
          installment: { id: 38, sequence: 8, status: "planned", planned_date: "2037-08-01", scheduled_amount: "250.0000", lock_version: 1 },
          suggested_amount: "250.0000", default_account_id: 5,
          accounts: [{ id: 5, name: "Main bank", currency_code: "ILS", available_balance: "900.0000", covers_suggested_amount: true }],
        },
      },
    });
    // Installment 38 is the seventh open one: hidden behind "Show all" without the reminder.
    const view = await renderDetails("/dashboard/savings-goals/1?plan=9&installment=38");

    const focused = view.container.querySelector('.smart-plan .installment-timeline__row--focus[data-installment-id="38"]');
    assert.ok(focused, "the reminded row is shown and highlighted");
    assert.equal(focused.getAttribute("aria-current"), "true");
    assert.equal(view.container.querySelector(".smart-plan .installment-timeline__toggle"), null, "the list is opened, not toggled");
    assert.match(banner(view).textContent, /Reminder: installment 8/);
    assert.equal(view.container.querySelector(".plan-history .installment-timeline__row--focus"), null, "history leaves the active plan to the panel");

    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/38/confirmation-preview").length, 0, "nothing opened by itself");
    await click(byText(banner(view), "Review installment"));
    await settle();
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/38/confirmation-preview").length, 1, "a fresh preview");
    assert.ok(dialog());
    assert.equal(writes(calls).length, 0, "no money moved");
    await view.unmount();
  });

  it("an allocated plan's review asks the backend for a fresh funding preview, never a confirmation", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData({ mode: "allocated" }),
      "GET /savings-goals/1/plans": historyPage([]),
      "POST /savings-goals/1/planned-contributions/32/funding-preview": { status: 500, body: { status: false, message: "Down." } },
    });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=9&installment=32");

    await click(byText(banner(view), "Review installment"));
    await settle();
    assert.equal(callsTo(calls, "POST", "/savings-goals/1/planned-contributions/32/funding-preview").length, 1, "read only preview");
    assert.equal(callsTo(calls, "POST", "/savings-goals/1/planned-contributions/32/confirm-accounts").length, 0);
    await view.unmount();
  });

  it("shows an already confirmed installment's state instead of offering a confirmation", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData(), "GET /savings-goals/1/plans": historyPage([]) });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=9&installment=31");

    assert.match(banner(view).textContent, /Installment 1 is Confirmed\. There's nothing to confirm/);
    assert.equal(byText(banner(view), "Review installment"), undefined);
    assert.ok(view.container.querySelector('.installment-timeline__row--focus[data-installment-id="31"]'));
    await view.unmount();
  });

  it("a viewer who doesn't manage the plan sees the installment but no review", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData({ canManage: false }), "GET /savings-goals/1/plans": historyPage([]) });
    const view = await renderDetails("/dashboard/savings-goals/1?installment=33");

    assert.match(banner(view).textContent, /can't be confirmed from here/);
    assert.equal(byText(banner(view), "Review installment"), undefined);
    await view.unmount();
  });

  it("ignores malformed ids", async () => {
    const calls = serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData(), "GET /savings-goals/1/plans": historyPage([]) });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=abc&installment=-3");

    assert.equal(banner(view), null);
    assert.equal(view.container.querySelector(".installment-timeline__row--focus"), null);
    assert.equal(writes(calls).length, 0);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- closed plans */

describe("reminder for an earlier plan", () => {
  it("finds the plan on an older page, opens it and pages its installments to the reminded one", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plans?page=2": historyPage([historyPlan(8, "superseded")], 2, 2),
      "GET /savings-goals/1/plans": historyPage([historyPlan(9, "active")], 1, 2),
      "GET /savings-goals/1/plans/8/installments?page=2": installmentsPage(8, "superseded", plan8Rows.slice(50), 2, 2),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(8, "superseded", plan8Rows.slice(0, 50), 1, 2),
    });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=856");
    await settle();

    assert.match(banner(view).textContent, /earlier plan/, "the panel hands over to history");
    const plans = callsTo(calls, "GET", "/savings-goals/1/plans");
    assert.deepEqual(plans.map((call) => param(call, "page")), [null, "2"], "older page read automatically");

    const installments = callsTo(calls, "GET", "/savings-goals/1/plans/8/installments");
    assert.equal(param(installments[0], "per_page"), "50");
    assert.deepEqual(installments.map((call) => param(call, "page")), [null, "2"], "paged until found");

    const card = [...view.container.querySelectorAll(".plan-history__card")].find((item) => /Replaced/.test(item.textContent));
    assert.equal(byText(card, "Hide installments").getAttribute("aria-expanded"), "true");
    assert.ok(card.querySelector('.installment-timeline__row--focus[data-installment-id="856"]'));
    assert.match(card.querySelector(".plan-installments__focus").textContent, /installment 56 is Cancelled\. This plan is Replaced/);
    assert.equal(card.querySelectorAll(".installment-timeline__action--primary").length, 0, "nothing to confirm in a closed plan");
    assert.equal(writes(calls).length, 0);
    await view.unmount();
  });

  it("works for an achieved goal, which has no active plan to look up", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal({ status: "achieved" }) },
      "GET /savings-goals/1/plans": historyPage([historyPlan(8, "completed")]),
      "GET /savings-goals/1/plans/8/installments?page=2": installmentsPage(8, "completed", plan8Rows.slice(50), 2, 2),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(8, "completed", plan8Rows.slice(0, 50), 1, 2),
    });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=820", { language: "ar" });

    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plan").length, 0);
    assert.ok(view.container.querySelector('.installment-timeline__row--focus[data-installment-id="820"]'));
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans/8/installments").length, 1, "found on the first page");
    assert.match(view.container.querySelector(".plan-installments__focus").textContent, /القسط 20/);
    await view.unmount();
  });

  it("says so when the plan or installment isn't there", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plans": historyPage([historyPlan(8, "completed")]),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(8, "completed", plan8Rows.slice(0, 3), 1, 1),
    });
    let view = await renderDetails("/dashboard/savings-goals/1?plan=77&installment=5");
    assert.match(view.container.querySelector(".plan-history").textContent, /isn't in this goal's history/);
    await view.unmount();

    view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=999");
    assert.match(view.container.querySelector(".plan-installments__focus").textContent, /isn't in this plan/);
    await view.unmount();
  });

  it("stops paging on a page that isn't the one asked for, and never loops", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plans": historyPage([historyPlan(8, "completed")]),
      // Asked for page 2, the backend answers page 1 again.
      "GET /savings-goals/1/plans/8/installments": installmentsPage(8, "completed", plan8Rows.slice(0, 50), 1, 2),
    });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=856");
    await settle(20);

    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans/8/installments").length, 2, "one retry-free extra page, then stop");
    assert.ok(view.container.querySelector(".plan-installments__error"), "the failure is explained with a retry");
    assert.equal(view.container.querySelector(".plan-installments__focus"), null, "no guess that the installment is missing");
    await view.unmount();
  });

  it("caps automatic paging even if the backend keeps reporting more pages", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": notFound,
      "GET /savings-goals/1/plans": (() => {
        let page = 0;
        return () => {
          page += 1;
          return historyPage([historyPlan(1000 + page, "superseded")], page, 10000);
        };
      })(),
    });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=5");
    await settle(200);

    const requests = callsTo(calls, "GET", "/savings-goals/1/plans").length;
    assert.ok(requests <= 40, `bounded (${requests} requests)`);
    assert.match(view.container.querySelector(".plan-history").textContent, /isn't in this goal's history/);
    await view.unmount();
  });

  it("an inaccessible goal shows the goal's not-found state and asks for no plan", async () => {
    const calls = serve({ "GET /savings-goals/1": notFound });
    const view = await renderDetails("/dashboard/savings-goals/1?plan=8&installment=5");

    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plan").length, 0);
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans").length, 0);
    assert.equal(writes(calls).length, 0);
    await view.unmount();
  });
});
