import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import {
  appendPlans,
  daysBetween,
  getCompletionPerformance,
  getEndingKey,
  getInstallmentShare,
  readPlanHistory,
  toDateIn,
} from "../src/features/Dashboards/User/SavingsGoals/planHistoryHelpers.js";
import {
  buildFundingRevision,
  buildScheduleRevision,
  countReversibleSplitPayments,
  getPlanFunding,
  getPlanRhythm,
  getRevisionErrorStep,
  isSameFunding,
} from "../src/features/Dashboards/User/SmartPlanRevision/planRevisionHelpers.js";
import { byText, change, click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoalDetails } = await import("../src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx");
const { default: SmartPlanRevision } = await import("../src/features/Dashboards/User/SmartPlanRevision/SmartPlanRevision.jsx");

/* ------------------------------------------------------------- fixtures */

const fingerprint = (seed) => seed.repeat(64).slice(0, 64);

const goal = (over = {}) => ({
  id: 1,
  workspace_id: 3,
  name: "Emergency fund",
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: "2037-08-30",
  status: "active",
  account: { id: 101, name: "Emergency fund", type: "savings", currency_code: "ILS" },
  progress: { target_amount: "5000.0000", saved_amount: "1250.0000", remaining_amount: "3750.0000", percentage_funded: "25.0000", status: "in_progress", deadline_passed: false },
  ...over,
});

const installment = (id, over = {}) => ({
  id,
  savings_plan_id: 9,
  sequence: id,
  planned_date: `2037-0${id}-01`,
  original_planned_date: null,
  postponed_count: 0,
  amount: "312.5000",
  status: "planned",
  from_account_id: 5,
  fulfilled_amount: null,
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

const plan = (over = {}) => ({
  id: 9,
  savings_goal_id: 1,
  status: "active",
  intensity: "balanced",
  frequency: "monthly",
  interval: 1,
  currency_code: "ILS",
  installment_amount: "312.5000",
  final_installment_amount: "312.5000",
  installment_count: 4,
  start_date: "2037-01-01",
  expected_completion_date: "2037-04-01",
  target_date: "2037-08-30",
  baseline_remaining: "1250.0000",
  funding_mode: "priority",
  plan_version: 3,
  funding_sources: [
    { account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: null },
    { account_id: 6, account_name: "Wallet", priority: 2, allocation_bps: null },
  ],
  next_installment: { ...installment(3), is_overdue: false },
  installments: [
    installment(1, { status: "fulfilled", fulfilled_amount: "312.5000", confirmed_amount: "312.5000", effective_amount: "312.5000", lock_version: 3, from_account_id: null }),
    installment(2, { status: "fulfilled", fulfilled_amount: "312.5000", fulfilled_goal_movement_id: 77, effective_amount: "312.5000" }),
    installment(3, { lock_version: 2 }),
    installment(4),
  ],
  ...over,
});

const planData = ({ goalOver = {}, ...over } = {}) => ({
  savings_goal: goal(goalOver),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: plan(over),
  plan_health: { executable: true, outstanding_amount: "625.0000", outstanding_count: 2, overdue: { count: 0 }, reasons: [] },
});

const accounts = [
  { id: 5, name: "Main bank", type: "bank", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 6, name: "Wallet", type: "wallet", currency_code: "ILS", status: "active", savings_goal: null },
];

const option = (intensity, over = {}) => ({
  intensity,
  basis: "deadline",
  status: "scheduled",
  is_feasible: true,
  installment_amount: { easy: "125.0000", balanced: "250.0000", intensive: "625.0000" }[intensity],
  final_installment_amount: { easy: "125.0000", balanced: "250.0000", intensive: "625.0000" }[intensity],
  installment_count: { easy: 30, balanced: 15, intensive: 6 }[intensity],
  frequency: "monthly",
  interval: 1,
  first_due_date: "2037-03-01",
  expected_completion_date: "2037-08-01",
  target_date: "2037-08-30",
  shortfall_amount: null,
  affordability: { band: "comfortable", monthly_equivalent: "625.0000", share_of_capacity_bps: 3000, reasons: [] },
  warnings: [],
  duplicate_of: null,
  options_fingerprint: fingerprint(intensity[0]),
  assessment_fingerprint: fingerprint(intensity[1]),
  installments: [],
  ...over,
});

const planOptions = (over = {}) => ({
  goal: { id: 1, currency_code: "ILS", target_amount: "5000.0000", saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  schedule: { frequency: "monthly", interval: 1, first_due_date: "2037-03-01", target_date: "2037-08-30" },
  capacity: { status: "known", currency_code: "ILS", monthly_amount: "2000.0000", reasons: [], warnings: [] },
  options: [option("easy"), option("balanced"), option("intensive")],
  recommended_intensity: "intensive",
  recommendation_reason: "fastest_comfortable_option",
  warnings: [],
  ...over,
});

const historyPlan = (id, over = {}) => ({
  id,
  savings_goal_id: 1,
  status: "superseded",
  plan_version: id,
  intensity: "balanced",
  frequency: "monthly",
  interval: 1,
  currency_code: "ILS",
  installment_amount: "300.0000",
  final_installment_amount: "300.0000",
  installment_count: 10,
  start_date: "2036-01-01",
  expected_completion_date: "2036-10-01",
  target_date: "2037-08-30",
  baseline_remaining: "3000.0000",
  funding_mode: "single",
  funding_sources: [{ account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: null }],
  installments_summary: { total: 10, fulfilled: 2, open: 0, cancelled: 8 },
  closed_reason: "plan_superseded",
  supersedes_plan_id: null,
  superseded_by_plan_id: null,
  funding_revisions: [],
  accepted_at: "2036-01-01T09:00:00.000000Z",
  completed_at: null,
  discontinued_at: null,
  superseded_at: "2036-03-05T09:00:00.000000Z",
  capacity_snapshot: null,
  ...over,
});

const historyPage = (plans, { page = 1, lastPage = 1, total = plans.length } = {}) => ({
  savings_plans: { current_page: page, data: plans, last_page: lastPage, per_page: 5, total },
});

const notFound = { status: 404, body: { status: false, message: "Not found." } };
const conflict = (code, extra = {}) => ({ status: 409, body: { status: false, message: "Conflict.", code, ...extra } });

function serve(routes = {}) {
  const queues = Object.fromEntries(Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));

  return mockFetch((url, init) => {
    const method = init.method ?? "GET";
    const path = new URL(url, "http://localhost").pathname.replace(/^\/api/, "");
    const queue = queues[`${method} ${path}`];

    if (queue) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      const answer = typeof next === "function" ? next() : next;
      return answer.status ? answer : { body: envelope(answer) };
    }
    if (method === "GET" && path === "/accounts") return { body: envelope({ accounts }) };
    if (method !== "GET") throw new Error(`Unexpected write ${method} ${path}`);
    return { body: envelope({}) };
  });
}

const callsTo = (calls, method, path) =>
  calls.filter((call) => call.method === method && new URL(call.url, "http://localhost").pathname === `/api${path}`);

async function settle(times = 10) {
  for (let i = 0; i < times; i += 1) await flush();
}

function LocationProbe() {
  const location = useLocation();
  return h("output", { "data-path": location.pathname, "data-revised": String(location.state?.smartPlanRevised ?? "") });
}

const auth = (children) => h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, children);

async function renderDetails({ language = "en", enabled = true } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [
      { path: "/dashboard/savings-goals/:savingsGoalId", element: h(SavingsGoalDetails, { smartSavingsEnabled: enabled }) },
      { path: "*", element: h(LocationProbe) },
    ],
    { initialEntries: ["/dashboard/savings-goals/1"] },
  );
  const view = await render(withI18n(i18n, auth(h(RouterProvider, { router }))));
  await settle();
  return { ...view, i18n, router };
}

async function renderRevision(change, { language = "en" } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [
      { path: "/dashboard/savings-goals/:savingsGoalId/smart-plan/revise/:change", element: h(SmartPlanRevision, { smartSavingsEnabled: true }) },
      { path: "*", element: h(LocationProbe) },
    ],
    { initialEntries: [`/dashboard/savings-goals/1/smart-plan/revise/${change}`] },
  );
  const view = await render(withI18n(i18n, auth(h(RouterProvider, { router }))));
  await settle();
  return { ...view, i18n, router };
}

const dialog = () => document.querySelector(".plan-dialog");
const probe = (view) => view.container.querySelector("output");
const continueButton = (view) => byText(view.container, "Continue");

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- helpers */

describe("revision helpers", () => {
  it("starts from the plan's own rhythm and funding", () => {
    assert.equal(getPlanRhythm({ frequency: "weekly", interval: 2 }), "biweekly");
    assert.equal(getPlanRhythm({ frequency: "monthly", interval: 3 }), "quarterly");
    assert.equal(getPlanRhythm({ frequency: "monthly", interval: 5 }), null);

    assert.deepEqual(
      getPlanFunding({
        funding_mode: "allocated",
        funding_sources: [
          { account_id: 6, priority: 2, allocation_bps: 4000 },
          { account_id: 5, priority: 1, allocation_bps: 6000 },
        ],
      }),
      { mode: "allocated", sources: [{ account_id: 5, percent: "60" }, { account_id: 6, percent: "40" }] },
    );
    assert.deepEqual(getPlanFunding({ funding_mode: "at_confirmation", funding_sources: [] }), { mode: "at_confirmation", sources: [] });
  });

  it("recognises an unchanged funding setup, including order", () => {
    const current = plan();
    assert.equal(isSameFunding(current, { mode: "priority", sources: [{ account_id: 5 }, { account_id: 6 }] }), true);
    assert.equal(isSameFunding(current, { mode: "priority", sources: [{ account_id: 6 }, { account_id: 5 }] }), false, "priority order is a change");
    assert.equal(isSameFunding(current, { mode: "single", sources: [{ account_id: 5 }] }), false);
  });

  it("builds revision bodies from the reviewed version, fingerprints and funding only", () => {
    const current = plan();
    const chosen = option("intensive");
    const funding = { mode: "single", sources: [{ account_id: 6, percent: "" }] };

    assert.deepEqual(buildScheduleRevision(current, { rhythm: "biweekly", start_date: "2037-03-10" }, chosen, funding), {
      change: "schedule",
      expected_plan_version: 3,
      intensity: "intensive",
      frequency: "weekly",
      interval: 2,
      start_date: "2037-03-10",
      options_fingerprint: fingerprint("i"),
      assessment_fingerprint: fingerprint("n"),
      funding: { mode: "single", sources: [{ account_id: 6 }] },
    });
    assert.deepEqual(buildFundingRevision(current, funding), {
      change: "funding",
      expected_plan_version: 3,
      funding: { mode: "single", sources: [{ account_id: 6 }] },
    });
  });

  it("points a 422 at the stage that owns the field", () => {
    assert.equal(getRevisionErrorStep({ "funding.sources.0.account_id": ["x"] }, "funding"), "funding");
    assert.equal(getRevisionErrorStep({ options_fingerprint: ["x"] }, "schedule"), "plan");
    assert.equal(getRevisionErrorStep({ start_date: ["x"] }, "schedule"), "schedule");
    assert.equal(getRevisionErrorStep({ start_date: ["x"] }, "funding"), null);
  });

  it("counts split payments that a schedule change would leave behind", () => {
    assert.equal(countReversibleSplitPayments(plan()), 1);
    assert.equal(countReversibleSplitPayments(plan({ installments: [installment(3)] })), 0);
  });
});

describe("history helpers", () => {
  it("reads one goal's plans from the paginator and appends pages without repeats", () => {
    const page = readPlanHistory(historyPage([historyPlan(2), historyPlan(3, { savings_goal_id: 99 })], { lastPage: 2, total: 6 }), 1);
    assert.deepEqual(page.plans.map((item) => item.id), [2]);
    assert.equal(page.lastPage, 2);
    assert.equal(readPlanHistory({ savings_plans: {} }, 1), null);
    assert.deepEqual(appendPlans([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map((item) => item.id), [1, 2, 3]);
  });

  it("compares a completed plan with its own schedule on the user's calendar", () => {
    const completed = historyPlan(4, { status: "completed", closed_reason: "goal_achieved", expected_completion_date: "2036-10-01" });

    assert.deepEqual(getCompletionPerformance({ ...completed, completed_at: "2036-09-21T23:30:00Z" }, "UTC"), {
      completedOn: "2036-09-21",
      plannedOn: "2036-10-01",
      verdict: "early",
      days: 10,
    });
    // 23:30 UTC is already the next day in Gaza (UTC+2/+3).
    assert.equal(getCompletionPerformance({ ...completed, completed_at: "2036-09-30T23:30:00Z" }, "Asia/Gaza").verdict, "onTime");
    assert.equal(getCompletionPerformance({ ...completed, completed_at: "2036-10-04T08:00:00Z" }, "UTC").verdict, "late");
    assert.equal(getCompletionPerformance(historyPlan(5), "UTC"), null, "only completed plans");
    assert.equal(daysBetween("2036-02-28", "2036-03-01"), 2, "leap year");
    assert.equal(toDateIn("not a date", "UTC"), null);
  });

  it("describes how a plan ended and how far it got by count", () => {
    assert.equal(getEndingKey(historyPlan(1)), "plan_superseded");
    assert.equal(getEndingKey(historyPlan(1, { status: "discontinued", closed_reason: null })), "discontinued");
    assert.equal(getEndingKey(historyPlan(1, { status: "active" })), null);
    assert.equal(getInstallmentShare({ total: 8, fulfilled: 2 }), 25);
    assert.equal(getInstallmentShare({ total: 0, fulfilled: 0 }), 0);
  });
});

/* ------------------------------------------------------------- discontinue */

describe("discontinuing a plan", () => {
  it("needs an explicit acknowledgement, sends the reviewed version once, and returns the goal to flexible saving", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": [planData(), notFound],
      "GET /savings-goals/1/plans": [historyPage([historyPlan(9, { status: "active", closed_reason: null, superseded_at: null })]), historyPage([historyPlan(9, { status: "discontinued", closed_reason: "plan_discontinued", superseded_at: null, discontinued_at: "2037-03-02T09:00:00Z" })])],
      "POST /savings-goals/1/plan/discontinue": planData({ status: "discontinued" }),
    });
    const view = await renderDetails();

    await click(byText(view.container, "Discontinue"));
    assert.equal(dialog().getAttribute("role"), "alertdialog");
    assert.match(dialog().textContent, /Open installments2/);
    assert.match(dialog().textContent, /No money moves/);
    assert.match(dialog().textContent, /Saved in the goal \(stays\)₪1,250\.00/);
    assert.equal(document.activeElement?.textContent, "Keep the plan", "the safe choice has focus");

    const submit = byText(dialog(), "Discontinue plan");
    assert.equal(submit.disabled, true, "acknowledgement required");
    await click(dialog().querySelector(".discontinue-plan__ack input"));
    await click(byText(dialog(), "Discontinue plan"));
    await settle();

    const posts = callsTo(calls, "POST", "/savings-goals/1/plan/discontinue");
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body, { expected_plan_version: 3 });
    assert.match(posts[0].headers["Idempotency-Key"], /^savings-plan-discontinue-[A-Za-z0-9._:-]+$/);
    assert.equal(dialog(), null);
    assert.match(view.container.querySelector(".savings-goal-details__notice").textContent, /was discontinued\. No money moved/);
    assert.ok(view.container.querySelector(".smart-plan--invite"), "the goal is flexible again and may take a new plan");
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans").length, 2, "plan history is read again");
    assert.match(view.container.querySelector(".plan-history").textContent, /Discontinued by you/);
    await view.unmount();
  });

  it("on a version conflict reloads the plan, asks again, and never resends on its own", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": [planData(), planData({ plan_version: 4 })],
      "GET /savings-goals/1/plans": historyPage([]),
      "POST /savings-goals/1/plan/discontinue": [conflict("savings_plan_version_conflict", { current_plan_version: 4 }), planData({ status: "discontinued", plan_version: 4 })],
    });
    const view = await renderDetails();

    await click(byText(view.container, "Discontinue"));
    await click(dialog().querySelector(".discontinue-plan__ack input"));
    await click(byText(dialog(), "Discontinue plan"));
    await settle();

    assert.match(dialog().textContent, /The plan changed since you opened this/);
    assert.equal(callsTo(calls, "POST", "/savings-goals/1/plan/discontinue").length, 1, "nothing resent automatically");
    assert.equal(dialog().querySelector(".discontinue-plan__ack input").checked, false, "the acknowledgement covered the old version");
    assert.equal(byText(dialog(), "Discontinue plan").disabled, true);

    await click(dialog().querySelector(".discontinue-plan__ack input"));
    await click(byText(dialog(), "Discontinue plan"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/savings-goals/1/plan/discontinue");
    assert.deepEqual(second.body, { expected_plan_version: 4 }, "the fresh version");
    assert.notEqual(second.headers["Idempotency-Key"], first.headers["Idempotency-Key"], "a rejected request's key isn't reused");
    await view.unmount();
  });

  it("keeps the key after an unknown outcome, so trying again replays", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plans": historyPage([]),
      "POST /savings-goals/1/plan/discontinue": [{ status: 503, body: { status: false, message: "Down." } }, planData({ status: "discontinued" })],
    });
    const view = await renderDetails();

    await click(byText(view.container, "Discontinue"));
    await click(dialog().querySelector(".discontinue-plan__ack input"));
    await click(byText(dialog(), "Discontinue plan"));
    await settle();
    assert.match(dialog().textContent, /couldn't confirm whether this was saved/);

    await click(byText(dialog(), "Try again"));
    await settle();
    const [first, second] = callsTo(calls, "POST", "/savings-goals/1/plan/discontinue");
    assert.equal(second.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- history */

describe("plan history", () => {
  it("shows active, completed, discontinued and replaced plans without mixing in the goal's balance", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plans": [
        historyPage(
          [
            historyPlan(9, { status: "active", closed_reason: null, superseded_at: null, installments_summary: { total: 4, fulfilled: 2, open: 2, cancelled: 0 } }),
            historyPlan(8, {
              status: "completed",
              closed_reason: "goal_achieved",
              superseded_at: null,
              completed_at: "2036-09-21T10:00:00Z",
              baseline_remaining: "2400.0000",
              funding_mode: "allocated",
              funding_sources: [
                { account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: 6000 },
                { account_id: 6, account_name: "Wallet", priority: 2, allocation_bps: 4000 },
              ],
              funding_revisions: [{ change: "funding", revised_at: "2036-05-01T09:00:00+00:00", previous_funding_mode: "single", previous_sources: [] }],
              installments_summary: { total: 8, fulfilled: 8, open: 0, cancelled: 0 },
            }),
          ],
          { lastPage: 2, total: 3 },
        ),
        historyPage([historyPlan(7, { status: "discontinued", closed_reason: "plan_discontinued", superseded_at: null, discontinued_at: "2035-12-01T09:00:00Z" })], { page: 2, lastPage: 2, total: 3 }),
      ],
    });
    const view = await renderDetails();
    const history = view.container.querySelector(".plan-history");

    const [request] = callsTo(calls, "GET", "/savings-goals/1/plans");
    assert.equal(new URL(request.url, "http://localhost").searchParams.get("per_page"), "5");
    assert.match(history.textContent, /Plans: 3/);

    const cards = history.querySelectorAll(".plan-history__card");
    assert.equal(cards.length, 2);
    assert.match(cards[0].textContent, /Active.*Balanced plan/);
    assert.ok(byText(cards[0], "Go to the plan"), "the active plan's installments are in its panel");
    assert.ok(cards[1].querySelector(".plan-history__completion"), "completed plans open with a summary");
    assert.match(cards[1].textContent, /Target reached on/);
    assert.match(cards[1].textContent, /Finished ahead of the plan \(days: 10\)/);
    assert.match(cards[1].textContent, /Set out to cover₪2,400\.00/, "the plan's own figure, labelled as such");
    assert.match(cards[1].textContent, /current balance is in its progress above/);
    assert.match(cards[1].textContent, /Main bank 60% · Wallet 40%/);
    assert.match(cards[1].textContent, /Funding changes: 1/);
    assert.match(cards[1].textContent, /Opening a closed plan's installments.*isn't available yet/, "the gap is said, not hidden");
    assert.equal(cards[1].querySelector(".plan-history__bar").getAttribute("aria-valuenow"), "100");

    await click(byText(history, "Show older plans"));
    await settle();
    const [, older] = callsTo(calls, "GET", "/savings-goals/1/plans");
    assert.equal(new URL(older.url, "http://localhost").searchParams.get("page"), "2");
    assert.equal(history.querySelectorAll(".plan-history__card").length, 3);
    assert.match(history.textContent, /Discontinued by you/);
    assert.equal(byText(history, "Show older plans"), undefined, "no more pages");
    assert.equal(calls.filter((call) => call.method !== "GET").length, 0, "reading history writes nothing");
    await view.unmount();
  });

  it("is shown for an achieved goal, renders nothing for a goal that never had a plan, and isn't requested with the flag off", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal({ status: "achieved" }) },
      "GET /savings-goals/1/plans": historyPage([historyPlan(8, { status: "completed", closed_reason: "goal_achieved", superseded_at: null, completed_at: "2036-10-01T10:00:00Z" })]),
    });
    let view = await renderDetails();
    assert.match(view.container.querySelector(".plan-history").textContent, /Finished on the planned date/);
    await view.unmount();

    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": notFound, "GET /savings-goals/1/plans": historyPage([]) });
    view = await renderDetails();
    assert.equal(view.container.querySelector(".plan-history"), null);
    await view.unmount();

    const calls = serve({ "GET /savings-goals/1": { savings_goal: goal() } });
    view = await renderDetails({ enabled: false });
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans").length, 0);
    assert.equal(view.container.querySelector(".plan-history"), null);
    await view.unmount();
  });

  it("renders in Arabic with isolated amounts", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plans": historyPage([historyPlan(8)]),
    });
    const view = await renderDetails({ language: "ar" });
    const history = view.container.querySelector(".plan-history");
    assert.match(history.textContent, /تاريخ الخطط/);
    assert.match(history.textContent, /مستبدلة/);
    assert.ok(history.querySelector("bdi[dir='ltr']"), "amounts stay LTR inside RTL text");
    assert.match(view.container.querySelector(".smart-plan__manage").textContent, /تعديل الجدول/);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- revision */

describe("revising funding", () => {
  it("starts from the current setup, refuses a no-op, and sends the reviewed version with the new funding", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "PATCH /savings-goals/1/plan": planData({ plan_version: 4, funding_mode: "single" }),
    });
    const view = await renderRevision("funding");

    const priority = view.container.querySelector('input[name="smart-wizard-funding-mode"][value="priority"]');
    assert.equal(priority.checked, true, "prefilled from the plan");
    assert.match(view.container.querySelector(".funding-step__chosen").textContent, /Main bank.*Wallet/);

    await click(continueButton(view));
    assert.match(view.container.textContent, /This is how the plan is funded now/);
    assert.equal(view.container.querySelector(".revision-review"), null);

    await click(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="single"]'));
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"][value="6"]'));
    await click(continueButton(view));

    const review = view.container.querySelector(".revision-review");
    assert.match(review.textContent, /FundingAccounts in priority order.*One account/);
    assert.match(review.textContent, /schedule, dates and amounts don't change/);
    assert.match(review.textContent, /Per installment₪312\.50₪312\.50Unchanged/);
    const submit = byText(view.container, "Approve the new funding");
    assert.equal(submit.disabled, true, "approval required");
    assert.equal(callsTo(calls, "PATCH", "/savings-goals/1/plan").length, 0, "nothing sent while reviewing");

    await click(review.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Approve the new funding"));
    await settle();

    const [patch] = callsTo(calls, "PATCH", "/savings-goals/1/plan");
    assert.deepEqual(patch.body, { change: "funding", expected_plan_version: 3, funding: { mode: "single", sources: [{ account_id: 6 }] } });
    assert.match(patch.headers["Idempotency-Key"], /^savings-plan-revision-[A-Za-z0-9._:-]+$/);
    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals/1");
    assert.equal(probe(view).dataset.revised, "funding");
    await view.unmount();
  });

  it("on a version conflict shows the current plan for a fresh approval and resends nothing", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": [planData(), planData({ plan_version: 5 })],
      "PATCH /savings-goals/1/plan": [conflict("savings_plan_version_conflict", { current_plan_version: 5 }), planData({ plan_version: 6 })],
    });
    const view = await renderRevision("funding");

    await click(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="single"]'));
    await click(view.container.querySelector('input[name="smart-wizard-funding-account"][value="6"]'));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Approve the new funding"));
    await settle();

    assert.match(view.container.textContent, /Your plan changed since you opened this page/);
    assert.equal(view.container.querySelector(".review-step__accept input").checked, false, "the approval was for version 3");
    assert.equal(callsTo(calls, "PATCH", "/savings-goals/1/plan").length, 1);

    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Approve the new funding"));
    await settle();
    const [first, second] = callsTo(calls, "PATCH", "/savings-goals/1/plan");
    assert.equal(second.body.expected_plan_version, 5);
    assert.notEqual(second.headers["Idempotency-Key"], first.headers["Idempotency-Key"]);
    await view.unmount();
  });
});

describe("revising the schedule", () => {
  it("previews fresh options, compares them with the plan and sends fingerprints, never amounts", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plan-options": { plan_options: planOptions() },
      "PATCH /savings-goals/1/plan": planData({ id: 10, plan_version: 4, intensity: "intensive" }),
    });
    const view = await renderRevision("schedule");

    assert.equal(view.container.querySelector('input[name="smart-wizard-rhythm"][value="monthly"]').checked, true, "the plan's rhythm");
    await click(view.container.querySelector('input[name="smart-wizard-rhythm"][value="biweekly"]'));
    await click(continueButton(view));
    await settle();

    const [options] = callsTo(calls, "GET", "/savings-goals/1/plan-options");
    const query = new URL(options.url, "http://localhost").searchParams;
    assert.equal(query.get("frequency"), "weekly");
    assert.equal(query.get("interval"), "2");

    await click(view.container.querySelector('input[name="smart-wizard-intensity"][value="intensive"]'));
    await click(continueButton(view));
    // Funding carries over from the plan.
    assert.equal(view.container.querySelector('input[name="smart-wizard-funding-mode"][value="priority"]').checked, true);
    await click(continueButton(view));

    const review = view.container.querySelector(".revision-review");
    assert.match(review.textContent, /IntensityBalanced.*Intensive/);
    assert.match(review.textContent, /Per installment₪312\.50.*₪625\.00/);
    assert.match(review.textContent, /Its open installments are cancelled \(2\)/);
    assert.match(review.textContent, /covers exactly what's left to save: ₪3,750\.00/);
    assert.match(review.textContent, /paid from several accounts in this plan: 1/, "the split-reversal gap is said before approval");

    await click(review.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Approve the new schedule"));
    await settle();

    const [patch] = callsTo(calls, "PATCH", "/savings-goals/1/plan");
    assert.deepEqual(patch.body, {
      change: "schedule",
      expected_plan_version: 3,
      intensity: "intensive",
      frequency: "weekly",
      interval: 2,
      options_fingerprint: fingerprint("i"),
      assessment_fingerprint: fingerprint("n"),
      funding: { mode: "priority", sources: [{ account_id: 5 }, { account_id: 6 }] },
    });
    assert.equal(JSON.stringify(patch.body).includes("installment_amount"), false);
    assert.equal(probe(view).dataset.revised, "schedule");
    await view.unmount();
  });

  it("returns to fresh options on a stale option and never accepts the regenerated one for the user", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/plan-options": { plan_options: planOptions() },
      "PATCH /savings-goals/1/plan": conflict("savings_plan_option_stale", { verdict: "schedule_changed", current_option: option("intensive", { options_fingerprint: fingerprint("z") }) }),
    });
    const view = await renderRevision("schedule");

    await click(continueButton(view));
    await settle();
    await click(view.container.querySelector('input[name="smart-wizard-intensity"][value="intensive"]'));
    await click(continueButton(view));
    await click(continueButton(view));
    await click(view.container.querySelector(".review-step__accept input"));
    await click(byText(view.container, "Approve the new schedule"));
    await settle();

    assert.ok(view.container.querySelector(".plan-step"), "back on the options");
    assert.match(view.container.textContent, /changed/i);
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plan-options").length, 2, "options fetched again");
    assert.equal(callsTo(calls, "PATCH", "/savings-goals/1/plan").length, 1, "nothing resent");
    await view.unmount();
  });

  it("explains a paused goal keeps its schedule and offers a funding change instead", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal({ status: "paused" }) },
      "GET /savings-goals/1/plan": planData({ goalOver: { status: "paused" } }),
    });
    const view = await renderRevision("schedule");

    assert.match(view.container.textContent, /Resume the goal to change its schedule/);
    assert.ok(byText(view.container, "Change funding instead", "a"));
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plan-options").length, 0);
    await view.unmount();
  });

  it("says so when the goal has no active plan", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": notFound });
    const view = await renderRevision("funding");
    assert.match(view.container.textContent, /This goal has no active plan/);
    await view.unmount();
  });
});

describe("plan management entry points", () => {
  it("the revision page redirects and requests nothing with the flag off", async () => {
    const calls = serve();
    const i18n = await createI18n("en");
    const router = createMemoryRouter(
      [
        { path: "/dashboard/savings-goals/:savingsGoalId/smart-plan/revise/:change", element: h(SmartPlanRevision, { smartSavingsEnabled: false }) },
        { path: "*", element: h(LocationProbe) },
      ],
      { initialEntries: ["/dashboard/savings-goals/1/smart-plan/revise/funding"] },
    );
    const view = await render(withI18n(i18n, auth(h(RouterProvider, { router }))));
    await settle();

    assert.equal(probe(view).dataset.path, "/dashboard/savings-goals");
    assert.equal(calls.length, 0);
    await view.unmount();
  });

  it("links the active plan to both revisions", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData(), "GET /savings-goals/1/plans": historyPage([]) });
    const view = await renderDetails();
    const manage = view.container.querySelector(".smart-plan__manage");

    assert.equal(byText(manage, "Revise schedule", "a").getAttribute("href"), "/dashboard/savings-goals/1/smart-plan/revise/schedule");
    assert.equal(byText(manage, "Change funding", "a").getAttribute("href"), "/dashboard/savings-goals/1/smart-plan/revise/funding");
    await view.unmount();
  });
});
