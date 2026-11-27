import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FORM_WRITES, envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { activePlan, goal, planningBackend } from "./helpers/planningFixture.mjs";
import { change, click } from "./helpers/dom.mjs";

/*
 * Smart Savings in Mobile: off unless the build says so, and read-only when on.
 *
 * The build flag is a constant fixed when the code is built, so the "on" half of
 * this file runs in a child process whose module loader sets it
 * (SMARTSPEND_TEST_SMART_SAVINGS=true, tests/helpers/loader.mjs). The parent run
 * proves the flag is off by default and runs the child.
 */

after(() => dom.window.close());

const ON = process.env.SMARTSPEND_TEST_SMART_SAVINGS === "true";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const gate = await import("../src/mobile/planning/smartSavingsGate.js");
const writeGate = await import("../src/mobile/data/writeGate.js");
const { sendPlanWrite } = await import("../src/mobile/data/writePlanApi.js");
const desktop = await import("../src/features/Dashboards/User/SavingsGoals/smartSavingsFlag.js");

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, data) => {
  api = installFakeApi(typeof data === "function" ? data : planningBackend(data));
  view = await mountMobile({ entry });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("the flag", () => {
  it("is Mobile's own copy of the full version's rule, and they always agree", () => {
    assert.equal(gate.MOBILE_SMART_SAVINGS, desktop.SMART_SAVINGS_ENABLED);
    assert.equal(gate.MOBILE_SMART_SAVINGS, ON);
    assert.equal(gate.SmartPlanSection === null, !ON);
  });
});

if (!ON) {
  describe("Smart Savings off (the default and the production setting)", () => {
    it("a goal's page has no plan section and makes no plan request, whatever the backend would say", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: activePlan(1) } });

      assert.equal(q("[data-sm-section='smart-plan']"), null);
      assert.doesNotMatch(text(q("main")), /Smart Savings|planned contribution/i);
      assert.deepEqual(api.summary(), ["GET /savings-goals/1", "GET /savings-goals/1/activity"]); // the goal and its movement history; never a plan
    });

    it("the flag-on tests run in a child process with the flag on, and pass", () => {
      // The runner's own context variable would make the child report to this process instead of printing.
      const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
      const result = spawnSync(process.execPath, ["--import", "./tests/helpers/register.mjs", "--test", "--test-reporter=tap", "tests/mobileSavings.test.mjs"], {
        cwd: ROOT,
        env: { ...env, SMARTSPEND_TEST_SMART_SAVINGS: "true" },
        encoding: "utf8",
      });

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.slice(-3000));
      assert.match(result.stdout, /# pass [1-9]/);
      assert.match(result.stdout, /# fail 0/);
    });
  });
} else {
  describe("Smart Savings on", () => {
    it("the plan section's two languages have exactly the same keys, and are registered in the Mobile namespace", async () => {
      const { SMART_PLAN_MESSAGES } = await import("../src/mobile/planning/smartPlanMessages.js");
      const { i18n } = await import("./helpers/mobileHarness.mjs");

      assert.deepEqual(Object.keys(SMART_PLAN_MESSAGES.en).sort(), Object.keys(SMART_PLAN_MESSAGES.ar).sort());
      assert.equal(i18n.getResource("en", "mobile", "planning.goals.plan.title"), "Smart Savings plan");
      assert.ok(i18n.getResource("ar", "mobile", "planning.goals.plan.title"));
    });

    const planWith = (over = {}) => {
      const plan = activePlan(1);
      Object.assign(plan.savings_plan, { intensity: "balanced", frequency: "monthly", interval: 1, installment_amount: "250.0000", expected_completion_date: "2027-06-05", installments: [
        { id: 900, sequence: 3, planned_date: "2026-11-05", amount: "250.0000", status: "planned", lock_version: 4 },
        { id: 901, sequence: 4, planned_date: "2026-12-05", amount: "250.0000", status: "planned", lock_version: 1 },
        { id: 898, sequence: 2, planned_date: "2026-10-05", amount: "250.0000", status: "confirmed" },
      ] }, over);
      plan.savings_goal.target_date = "2027-06-30";
      return plan;
    };
    const preview = (over = {}) => ({ confirmation: { installment: { id: 900, planned_date: "2026-11-05", lock_version: 4 }, savings_plan: { plan_version: 2 }, savings_goal: { name: "Laptop" }, suggested_amount: "250.0000", confirmable: true, default_account_id: 1, warnings: [], accounts: [{ id: 1, name: "Everyday wallet", available_balance: "1234.5000", covers_suggested_amount: true }, { id: 2, name: "Small cash", available_balance: "10.0000", covers_suggested_amount: false }], ...over } });
    const backend = (extra = {}) => (call) => {
      if (/\/planned-contributions\/\d+\/confirmation-preview$/.test(call.path)) return extra.preview ?? { body: envelope(preview()) };
      if (/\/plan-options$/.test(call.path)) return { body: envelope({ plan_options: { options: [{ intensity: "easy", is_feasible: true, options_fingerprint: "a", installment_amount: "120.0000", installment_count: 25, expected_completion_date: "2028-11-05", affordability: { band: "comfortable" } }, { intensity: "intensive", is_feasible: false, shortfall_amount: "300.0000" }] } }) };
      return planningBackend({ goals: [goal(1)], plans: extra.noPlan ? {} : { 1: extra.plan ?? planWith() } })(call);
    };

    it("shows the plan's own figures and its open installments, from GET …/plan only", async () => {
      await open("/m/planning/goals/1", backend());
      const section = q("[data-sm-section='smart-plan']");
      assert.equal(section.querySelector("[data-sm-plan]").dataset.smPlan, "active");
      assert.match(text(section), /Balanced/);
      assert.match(text(section), /Per installment\s*250\.00ILS/);
      assert.deepEqual(qa("[data-sm-list='installments'] [data-sm-installment]", section).map((row) => row.dataset.smInstallment), ["900", "901"], "only open (planned) installments can be reviewed");
      assert.deepEqual(api.summary(), ["GET /savings-goals/1", "GET /savings-goals/1/activity", "GET /savings-goals/1/plan"]);
    });

    it("confirm review: reads the preview first, shows the backend's amount and accounts, and its last button never sends", async () => {
      await open("/m/planning/goals/1", backend());
      await click(q("[data-sm-installment='900'] [data-sm-action='review-confirm']"));
      await settle();
      const dialog = q("[role='dialog']");
      assert.ok(api.calls.some((call) => call.path === "/savings-goals/1/planned-contributions/900/confirmation-preview"));
      assert.match(text(dialog), /Amount to move\s*250\.00ILS/);
      assert.equal(q("[data-sm-account='1'] input", dialog).checked, true, "the plan's own account, which can pay");
      assert.equal(q("[data-sm-account='2'] input", dialog).disabled, true, "an account the backend says can't cover it");
      assert.equal(q("[data-sm-versions]", dialog).dataset.smVersions, "2:4");
      assert.ok(q("[data-sm-note='funding-unavailable']", dialog), "multi-account funding is said to be unavailable");
      assert.equal(api.calls.some((call) => /funding/.test(call.path)), false, "the funding preview (a POST) is never asked for");
      const send = q("[data-sm-action='send']", dialog);
      assert.equal(send.disabled, true);
      await click(send);
      assert.deepEqual(api.violations, []);
      assert.ok(api.calls.every((call) => call.method === "GET"));
      await click(q("[data-sm-action='keep']", dialog));
      assert.equal(q("[data-sm-installment='900']").dataset.smStatus, "planned", "reviewing it did not change it");
    });

    it("confirm review: a blocker is shown and no account can be chosen; an installment no longer open says so", async () => {
      await open("/m/planning/goals/1", backend({ preview: { body: envelope(preview({ confirmable: false, blocker: { code: "goal_paused", message: "The goal is paused." } })) } }));
      await click(q("[data-sm-installment='900'] [data-sm-action='review-confirm']"));
      await settle();
      assert.ok(q("[role='dialog'] [data-sm-blocker]"));
      assert.equal(q("[role='dialog'] fieldset").disabled, true);
      await view.unmount();
      api.restore();
      await open("/m/planning/goals/1", backend({ preview: failure(409, "The installment changed.") }));
      await click(q("[data-sm-installment='900'] [data-sm-action='review-confirm']"));
      await settle();
      assert.ok(q("[role='dialog'] [data-sm-note='installment-stale']"));
    });

    it("postpone review: the date must follow the backend's stated rules; skip review defaults to keeping it", async () => {
      await open("/m/planning/goals/1", backend());
      await click(q("[data-sm-installment='900'] [data-sm-action='review-postpone']"));
      const dialog = q("[role='dialog']");
      const input = q("[data-sm-input='new-date']", dialog);
      assert.equal(input.max, "2026-12-04", "before the next installment");
      await change(input, "2026-12-20");
      await click(q("[data-sm-action='check-postpone']", dialog));
      assert.equal(q("[data-sm-error]", dialog).dataset.smError, "bounds");
      assert.equal(q("[data-sm-action='send']", dialog).disabled, true);
      await click(q("[data-sm-action='keep']", dialog));
      await click(q("[data-sm-installment='901'] [data-sm-action='review-skip']"));
      assert.match(text(q("[role='dialog']")), /A skip can't be undone/);
      assert.equal(q("[role='dialog'] [data-sm-action='send']").disabled, true);
      assert.ok(api.calls.every((call) => call.method === "GET"));
    });

    it("a goal with no plan can see the backend's options per rhythm, and can't start one here", async () => {
      await open("/m/planning/goals/1", backend({ noPlan: true }));
      assert.equal(api.calls.some((call) => /plan-options/.test(call.path)), false, "options are read only when asked for");
      await click(q("[data-sm-rhythm='monthly']"));
      await settle();
      const call = api.calls.find((item) => /plan-options/.test(item.path));
      assert.deepEqual(call.query, { frequency: "monthly", interval: "1" });
      assert.equal(q("[data-sm-option='easy']").dataset.smFeasible, "true");
      assert.equal(q("[data-sm-option='intensive']").dataset.smFeasible, "false");
      assert.match(text(q("[data-sm-option='easy']")), /Comfortable/);
      assert.equal(q("[data-sm-action='create-plan']").disabled, true);
    });

    it("an overdue installment and a recommended review are said in words", async () => {
      const plan = activePlan(1);
      plan.savings_plan.next_installment.is_overdue = true;
      plan.savings_plan.next_installment.status = "planned";
      plan.plan_health = { executable: false, replanning_recommended: true };
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: plan } });

      const shown = text(q("[data-sm-section='smart-plan']"));
      for (const words of [/Overdue/, /Plan review suggested/, /Can't be confirmed right now/]) assert.match(shown, words);
      assert.equal(q("[data-sm-action='review-confirm']").disabled, true, "not executable: no confirm review");
    });

    it("a goal with no plan (404) is a flexible goal, not an error", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1)] });
      const section = q("[data-sm-section='smart-plan']");

      assert.equal(section.querySelector("[data-sm-plan]").dataset.smPlan, "none");
      assert.match(text(section), /no Smart Savings plan/);
      assert.equal(q("[data-sm-screen='goal']").dataset.smState, "ready");
      assert.equal(q("[data-sm-error]"), null);
    });

    it("a plan that is not this goal's, or not active, is refused inside the section and the rest of the page stands", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: activePlan(2) } });
      assert.equal(q("[data-sm-section='smart-plan'] [data-sm-error]").dataset.smError, "malformed");
      assert.match(text(q("[data-sm-screen='goal']")), /Laptop|Goal 1/);

      await view.unmount();
      api.restore();
      const completed = activePlan(1);
      completed.savings_plan.status = "completed";
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: completed } });
      assert.equal(q("[data-sm-section='smart-plan'] [data-sm-error]").dataset.smError, "malformed");
      assert.doesNotMatch(text(q("[data-sm-section='smart-plan']")), /Nov 5/);
    });

    it("a plan read that fails has a Retry that is the same GET", async () => {
      let fail = true;
      const backend = planningBackend({ goals: [goal(1)], plans: { 1: activePlan(1) } });
      await open("/m/planning/goals/1", (call) => (/\/plan$/.test(call.path) && fail ? failure(500, "boom") : backend(call)));
      assert.equal(q("[data-sm-section='smart-plan'] [data-sm-error]").dataset.smError, "server");

      fail = false;
      await click(qa("button", q("[data-sm-section='smart-plan']")).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(q("[data-sm-plan]").dataset.smPlan, "active");
      assert.deepEqual(api.violations, []);
    });

    // GET …/plans: the goal's plan history (docs/savings-goals/plan-management.md). Read only, and only once asked for.
    const historyPlan = (id, over = {}) => ({
      id, savings_goal_id: 1, status: "superseded", plan_version: id, intensity: "easy", frequency: "monthly", interval: 1, installment_amount: "120.0000",
      start_date: "2026-01-05", expected_completion_date: "2026-12-05", installments_summary: { total: 12, fulfilled: 3, open: 0, cancelled: 9 },
      closed_reason: "plan_superseded", accepted_at: "2026-01-01T09:00:00.000000Z", completed_at: null, discontinued_at: null, superseded_at: "2026-04-01T09:00:00.000000Z", ...over,
    });
    const historyPage = (plans, { page = 1, lastPage = 1, total = plans.length } = {}) => ({ savings_plans: { current_page: page, data: plans, last_page: lastPage, per_page: 10, total } });
    const withHistory = (history, extra = {}) => {
      const base = backend(extra);
      return (call) => (/^\/savings-goals\/1\/plans$/.test(call.path) ? (typeof history === "function" ? history(call) : { body: envelope(history) }) : base(call));
    };

    it("the strings of the plan history have the same keys in both languages", async () => {
      const { SMART_PLAN_MESSAGES } = await import("../src/mobile/planning/smartPlanMessages.js");
      const flat = (value, prefix = "") => Object.entries(value).flatMap(([key, item]) => (item && typeof item === "object" ? flat(item, `${prefix}${key}.`) : [`${prefix}${key}`])).sort();
      assert.deepEqual(flat(SMART_PLAN_MESSAGES.en.history), flat(SMART_PLAN_MESSAGES.ar.history));
    });

    it("earlier plans are read only when asked for, with GET …/plans, and show each plan's own figures", async () => {
      const history = historyPage([
        historyPlan(3, { status: "active", closed_reason: null, superseded_at: null }),
        historyPlan(2),
        historyPlan(1, { status: "discontinued", closed_reason: "plan_discontinued", superseded_at: null, discontinued_at: "2026-01-20T09:00:00.000000Z", installments_summary: { total: 12, fulfilled: 0, open: 0, cancelled: 12 } }),
        historyPlan(9, { savings_goal_id: 2 }),
        historyPlan(8, { status: "draft" }),
      ], { lastPage: 2, total: 14 });
      await open("/m/planning/goals/1", withHistory(history));
      assert.equal(api.calls.some((call) => /\/plans$/.test(call.path)), false, "the goal's page reads no history by itself");
      const toggle = q("[data-sm-action='plan-history']");
      assert.equal(toggle.getAttribute("aria-expanded"), "false");

      await click(toggle);
      await settle();
      const call = api.calls.find((item) => /\/plans$/.test(item.path));
      assert.equal(call.path, "/savings-goals/1/plans");
      assert.deepEqual(call.query, { per_page: "10" });
      assert.equal(q("[data-sm-action='plan-history']").getAttribute("aria-expanded"), "true");
      // The active plan is the section above; another goal's row and an unknown status are dropped.
      assert.deepEqual(qa("[data-sm-history-plan]").map((row) => [row.dataset.smHistoryPlan, row.dataset.smStatus]), [["2", "superseded"], ["1", "discontinued"]]);
      const replaced = text(q("[data-sm-history-plan='2']"));
      for (const words of [/Plan 2/, /Replaced/, /120\.00/, /Every 1 × month/, /Easy/, /3 of 12 installments confirmed/, /Replaced by a revised plan/]) assert.match(replaced, words);
      assert.match(text(q("[data-sm-history-plan='1']")), /0 of 12 installments confirmed/);
      assert.match(q("[data-sm-action='plan-history-more']").textContent, /Show older plans/, "last_page 2: more can be read");
      assert.ok(api.calls.every((item) => item.method === "GET"));
      assert.deepEqual(api.violations, []);

      await click(q("[data-sm-action='plan-history']"));
      assert.equal(q("[data-sm-action='plan-history']").getAttribute("aria-expanded"), "false");
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      assert.equal(qa("[data-sm-history-plan]").length, 2, "reopened, the plans are still there");
      assert.equal(api.calls.filter((item) => /\/plans$/.test(item.path)).length, 1, "closing and reopening send nothing more");
    });

    it("Show older plans reads page=2, page=3…, appends without repeats and stops at the paginator's last page", async () => {
      const pagesOf = {
        1: historyPage([historyPlan(9, { status: "active", closed_reason: null, superseded_at: null }), historyPlan(8), historyPlan(7)], { lastPage: 3, total: 7 }),
        2: historyPage([historyPlan(7), historyPlan(6), historyPlan(5, { savings_goal_id: 2 }), historyPlan(4, { status: "draft" })], { page: 2, lastPage: 3, total: 7 }),
        3: historyPage([historyPlan(3, { status: "discontinued", closed_reason: "goal_archived", superseded_at: null, discontinued_at: "2026-02-01T09:00:00.000000Z" })], { page: 3, lastPage: 3, total: 7 }),
      };
      await open("/m/planning/goals/1", withHistory((call) => ({ body: envelope(pagesOf[call.query.page ?? "1"]) })));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      const shown = () => qa("[data-sm-history-plan]").map((row) => row.dataset.smHistoryPlan);
      const historyCalls = () => api.calls.filter((call) => /\/plans$/.test(call.path)).map((call) => call.query);
      assert.deepEqual(shown(), ["8", "7"]);
      assert.deepEqual(historyCalls(), [{ per_page: "10" }], "the next page waits for Show older plans");

      await click(q("[data-sm-action='plan-history-more']"));
      await settle();
      assert.deepEqual(shown(), ["8", "7", "6"], "7 is on both pages and shown once; another goal's plan and an unknown status are dropped");
      await click(q("[data-sm-action='plan-history-more']"));
      await settle();
      assert.deepEqual(shown(), ["8", "7", "6", "3"]);
      assert.match(text(q("[data-sm-history-plan='3']")), /Ended when the goal was archived/);
      assert.deepEqual(historyCalls(), [{ per_page: "10" }, { per_page: "10", page: "2" }, { per_page: "10", page: "3" }]);
      assert.equal(q("[data-sm-action='plan-history-more']"), null, "page 3 of 3: everything is loaded");
      assert.ok(api.calls.every((call) => call.method === "GET"));
      assert.deepEqual(api.violations, []);
    });

    it("a failed older page keeps the plans shown and retries that page only; installments of a plan from it still open", async () => {
      let second = failure(503, "busy");
      const base = withHistory((call) => (call.query.page === "2" ? second : { body: envelope(historyPage([historyPlan(2)], { lastPage: 2, total: 2 })) }));
      await open("/m/planning/goals/1", (call) => (/\/plans\/1\/installments$/.test(call.path)
        ? { body: envelope({ savings_plan: { id: 1, savings_goal_id: 1, status: "discontinued" }, installments: { current_page: 1, last_page: 1, total: 1, data: [{ id: 50, savings_plan_id: 1, sequence: 1, planned_date: "2026-01-05", amount: "120.0000", status: "cancelled" }] } }) }
        : base(call)));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      await click(q("[data-sm-action='plan-history-more']"));
      await settle();
      const panel = q("[data-sm-section='plan-history']");
      assert.equal(panel.querySelector("[data-sm-error]").dataset.smError, "server");
      assert.deepEqual(qa("[data-sm-history-plan]").map((row) => row.dataset.smHistoryPlan), ["2"], "the first page stays");
      assert.equal(q("[data-sm-action='plan-history-more']"), null, "the failed page is retried from its error, not skipped");

      second = { body: envelope({ savings_plans: { data: "nope" } }) };
      await click(qa("button", panel).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(panel.querySelector("[data-sm-error]").dataset.smError, "malformed");
      assert.deepEqual(qa("[data-sm-history-plan]").map((row) => row.dataset.smHistoryPlan), ["2"]);

      second = { body: envelope(historyPage([historyPlan(1, { status: "discontinued", closed_reason: "plan_discontinued", superseded_at: null })], { page: 2, lastPage: 2, total: 2 })) };
      await click(qa("button", panel).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(panel.querySelector("[data-sm-error]"), null);
      assert.deepEqual(qa("[data-sm-history-plan]").map((row) => row.dataset.smHistoryPlan), ["2", "1"]);
      assert.deepEqual(api.calls.filter((call) => /\/plans$/.test(call.path)).map((call) => call.query.page ?? "1"), ["1", "2", "2", "2"], "only the failed page was asked again");

      await click(q("[data-sm-history-plan='1'] [data-sm-action='plan-installments']"));
      await settle();
      assert.deepEqual(qa("[data-sm-history-plan='1'] [data-sm-installment]").map((row) => row.dataset.smInstallment), ["50"]);
      assert.deepEqual(api.violations, []);
    });

    it("a goal with no active plan can still open its history; a goal with none says so", async () => {
      await open("/m/planning/goals/1", withHistory(historyPage([historyPlan(1, { status: "completed", closed_reason: "goal_achieved", superseded_at: null, completed_at: "2026-06-01T09:00:00.000000Z" })]), { noPlan: true }));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      assert.equal(q("[data-sm-history-plan='1']").dataset.smStatus, "completed");
      assert.match(text(q("[data-sm-history-plan='1']")), /Ended when the goal reached its target/);
      assert.equal(q("[data-sm-action='plan-history-more']"), null, "one page: nothing more to read");

      await view.unmount();
      api.restore();
      await open("/m/planning/goals/1", withHistory(historyPage([])));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      assert.equal(q("[data-sm-history='empty']").textContent, "This goal has no earlier plans.");
    });

    it("a history read that fails, or is not this goal's shape, shows an error with a Retry that is the same GET", async () => {
      let answer = failure(500, "boom");
      await open("/m/planning/goals/1", withHistory(() => answer));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      const panel = () => q("[data-sm-section='plan-history']");
      assert.equal(panel().querySelector("[data-sm-error]").dataset.smError, "server");
      assert.equal(q("[data-sm-plan]").dataset.smPlan, "active", "the plan above stands");

      answer = { body: envelope({ savings_plans: { data: "nope" } }) };
      await click(qa("button", panel()).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(panel().querySelector("[data-sm-error]").dataset.smError, "malformed");
      assert.deepEqual(api.calls.filter((item) => /\/plans$/.test(item.path)).map((item) => item.path), ["/savings-goals/1/plans", "/savings-goals/1/plans"]);
      assert.deepEqual(api.violations, []);
    });

    // GET …/plans/{plan}/installments (docs/savings-goals/plan-management.md, F5.2): one earlier plan's installments, read only.
    const planInstallment = (id, over = {}) => ({
      id, savings_plan_id: 2, sequence: id - 20, planned_date: `2026-0${Math.min(9, id - 20)}-05`, original_planned_date: null, postponed_count: 0, amount: "120.0000", status: "cancelled",
      lock_version: 1, reversal_state: "none", fulfilled_amount: null, effective_amount: null, reversed_amount: null, shortfall_amount: null, resolution_reason: null, ...over,
    });
    const installmentsPage = (items, { planId = 2, page = 1, lastPage = 1, total = items.length } = {}) => ({
      savings_plan: { id: planId, savings_goal_id: 1, status: "superseded", plan_version: 2, currency_code: "ILS", can_manage: true },
      installments: { current_page: page, data: items, last_page: lastPage, per_page: 10, total },
    });
    const withInstallments = () => withHistory(historyPage([historyPlan(2), historyPlan(1, { status: "discontinued", closed_reason: "plan_discontinued" })]), {});
    const openHistory = async (installments) => {
      const base = withInstallments();
      await open("/m/planning/goals/1", (call) => (/^\/savings-goals\/1\/plans\/\d+\/installments$/.test(call.path) ? installments(call) : base(call)));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
    };
    const row = (planId) => q(`[data-sm-history-plan='${planId}']`);
    const installmentCalls = () => api.calls.filter((call) => /\/installments$/.test(call.path));

    it("an earlier plan's installments are read only once its row is opened, and only that plan's", async () => {
      await openHistory(() => ({ body: envelope(installmentsPage([
        planInstallment(21, { status: "fulfilled", fulfilled_amount: "120.0000", effective_amount: "120.0000" }),
        planInstallment(22, { status: "fulfilled", fulfilled_amount: "120.0000", effective_amount: "80.0000", reversed_amount: "40.0000", reversal_state: "partially_reversed", postponed_count: 1, original_planned_date: "2026-01-20" }),
        planInstallment(23, { status: "skipped" }),
        planInstallment(24, { status: "cancelled", resolution_reason: "plan_superseded" }),
        planInstallment(29, { savings_plan_id: 1 }),
      ], { total: 4 })) })); // the backend's total is this plan's own; a stray row of another plan is not in it
      assert.deepEqual(installmentCalls(), [], "opening the history reads no installments");
      const toggle = row(2).querySelector("[data-sm-action='plan-installments']");
      assert.match(toggle.textContent, /Show installments \(12\)/);
      assert.equal(toggle.getAttribute("aria-expanded"), "false");

      await click(toggle);
      await settle();
      assert.deepEqual(installmentCalls().map((call) => [call.path, call.query]), [["/savings-goals/1/plans/2/installments", { per_page: "10" }]]);
      assert.equal(row(1).querySelector("[data-sm-list='plan-installments']"), null, "the other plan stays closed and unread");
      const rows = qa("[data-sm-list='plan-installments'] [data-sm-installment]", row(2));
      assert.deepEqual(rows.map((item) => [item.dataset.smInstallment, item.dataset.smStatus]), [["21", "fulfilled"], ["22", "partially_reversed"], ["23", "skipped"], ["24", "cancelled"]], "another plan's row is dropped");
      assert.match(text(rows[0]), /Installment 1/);
      assert.match(text(rows[0]), /Confirmed · Scheduled 120\.00/);
      assert.match(text(rows[1]), /Partly reversed/);
      assert.match(text(rows[1]), /Confirmed amount 80\.00/);
      assert.match(text(rows[1]), /Reversed 40\.00/);
      assert.match(text(rows[1]), /Postponed 1 times · originally/);
      assert.doesNotMatch(text(rows[2]), /Confirmed amount/);
      assert.match(text(rows[3]), /Replaced by a revised plan/);
      assert.match(text(row(2)), /4 of 4 shown/);
      assert.equal(row(2).querySelector("[data-sm-action='plan-installments-more']"), null, "one page: no Show more");
      // Read only: nothing in the list can act on an installment; the only buttons show a split payment's details.
      assert.deepEqual(qa("[data-sm-list='plan-installments'] button", row(2)).map((button) => button.dataset.smAction), ["installment-payments", "installment-payments"]);
      assert.ok(api.calls.every((call) => call.method === "GET"));
      assert.deepEqual(api.violations, []);
    });

    it("Show more reads the next page with page=2, appends it without repeats, and stops at the last page", async () => {
      await openHistory((call) => ({ body: envelope(call.query.page === "2"
        ? installmentsPage([planInstallment(30), planInstallment(31)], { page: 2, lastPage: 2, total: 12 })
        : installmentsPage(Array.from({ length: 10 }, (_, index) => planInstallment(21 + index)), { lastPage: 2, total: 12 })) }));
      await click(row(2).querySelector("[data-sm-action='plan-installments']"));
      await settle();
      assert.equal(qa("[data-sm-list='plan-installments'] [data-sm-installment]", row(2)).length, 10);
      assert.match(text(row(2)), /10 of 12 shown/);
      assert.equal(installmentCalls().length, 1, "the next page waits for Show more");

      await click(row(2).querySelector("[data-sm-action='plan-installments-more']"));
      await settle();
      assert.deepEqual(installmentCalls().map((call) => call.query), [{ per_page: "10" }, { per_page: "10", page: "2" }]);
      assert.deepEqual(qa("[data-sm-list='plan-installments'] [data-sm-installment]", row(2)).map((item) => item.dataset.smInstallment), ["21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"], "30 is on both pages and shown once");
      assert.match(text(row(2)), /11 of 12 shown/);
      assert.equal(row(2).querySelector("[data-sm-action='plan-installments-more']"), null);
      assert.deepEqual(api.violations, []);
    });

    it("a plan with no installments says so", async () => {
      await openHistory(() => ({ body: envelope(installmentsPage([])) }));
      await click(row(2).querySelector("[data-sm-action='plan-installments']"));
      await settle();
      assert.equal(row(2).querySelector("[data-sm-installments='empty']").textContent, "This plan has no installments to show.");
    });

    it("a failed or another plan's first page is an error whose Retry is the same GET; a failed next page retries that page only", async () => {
      let first = failure(500, "boom");
      let second = failure(503, "busy");
      await openHistory((call) => (call.query.page === "2" ? second : first));
      await click(row(2).querySelector("[data-sm-action='plan-installments']"));
      await settle();
      assert.equal(row(2).querySelector("[data-sm-error]").dataset.smError, "server");

      first = { body: envelope(installmentsPage([planInstallment(21)], { planId: 7 })) };
      await click(qa("button", row(2)).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(row(2).querySelector("[data-sm-error]").dataset.smError, "malformed", "a page about another plan is refused");

      first = { body: envelope(installmentsPage([planInstallment(21)], { lastPage: 2, total: 2 })) };
      await click(qa("button", row(2)).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      await click(row(2).querySelector("[data-sm-action='plan-installments-more']"));
      await settle();
      assert.ok(row(2).querySelector("[data-sm-error]"), "the next page's failure is shown");
      assert.equal(qa("[data-sm-list='plan-installments'] [data-sm-installment]", row(2)).length, 1, "the first page stays");

      second = { body: envelope(installmentsPage([planInstallment(22)], { page: 2, lastPage: 2, total: 2 })) };
      await click(qa("button", row(2)).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(qa("[data-sm-list='plan-installments'] [data-sm-installment]", row(2)).length, 2);
      assert.deepEqual(installmentCalls().map((call) => call.query.page ?? "1"), ["1", "1", "1", "2", "2"]);
      assert.ok(api.calls.every((call) => call.method === "GET"));
      assert.deepEqual(api.violations, []);
    });

    // GET …/planned-contributions/{iid}/funding-legs (docs/savings-goals/api.md): a split installment's payments, read only, owner only.
    const leg = (id, name, amount, over = {}) => ({ id, account_id: id + 4, account_name: name, amount, currency_code: "ILS", transfer_id: 500 + id, goal_movement_id: 600 + id, is_effective: true, reversed_at: null, ...over });
    const fundingLegs = ({ installmentId = 21, current = [leg(41, "Main bank", "70.0000"), leg(42, "Wallet", "50.0000")], history = [] } = {}) => ({
      installment: { id: installmentId, status: "fulfilled" },
      current_confirmation: current ? { confirmation_version: 3, confirmation_legs: current.length, is_multi_leg: true, confirmed_at: "2026-01-05T09:00:00.000000Z", funding_legs: current } : null,
      funding_legs: current ?? [],
      history,
      reversal: { eligible: true, effective_leg_ids: [41, 42], expected_lock_version: 7 },
    });
    const paidInstallments = (canManage = true) => {
      const page = installmentsPage([
        planInstallment(21, { status: "fulfilled", fulfilled_amount: "120.0000", effective_amount: "120.0000", fulfilled_goal_movement_id: null }),
        planInstallment(22, { status: "fulfilled", fulfilled_amount: "120.0000", effective_amount: "120.0000", fulfilled_goal_movement_id: 77 }),
        planInstallment(23, { status: "skipped" }),
      ]);
      page.savings_plan.can_manage = canManage;
      return { body: envelope(page) };
    };
    const openPayments = async (legs, canManage = true) => {
      const base = withInstallments();
      await open("/m/planning/goals/1", (call) => (/\/funding-legs$/.test(call.path) ? legs(call) : /\/plans\/\d+\/installments$/.test(call.path) ? paidInstallments(canManage) : base(call)));
      await click(q("[data-sm-action='plan-history']"));
      await settle();
      await click(row(2).querySelector("[data-sm-action='plan-installments']"));
      await settle();
    };
    const paymentsOf = (id) => q(`[data-sm-list='plan-installments'] [data-sm-installment='${id}']`);
    const legCalls = () => api.calls.filter((call) => /\/funding-legs$/.test(call.path));

    it("a split payment's accounts and amounts are read only when its payments are opened, and nothing else is offered", async () => {
      await openPayments(() => ({ body: envelope(fundingLegs({
        current: [leg(41, "Main bank", "70.0000", { is_effective: false, reversed_at: "2026-02-01T09:00:00.000000Z" }), leg(42, "Wallet", "50.0000")],
        history: [{ confirmation_version: 2, confirmation_legs: 1, is_multi_leg: false, confirmed_at: "2025-12-20T09:00:00.000000Z", funding_legs: [leg(31, "Savings box", "120.0000", { is_effective: false, reversed_at: "2025-12-28T09:00:00.000000Z" })] }],
      })) }));
      assert.ok(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"), "a split payment offers its payments");
      assert.equal(paymentsOf(22).querySelector("[data-sm-action='installment-payments']"), null, "a single-account payment does not (its movement is in the goal's activity)");
      assert.equal(paymentsOf(23).querySelector("[data-sm-action='installment-payments']"), null, "a skipped installment has no payment");
      assert.deepEqual(legCalls(), [], "nothing is read before it is opened");

      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await settle();
      assert.deepEqual(legCalls().map((call) => call.path), ["/savings-goals/1/planned-contributions/21/funding-legs"]);
      const current = paymentsOf(21).querySelector("[data-sm-payments-cycle='current']");
      assert.match(text(current), /Paid on Jan 5, 2026/);
      assert.deepEqual(qa("[data-sm-leg]", current).map((item) => [item.dataset.smLeg, item.dataset.smLegState]), [["41", "reversed"], ["42", "effective"]]);
      assert.match(text(current.querySelector("[data-sm-leg='41']")), /Main bank.*70\.00.*Reversed on Feb 1, 2026/);
      assert.match(text(current.querySelector("[data-sm-leg='42']")), /Wallet.*50\.00.*In the goal/);
      const earlier = paymentsOf(21).querySelector("[data-sm-payments-cycle='earlier']");
      assert.match(text(earlier), /Earlier confirmation, paid on Dec 20, 2025/);
      assert.match(text(earlier), /Savings box.*120\.00.*Reversed on Dec 28, 2025/);
      // Shown: names and amounts. Not shown: account, transfer or movement ids; no total worked out; no way to reverse.
      const shown = text(paymentsOf(21).querySelector("[data-sm-payments='ready']"));
      for (const id of ["35", "45", "46", "531", "541", "542", "631", "641", "642", "lock"]) assert.ok(!new RegExp(`\\b${id}\\b`, "i").test(shown), `${id} is not shown`);
      assert.equal(qa("button", paymentsOf(21).querySelector("[data-sm-payments='ready']")).length, 0, "no reversal or other action");
      assert.match(shown, /reversing one is done in the full version/);

      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await settle();
      assert.equal(legCalls().length, 1, "closing and reopening reads the cached payments");
      assert.ok(api.calls.every((call) => call.method === "GET"));
      assert.deepEqual(api.violations, []);
    });

    it("someone who doesn't own the plan (can_manage false) is not offered payments, which the backend would refuse", async () => {
      await openPayments(() => ({ body: envelope(fundingLegs()) }), false);
      assert.equal(qa("[data-sm-action='installment-payments']").length, 0);
      assert.deepEqual(legCalls(), []);
    });

    it("a payment with no recorded legs says so", async () => {
      await openPayments(() => ({ body: envelope(fundingLegs({ current: null })) }));
      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await settle();
      assert.equal(paymentsOf(21).querySelector("[data-sm-payments='empty']").textContent, "No payment details are recorded for this installment.");
    });

    it("a refusal (403) is said in place with no Retry, since asking again can't change it", async () => {
      await openPayments(() => failure(403, "Forbidden"));
      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await settle();
      assert.equal(paymentsOf(21).querySelector("[data-sm-error]").dataset.smError, "forbidden");
      assert.equal(qa("button", paymentsOf(21).querySelector("[data-sm-error]")).length, 0);
      assert.ok(paymentsOf(22), "the installments around it stand");
      assert.equal(legCalls().length, 1);
    });

    it("a failed or another installment's answer is an error whose Retry is the same GET", async () => {
      let answer = failure(500, "boom");
      await openPayments(() => answer);
      await click(paymentsOf(21).querySelector("[data-sm-action='installment-payments']"));
      await settle();
      assert.equal(paymentsOf(21).querySelector("[data-sm-error]").dataset.smError, "server");

      answer = { body: envelope(fundingLegs({ installmentId: 99 })) };
      await click(qa("button", paymentsOf(21)).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(paymentsOf(21).querySelector("[data-sm-error]").dataset.smError, "malformed", "payments of another installment are refused");

      answer = { body: envelope(fundingLegs()) };
      await click(qa("button", paymentsOf(21)).find((item) => item.textContent.trim() === "Try again"));
      await settle();
      assert.equal(qa("[data-sm-leg]", paymentsOf(21)).length, 2);
      assert.deepEqual(legCalls().map((call) => call.path), Array(3).fill("/savings-goals/1/planned-contributions/21/funding-legs"));
      assert.deepEqual(api.violations, []);
    });

    /*
     * Installment postpone (installment.postpone, data/writePlanApi.js): wired and CLOSED. The send button stays disabled
     * while the gate is closed; the send path is exercised only with the test switch (setWriteApprovalsForTests) and the
     * fake backend's one allowed rule. Dates are in 2030 so the bounds don't depend on today.
     */
    const POSTPONE_PATH = "/savings-goals/1/planned-contributions/900/postpone";
    const futurePlan = (over = {}) => {
      const plan = activePlan(1);
      Object.assign(plan.savings_plan, { plan_version: 2, installments: [
        { id: 900, sequence: 3, planned_date: "2030-03-05", amount: "250.0000", status: "planned", lock_version: 4 },
        { id: 901, sequence: 4, planned_date: "2030-04-05", amount: "250.0000", status: "planned", lock_version: 1 },
      ] }, over);
      plan.savings_goal.target_date = "2031-06-30";
      return plan;
    };
    const postponed = { body: envelope({ installment: { id: 900, sequence: 3, planned_date: "2030-03-20", status: "planned", lock_version: 5 }, result: { money_moved: false } }) };
    const conflict = (code, extra = {}) => ({ status: 409, body: { status: false, message: "Conflict.", ...(code ? { code } : {}), ...extra, errors: {} } });
    // `answer(call, n)`: the n-th postpone's answer (1-based).
    const openPostpone = async ({ answer = () => postponed, plan = futurePlan(), approve = true } = {}) => {
      let n = 0;
      const base = planningBackend({ goals: [goal(1)], plans: { 1: plan } });
      api = installFakeApi((call) => (call.method === "POST" ? answer(call, ++n) : base(call)), { allowWrites: [FORM_WRITES.installmentPostpone] });
      if (approve) writeGate.setWriteApprovalsForTests(["installment.postpone"]);
      // A pending write's key is kept per (user, workspace): without a workspace it can't be kept, and nothing is sent.
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1, timezone: "UTC" } });
      view = await mountMobile({ entry: "/m/planning/goals/1" });
      await click(q("[data-sm-installment='900'] [data-sm-action='review-postpone']"));
    };
    const dialog = () => q("[role='dialog']");
    const fill = async (date = "2030-03-20", reason) => {
      await change(q("[data-sm-input='new-date']", dialog()), date);
      if (reason !== undefined) await change(q("[data-sm-input='reason']", dialog()), reason);
    };
    const send = async () => {
      await click(q("[data-sm-action='send']", dialog()));
      await settle();
    };
    const posts = () => api.calls.filter((call) => call.method === "POST");
    const planReads = () => api.calls.filter((call) => call.method === "GET" && call.path === "/savings-goals/1/plan").length;
    const outcome = () => q("[data-sm-postpone-outcome]", dialog());
    const reopen = async () => {
      await click(q("[data-sm-action='keep']", dialog()));
      await settle();
      await click(q("[data-sm-installment='900'] [data-sm-action='review-postpone']"));
    };
    afterEach(() => writeGate.setWriteApprovalsForTests(null));

    it("closed (the shipped gate): the send button stays disabled, nothing is sent, and the facade refuses before any request", async () => {
      await openPostpone({ approve: false });
      await fill("2030-03-20", "Trip");
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
      assert.equal(q("[data-sm-note='write-closed']", dialog()).dataset.smWrite, "installment.postpone");
      await send();
      assert.equal(writeGate.isWriteOpen("installment.postpone"), false);
      assert.throws(() => sendPlanWrite({ operation: "installment.postpone", ids: { goalId: "1", installmentId: "900" }, input: { expected_plan_version: 2, expected_lock_version: 4, new_date: "2030-03-20" } }, "mobile-installment-postpone-key"), (error) => error.name === "WriteClosedError" && error.operation === "installment.postpone");
      assert.deepEqual(posts(), [], "no POST at all");
      assert.ok(api.calls.every((call) => call.method === "GET"));
      assert.deepEqual(api.violations, []);
    });

    it("the test switch opens postpone only: no other write becomes available", () => {
      writeGate.setWriteApprovalsForTests(["installment.postpone"]);
      for (const operation of Object.keys(writeGate.MOBILE_WRITES)) assert.equal(writeGate.isWriteOpen(operation), operation === "installment.postpone", operation);
    });

    it("opened by the test switch: one POST with exactly the reviewed versions, the date, the trimmed reason and a key; then the plan is read again", async () => {
      await openPostpone();
      assert.equal(q("[data-sm-note='write-closed']", dialog()), null);
      await fill("2030-03-20", "  Trip abroad  ");
      const readsBefore = planReads();
      await send();
      assert.equal(posts().length, 1);
      const [call] = posts();
      assert.equal(call.path, POSTPONE_PATH);
      assert.deepEqual(call.body, { expected_plan_version: 2, expected_lock_version: 4, new_date: "2030-03-20", reason: "Trip abroad" });
      assert.match(call.headers["Idempotency-Key"], /^mobile-installment-postpone-[A-Za-z0-9._:-]{8,}$/);
      assert.equal(outcome().dataset.smPostponeOutcome, "done");
      assert.match(outcome().textContent, /Installment 3 moved to Mar 20, 2030\. No money moved\./);
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true, "one decision per review");
      assert.ok(planReads() > readsBefore, "the plan is read again after the change");
      assert.deepEqual(api.violations, []);
    });

    it("an empty reason is left out of the body", async () => {
      await openPostpone();
      await fill("2030-03-20", "   ");
      await send();
      assert.deepEqual(posts()[0].body, { expected_plan_version: 2, expected_lock_version: 4, new_date: "2030-03-20" });
    });

    it("a second tap while the first is on its way sends nothing", async () => {
      let release;
      await openPostpone({ answer: () => new Promise((resolve) => { release = resolve; }) });
      await fill();
      await click(q("[data-sm-action='send']", dialog()));
      await click(q("[data-sm-action='send']", dialog()));
      await settle(5);
      assert.equal(posts().length, 1);
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
      assert.equal(outcome().dataset.smPostponeOutcome, "sending");
      release(postponed);
      await settle();
      assert.equal(posts().length, 1);
      assert.equal(outcome().dataset.smPostponeOutcome, "done");
    });

    for (const [name, answer] of [
      ["a 500 (the postpone may have committed)", failure(500, "boom")],
      ["a network failure", new Error("offline")],
      ["a 409 with no code (a key still processing, or reused)", conflict(null)],
      ["a 409 with a code that is not one of postpone's own", conflict("idempotency_key_reused")],
    ]) {
      it(`${name} is an unknown outcome: nothing is resent, the plan is read again, and only an identical retry reuses the key`, async () => {
        await openPostpone({ answer: (call, n) => (n === 1 ? answer : postponed) });
        await fill("2030-03-20", "Trip");
        const readsBefore = planReads();
        await send();
        assert.equal(outcome().dataset.smPostponeOutcome, "unknown");
        assert.equal(outcome().getAttribute("role"), "alert");
        assert.match(outcome().textContent, /couldn't confirm whether the installment was postponed/);
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true, "no further decision from this review");
        await settle();
        assert.equal(posts().length, 1, "never retried by itself");
        assert.ok(planReads() > readsBefore, "the plan and installment are read again");
        const firstKey = posts()[0].headers["Idempotency-Key"];

        // A deliberate retry from a fresh review of the same, unchanged state: the identical request with the same key.
        await reopen();
        await fill("2030-03-20", "Trip");
        await send();
        assert.equal(posts().length, 2);
        assert.equal(posts()[1].headers["Idempotency-Key"], firstKey, "the same key, never a fresh one");
        assert.deepEqual(posts()[1].body, posts()[0].body);
        assert.equal(outcome().dataset.smPostponeOutcome, "done");
        assert.deepEqual(api.violations, []);
      });
    }

    it("after an unknown outcome, a different date is a different request with its own key", async () => {
      await openPostpone({ answer: (call, n) => (n === 1 ? failure(503, "busy") : postponed) });
      await fill("2030-03-20");
      await send();
      await reopen();
      await fill("2030-03-25");
      await send();
      assert.notEqual(posts()[1].headers["Idempotency-Key"], posts()[0].headers["Idempotency-Key"]);
      assert.equal(posts()[1].body.new_date, "2030-03-25");
    });

    for (const code of ["savings_installment_version_conflict", "savings_plan_version_conflict", "savings_installment_not_open", "savings_plan_not_active"]) {
      it(`a coded ${code} changed nothing: the plan is read again, a new review is needed, and no earlier attempt is called failed`, async () => {
        await openPostpone({ answer: () => conflict(code) });
        await fill();
        const readsBefore = planReads();
        await send();
        assert.equal(outcome().dataset.smPostponeOutcome, "stale");
        assert.match(outcome().textContent, /this request changed nothing\. If an earlier attempt went through, the plan now shows it/);
        assert.doesNotMatch(outcome().textContent, /failed|wasn't postponed/i);
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true, "the review is out of date");
        await settle();
        assert.equal(posts().length, 1, "nothing is resent");
        assert.ok(planReads() > readsBefore, "the plan is read again");
      });
    }

    it("a 404 (installment gone) is the same: a certain refusal, re-read, new review", async () => {
      await openPostpone({ answer: () => failure(404, "Not found") });
      await fill();
      await send();
      assert.equal(outcome().dataset.smPostponeOutcome, "stale");
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
    });

    it("a date the backend refuses is said with its own limit, nothing changed, and a corrected date is a new request", async () => {
      await openPostpone({ answer: (call, n) => (n === 1 ? conflict("savings_installment_schedule_conflict", { latest_allowed_date: "2030-03-28" }) : postponed) });
      await fill("2030-03-30");
      await send();
      assert.equal(outcome().dataset.smPostponeOutcome, "date");
      assert.match(outcome().textContent, /latest date allowed is Mar 28, 2030\. Nothing was changed\./);
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, false, "the person can choose another date");
      await fill("2030-03-27");
      await send();
      assert.equal(posts().length, 2);
      assert.notEqual(posts()[1].headers["Idempotency-Key"], posts()[0].headers["Idempotency-Key"], "a refused request's key is not reused");
      assert.equal(outcome().dataset.smPostponeOutcome, "done");
    });

    it("the postpone limit is final for this review; a 422 shows the backend's field messages and allows a fix", async () => {
      await openPostpone({ answer: () => conflict("savings_installment_postpone_limit_reached", { max_postponements: 2 }) });
      await fill();
      await send();
      assert.equal(outcome().dataset.smPostponeOutcome, "limit");
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);

      await view.unmount();
      api.restore();
      await openPostpone({ answer: () => ({ status: 422, body: { status: false, message: "Invalid.", errors: { new_date: ["The new date must be after the current date."] } } }) });
      await fill();
      await send();
      assert.equal(outcome().dataset.smPostponeOutcome, "invalid");
      assert.match(outcome().textContent, /The new date must be after the current date\./);
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, false);
    });

    it("an invalid date, a missing version or a closed installment is refused before any request", async () => {
      await openPostpone();
      await fill("2030-04-10"); // past the next installment
      await send();
      assert.equal(q("[data-sm-postpone-problem]", dialog()).dataset.smPostponeProblem, "date");
      assert.equal(q("[data-sm-error]", dialog()).dataset.smError, "bounds");
      await fill("2030-02-30");
      await send();
      assert.equal(q("[data-sm-postpone-problem]", dialog()).dataset.smPostponeProblem, "date");
      assert.deepEqual(posts(), []);

      await view.unmount();
      api.restore();
      await openPostpone({ plan: futurePlan({ plan_version: null }) });
      await fill();
      await send();
      assert.equal(q("[data-sm-postpone-problem]", dialog()).dataset.smPostponeProblem, "versions");
      assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
      assert.deepEqual(posts(), []);

      const { buildPostponeWrite, postponeBounds } = await import("../src/mobile/planning/smart/planModel.js");
      const installment = { id: "900", sequence: 3, date: "2030-03-05", open: false, lockVersion: 4 };
      const bounds = postponeBounds(installment, [], null, "2030-01-01");
      assert.deepEqual(buildPostponeWrite({ goalId: 1, installment, planVersion: 2, date: "2030-03-20", reason: "", bounds }), { problem: "notOpen" });
      assert.deepEqual(buildPostponeWrite({ goalId: 1, installment: { ...installment, open: true, lockVersion: null }, planVersion: 2, date: "2030-03-20", reason: "", bounds }), { problem: "versions" });
      assert.deepEqual(buildPostponeWrite({ goalId: 1, installment: { ...installment, open: true }, planVersion: 2, date: "2030-03-20", reason: "x".repeat(501), bounds }), { problem: "reason" });
    });

    it("only exact codes decide: classifyWriteOutcome never reads the message, and an uncoded 409 is unknown", async () => {
      const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
      const { POSTPONE_CERTAIN_409 } = await import("../src/mobile/planning/smart/planModel.js");
      const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
      const err = (serverCode, message = "x") => new ApiError(message, { status: 409, code: "CONFLICT", serverCode });
      assert.equal(classifyWriteOutcome(err("savings_installment_version_conflict"), POSTPONE_CERTAIN_409).kind, "rejected");
      assert.equal(classifyWriteOutcome(err(null, "savings_installment_version_conflict: this installment changed"), POSTPONE_CERTAIN_409).kind, "unknown", "a code named in the message is not a code");
      assert.equal(classifyWriteOutcome(err("savings_installment_version_conflict")).kind, "unknown", "the codes count only for the write that names them");
      assert.equal(classifyWriteOutcome(new ApiError("", { status: 500, code: "SERVER_ERROR" }), POSTPONE_CERTAIN_409).kind, "unknown");
    });

    it("the postpone strings have the same keys in English and Arabic, and the outcome is said in Arabic", async () => {
      const { SMART_PLAN_MESSAGES } = await import("../src/mobile/planning/smartPlanMessages.js");
      for (const section of ["postponeOutcome", "postponeProblem"]) assert.deepEqual(Object.keys(SMART_PLAN_MESSAGES.en[section]).sort(), Object.keys(SMART_PLAN_MESSAGES.ar[section]).sort(), section);
      await view?.unmount();
      view = null;
      await resetEnvironment("ar");
      storeSession({ token: TOKEN_A, user: USER_A });
      await openPostpone({ answer: () => failure(500, "boom") });
      await fill();
      await send();
      assert.match(outcome().textContent, /تعذّر التأكد مما إذا كان القسط قد أُجّل/);
    });

    /*
     * Installment skip (installment.skip) and single-account confirmation (installment.confirm, MOVES MONEY), both through
     * data/writePlanApi.js: wired and CLOSED. The send path is exercised only with the test switch and the fake backend's
     * one allowed rule per write. The confirmation is built from the preview on screen, whose versions differ from the
     * plan's here (7 / 9 against 2 / 4), so a request that used the plan's would be caught.
     */
    const CONFIRM_PATH = "/savings-goals/1/planned-contributions/900/confirm";
    const SKIP_PATH = "/savings-goals/1/planned-contributions/900/skip";
    const confirmPreview = (over = {}) => ({ confirmation: {
      installment: { id: 900, planned_date: "2030-03-05", lock_version: 9 }, savings_plan: { plan_version: 7 }, savings_goal: { name: "Laptop" },
      suggested_amount: "250.0000", confirmable: true, default_account_id: 1, warnings: [],
      accounts: [
        { id: 1, name: "Everyday wallet", available_balance: "1234.5000", covers_suggested_amount: true },
        { id: 2, name: "Small cash", available_balance: "10.0000", covers_suggested_amount: false },
        { id: 3, name: "Savings box", available_balance: "800.0000", covers_suggested_amount: true },
      ],
      ...over,
    } });
    const confirmed = { status: 201, body: envelope({ contribution: { id: 77, amount: "250.0000" }, installment: { id: 900, status: "fulfilled", lock_version: 10 }, savings_plan: { id: 5, status: "active", plan_version: 7 } }) };
    const skipped = { body: envelope({ installment: { id: 900, sequence: 3, status: "skipped", lock_version: 5 }, result: { money_moved: false } }) };
    const previewReads = () => api.calls.filter((call) => call.method === "GET" && call.path.endsWith("/900/confirmation-preview")).length;
    const goalReads = () => api.calls.filter((call) => call.method === "GET" && call.path === "/savings-goals/1").length;
    // `answer(call, n)`: the n-th write's answer; `previewAnswer(n)`: the n-th preview read's answer.
    const openReview = async (kind, { answer = () => (kind === "skip" ? skipped : confirmed), previewAnswer = () => ({ body: envelope(confirmPreview()) }), plan = futurePlan(), approve = true } = {}) => {
      let writes = 0;
      let previews = 0;
      const base = planningBackend({ goals: [goal(1)], plans: { 1: plan } });
      const backendCall = (call) => {
        if (call.method === "POST") return answer(call, ++writes);
        if (call.path.endsWith("/confirmation-preview")) return previewAnswer(++previews);
        return base(call);
      };
      api = installFakeApi(backendCall, { allowWrites: [kind === "skip" ? FORM_WRITES.installmentSkip : FORM_WRITES.installmentConfirm] });
      if (approve) writeGate.setWriteApprovalsForTests([`installment.${kind}`]);
      storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1, timezone: "UTC" } });
      view = await mountMobile({ entry: "/m/planning/goals/1" });
      await click(q(`[data-sm-installment='900'] [data-sm-action='review-${kind}']`));
      await settle();
    };
    const outcomeOf = (kind) => q(`[data-sm-${kind}-outcome]`, dialog());
    const reopenReview = async (kind) => {
      await click(q("[data-sm-action='keep']", dialog()));
      await settle();
      await click(q(`[data-sm-installment='900'] [data-sm-action='review-${kind}']`));
      await settle();
    };

    describe("installment confirmation (single account, moves money)", () => {
      it("closed (the shipped gate): the send button stays disabled, nothing is sent, and the facade refuses before any request", async () => {
        await openReview("confirm", { approve: false });
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        assert.equal(q("[data-sm-note='write-closed']", dialog()).dataset.smWrite, "installment.confirm");
        await send();
        assert.equal(writeGate.isWriteOpen("installment.confirm"), false);
        assert.equal(writeGate.MOBILE_WRITES["installment.confirm"].moves, true);
        assert.throws(() => sendPlanWrite({ operation: "installment.confirm", ids: { goalId: "1", installmentId: "900" }, input: { expected_plan_version: 7, expected_lock_version: 9, from_account_id: 1, amount: "250.0000" } }, "mobile-installment-confirm-key"), (error) => error.name === "WriteClosedError" && error.operation === "installment.confirm");
        assert.deepEqual(posts(), [], "no POST at all");
        assert.deepEqual(api.violations, []);
      });

      it("the test switch opens confirm only: no other write becomes available", () => {
        writeGate.setWriteApprovalsForTests(["installment.confirm"]);
        for (const operation of Object.keys(writeGate.MOBILE_WRITES)) assert.equal(writeGate.isWriteOpen(operation), operation === "installment.confirm", operation);
      });

      it("opened by the test switch: one POST with the preview's versions and amount exactly, the chosen account and a key", async () => {
        await openReview("confirm");
        assert.equal(q("[data-sm-note='write-closed']", dialog()), null);
        await click(q("[data-sm-account='3'] input", dialog()));
        const readsBefore = planReads();
        await send();
        assert.equal(posts().length, 1);
        const [call] = posts();
        assert.equal(call.path, CONFIRM_PATH);
        assert.deepEqual(call.body, { expected_plan_version: 7, expected_lock_version: 9, from_account_id: 3, amount: "250.0000" }, "the preview's versions, never the plan's 2 / 4");
        assert.match(call.headers["Idempotency-Key"], /^mobile-installment-confirm-[A-Za-z0-9._:-]{8,}$/);
        assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "done");
        assert.match(outcomeOf("confirm").textContent, /Installment 3 is confirmed/);
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true, "one decision per review");
        assert.ok(planReads() > readsBefore, "the plan is read again after the money moved");
        assert.deepEqual(api.violations, []);
      });

      it("the plan's own account is preselected; an account the preview says can't cover the amount can't be chosen", async () => {
        await openReview("confirm");
        assert.equal(q("[data-sm-account='1'] input", dialog()).checked, true);
        assert.equal(q("[data-sm-account='2'] input", dialog()).disabled, true);
        await send();
        assert.equal(posts()[0].body.from_account_id, 1);
      });

      it("closing after a confirmation reads the goal and a new preview again", async () => {
        await openReview("confirm");
        await send();
        const goalsBefore = goalReads();
        const previewsBefore = previewReads();
        await reopenReview("confirm");
        assert.ok(goalReads() > goalsBefore, "the goal's progress is read from the server again");
        assert.ok(previewReads() > previewsBefore, "a new review starts from a new preview");
      });

      it("a second tap while the first is on its way sends nothing", async () => {
        let release;
        await openReview("confirm", { answer: () => new Promise((resolve) => { release = resolve; }) });
        await click(q("[data-sm-action='send']", dialog()));
        await click(q("[data-sm-action='send']", dialog()));
        await settle(5);
        assert.equal(posts().length, 1);
        assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "sending");
        release(confirmed);
        await settle();
        assert.equal(posts().length, 1);
        assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "done");
      });

      for (const [name, answer] of [
        ["a 500 (the money may have moved)", failure(500, "boom")],
        ["a network failure", new Error("offline")],
        ["a 409 with no code (a key still processing)", conflict(null)],
        ["a 409 with a code that is not one of confirm's own", conflict("idempotency_key_reused")],
      ]) {
        it(`${name} is an unknown outcome: nothing is resent, and only an identical retry from an unchanged preview reuses the key`, async () => {
          await openReview("confirm", { answer: (call, n) => (n === 1 ? answer : confirmed) });
          await send();
          assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "unknown");
          assert.equal(outcomeOf("confirm").getAttribute("role"), "alert");
          assert.match(outcomeOf("confirm").textContent, /couldn't confirm whether the money moved/);
          assert.equal(q("[data-sm-action='send']", dialog()).disabled, true, "no further decision from this review");
          await settle();
          assert.equal(posts().length, 1, "never retried by itself");
          const firstKey = posts()[0].headers["Idempotency-Key"];

          // The preview is read again and is unchanged (the money did not move): the identical request with the same key.
          await reopenReview("confirm");
          await send();
          assert.equal(posts().length, 2);
          assert.equal(posts()[1].headers["Idempotency-Key"], firstKey, "the same key, never a fresh one");
          assert.deepEqual(posts()[1].body, posts()[0].body);
          assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "done");
          assert.deepEqual(api.violations, []);
        });
      }

      it("after an unknown outcome, a preview that says the installment is no longer open offers nothing to send", async () => {
        await openReview("confirm", { answer: () => failure(503, "busy"), previewAnswer: (n) => (n === 1 ? { body: envelope(confirmPreview()) } : conflict("savings_installment_not_open")) });
        await send();
        await reopenReview("confirm");
        assert.ok(q("[data-sm-note='installment-stale']", dialog()), "said so, never guessed");
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        await send();
        assert.equal(posts().length, 1);
      });

      for (const code of ["savings_installment_version_conflict", "savings_plan_version_conflict", "savings_installment_not_open", "savings_plan_not_active", "savings_goal_not_active"]) {
        it(`a coded ${code} moved no money: a new review is needed, and no earlier attempt is called failed`, async () => {
          await openReview("confirm", { answer: () => conflict(code) });
          const readsBefore = planReads();
          await send();
          assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "stale");
          assert.match(outcomeOf("confirm").textContent, /this request moved no money\. If an earlier attempt went through, the plan now shows it/);
          assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
          await settle();
          assert.equal(posts().length, 1, "nothing is resent");
          assert.ok(planReads() > readsBefore, "the plan is read again");
        });
      }

      for (const [code, key] of [["savings_goal_not_accepting_contributions", "notAccepting"], ["savings_installment_exceeds_remaining", "exceeds"], ["savings_installment_funding_unsupported", "funding"]]) {
        it(`a coded ${code} is a certain, final refusal (${key})`, async () => {
          await openReview("confirm", { answer: () => conflict(code) });
          await send();
          assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, key);
          assert.match(outcomeOf("confirm").textContent, /No money moved\./);
          assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        });
      }

      it("a 422 (the balance) shows the backend's reason, reads the preview again and allows another account with a new key", async () => {
        await openReview("confirm", { answer: (call, n) => (n === 1 ? { status: 422, body: { status: false, message: "Insufficient balance in the source account.", errors: {} } } : confirmed) });
        const previewsBefore = previewReads();
        await send();
        assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "invalid");
        assert.match(outcomeOf("confirm").textContent, /Insufficient balance in the source account\./);
        assert.ok(previewReads() > previewsBefore, "the balances are read again");
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, false);
        await click(q("[data-sm-account='3'] input", dialog()));
        await send();
        assert.equal(posts().length, 2);
        assert.equal(posts()[1].body.from_account_id, 3);
        assert.notEqual(posts()[1].headers["Idempotency-Key"], posts()[0].headers["Idempotency-Key"], "a refused request's key is not reused");
        assert.equal(outcomeOf("confirm").dataset.smConfirmOutcome, "done");
      });

      it("a preview that isn't confirmable, names a blocker, or has no versions or amount is refused before any request", async () => {
        await openReview("confirm", { previewAnswer: () => ({ body: envelope(confirmPreview({ confirmable: false, blocker: { code: "savings_goal_not_active", message: "Paused." } })) }) });
        await send();
        assert.equal(q("[data-sm-confirm-problem]", dialog()).dataset.smConfirmProblem, "notConfirmable");
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        assert.deepEqual(posts(), []);

        const { buildConfirmWrite, buildConfirmationPreview } = await import("../src/mobile/planning/smart/planModel.js");
        const ready = buildConfirmationPreview(confirmPreview(), "900");
        assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: ready, accountId: "1" }).write.input, { expected_plan_version: 7, expected_lock_version: 9, from_account_id: 1, amount: "250.0000" });
        assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: { ...ready, planVersion: null }, accountId: "1" }), { problem: "versions" });
        assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: { ...ready, lockVersion: null }, accountId: "1" }), { problem: "versions" });
        for (const amount of [null, "0.0000", "-250.0000", "abc"]) assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: { ...ready, amount }, accountId: "1" }), { problem: "amount" }, String(amount));
        for (const accountId of ["", "2", "99", "1.5", null]) assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: ready, accountId }), { problem: "account" }, String(accountId));
        assert.deepEqual(buildConfirmWrite({ goalId: 1, installmentId: "900", preview: null, accountId: "1" }), { problem: "notConfirmable" });
      });

      it("only exact codes decide, and they count only for the write that names them", async () => {
        const { classifyWriteOutcome } = await import("../src/mobile/forms/useWorkflowSubmit.js");
        const { CONFIRM_CERTAIN_409, SKIP_CERTAIN_409 } = await import("../src/mobile/planning/smart/planModel.js");
        const { ApiError } = await import("../src/features/Dashboards/User/api/apiClient.js");
        const err = (serverCode, message = "x") => new ApiError(message, { status: 409, code: "CONFLICT", serverCode });
        assert.equal(classifyWriteOutcome(err("savings_installment_exceeds_remaining"), CONFIRM_CERTAIN_409).kind, "rejected");
        assert.equal(classifyWriteOutcome(err("savings_installment_exceeds_remaining"), SKIP_CERTAIN_409).kind, "unknown", "not a skip's code");
        assert.equal(classifyWriteOutcome(err(null, "savings_installment_not_open"), CONFIRM_CERTAIN_409).kind, "unknown", "a code named in the message is not a code");
        assert.equal(classifyWriteOutcome(new ApiError("", { status: 502, code: "SERVER_ERROR" }), CONFIRM_CERTAIN_409).kind, "unknown");
      });
    });

    describe("installment skip (no money)", () => {
      it("closed (the shipped gate): the send button stays disabled, nothing is sent, and the facade refuses before any request", async () => {
        await openReview("skip", { approve: false });
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        assert.equal(q("[data-sm-note='write-closed']", dialog()).dataset.smWrite, "installment.skip");
        await send();
        assert.throws(() => sendPlanWrite({ operation: "installment.skip", ids: { goalId: "1", installmentId: "900" }, input: { expected_plan_version: 2, expected_lock_version: 4 } }, "mobile-installment-skip-key"), (error) => error.name === "WriteClosedError" && error.operation === "installment.skip");
        assert.deepEqual(posts(), []);
        assert.deepEqual(api.violations, []);
      });

      it("opened by the test switch: one POST with the plan's versions, the trimmed reason and a key; Keep it is the default", async () => {
        await openReview("skip");
        assert.equal(q("[data-sm-action='keep']", dialog()).textContent, "Keep it");
        await change(q("[data-sm-input='reason']", dialog()), "  Short month  ");
        const readsBefore = planReads();
        await send();
        assert.equal(posts().length, 1);
        const [call] = posts();
        assert.equal(call.path, SKIP_PATH);
        assert.deepEqual(call.body, { expected_plan_version: 2, expected_lock_version: 4, reason: "Short month" });
        assert.match(call.headers["Idempotency-Key"], /^mobile-installment-skip-[A-Za-z0-9._:-]{8,}$/);
        assert.equal(outcomeOf("skip").dataset.smSkipOutcome, "done");
        assert.match(outcomeOf("skip").textContent, /Installment 3 was skipped\. No money moved\./);
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        assert.ok(planReads() > readsBefore);
      });

      it("an empty reason is left out; a reason over 500 characters is refused before any request", async () => {
        await openReview("skip");
        await change(q("[data-sm-input='reason']", dialog()), "x".repeat(501));
        await send();
        assert.equal(q("[data-sm-skip-problem]", dialog()).dataset.smSkipProblem, "reason");
        assert.deepEqual(posts(), []);
        await change(q("[data-sm-input='reason']", dialog()), "   ");
        await send();
        assert.deepEqual(posts()[0].body, { expected_plan_version: 2, expected_lock_version: 4 });
      });

      it("a 500 is an unknown outcome: never resent by itself, and an identical retry reuses the key", async () => {
        await openReview("skip", { answer: (call, n) => (n === 1 ? failure(500, "boom") : skipped) });
        await send();
        assert.equal(outcomeOf("skip").dataset.smSkipOutcome, "unknown");
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);
        await settle();
        assert.equal(posts().length, 1);
        await reopenReview("skip");
        await send();
        assert.equal(posts()[1].headers["Idempotency-Key"], posts()[0].headers["Idempotency-Key"]);
        assert.deepEqual(posts()[1].body, posts()[0].body);
        assert.equal(outcomeOf("skip").dataset.smSkipOutcome, "done");
      });

      it("a coded version conflict changed nothing and needs a new review; a closed installment or missing version is refused before any request", async () => {
        await openReview("skip", { answer: () => conflict("savings_installment_version_conflict") });
        await send();
        assert.equal(outcomeOf("skip").dataset.smSkipOutcome, "stale");
        assert.equal(q("[data-sm-action='send']", dialog()).disabled, true);

        const { buildSkipWrite } = await import("../src/mobile/planning/smart/planModel.js");
        const installment = { id: "900", open: true, lockVersion: 4 };
        assert.deepEqual(buildSkipWrite({ goalId: 1, installment: { ...installment, open: false }, planVersion: 2, reason: "" }), { problem: "notOpen" });
        assert.deepEqual(buildSkipWrite({ goalId: 1, installment, planVersion: null, reason: "" }), { problem: "versions" });
        assert.deepEqual(buildSkipWrite({ goalId: 1, installment: { ...installment, lockVersion: undefined }, planVersion: 2, reason: "" }), { problem: "versions" });
      });
    });

    it("the confirm and skip strings have the same keys in English and Arabic, and an unknown confirmation is said in Arabic", async () => {
      const { SMART_PLAN_MESSAGES } = await import("../src/mobile/planning/smartPlanMessages.js");
      for (const section of ["confirmOutcome", "confirmProblem", "skipOutcome", "skipProblem"]) assert.deepEqual(Object.keys(SMART_PLAN_MESSAGES.en[section]).sort(), Object.keys(SMART_PLAN_MESSAGES.ar[section]).sort(), section);
      await view?.unmount();
      view = null;
      await resetEnvironment("ar");
      await openReview("confirm", { answer: () => failure(500, "boom") });
      await send();
      assert.match(outcomeOf("confirm").textContent, /تعذّر التأكد مما إذا كان المال قد انتقل/);
    });

    it("an archived goal has no plan section and no plan request", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1, { status: "archived", archived_at: "2026-09-01T00:00:00Z" })], plans: { 1: activePlan(1) } });

      assert.equal(q("[data-sm-section='smart-plan']"), null);
      assert.deepEqual(api.summary(), ["GET /savings-goals/1", "GET /savings-goals/1/activity"]); // the goal and its movement history; never a plan
    });
  });
}
