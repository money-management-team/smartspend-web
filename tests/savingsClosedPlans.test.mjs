import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import { UnreadNotificationsContext } from "../src/contexts/notifications/unreadNotificationsContext.js";
import {
  getNotificationPath,
  getSavingsReminderTarget,
  readNotificationPreferences,
} from "../src/features/Dashboards/User/Notifications/notificationHelpers.js";
import { readFinancialSummary, readPlanInstallments } from "../src/features/Dashboards/User/SavingsGoals/planHistoryHelpers.js";
import { byText, change, click, flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoalDetails } = await import("../src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx");
const { default: SmartPlanRevision } = await import("../src/features/Dashboards/User/SmartPlanRevision/SmartPlanRevision.jsx");
const { default: NotificationInbox } = await import("../src/features/Dashboards/User/Notifications/components/NotificationInbox/NotificationInbox.jsx");
const { default: SavingsReminders } = await import("../src/features/Dashboards/User/Settings/components/SavingsReminders/SavingsReminders.jsx");

/* ------------------------------------------------------------- fixtures */

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
  savings_plan_id: 8,
  sequence: id - 20,
  planned_date: `2036-0${id - 20}-01`,
  original_planned_date: null,
  postponed_count: 0,
  amount: "300.0000",
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

// A completed plan's installments: split payment (reversible), single-account,
// partly reversed, postponed then confirmed, skipped, cancelled.
const closedInstallments = [
  installment(21, { status: "fulfilled", fulfilled_amount: "300.0000", confirmed_amount: "300.0000", effective_amount: "300.0000", from_account_id: null, lock_version: 4 }),
  installment(22, { status: "fulfilled", fulfilled_amount: "300.0000", fulfilled_goal_movement_id: 77, confirmed_amount: "300.0000", effective_amount: "300.0000" }),
  installment(23, { status: "fulfilled", fulfilled_amount: "200.0000", confirmed_amount: "300.0000", effective_amount: "200.0000", reversed_amount: "100.0000", shortfall_amount: "100.0000", reversal_state: "partially_reversed", from_account_id: null }),
  installment(24, { status: "fulfilled", postponed_count: 1, original_planned_date: "2036-03-20", fulfilled_amount: "300.0000", fulfilled_goal_movement_id: 78, confirmed_amount: "300.0000", effective_amount: "300.0000" }),
  installment(25, { status: "skipped", skipped_at: "2036-05-01T09:00:00Z" }),
  installment(26, { status: "cancelled", resolution_reason: "goal_achieved" }),
];

const installmentsPage = (items, { planStatus = "completed", canManage = true, page = 1, lastPage = 1, total = items.length } = {}) => ({
  savings_plan: { id: 8, savings_goal_id: 1, status: planStatus, plan_version: 2, currency_code: "ILS", can_manage: canManage },
  installments: { current_page: page, data: items, last_page: lastPage, per_page: 10, total },
});

const summary = (over = {}) => ({
  currency_code: "ILS",
  basis: "plan_installment_confirmations",
  contributions: { confirmed_amount: "1200.0000", effective_amount: "1100.0000", reversed_amount: "100.0000", confirmation_legs: 6, reversed_legs: 1, paid_installments: 4 },
  scheduled: { total: { count: 6, amount: "1800.0000" }, skipped: { count: 1, amount: "300.0000" } },
  attribution: { complete: true, issues: [] },
  ...over,
});

const historyPlan = (over = {}) => ({
  id: 8,
  savings_goal_id: 1,
  status: "completed",
  plan_version: 2,
  intensity: "balanced",
  frequency: "monthly",
  interval: 1,
  currency_code: "ILS",
  installment_amount: "300.0000",
  final_installment_amount: "300.0000",
  installment_count: 6,
  start_date: "2036-01-01",
  expected_completion_date: "2036-06-01",
  target_date: "2037-08-30",
  baseline_remaining: "1800.0000",
  funding_mode: "priority",
  funding_sources: [{ account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: null }],
  installments_summary: { total: 6, fulfilled: 4, open: 0, cancelled: 1 },
  financial_summary: summary(),
  can_manage: true,
  closed_reason: "goal_achieved",
  supersedes_plan_id: null,
  superseded_by_plan_id: null,
  funding_revisions: [],
  accepted_at: "2035-12-20T09:00:00Z",
  completed_at: "2036-05-25T09:00:00Z",
  discontinued_at: null,
  superseded_at: null,
  capacity_snapshot: null,
  ...over,
});

const historyPage = (plans) => ({ savings_plans: { current_page: 1, data: plans, last_page: 1, per_page: 5, total: plans.length } });

const activePlan = (over = {}) => ({
  savings_goal: goal(),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: {
    id: 9, savings_goal_id: 1, status: "active", intensity: "balanced", frequency: "monthly", interval: 1, currency_code: "ILS",
    installment_amount: "312.5000", final_installment_amount: "312.5000", installment_count: 2, start_date: "2037-01-01",
    expected_completion_date: "2037-02-01", target_date: "2037-08-30", funding_mode: "single", plan_version: 3, can_manage: true,
    funding_sources: [{ account_id: 5, account_name: "Main bank", priority: 1, allocation_bps: null }],
    next_installment: null,
    installments: [
      { ...installment(31, { savings_plan_id: 9, sequence: 1, planned_date: "2037-01-01", amount: "312.5000", lock_version: 2 }) },
      { ...installment(32, { savings_plan_id: 9, sequence: 2, planned_date: "2037-02-01", amount: "312.5000" }) },
    ],
    ...over,
  },
  plan_health: { executable: true, outstanding_amount: "625.0000", outstanding_count: 2, overdue: { count: 1 }, reasons: [] },
});

const legs = (over = {}) => ({
  installment: installment(21, { status: "fulfilled", effective_amount: "300.0000", confirmed_amount: "300.0000", from_account_id: null, lock_version: 4 }),
  current_confirmation: {
    confirmation_version: 1, confirmation_legs: 2, is_multi_leg: true, confirmed_at: "2036-01-01T09:00:00Z",
    funding_legs: [
      { id: 61, account_id: 5, account_name: "Main bank", amount: "200.0000", currency_code: "ILS", transfer_id: 1, goal_movement_id: 2, is_effective: true, reversed_at: null },
      { id: 62, account_id: 6, account_name: "Wallet", amount: "100.0000", currency_code: "ILS", transfer_id: 3, goal_movement_id: 4, is_effective: true, reversed_at: null },
    ],
  },
  funding_legs: [],
  history: [],
  reversal: { eligible: true, effective_leg_ids: [61, 62], expected_lock_version: 4 },
  ...over,
});

const conflict = (code) => ({ status: 409, body: { status: false, message: "Conflict.", code } });

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
  return h("output", { "data-path": location.pathname + location.search });
}

const auth = (children) => h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, children);

async function renderAt(path, element, routePath, { language = "en" } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [
      { path: routePath, element },
      { path: "*", element: h(LocationProbe) },
    ],
    { initialEntries: [path] },
  );
  const view = await render(withI18n(i18n, auth(h(RouterProvider, { router }))));
  await settle();
  return { ...view, i18n, router };
}

const renderDetails = (path = "/dashboard/savings-goals/1", options) =>
  renderAt(path, h(SavingsGoalDetails, { smartSavingsEnabled: true }), "/dashboard/savings-goals/:savingsGoalId", options);

const dialog = () => document.querySelector(".plan-dialog");
const historyCard = (view) => view.container.querySelector(".plan-history__card");

async function openInstallments(view) {
  await click(byText(historyCard(view), "Show installments (6)"));
  await settle();
}

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- helpers */

describe("F5.2 helpers", () => {
  it("shows a plan's totals only while attribution is complete", () => {
    const complete = readFinancialSummary(summary());
    assert.equal(complete.complete, true);
    assert.equal(complete.effective, "1100.0000", "the backend's exact string");
    assert.equal(complete.reversedLegs, 1);

    const incomplete = readFinancialSummary(summary({ attribution: { complete: false, issues: ["leg_ledger_mismatch"] }, contributions: { confirmed_amount: "999.0000", effective_amount: "999.0000", reversed_amount: "0.0000" } }));
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.effective, null, "never shown, even if a value is sent");
    assert.deepEqual(incomplete.issues, ["leg_ledger_mismatch"]);
    assert.equal(readFinancialSummary(null), null);
  });

  it("reads one plan's installments page and nothing else", () => {
    const page = readPlanInstallments(installmentsPage(closedInstallments, { lastPage: 2, total: 12 }), 8);
    assert.equal(page.items.length, 6);
    assert.equal(page.plan.can_manage, true);
    assert.equal(page.lastPage, 2);
    assert.equal(readPlanInstallments(installmentsPage(closedInstallments), 99), null, "another plan's page");
  });

  it("links savings reminders to their goal and installment, only with smart savings on", () => {
    const action = {
      type: "review_savings_installment",
      savings_goal_id: 1,
      savings_plan_id: 9,
      installment_id: 31,
      planned_date: "2037-01-01",
      reminder_stage: "due",
      confirmation_preview: "/api/savings-goals/1/planned-contributions/31/confirmation-preview",
      funding_preview: null,
    };
    const reminder = { type: "savings_installment_due", subject_type: "planned_savings_contribution", subject_id: 31, action };
    assert.deepEqual(getSavingsReminderTarget(reminder), { goalId: "1", planId: "9", installmentId: "31" });
    assert.equal(getNotificationPath(reminder, { smartSavingsEnabled: true }), "/dashboard/savings-goals/1?plan=9&installment=31");
    assert.equal(getNotificationPath(reminder, { smartSavingsEnabled: false }), null, "unchanged when the flag is off");
    // The top-level action, never metadata.
    assert.equal(getSavingsReminderTarget({ ...reminder, action: undefined, metadata: { action } }), null);
    // null / malformed actions fall back to the overview, never a guess.
    assert.equal(getNotificationPath({ ...reminder, action: null }, { smartSavingsEnabled: true }), "/dashboard/savings-goals");
    assert.equal(getSavingsReminderTarget({ ...reminder, action: { ...action, type: "other" } }), null);
    assert.equal(getSavingsReminderTarget({ ...reminder, action: { ...action, savings_goal_id: "1/../../admin" } }), null);
    assert.equal(getSavingsReminderTarget({ ...reminder, action: { ...action, installment_id: 0 } }), null);
    assert.equal(getSavingsReminderTarget({ ...reminder, action: { ...action, installment_id: 3.5 } }), null);
    assert.deepEqual(getSavingsReminderTarget({ ...reminder, action: { ...action, savings_plan_id: null } }), { goalId: "1", planId: null, installmentId: "31" });
    assert.equal(getNotificationPath({ ...reminder, action: { ...action, savings_plan_id: null } }, { smartSavingsEnabled: true }), "/dashboard/savings-goals/1?installment=31");
    // Preview paths from the payload are never followed.
    assert.doesNotMatch(getNotificationPath({ ...reminder, action: { ...action, confirmation_preview: "https://evil.example" } }, { smartSavingsEnabled: true }), /evil|\/api\//);
    assert.equal(getNotificationPath({ type: "recurring_posted", subject_type: "debt", subject_id: 4 }, { smartSavingsEnabled: true }), "/dashboard/debts/4");
  });

  it("reads the reminder preference and the global switch", () => {
    assert.deepEqual(readNotificationPreferences({ preferences: { savings_installment_reminders: true }, savings_installment_reminders_available: false }), { enabled: true, available: false });
    assert.equal(readNotificationPreferences({ preferences: {} }), null);
  });
});

/* ------------------------------------------------------------- history */

describe("complete plan history", () => {
  it("shows what a plan's own installments collected, apart from the goal's balance", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([historyPlan()]),
    });
    const view = await renderDetails();
    const money = view.container.querySelector(".plan-history__money");

    assert.match(money.textContent, /Effective plan contributions₪1,100\.00/);
    assert.match(money.textContent, /Confirmed plan contributions₪1,200\.00/);
    assert.match(money.textContent, /Reversed plan contributions₪100\.00Reversed payments: 1/);
    assert.doesNotMatch(money.textContent, /Still in the goal|balance₪/, "never labelled as the goal's balance");
    assert.match(money.textContent, /This isn't the goal's balance/);
    assert.match(historyCard(view).textContent, /Effective plan contributions: ₪1,100\.00/);
    await view.unmount();
  });

  it("isolates each funding account's name and share, so mixed Arabic and English names keep their order", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([
        historyPlan({
          funding_mode: "allocated",
          funding_sources: [
            { account_id: 5, account_name: "Main checking", priority: 1, allocation_bps: 7000 },
            { account_id: 6, account_name: "حساب التوفير المشترك", priority: 2, allocation_bps: 3000 },
          ],
        }),
      ]),
    });
    const view = await renderDetails();
    const isolated = [...view.container.querySelectorAll(".plan-history__funding small bdi")].map((node) => node.textContent);

    assert.deepEqual(isolated, ["Main checking", "70%", "حساب التوفير المشترك", "30%"]);
    await view.unmount();
  });

  it("hides unreliable totals when attribution is incomplete", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([historyPlan({ financial_summary: summary({ attribution: { complete: false, issues: ["fulfilment_mismatch"] } }) })]),
    });
    const view = await renderDetails();
    const money = view.container.querySelector(".plan-history__money");

    assert.match(money.textContent, /can't be worked out reliably/);
    assert.doesNotMatch(money.textContent, /₪/, "no amount is shown");
    assert.doesNotMatch(historyCard(view).textContent, /Effective plan contributions:/);
    await view.unmount();
  });

  it("opens any plan's installments with every state, and pages through them", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([historyPlan()]),
      "GET /savings-goals/1/plans/8/installments": [
        installmentsPage(closedInstallments.slice(0, 4), { lastPage: 2, total: 6 }),
        installmentsPage(closedInstallments.slice(4), { page: 2, lastPage: 2, total: 6 }),
      ],
    });
    const view = await renderDetails();

    assert.equal(callsTo(calls, "GET", "/savings-goals/1/plans/8/installments").length, 0, "loaded on request only");
    await openInstallments(view);

    const toggle = byText(historyCard(view), "Hide installments");
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    const [first] = callsTo(calls, "GET", "/savings-goals/1/plans/8/installments");
    assert.equal(new URL(first.url, "http://localhost").searchParams.get("per_page"), "10");

    const panel = view.container.querySelector(".plan-installments");
    assert.match(panel.textContent, /Showing 4 of 6/);
    assert.match(panel.textContent, /Partly reversed/i);
    assert.match(panel.textContent, /Postponed/i);

    await click(byText(panel, "Show more installments"));
    await settle();
    const [, second] = callsTo(calls, "GET", "/savings-goals/1/plans/8/installments");
    assert.equal(new URL(second.url, "http://localhost").searchParams.get("page"), "2");
    assert.match(panel.textContent, /Showing 6 of 6/);
    assert.match(panel.textContent, /Skipped/);
    assert.match(panel.textContent, /Cancelled when the goal reached its target/);
    assert.equal(byText(panel, "Show more installments"), undefined);
    assert.equal(panel.querySelectorAll(".installment-timeline__action--primary").length, 0, "a closed plan offers no confirm");
    await view.unmount();
  });
});

/* ------------------------------------------------------------- reversal */

describe("closed-plan reversal", () => {
  it("reverses a closed plan's split payment through a fresh, approved review, and the plan stays closed", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([historyPlan()]),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(closedInstallments),
      "GET /savings-goals/1/planned-contributions/21/funding-legs": legs(),
      "POST /savings-goals/1/planned-contributions/21/reverse-legs": {
        installment: installment(21, { status: "cancelled" }),
        previously_effective_amount: "300.0000",
        funding_legs: [],
        reversal: { eligible: false, effective_leg_ids: [], expected_lock_version: 5 },
        savings_goal: goal({ progress: undefined }),
        balance: { saved_amount: "950.0000", remaining_amount: "4050.0000" },
        savings_plan: { id: 8, status: "completed", plan_version: 2 },
        plan_health: {},
      },
    });
    const view = await renderDetails();
    await openInstallments(view);

    const panel = view.container.querySelector(".plan-installments");
    const reverseButtons = panel.querySelectorAll(".installment-timeline__action--reverse");
    assert.equal(reverseButtons.length, 2, "only split payments still holding money (21 and the partly reversed 23)");
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/21/funding-legs").length, 0);

    await click(reverseButtons[0]);
    await settle();
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/21/funding-legs").length, 1, "payments read fresh");
    assert.equal(callsTo(calls, "POST", "/savings-goals/1/planned-contributions/21/reverse-legs").length, 0, "never automatic");

    await change(dialog().querySelector("#reverse-legs-reason"), "Paid from the wrong account");
    await click(dialog().querySelector(".reverse-legs__ack input"));
    await click(byText(dialog(), "Reverse"));
    await settle();

    const [post] = callsTo(calls, "POST", "/savings-goals/1/planned-contributions/21/reverse-legs");
    assert.deepEqual(post.body, { reason: "Paid from the wrong account", expected_lock_version: 4, all: true });
    assert.match(post.headers["Idempotency-Key"], /^savings-installment-reverse-/);
    assert.equal(dialog(), null);
    assert.match(view.container.querySelector(".savings-goal-details__notice").textContent, /Payments reversed/);
    assert.ok(callsTo(calls, "GET", "/savings-goals/1/plans").length >= 2, "history read again");
    await settle();
    assert.match(view.container.querySelector(".plan-installments").textContent, /this plan stays Completed/);
    await view.unmount();
  });

  it("chooses one leg, and on a 409 reads the payments again and asks for a fresh approval", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": { status: 404, body: { status: false, message: "Not found." } },
      "GET /savings-goals/1/plans": historyPage([historyPlan({ status: "superseded", closed_reason: "plan_superseded", completed_at: null, superseded_at: "2036-04-01T09:00:00Z" })]),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(closedInstallments, { planStatus: "superseded" }),
      "GET /savings-goals/1/planned-contributions/21/funding-legs": [legs(), legs({ reversal: { eligible: true, effective_leg_ids: [61, 62], expected_lock_version: 6 } })],
      "POST /savings-goals/1/planned-contributions/21/reverse-legs": conflict("savings_installment_version_conflict"),
    });
    const view = await renderDetails();
    await openInstallments(view);

    await click(view.container.querySelectorAll(".plan-installments .installment-timeline__action--reverse")[0]);
    await settle();
    await click(dialog().querySelector('input[name="reverse-legs-scope"][value="some"]'));
    await click(dialog().querySelectorAll(".reverse-legs__section .funding-legs__select input")[1]);
    await change(dialog().querySelector("#reverse-legs-reason"), "Wallet was wrong");
    await click(dialog().querySelector(".reverse-legs__ack input"));
    await click(byText(dialog(), "Reverse"));
    await settle();

    const posts = callsTo(calls, "POST", "/savings-goals/1/planned-contributions/21/reverse-legs");
    assert.equal(posts.length, 1, "nothing resent");
    assert.deepEqual(posts[0].body, { reason: "Wallet was wrong", expected_lock_version: 4, leg_ids: [62] });
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/21/funding-legs").length, 2, "read again");
    assert.equal(dialog().querySelector(".reverse-legs__ack input").checked, false, "fresh approval needed");
    await view.unmount();
  });
});

/* ------------------------------------------------------------- permission */

describe("owner-aware UI", () => {
  it("shows a colleague the plan and its history read only", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": activePlan({ can_manage: false }),
      "GET /savings-goals/1/plans": historyPage([historyPlan({ can_manage: false })]),
      "GET /savings-goals/1/plans/8/installments": installmentsPage(closedInstallments, { canManage: false }),
    });
    const view = await renderDetails();
    const panel = view.container.querySelector(".smart-plan");

    assert.equal(panel.querySelector(".smart-plan__manage"), null, "no revise / discontinue");
    assert.equal(panel.querySelectorAll(".installment-timeline__action").length, 0, "no confirm, postpone, skip or reverse");
    assert.match(panel.textContent, /Only its owner can confirm installments/);
    assert.match(historyCard(view).textContent, /View only/);

    await openInstallments(view);
    const installments = view.container.querySelector(".plan-installments");
    assert.match(installments.textContent, /View only: only the plan's owner can reverse/);
    assert.equal(installments.querySelectorAll(".installment-timeline__action--reverse").length, 0);
    assert.equal(calls.filter((call) => call.method !== "GET").length, 0);
    await view.unmount();
  });

  it("an owner without the permission flag can't open the revision", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": activePlan({ can_manage: false }) });
    const view = await renderAt(
      "/dashboard/savings-goals/1/smart-plan/revise/funding",
      h(SmartPlanRevision, { smartSavingsEnabled: true }),
      "/dashboard/savings-goals/:savingsGoalId/smart-plan/revise/:change",
    );
    assert.match(view.container.textContent, /Only the plan's owner can change it/);
    assert.equal(view.container.querySelector(".funding-step"), null);
    await view.unmount();
  });
});

/* ------------------------------------------------------------- reminders */

describe("savings reminders", () => {
  it("opens the reminded installment and reviews it only through a fresh preview", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": activePlan(),
      "GET /savings-goals/1/plans": historyPage([]),
      "GET /savings-goals/1/planned-contributions/31/confirmation-preview": {
        confirmation: {
          confirmable: true, blocker: null, warnings: [],
          savings_goal: { id: 1, name: "Emergency fund" },
          savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: "single" },
          installment: { id: 31, sequence: 1, status: "planned", planned_date: "2037-01-01", scheduled_amount: "312.5000", lock_version: 2 },
          suggested_amount: "312.5000", default_account_id: 5,
          accounts: [{ id: 5, name: "Main bank", currency_code: "ILS", available_balance: "900.0000", covers_suggested_amount: true }],
        },
      },
    });
    const view = await renderDetails("/dashboard/savings-goals/1?installment=31");

    const banner = view.container.querySelector(".smart-plan__reminder");
    assert.match(banner.textContent, /Reminder: installment 1/);
    assert.match(banner.textContent, /Nothing moves until you confirm/);
    assert.ok(view.container.querySelector('.installment-timeline__row--focus[data-installment-id="31"]'));
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/31/confirmation-preview").length, 0, "nothing opened by itself");

    await click(byText(banner, "Review installment"));
    await settle();
    assert.equal(callsTo(calls, "GET", "/savings-goals/1/planned-contributions/31/confirmation-preview").length, 1, "a fresh preview");
    assert.ok(dialog());
    assert.equal(calls.filter((call) => call.method !== "GET").length, 0, "no money moved");
    await view.unmount();
  });

  it("says so when the reminded installment is no longer open", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": activePlan(), "GET /savings-goals/1/plans": historyPage([]) });
    const view = await renderDetails("/dashboard/savings-goals/1?installment=999");
    assert.match(view.container.querySelector(".smart-plan__reminder").textContent, /no longer open/);
    assert.equal(byText(view.container.querySelector(".smart-plan__reminder"), "Review installment"), undefined);
    await view.unmount();
  });

  it("shows due and overdue reminders in the existing inbox with their link", async () => {
    serve({
      "GET /notifications": {
        notifications: {
          current_page: 1, last_page: 1, per_page: 20, total: 2,
          data: [
            { id: 1, type: "savings_installment_overdue", severity: "warning", title: "Installment overdue", body: "312.5000 ILS for Emergency fund", subject_type: "planned_savings_contribution", subject_id: 31, amount: "312.5000", currency_code: "ILS", is_read: false, created_at: "2037-01-04T09:00:00Z", action: { type: "review_savings_installment", savings_goal_id: 1, savings_plan_id: 9, installment_id: 31, planned_date: "2037-01-01", reminder_stage: "overdue_3", confirmation_preview: "/api/savings-goals/1/planned-contributions/31/confirmation-preview", funding_preview: null } },
            { id: 2, type: "savings_installment_due", severity: "warning", title: "Installment due", body: "Due today", subject_type: "planned_savings_contribution", subject_id: 32, amount: "312.5000", currency_code: "ILS", is_read: true, created_at: "2037-01-01T09:00:00Z" },
          ],
        },
        unread_count: 1,
      },
    });
    const inbox = (enabled) =>
      h(UnreadNotificationsContext.Provider, { value: { count: 1, setCount: () => {} } }, h(NotificationInbox, { searchParams: new URLSearchParams(), onSearchParamsChange: () => {}, smartSavingsEnabled: enabled }));

    let view = await renderAt("/dashboard/notifications", inbox(true), "/dashboard/notifications");
    const links = [...view.container.querySelectorAll(".notification-item__link")].map((link) => link.getAttribute("href"));
    assert.deepEqual(links, ["/dashboard/savings-goals/1?plan=9&installment=31", "/dashboard/savings-goals"]);
    assert.match(view.container.textContent, /Savings installment overdue/);
    await view.unmount();

    view = await renderAt("/dashboard/notifications", inbox(false), "/dashboard/notifications");
    assert.equal(view.container.querySelectorAll(".notification-item__link").length, 0, "flag off: unchanged, no link");
    await view.unmount();
  });
});

describe("reminder preference", () => {
  const renderPreference = (language = "en") =>
    renderAt("/dashboard/settings?tab=preferences", h(SavingsReminders), "/dashboard/settings", { language });

  it("explains the global switch and saves only the reminder preference", async () => {
    const calls = serve({
      "GET /notifications/preferences": { preferences: { savings_installment_reminders: true }, channels: ["in_app"], savings_installment_reminders_available: false },
      "PATCH /notifications/preferences": { preferences: { savings_installment_reminders: false }, channels: ["in_app"], savings_installment_reminders_available: false },
    });
    const view = await renderPreference();
    const toggle = view.container.querySelector('input[role="switch"]');

    assert.equal(toggle.checked, true);
    assert.match(view.container.textContent, /turned off for SmartSpend right now/);

    await click(toggle);
    await settle();
    const [patch] = callsTo(calls, "PATCH", "/notifications/preferences");
    assert.deepEqual(patch.body, { savings_installment_reminders: false }, "nothing else is sent");
    assert.equal(view.container.querySelector('input[role="switch"]').checked, false);
    assert.match(view.container.textContent, /Saved: reminders are off/);
    await view.unmount();
  });

  it("keeps the saved value when saving fails", async () => {
    serve({
      "GET /notifications/preferences": { preferences: { savings_installment_reminders: true }, channels: ["in_app"], savings_installment_reminders_available: true },
      "PATCH /notifications/preferences": { status: 500, body: { status: false, message: "Down." } },
    });
    const view = await renderPreference("ar");

    assert.doesNotMatch(view.container.textContent, /متوقفة حاليًا/, "no global-off note while reminders run");
    await click(view.container.querySelector('input[role="switch"]'));
    await settle();
    assert.equal(view.container.querySelector('input[role="switch"]').checked, true);
    assert.match(view.container.textContent, /لم يُحفظ اختيارك/);
    await view.unmount();
  });
});
