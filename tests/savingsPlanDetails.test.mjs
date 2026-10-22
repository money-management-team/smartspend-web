import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { AuthContext } from "../src/contexts/auth/authContext.js";
import { ApiError } from "../src/features/Dashboards/User/api/apiClient.js";
import {
  addDays,
  buildConfirmPayload,
  classifyPlanWriteError,
  getHealthSignals,
  getInstallmentState,
  getOverdueInstallmentIds,
  getPostponeBounds,
  getSmartPlanErrorMessage,
  getVisibleInstallments,
  pickDefaultAccountId,
  readPlanResponse,
} from "../src/features/Dashboards/User/SavingsGoals/smartPlanHelpers.js";
import { byText, change, click, flush, installDom, render, submit } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoalDetails } = await import(
  "../src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx"
);

/* ------------------------------------------------------------- fixtures */

const goal = (over = {}) => ({
  id: 1,
  workspace_id: 1,
  name: "Emergency fund",
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: "2037-08-30",
  status: "active",
  account: { id: 101, name: "Emergency fund", type: "savings", currency_code: "ILS" },
  progress: {
    goal_id: 1,
    target_amount: "5000.0000",
    saved_amount: "1250.0000",
    remaining_amount: "3750.0000",
    percentage_funded: "25.0000",
    status: "in_progress",
    deadline_passed: false,
  },
  ...over,
});

// Monthly from 2036-10-01: installment 1 → 2036-10-01, 5 → 2037-02-01.
const monthlyDate = (sequence) => {
  const month = 9 + sequence;
  return `${2036 + Math.floor((month - 1) / 12)}-${String(((month - 1) % 12) + 1).padStart(2, "0")}-01`;
};

const installment = (id, over = {}) => ({
  id,
  savings_plan_id: 9,
  sequence: id,
  planned_date: monthlyDate(id),
  original_planned_date: null,
  postponed_count: 0,
  amount: "312.5000",
  status: "planned",
  from_account_id: 5,
  fulfilled_amount: null,
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

// 1 confirmed, 2 partly reversed, 3 skipped, 4 overdue + postponed, 5–8 open.
const installments = () => [
  installment(1, { status: "fulfilled", fulfilled_amount: "312.5000", effective_amount: "312.5000", confirmed_amount: "312.5000" }),
  installment(2, {
    status: "fulfilled",
    reversal_state: "partially_reversed",
    fulfilled_amount: "200.0000",
    effective_amount: "200.0000",
    reversed_amount: "112.5000",
    shortfall_amount: "112.5000",
  }),
  installment(3, { status: "skipped", skipped_at: "2036-12-02T10:00:00Z" }),
  installment(4, { postponed_count: 1, original_planned_date: "2037-01-01", planned_date: "2037-01-10", lock_version: 2 }),
  installment(5),
  installment(6),
  installment(7),
  installment(8),
];

const planData = ({ plan = {}, health = {} } = {}) => ({
  savings_goal: goal(),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: {
    id: 9,
    savings_goal_id: 1,
    status: "active",
    intensity: "balanced",
    frequency: "monthly",
    interval: 1,
    currency_code: "ILS",
    installment_amount: "312.5000",
    final_installment_amount: "312.5000",
    installment_count: 8,
    start_date: "2036-10-01",
    expected_completion_date: "2037-05-01",
    target_date: "2037-08-30",
    baseline_remaining: "2500.0000",
    funding_mode: "priority",
    plan_version: 3,
    funding_sources: [
      { account_id: 6, account_name: "Wallet", currency_code: "ILS", priority: 2, allocation_bps: null },
      { account_id: 5, account_name: "Main bank", currency_code: "ILS", priority: 1, allocation_bps: null },
    ],
    next_installment: { ...installment(4, { postponed_count: 1, lock_version: 2 }), is_overdue: true },
    installments: installments(),
    capacity_snapshot: null,
    ...plan,
  },
  plan_health: {
    executable: true,
    remaining_amount: "3750.0000",
    outstanding_amount: "1562.5000",
    outstanding_count: 5,
    fulfilled_count: 2,
    partially_reversed_count: 1,
    partially_reversed_amount: "112.5000",
    overdue: { count: 1, amount: "312.5000", oldest_planned_date: "2037-01-10" },
    skipped_count: 1,
    skipped_scheduled_amount: "312.5000",
    postponed_count: 1,
    uncovered_amount: "2187.5000",
    scheduled_completion_date: "2037-05-01",
    completion_delayed: false,
    target_at_risk: true,
    replanning_recommended: true,
    reasons: ["overdue_installments", "behind_schedule", "skipped_installments"],
    ...health,
  },
});

const confirmation = (over = {}) => ({
  confirmable: true,
  blocker: null,
  warnings: ["installment_overdue"],
  savings_goal: { id: 1, name: "Emergency fund", status: "active", currency_code: "ILS", target_amount: "5000.0000", saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: { id: 9, status: "active", plan_version: 3, funding_mode: "priority" },
  installment: { id: 4, sequence: 4, status: "planned", planned_date: "2037-01-10", scheduled_amount: "312.5000", lock_version: 2 },
  suggested_amount: "312.5000",
  default_account_id: 5,
  accounts: [
    { id: 5, name: "Main bank", currency_code: "ILS", available_balance: "900.0000", allows_overdraft: false, covers_suggested_amount: true },
    { id: 6, name: "Wallet", currency_code: "ILS", available_balance: "20.0000", allows_overdraft: false, covers_suggested_amount: false },
  ],
  ...over,
});

const notFound = { status: 404, body: { status: false, message: "The requested resource was not found.", data: null } };
const conflict = (code, extra = {}) => ({ status: 409, body: { status: false, message: "Conflict.", code, ...extra } });

/**
 * A scripted backend. `routes` maps "METHOD path-suffix" to a response or a
 * list of responses (served in order, the last one repeating).
 */
function serve(routes = {}) {
  const queues = Object.fromEntries(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );

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
    // Other widgets on the page (activity, standalone planned contributions).
    return { body: envelope({}) };
  });
}

const callsTo = (calls, method, suffix) =>
  calls.filter((call) => call.method === method && new URL(call.url, "http://localhost").pathname.endsWith(suffix));

async function settle(times = 8) {
  for (let i = 0; i < times; i += 1) await flush();
}

async function renderDetails({ language = "en", enabled = true } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [{ path: "/dashboard/savings-goals/:savingsGoalId", element: h(SavingsGoalDetails, { smartSavingsEnabled: enabled }) }],
    { initialEntries: ["/dashboard/savings-goals/1"] },
  );
  const view = await render(
    withI18n(
      i18n,
      h(AuthContext.Provider, { value: { user: { timezone: "UTC" }, workspace: null } }, h(RouterProvider, { router })),
    ),
  );
  await settle();
  return { ...view, i18n };
}

const panel = (view) => view.container.querySelector(".smart-plan");
const dialog = () => document.querySelector(".plan-dialog");
const rowFor = (view, sequence) =>
  [...view.container.querySelectorAll(".installment-timeline__row")].find((row) =>
    row.querySelector(".installment-timeline__seq")?.textContent.endsWith(` ${sequence}`),
  );

beforeEach(() => {
  installBrowserStubs();
  document.body.innerHTML = "";
});

/* ------------------------------------------------------------- helpers */

describe("smart plan helpers", () => {
  it("accepts only this goal's active plan", () => {
    assert.ok(readPlanResponse(planData(), 1));
    assert.equal(readPlanResponse(planData(), 2), null);
    assert.equal(readPlanResponse(planData({ plan: { status: "completed" } }), 1), null);
    assert.equal(readPlanResponse(planData({ plan: { installments: null } }), 1), null);
  });

  it("marks overdue rows from the backend's count, not the client clock", () => {
    const { savings_plan: plan, plan_health: health } = planData();
    const ids = getOverdueInstallmentIds(plan, health);

    assert.deepEqual([...ids], ["4"]);
    assert.deepEqual(
      plan.installments.map((row) => getInstallmentState(row, ids)),
      ["fulfilled", "partially_reversed", "skipped", "overdue", "planned", "planned", "planned", "planned"],
    );
  });

  it("collapses open installments after the first four", () => {
    const { rows, hidden } = getVisibleInstallments(installments(), false);
    assert.equal(rows.length, 7);
    assert.equal(hidden, 1);
    assert.equal(getVisibleInstallments(installments(), true).hidden, 0);
  });

  it("bounds a postponement by today, the next installment and the target date", () => {
    const rows = installments();
    const bounds = getPostponeBounds({
      installment: rows[3],
      installments: rows,
      targetDate: "2037-08-30",
      today: "2037-01-12",
    });

    assert.equal(bounds.min, "2037-01-12");
    assert.equal(bounds.max, "2037-01-31");
    assert.equal(bounds.nextDate, "2037-02-01");
    assert.equal(bounds.available, true);

    const last = getPostponeBounds({ installment: rows[7], installments: rows, targetDate: "2037-05-01", today: "2037-01-01" });
    assert.equal(last.available, false);
    assert.equal(addDays("2037-03-01", -1), "2037-02-28");
  });

  it("classifies write failures", () => {
    const error = (code, serverCode) => new ApiError("", { code, serverCode });
    assert.equal(classifyPlanWriteError(error("CONFLICT", "savings_installment_version_conflict")), "stale");
    assert.equal(classifyPlanWriteError(error("CONFLICT", "savings_installment_schedule_conflict")), "input");
    assert.equal(classifyPlanWriteError(error("CONFLICT", "savings_installment_postpone_limit_reached")), "final");
    assert.equal(classifyPlanWriteError(error("NOT_FOUND")), "stale");
    assert.equal(classifyPlanWriteError(error("VALIDATION_ERROR")), "input");
    assert.equal(classifyPlanWriteError(error("TIMEOUT")), "unknown");
    assert.equal(classifyPlanWriteError(error("SERVER_ERROR")), "unknown");
    assert.equal(classifyPlanWriteError(error("FORBIDDEN")), "final");
    assert.equal(classifyPlanWriteError(error("RATE_LIMITED")), "final");
  });

  it("confirms exactly the preview's amount and versions", () => {
    const preview = confirmation();
    assert.equal(pickDefaultAccountId(preview), 5);
    assert.deepEqual(buildConfirmPayload(preview, "5"), {
      expected_plan_version: 3,
      expected_lock_version: 2,
      from_account_id: 5,
      amount: "312.5000",
    });
    // The plan's account can't pay and several others could: the user chooses.
    assert.equal(
      pickDefaultAccountId(
        confirmation({
          default_account_id: 6,
          accounts: [
            { id: 6, covers_suggested_amount: false },
            { id: 7, covers_suggested_amount: true },
            { id: 8, covers_suggested_amount: true },
          ],
        }),
      ),
      null,
    );
  });

  it("reads health signals without arithmetic", () => {
    const keys = getHealthSignals(planData().plan_health).map((signal) => signal.key);
    assert.deepEqual(keys, ["overdue", "uncovered", "skipped", "partiallyReversed"]);
    assert.deepEqual(
      getHealthSignals({ executable: true, target_at_risk: true, uncovered_amount: "0.0000", scheduled_completion_date: "2037-09-01" }).map((s) => s.key),
      ["endsAfterTarget"],
    );
    assert.deepEqual(getHealthSignals({ executable: false }).map((s) => s.key), ["onHold"]);
  });

  it("words conflicts in the user's language with a formatted date", async () => {
    const i18n = await createI18n("ar");
    const message = getSmartPlanErrorMessage(
      new ApiError("x", { code: "CONFLICT", serverCode: "savings_installment_schedule_conflict", payload: { latest_allowed_date: "2037-01-31" } }),
      i18n.t,
      i18n,
      "postpone",
    );
    assert.match(message, /آخر تاريخ مسموح/);
    assert.doesNotMatch(message, /object|2037-01-31/);
  });
});

/* ------------------------------------------------------------- page */

describe("Goal details smart plan", () => {
  it("with the gate off, never calls the plan endpoints", async () => {
    const calls = serve({ "GET /savings-goals/1": { savings_goal: goal() } });
    const view = await renderDetails({ enabled: false });

    assert.ok(view.container.querySelector(".savings-goal-details__header"));
    assert.equal(callsTo(calls, "GET", "/plan").length, 0);
    assert.equal(panel(view), null);
    // The header badge contrast fix belongs to the smart experience only.
    assert.equal(view.container.querySelector(".savings-goal-details--smart"), null);
    await view.unmount();
  });

  it("invites an active flexible goal to take a plan and never looks up an achieved one", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": notFound });
    let view = await renderDetails();
    const invite = view.container.querySelector(".smart-plan--invite");
    assert.ok(invite);
    assert.equal(invite.querySelector("a").getAttribute("href"), "/dashboard/savings-goals/1/smart-plan");
    assert.equal(view.container.querySelector(".smart-plan__figures"), null);
    assert.doesNotMatch(view.container.textContent, /Flexible/);
    await view.unmount();

    // A paused flexible goal keeps its page as it was.
    serve({ "GET /savings-goals/1": { savings_goal: goal({ status: "paused" }) }, "GET /savings-goals/1/plan": notFound });
    view = await renderDetails();
    assert.equal(panel(view), null);
    await view.unmount();

    const calls = serve({ "GET /savings-goals/1": { savings_goal: goal({ status: "achieved" }) } });
    view = await renderDetails();
    assert.equal(callsTo(calls, "GET", "/plan").length, 0);
    assert.equal(panel(view), null);
    await view.unmount();
  });

  it("renders the plan, its health, funding and timeline from the backend's values", async () => {
    serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData() });
    const view = await renderDetails();
    const section = panel(view);

    assert.match(section.querySelector("h2").textContent, /Balanced plan/);
    assert.match(section.textContent, /Monthly installments/);

    const figures = [...section.querySelectorAll(".smart-plan__figure")].map((node) => node.textContent);
    assert.match(figures[0], /Saved.*1,250\.00/);
    assert.match(figures[1], /Remaining.*3,750\.00/);
    assert.match(figures[2], /Still scheduled.*1,562\.50.*Open installments: 5/);

    // Funding sources in priority order.
    assert.deepEqual(
      [...section.querySelectorAll(".smart-plan__sources li > span")].map((node) => node.textContent),
      ["Main bank", "Wallet"],
    );

    const health = section.querySelector(".plan-health").textContent;
    assert.match(health, /Overdue installments: 1/);
    assert.match(health, /Target at risk.*2,187\.50/);
    assert.match(health, /Skipped installments: 1/);
    assert.match(health, /Partly reversed installments: 1/);

    assert.match(rowFor(view, 2).textContent, /Partly reversed.*Paid.*200\.00.*Reversed.*112\.50.*Short by.*112\.50/);
    assert.match(rowFor(view, 3).textContent, /Skipped.*Not saved/);
    const overdue = rowFor(view, 4);
    assert.ok(overdue.classList.contains("installment-timeline__row--overdue"));
    assert.ok(overdue.classList.contains("installment-timeline__row--next"));
    assert.match(overdue.textContent, /Postponed: 1.*originally/);
    assert.equal(overdue.querySelector("s").textContent, "Jan 1, 2037");

    // Only open rows have actions; the eighth installment starts collapsed.
    assert.equal(rowFor(view, 1).querySelector(".installment-timeline__actions"), null);
    assert.ok(overdue.querySelector(".installment-timeline__actions"));
    assert.equal(overdue.querySelector(".installment-timeline__actions--compact"), null);
    // Later installments keep every action, as compact icon buttons.
    assert.equal(rowFor(view, 5).querySelectorAll(".installment-timeline__actions--compact button").length, 3);
    assert.equal(rowFor(view, 8), undefined);
    await click(byText(section, "Show all 8 installments"));
    assert.ok(rowFor(view, 8));
    await view.unmount();
  });

  it("hides installment actions while the goal is paused", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal({ status: "paused" }) },
      "GET /savings-goals/1/plan": planData({ health: { executable: false } }),
    });
    const view = await renderDetails();

    assert.equal(view.container.querySelector(".installment-timeline__actions"), null);
    assert.match(panel(view).textContent, /On hold/);
    await view.unmount();
  });

  it("confirms an installment only after the preview, with exact values and a key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": { confirmation: confirmation() },
      "POST /savings-goals/1/planned-contributions/4/confirm": {
        status: 201,
        body: envelope({ installment: installment(4, { status: "fulfilled" }), savings_goal: goal({ progress: undefined }) }),
      },
    });
    const view = await renderDetails();

    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();

    const body = dialog();
    assert.equal(callsTo(calls, "POST", "/confirm").length, 0, "opening the dialog moves nothing");
    assert.match(body.querySelector(".plan-dialog__total").textContent, /Amount to move.*312\.50/);
    assert.match(body.textContent, /This installment is overdue/);

    const radios = [...body.querySelectorAll('input[type="radio"]')];
    assert.equal(radios[0].checked, true);
    assert.equal(radios[1].disabled, true, "an account that can't pay can't be chosen");

    await click(byText(body, "Confirm and move money"));
    await settle();

    const [post] = callsTo(calls, "POST", "/confirm");
    assert.deepEqual(post.body, { expected_plan_version: 3, expected_lock_version: 2, from_account_id: 5, amount: "312.5000" });
    assert.match(post.headers["Idempotency-Key"], /^savings-installment-[A-Za-z0-9._:-]+$/);
    assert.equal(dialog(), null);
    assert.match(view.container.querySelector(".savings-goal-details__notice").textContent, /Installment confirmed/);
    assert.ok(callsTo(calls, "GET", "/plan").length >= 2, "the plan is fetched again");
    await view.unmount();
  });

  it("after a stale 409 shows the current preview and confirms with a new key", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": [
        { confirmation: confirmation() },
        { confirmation: confirmation({ installment: { ...confirmation().installment, lock_version: 3 } }) },
      ],
      "POST /savings-goals/1/planned-contributions/4/confirm": [
        conflict("savings_installment_version_conflict", { current_lock_version: 3 }),
        { status: 201, body: envelope({ savings_goal: goal() }) },
      ],
    });
    const view = await renderDetails();

    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    assert.equal(callsTo(calls, "GET", "/confirmation-preview").length, 2);
    assert.match(dialog().textContent, /This installment changed since you opened this/);
    assert.match(dialog().textContent, /Review what's shown now/);

    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/confirm");
    assert.equal(second.body.expected_lock_version, 3);
    assert.notEqual(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    await view.unmount();
  });

  it("retries an unknown outcome with the same key and payload", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": { confirmation: confirmation() },
      "POST /savings-goals/1/planned-contributions/4/confirm": [
        { status: 503, body: { status: false, message: "" } },
        { status: 201, body: envelope({ savings_goal: goal() }) },
      ],
    });
    const view = await renderDetails();

    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();
    await click(byText(dialog(), "Confirm and move money"));
    await settle();

    assert.match(dialog().textContent, /couldn't confirm whether the money moved/);
    await click(byText(dialog(), "Try again"));
    await settle();

    const [first, second] = callsTo(calls, "POST", "/confirm");
    assert.equal(first.headers["Idempotency-Key"], second.headers["Idempotency-Key"]);
    assert.deepEqual(first.body, second.body);
    await view.unmount();
  });

  it("blocks confirmation when the preview has a blocker", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": {
        confirmation: confirmation({
          confirmable: false,
          blocker: { code: "savings_installment_not_open", message: "no", installment_status: "fulfilled" },
          suggested_amount: null,
          warnings: [],
        }),
      },
    });
    const view = await renderDetails();

    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();

    assert.match(dialog().textContent, /This installment is no longer open/);
    assert.equal(byText(dialog(), "Confirm and move money").disabled, true);
    await view.unmount();
  });

  it("postpones within the allowed dates and explains a schedule conflict", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/5/postpone": [
        conflict("savings_installment_schedule_conflict", { next_planned_date: "2037-03-01", latest_allowed_date: "2037-02-28" }),
        { body: envelope({ installment: installment(5, { planned_date: "2037-02-20" }), result: { action: "postponed", money_moved: false } }) },
      ],
    });
    const view = await renderDetails();

    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[1]);
    const form = document.getElementById("postpone-installment-form");
    const input = form.querySelector('input[type="date"]');
    // Installment 5 is due 2037-02-01 and installment 6 on 2037-03-01.
    assert.ok(input.min >= "2037-02-02");
    assert.equal(input.max, "2037-02-28");
    assert.match(dialog().textContent, /Before the next installment, due/);

    await change(input, "2037-02-28");
    await submit(form);
    await settle();
    assert.match(dialog().textContent, /latest date allowed is Feb 28, 2037/);

    await change(input, "2037-02-20");
    await submit(form);
    await settle();

    const posts = callsTo(calls, "POST", "/postpone");
    assert.deepEqual(posts[1].body, { expected_plan_version: 3, expected_lock_version: 1, new_date: "2037-02-20" });
    assert.ok(posts[1].headers["Idempotency-Key"]);
    assert.equal(dialog(), null);
    assert.match(panel(view).querySelector(".smart-plan__notice").textContent, /Installment 5 moved to.*Feb 20, 2037.*No money moved/);
    await view.unmount();
  });

  it("rejects a date outside the bounds before calling the backend", async () => {
    const calls = serve({ "GET /savings-goals/1": { savings_goal: goal() }, "GET /savings-goals/1/plan": planData() });
    const view = await renderDetails();

    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[1]);
    const form = document.getElementById("postpone-installment-form");
    await change(form.querySelector('input[type="date"]'), "2037-06-01");
    await submit(form);
    await settle();

    assert.match(dialog().textContent, /Choose this date or earlier/);
    assert.equal(callsTo(calls, "POST", "/postpone").length, 0);
    await view.unmount();
  });

  it("skips only after explicit confirmation", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/5/skip": {
        body: envelope({ installment: installment(5, { status: "skipped" }), result: { action: "skipped", money_moved: false } }),
      },
    });
    const view = await renderDetails();

    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[2]);
    assert.match(dialog().textContent, /Your savings target and target date don't change/);
    assert.equal(callsTo(calls, "POST", "/skip").length, 0);

    await click(byText(dialog(), "Skip installment"));
    await settle();

    const [post] = callsTo(calls, "POST", "/skip");
    assert.deepEqual(post.body, { expected_plan_version: 3, expected_lock_version: 1 });
    assert.ok(post.headers["Idempotency-Key"]);
    assert.match(panel(view).querySelector(".smart-plan__notice").textContent, /Installment 5 skipped/);
    await view.unmount();
  });

  it("refetches the plan after a stale skip and keeps the dialog for review", async () => {
    const calls = serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "POST /savings-goals/1/planned-contributions/5/skip": conflict("savings_plan_version_conflict", { current_plan_version: 4 }),
    });
    const view = await renderDetails();

    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[2]);
    await click(byText(dialog(), "Skip installment"));
    await settle();

    assert.equal(callsTo(calls, "GET", "/plan").length, 2);
    assert.match(dialog().textContent, /The plan changed since you opened this/);
    await view.unmount();
  });

  it("explains an owner-only 403", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": { status: 403, body: { status: false, message: "Only the owner." } },
    });
    const view = await renderDetails();

    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();
    assert.match(dialog().textContent, /Only the person who set up this plan/);
    await view.unmount();
  });

  it("renders in Arabic with every key translated, dialogs included", async () => {
    serve({
      "GET /savings-goals/1": { savings_goal: goal() },
      "GET /savings-goals/1/plan": planData(),
      "GET /savings-goals/1/planned-contributions/4/confirmation-preview": { confirmation: confirmation() },
    });
    const view = await renderDetails({ language: "ar" });

    assert.match(panel(view).textContent, /خطة متوازنة/);
    await click(rowFor(view, 4).querySelector(".installment-timeline__action--primary"));
    await settle();
    assert.match(dialog().textContent, /تأكيد هذا القسط/);
    await click(byText(dialog(), "إلغاء"));
    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[1]);
    await click(byText(dialog(), "إلغاء"));
    await click(rowFor(view, 5).querySelectorAll(".installment-timeline__action")[2]);

    assert.deepEqual(view.i18n.missingKeys, []);
    await view.unmount();
  });
});
