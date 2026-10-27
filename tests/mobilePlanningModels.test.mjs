import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBudgetDetail, buildBudgetsPage, budgetFiltersToQuery, budgetFilterSignature, normalizeBudget, readBudgetFilters } from "../src/mobile/models/budgets.js";
import { buildGoalDetail, buildGoalsPage, goalFiltersToQuery, normalizeGoal, readGoalFilters } from "../src/mobile/models/goals.js";
import { buildPlanSummary } from "../src/mobile/models/plan.js";
import { buildPlanningPage, parsePercent } from "../src/mobile/models/planning.js";
import { buildRuleDetail, buildRulesPage, normalizeRule, readRuleFilters, ruleFilterSignature } from "../src/mobile/models/recurring.js";
import { activePlan, budget, goal, paginator, rule } from "./helpers/planningFixture.mjs";

/*
 * The Planning models: what they accept, what they refuse, and that they never
 * make a figure up. Fictional data only.
 */

const envelope = (key, rows, page = {}) => ({ status: true, data: { [key]: paginator(rows, page) } });

describe("percentages", () => {
  it("keeps the digits: one decimal at most, truncated and never rounded up", () => {
    assert.equal(parsePercent("40.0000").text, "40");
    assert.equal(parsePercent("99.9600").text, "99.9");
    assert.equal(parsePercent("0.0400").text, "0");
    assert.equal(parsePercent("112.5000").text, "112.5");
    assert.equal(parsePercent("007.5").text, "7.5");
  });

  it("makes a bar from the same digits, clamped to the track", () => {
    assert.equal(parsePercent("40.0000").bar, "40.00%");
    assert.equal(parsePercent("99.9600").bar, "99.96%");
    assert.equal(parsePercent("100.0000").bar, "100%");
    assert.equal(parsePercent("100.0000").full, true);
    assert.equal(parsePercent("250").bar, "100%");
    assert.equal(parsePercent("-5").bar, "0%");
    assert.equal(parsePercent("99.99").full, false);
  });

  it("is unavailable for anything that is not a decimal string", () => {
    for (const bad of [40, null, undefined, "", "abc", "4e1", "1,5", "40%", " 40", "40.00001", "1234567", {}]) assert.equal(parsePercent(bad), null, String(bad));
  });
});

describe("a page of a list", () => {
  it("is refused whole when the paginator disagrees with itself or with the request", () => {
    const rows = [budget(1), budget(2)];
    const good = envelope("budgets", rows);
    const expected = { page: 1, perPage: 20 };

    assert.equal(buildBudgetsPage(good, expected).total, 2);

    const broken = [
      { ...good, status: false },
      { status: true, data: {} },
      { status: true, data: { budgets: { ...good.data.budgets, total: "2" } } },
      { status: true, data: { budgets: { ...good.data.budgets, current_page: 2 } } },
      { status: true, data: { budgets: { ...good.data.budgets, per_page: 10 } } },
      { status: true, data: { budgets: { ...good.data.budgets, last_page: 3 } } },
      { status: true, data: { budgets: { ...good.data.budgets, from: 5 } } },
      { status: true, data: { budgets: { ...good.data.budgets, data: [rows[0], rows[0]], total: 2 } } },
      { status: true, data: { budgets: { ...good.data.budgets, data: [rows[0], { name: "no id" }] } } },
      { status: true, data: { budgets: { ...good.data.budgets, data: "nope" } } },
    ];

    for (const response of broken) assert.throws(() => buildBudgetsPage(response, expected), (error) => error.code === "MALFORMED_RESPONSE");
  });

  it("an empty list is a valid page with no rows", () => {
    const page = buildGoalsPage(envelope("savings_goals", []), { page: 1, perPage: 20 });
    assert.deepEqual([page.rows, page.total, page.lastPage], [[], 0, 1]);
  });

  it("reads the key it is given and no other", () => {
    assert.throws(() => buildPlanningPage(envelope("budgets", [budget(1)]), { page: 1, perPage: 20 }, "savings_goals", normalizeGoal));
  });
});

describe("budgets", () => {
  it("takes every figure from the backend's progress, in the budget's currency", () => {
    const model = normalizeBudget(budget(3, { name: "Food", scope: "category", category: { id: 4, name: "Groceries" }, category_id: 4 }));

    assert.deepEqual([model.id, model.name, model.scope, model.categoryName, model.currency, model.limit], ["3", "Food", "category", "Groceries", "ILS", "800.0000"]);
    assert.deepEqual([model.progress.spent, model.progress.remaining, model.progress.percent.text, model.progress.status, model.progress.statusKnown], ["200.0000", "600.0000", "25", "safe", true]);
    assert.deepEqual([model.status, model.statusKnown, model.archived], ["active", true, false]);
  });

  it("an overspent budget keeps its negative remaining as sent", () => {
    const over = budget(1);
    over.progress = { ...over.progress, spent: "950.0000", remaining: "-150.0000", percentage_used: "118.7500", status: "exceeded" };
    const model = normalizeBudget(over);

    assert.equal(model.progress.remaining, "-150.0000");
    assert.deepEqual([model.progress.percent.text, model.progress.percent.bar, model.progress.status], ["118.7", "100%", "exceeded"]);
  });

  it("does not trust progress that names another budget or another currency", () => {
    assert.equal(normalizeBudget(budget(1, { progress: { ...budget(1).progress, budget_id: 2 } })).progress, null);
    assert.equal(normalizeBudget(budget(1, { progress: { ...budget(1).progress, currency_code: "USD" } })).progress, null);
  });

  it("shows an invalid amount as unavailable, never as zero, and a missing progress as none", () => {
    const model = normalizeBudget(budget(1, { amount_limit: "12,000", progress: { ...budget(1).progress, spent: 200, remaining: null } }));

    assert.equal(model.limit, null);
    assert.deepEqual([model.progress.spent, model.progress.remaining], [null, null]);
    assert.equal(normalizeBudget(budget(1, { progress: undefined })).progress, null);
    assert.equal(normalizeBudget(budget(1, { currency_code: "ils" })).limit, null);
  });

  it("a state it does not know is kept as sent, and is never taken for a known one", () => {
    const model = normalizeBudget(budget(1, { status: "frozen", progress: { ...budget(1).progress, status: "mystery" } }));

    assert.deepEqual([model.status, model.statusKnown, model.archived], ["frozen", false, false]);
    assert.deepEqual([model.progress.status, model.progress.statusKnown], ["mystery", false]);
    assert.deepEqual([normalizeBudget(budget(1, { status: undefined })).status, normalizeBudget(budget(1, { status: undefined, archived_at: "2026-10-01" })).status], [null, "archived"]);
  });

  it("scope falls back to what the budget is attached to", () => {
    assert.equal(normalizeBudget(budget(1, { scope: undefined, category: { id: 4, name: "Food" } })).scope, "category");
    assert.equal(normalizeBudget(budget(1, { scope: undefined })).scope, "general");
  });

  it("a record page is refused when it is about another id", () => {
    assert.equal(buildBudgetDetail({ budget: budget(5) }, "5").id, "5");
    assert.equal(buildBudgetDetail({ budget: budget(5) }, "6"), null);
    assert.equal(buildBudgetDetail({}, "5"), null);
    assert.equal(buildBudgetDetail(null, "5"), null);
  });

  it("filters: only documented values, defaults left out of the address, names as the Desktop list", () => {
    assert.deepEqual(readBudgetFilters("status=archived&progress_status=exceeded"), { status: "archived", progress_status: "exceeded" });
    assert.deepEqual(readBudgetFilters("status=deleted&progress_status=<script>&owner=7"), { status: "active", progress_status: "" });
    assert.equal(budgetFilterSignature(readBudgetFilters("")), "default");
    assert.equal(budgetFilterSignature(readBudgetFilters("progress_status=warning&status=active")), "progress_status=warning");
    assert.deepEqual(budgetFiltersToQuery(readBudgetFilters("progress_status=warning"), 2, 20, 9), { workspace_id: 9, status: "active", progress_status: "warning", per_page: 20, page: 2 });
  });
});

describe("savings goals", () => {
  it("shows the lifecycle and the progress words as sent, and never decides a goal is achieved", () => {
    const model = normalizeGoal(goal(2, { name: "Laptop" }));

    assert.deepEqual([model.name, model.status, model.target, model.currency, model.targetDate], ["Laptop", "active", "3000.0000", "ILS", "2026-12-31"]);
    assert.deepEqual([model.progress.saved, model.progress.remaining, model.progress.percent.text, model.progress.status, model.progress.isAchieved], ["1200.0000", "1800.0000", "40", "in_progress", false]);

    // Saved equal to the target is still "active" until the backend says otherwise.
    const full = normalizeGoal(goal(3, { progress: { ...goal(3).progress, saved_amount: "3000.0000", remaining_amount: "0.0000", percentage_funded: "100.0000" } }));
    assert.deepEqual([full.status, full.progress.status, full.progress.isAchieved], ["active", "in_progress", false]);
  });

  it("its currency is the one every present field agrees on, otherwise unavailable", () => {
    assert.equal(normalizeGoal(goal(1, { currency_code: undefined })).currency, "ILS");
    const conflicting = normalizeGoal(goal(1, { account: { id: 5, name: "x", currency_code: "USD" } }));
    assert.deepEqual([conflicting.currency, conflicting.target, conflicting.progress.saved, conflicting.progress.remaining], [null, null, null, null]);
  });

  it("refuses progress for another goal, and unknown states are not silently complete", () => {
    assert.equal(normalizeGoal(goal(1, { progress: { ...goal(1).progress, goal_id: 9 } })).progress, null);
    const odd = normalizeGoal(goal(1, { status: "completed", progress: { ...goal(1).progress, status: "done" } }));
    assert.deepEqual([odd.statusKnown, odd.progress.statusKnown, odd.archived], [false, false, false]);
  });

  it("filters, page and record page", () => {
    assert.deepEqual(readGoalFilters("status=paused"), { status: "paused" });
    assert.deepEqual(readGoalFilters("status=nope"), { status: "active" });
    assert.deepEqual(goalFiltersToQuery({ status: "achieved" }, 3, 12, 1), { workspace_id: 1, status: "achieved", per_page: 12, page: 3 });
    assert.equal(buildGoalsPage(envelope("savings_goals", [goal(1)], { perPage: 12 }), { page: 1, perPage: 12 }).rows.length, 1);
    assert.equal(buildGoalDetail({ savings_goal: goal(4) }, "4").id, "4");
    assert.equal(buildGoalDetail({ savings_goal: goal(4) }, "5"), null);
  });
});

describe("recurring rules", () => {
  it("is a rule: its amount is unsigned, its next date is the backend's, and nothing is worked out", () => {
    const model = normalizeRule(rule(7, { type: "income", amount: "2500.0000", frequency: "yearly", interval: 2, next_due_date: "2027-01-15" }));

    assert.deepEqual([model.type, model.amount, model.currency, model.frequency, model.interval, model.nextDue, model.openOccurrences], ["income", "2500.0000", "ILS", "yearly", 2, "2027-01-15", 1]);
    assert.equal("balance" in model, false);
    assert.equal(normalizeRule(rule(7, { next_due_date: null })).nextDue, null);
    assert.equal(normalizeRule(rule(7, { next_due_date: "soon" })).nextDue, null);
  });

  it("keeps states it does not know as sent", () => {
    const model = normalizeRule(rule(1, { status: "suspended", type: "gift", frequency: "daily", processing_mode: "psychic", interval: 0 }));

    assert.deepEqual([model.statusKnown, model.typeKnown, model.frequencyKnown, model.modeKnown, model.interval], [false, false, false, false, null]);
    assert.deepEqual([model.status, model.type, model.frequency], ["suspended", "gift", "daily"]);
  });

  it("filters, page and record page", () => {
    assert.deepEqual(readRuleFilters("status=paused&type=income"), { status: "paused", type: "income" });
    assert.deepEqual(readRuleFilters("status=x&type=transfer"), { status: "active", type: "" });
    assert.equal(ruleFilterSignature(readRuleFilters("type=expense")), "type=expense");
    assert.equal(buildRulesPage(envelope("recurring_transactions", [rule(1), rule(2)], { perPage: 15 }), { page: 1, perPage: 15 }).total, 2);
    assert.equal(buildRuleDetail({ recurring_transaction: rule(8) }, "8").id, "8");
    assert.equal(buildRuleDetail({ recurring_transaction: rule(8) }, "9"), null);
  });
});

describe("a Smart Savings plan summary", () => {
  it("is the active plan of this goal: next installment and health, as sent", () => {
    const summary = buildPlanSummary(activePlan(2), "2", "ILS");

    assert.deepEqual(summary, { next: { date: "2026-11-05", amount: "250.0000", overdue: false }, executable: true, replanningRecommended: false });
  });

  it("is refused for another goal, another plan state, or a body that is not a plan", () => {
    assert.equal(buildPlanSummary(activePlan(2), "3", "ILS"), null);
    assert.equal(buildPlanSummary(activePlan(2, { savings_plan: { ...activePlan(2).savings_plan, status: "completed" } }), "2", "ILS"), null);
    assert.equal(buildPlanSummary(activePlan(2, { savings_plan: { ...activePlan(2).savings_plan, savings_goal_id: 9 } }), "2", "ILS"), null);
    assert.equal(buildPlanSummary({}, "2", "ILS"), null);
    assert.equal(buildPlanSummary(null, "2", "ILS"), null);
  });

  it("an installment amount in another form is unavailable, not guessed", () => {
    const summary = buildPlanSummary(activePlan(2, { savings_plan: { ...activePlan(2).savings_plan, next_installment: { planned_date: "2026-11-05", amount: "250,00", is_overdue: "1" } } }), "2", "ILS");
    assert.deepEqual(summary.next, { date: "2026-11-05", amount: null, overdue: true });
  });
});
