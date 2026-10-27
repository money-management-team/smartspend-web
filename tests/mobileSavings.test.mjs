import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { activePlan, goal, planningBackend } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

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

    it("shows the next planned contribution from GET /savings-goals/{id}/plan, and only that read is made", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: activePlan(1) } });
      const section = q("[data-sm-section='smart-plan']");

      assert.equal(section.querySelector("[data-sm-plan]").dataset.smPlan, "active");
      assert.match(text(section), /Next planned contribution\s*Nov 5, 2026/);
      assert.match(text(section), /Planned amount\s*250\.00ILS/);
      assert.deepEqual(api.summary(), ["GET /savings-goals/1", "GET /savings-goals/1/plan"]);
      assert.deepEqual(api.violations, []);
    });

    it("has no way to confirm, postpone, skip, create or revise: no controls, and a link to the full version", async () => {
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: activePlan(1) } });
      const section = q("[data-sm-section='smart-plan']");

      assert.equal(qa("button, input, form, select", section).length, 0);
      assert.match(text(section), /Confirming, postponing, skipping or changing it is only in the full version/);
      assert.equal(qa("a", section)[0].getAttribute("href"), "/dashboard/savings-goals/1/smart-plan");
      assert.equal(api.calls.some((call) => /confirm|postpone|skip|funding|plan-options|plans\b/.test(call.path.replace(/\/plan$/, ""))), false);
    });

    it("an overdue installment and a recommended review are said in words", async () => {
      const plan = activePlan(1);
      plan.savings_plan.next_installment.is_overdue = true;
      plan.plan_health = { executable: false, replanning_recommended: true };
      await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: plan } });

      assert.match(text(q("[data-sm-section='smart-plan']")), /Overdue.*Plan review suggested.*Can't be confirmed right now/);
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
