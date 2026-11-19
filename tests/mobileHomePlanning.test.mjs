import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { dashboard, healthyBackend, installFakeApi, multiCurrencyDashboard } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, storeSession } from "./helpers/mobileHarness.mjs";
import { click } from "./helpers/dom.mjs";

const { buildHomeModel } = await import("../src/mobile/models/home.js");

/*
 * Budgets and savings goals on Mobile Home, from GET /dashboard `planning`
 * (smartspend-backend PlanningSummaryService: budgets covering today and active
 * goals, in the primary currency only, with the backend's totals, counts and up
 * to five progress rows). Fictional data; no request other than the Home reads.
 */

after(() => dom.window.close());

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const card = (id) => q(`section[aria-labelledby='${id}']`);

const budgetRow = (id, over = {}) => ({
  budget_id: id, name: `Budget ${id}`, scope: "general", category_id: null, currency_code: "ILS",
  amount_limit: "1000.0000", spent: "850.0000", remaining: "150.0000", percentage_used: "85.0000", status: "near_limit",
  expenses_count: 4, days_remaining: 15, has_started: true, has_ended: false, is_archived: false, ...over,
});
const goalRow = (id, over = {}) => ({
  goal_id: id, name: `Goal ${id}`, account_id: 30 + id, currency_code: "ILS",
  target_amount: "5000.0000", saved_amount: "2000.0000", remaining_amount: "3000.0000", percentage_funded: "40.0000", status: "in_progress",
  contributions_count: 3, target_date: "2027-06-01", days_remaining: 200, is_achieved: false, deadline_passed: false, is_archived: false, ...over,
});
const planning = (over = {}) => ({
  budgets: {
    currency_code: "ILS", active_count: 2, total_limit: "1500.0000", total_spent: "1400.0000", total_remaining: "100.0000",
    by_status: { safe: 0, warning: 0, near_limit: 1, exceeded: 1 },
    items: [budgetRow(1, { name: "Food", amount_limit: "500.0000", spent: "550.0000", remaining: "-50.0000", percentage_used: "110.0000", status: "exceeded" }), budgetRow(2, { name: "Transport" })],
  },
  savings_goals: {
    currency_code: "ILS", active_count: 1, total_target: "5000.0000", total_saved: "2000.0000", total_remaining: "3000.0000", achieved_count: 0,
    items: [goalRow(7, { name: "Laptop" })],
  },
  ...over,
});

async function open(dashboardData) {
  api = installFakeApi(healthyBackend({ dashboardData }));
  view = await mountMobile({ entry: "/m" });
}

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

describe("the planning model", () => {
  it("keeps the backend's totals, counts and rows, and calculates nothing", () => {
    const model = buildHomeModel(dashboard({ planning: planning() })).planning;

    assert.equal(model.budgets.state, "ready");
    assert.equal(model.budgets.currency, "ILS");
    assert.deepEqual([model.budgets.totalSpent, model.budgets.totalLimit, model.budgets.totalRemaining], ["1400.0000", "1500.0000", "100.0000"]);
    assert.deepEqual(model.budgets.byStatus, [{ status: "near_limit", count: 1 }, { status: "exceeded", count: 1 }]);
    assert.deepEqual(model.budgets.items.map((item) => [item.id, item.name, item.progress.percent.text, item.progress.remaining]), [["1", "Food", "110", "-50.0000"], ["2", "Transport", "85", "150.0000"]]);

    assert.equal(model.goals.state, "ready");
    assert.deepEqual([model.goals.totalSaved, model.goals.totalTarget, model.goals.totalRemaining, model.goals.achievedCount], ["2000.0000", "5000.0000", "3000.0000", 0]);
    assert.deepEqual(model.goals.items.map((item) => [item.id, item.progress.percent.text, item.progress.saved]), [["7", "40", "2000.0000"]]);
  });

  it("is empty when the backend counts none, unavailable when the block is missing or malformed", () => {
    const empty = buildHomeModel(dashboard({ planning: planning({ budgets: { currency_code: "ILS", active_count: 0, total_limit: "0.0000", total_spent: "0.0000", total_remaining: "0.0000", by_status: {}, items: [] } }) })).planning;
    assert.equal(empty.budgets.state, "empty");
    assert.equal(empty.budgets.currency, "ILS");

    assert.deepEqual(Object.values(buildHomeModel(dashboard()).planning).map((part) => part.state), ["unavailable", "unavailable"], "no planning block");
    const bad = buildHomeModel(dashboard({ planning: planning({ savings_goals: { currency_code: "ILS", active_count: 1, total_target: "lots", total_saved: "1.0000", total_remaining: "1.0000", items: [] } }) })).planning;
    assert.equal(bad.goals.state, "unavailable", "a total that isn't an amount is not shown");
    assert.equal(buildHomeModel(dashboard({ planning: planning({ budgets: { active_count: 2 } }) })).planning.budgets.state, "unavailable", "no currency");
  });

  it("drops a row whose currency or id doesn't check out, and shows at most three", () => {
    const rows = [budgetRow(1), budgetRow(2, { currency_code: "USD" }), budgetRow(null), budgetRow(4), budgetRow(5), budgetRow(6)];
    const model = buildHomeModel(dashboard({ planning: planning({ budgets: { ...planning().budgets, active_count: 6, items: rows } }) })).planning;
    assert.deepEqual(model.budgets.items.map((item) => item.id), ["1", "4", "5"]);
    assert.equal(model.budgets.count, 6);
  });
});

describe("the cards on Home", () => {
  it("show the totals, the status counts and each row's bar, and link to the existing pages", async () => {
    await open(dashboard({ planning: planning() }));
    const budgets = card("sm-home-budgets");
    const goals = card("sm-home-goals");

    assert.ok(budgets && goals, "both cards are on Home");
    assert.match(text(budgets), /Active budgets: 2/);
    assert.match(text(budgets), /Near the limit 1/);
    assert.match(text(budgets), /Over the limit 1/);
    assert.match(text(budgets), /Remaining −50\.00/, "an exceeded budget's remaining is the backend's own negative figure");
    assert.match(text(budgets), /1,400\.00/);
    assert.match(text(budgets), /1,500\.00/);
    assert.deepEqual(qa("[data-sm-plan-row]", budgets).map((row) => row.getAttribute("href")), ["/m/planning/budgets/1", "/m/planning/budgets/2"]);
    assert.deepEqual(qa(".sm-progress-text", budgets).map((node) => node.textContent), ["110%", "85%"]);
    assert.equal(q("a.sm-card-link", budgets).getAttribute("href"), "/m/planning/budgets");

    assert.match(text(goals), /Active goals: 1/);
    assert.match(text(goals), /Still to save/);
    assert.equal(q("[data-sm-plan-row]", goals).getAttribute("href"), "/m/planning/goals/7");
    assert.equal(q("a.sm-card-link", goals).getAttribute("href"), "/m/planning/goals");
    assert.equal(q("[data-sm-note='primary-only']"), null, "one currency: no note");
    assert.deepEqual(api.summary().sort(), ["GET /dashboard", "GET /financial-alerts"], "no extra request");
  });

  it("say when there is nothing, and when the data isn't available", async () => {
    await open(dashboard({ planning: planning({ budgets: { currency_code: "ILS", active_count: 0, total_limit: "0.0000", total_spent: "0.0000", total_remaining: "0.0000", by_status: {}, items: [] }, savings_goals: null }) }));

    assert.match(text(card("sm-home-budgets")), /No active budget covers today in ILS/);
    assert.match(text(card("sm-home-goals")), /Savings goals aren't available right now/);
    assert.equal(q("a.sm-card-link", card("sm-home-goals")), null);
  });

  it("in several currencies, say the figures are the primary currency's only", async () => {
    await open({ ...multiCurrencyDashboard(), planning: planning() });

    const notes = qa("[data-sm-note='primary-only']").map((node) => text(node));
    assert.equal(notes.length, 2);
    assert.match(notes[0], /Only budgets in ILS, your primary currency/);
    assert.match(notes[1], /Only goals in ILS/);
  });

  it("hide every amount when amounts are hidden", async () => {
    await open(dashboard({ planning: planning() }));
    await click(q("[data-sm-action='toggle-amounts']"));

    for (const id of ["sm-home-budgets", "sm-home-goals"]) {
      assert.ok(qa(".sm-money", card(id)).length > 0);
      assert.equal(qa(".sm-money:not(.sm-money-hidden)", card(id)).length, 0, id);
    }
  });

  it("can be hidden with Arrange Home like any other card", async () => {
    await open(dashboard({ planning: planning() }));
    await click(q("[data-sm-action='arrange']"));
    await click(q("[data-sm-arrange='budgets'] input[type='checkbox']"));

    assert.equal(card("sm-home-budgets"), null);
    assert.ok(card("sm-home-goals"));
  });
});
