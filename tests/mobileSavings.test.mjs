import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
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
      assert.deepEqual(api.summary(), ["GET /savings-goals/1"]);
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
      assert.deepEqual(api.summary(), ["GET /savings-goals/1", "GET /savings-goals/1/plan"]);
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

    it("an archived goal has no plan section and no plan request", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1, { status: "archived", archived_at: "2026-09-01T00:00:00Z" })], plans: { 1: activePlan(1) } });

      assert.equal(q("[data-sm-section='smart-plan']"), null);
      assert.deepEqual(api.summary(), ["GET /savings-goals/1"]);
    });
  });
}
