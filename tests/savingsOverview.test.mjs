import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { flush, installDom, render } from "./helpers/dom.mjs";
import { createI18n, withI18n } from "./helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "./helpers/mockFetch.mjs";
import {
  SMART_SAVINGS_ENABLED,
  getUpcomingInstallments,
  loadPlanSummaries,
  lookupPlanSummary,
  toPlanSummary,
} from "../src/features/Dashboards/User/SavingsGoals/smartSavings.js";

const dom = installDom();
after(() => dom.window.close());
// recharts (pulled in through the page's imports) schedules frames on the globals.
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

const { default: SavingsGoals } = await import(
  "../src/features/Dashboards/User/SavingsGoals/SavingsGoals.jsx"
);

/* ------------------------------------------------------------- fixtures */

const goal = (id, over = {}) => ({
  id,
  workspace_id: 1,
  name: `Goal ${id}`,
  target_amount: "5000.0000",
  currency_code: "ILS",
  target_date: "2027-08-30",
  status: "active",
  account: { id: 100 + id, name: `Goal ${id}`, type: "savings", currency_code: "ILS" },
  progress: {
    goal_id: id,
    target_amount: "5000.0000",
    saved_amount: "1250.0000",
    remaining_amount: "3750.0000",
    percentage_funded: "25.0000",
    status: "in_progress",
    deadline_passed: false,
  },
  ...over,
});

const planData = (goalId, over = {}, health = {}) => ({
  savings_goal: goal(goalId),
  balance: { saved_amount: "1250.0000", remaining_amount: "3750.0000" },
  savings_plan: {
    id: 900 + goalId,
    savings_goal_id: goalId,
    status: "active",
    intensity: "balanced",
    currency_code: "ILS",
    plan_version: 1,
    next_installment: {
      id: 7000 + goalId,
      sequence: 2,
      planned_date: "2026-11-01",
      amount: "312.5000",
      status: "planned",
      is_overdue: false,
    },
    ...over,
  },
  plan_health: { executable: true, replanning_recommended: false, ...health },
});

const listBody = (goals) =>
  envelope({
    savings_goals: {
      data: goals,
      current_page: 1,
      last_page: 1,
      per_page: 12,
      total: goals.length,
      from: goals.length ? 1 : null,
      to: goals.length || null,
    },
  });

const notFound = { status: 404, body: { status: false, message: "The requested resource was not found.", data: null } };

/** Routes GET /savings-goals and GET /savings-goals/{id}/plan to `plans[id]`. */
function serve(goals, plans = {}) {
  return mockFetch((url) => {
    const path = new URL(url, "http://localhost").pathname;
    if (path === "/api/savings-goals") return { body: listBody(goals) };
    const match = path.match(/^\/api\/savings-goals\/(\d+)\/plan$/);
    if (match) {
      const answer = plans[match[1]];
      if (!answer) return notFound;
      return answer.status ? answer : { body: envelope(answer) };
    }
    throw new Error(`Unexpected request ${url}`);
  });
}

const planCalls = (calls) => calls.filter((call) => /\/plan$/.test(new URL(call.url, "http://localhost").pathname));

async function renderPage({ language = "en", enabled = true } = {}) {
  const i18n = await createI18n(language);
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  const router = createMemoryRouter(
    [{ path: "/dashboard/savings-goals", element: h(SavingsGoals, { smartSavingsEnabled: enabled }) }],
    { initialEntries: ["/dashboard/savings-goals"] },
  );
  const view = await render(withI18n(i18n, h(RouterProvider, { router })));
  for (let i = 0; i < 6; i += 1) await flush();
  return { ...view, i18n };
}

beforeEach(() => installBrowserStubs());

/* ------------------------------------------------------------- gate */

describe("feature gate", () => {
  it("is off unless the build sets VITE_SMART_SAVINGS_ENABLED=true", () => {
    assert.equal(SMART_SAVINGS_ENABLED, false);
  });
});

/* ------------------------------------------------------------- helpers */

describe("toPlanSummary", () => {
  it("keeps the backend's own amount and date strings", () => {
    const summary = toPlanSummary(planData(1), 1);
    assert.deepEqual(summary, {
      state: "smart",
      planId: 901,
      intensity: "balanced",
      currency: "ILS",
      nextInstallment: { id: 7001, date: "2026-11-01", amount: "312.5000", isOverdue: false },
      executable: true,
      reviewSuggested: false,
    });
  });

  it("is unavailable for another goal's plan or a non-active plan", () => {
    assert.equal(toPlanSummary(planData(1), 2).state, "unavailable");
    assert.equal(toPlanSummary(planData(1, { status: "completed" }), 1).state, "unavailable");
    assert.equal(toPlanSummary({}, 1).state, "unavailable");
  });

  it("drops a malformed next installment instead of showing it", () => {
    const summary = toPlanSummary(planData(1, { next_installment: { id: 1, planned_date: "soon", amount: 3 } }), 1);
    assert.equal(summary.nextInstallment, null);
  });

  it("reports on-hold and review flags from plan_health", () => {
    const summary = toPlanSummary(planData(1, {}, { executable: false, replanning_recommended: true }), 1);
    assert.equal(summary.executable, false);
    assert.equal(summary.reviewSuggested, true);
  });
});

describe("lookupPlanSummary", () => {
  it("reads 404 as flexible and any other failure as unavailable", async () => {
    const calls = serve([], {
      1: planData(1),
      3: { status: 500, body: { status: false, message: "boom" } },
      4: { status: 429, body: { status: false, message: "slow down" } },
      5: { status: 403, body: { status: false, message: "no" } },
    });

    assert.equal((await lookupPlanSummary(1)).state, "smart");
    assert.equal((await lookupPlanSummary(2)).state, "flexible");
    assert.equal((await lookupPlanSummary(3)).state, "unavailable");
    assert.equal((await lookupPlanSummary(4)).state, "unavailable");
    assert.equal((await lookupPlanSummary(5)).state, "unavailable");
    assert.ok(calls.every((call) => call.method === "GET"));
    assert.ok(calls.every((call) => !("Idempotency-Key" in call.headers)));
  });

  it("rethrows an abort", async () => {
    // Like a browser fetch: an aborted signal rejects.
    mockFetch((_url, init) => {
      if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return { body: envelope(planData(1)) };
    });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(lookupPlanSummary(1, { signal: controller.signal }), { name: "AbortError" });
  });
});

describe("loadPlanSummaries", () => {
  it("never has more than `concurrency` lookups in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    mockFetch(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return notFound;
    });

    const results = {};
    await loadPlanSummaries(["1", "2", "3", "4", "5", "6", "7", "8", "9"], {
      concurrency: 3,
      onResult: (id, summary) => {
        results[id] = summary.state;
      },
    });

    assert.equal(peak, 3);
    assert.equal(Object.keys(results).length, 9);
    assert.ok(Object.values(results).every((state) => state === "flexible"));
  });
});

describe("getUpcomingInstallments", () => {
  it("lists executable smart plans soonest first, capped", () => {
    const goals = [goal(1), goal(2), goal(3), goal(4)];
    const summaries = {
      1: toPlanSummary(planData(1, { next_installment: { id: 1, planned_date: "2026-12-01", amount: "1.0000" } }), 1),
      2: toPlanSummary(planData(2, { next_installment: { id: 2, planned_date: "2026-11-05", amount: "2.0000" } }), 2),
      3: toPlanSummary(planData(3, {}, { executable: false }), 3),
      4: { state: "flexible" },
    };

    const upcoming = getUpcomingInstallments(goals, summaries);
    assert.deepEqual(upcoming.map((item) => item.goal.id), [2, 1]);
    assert.equal(getUpcomingInstallments(goals, summaries, 1).length, 1);
  });
});

/* ------------------------------------------------------------- page */

describe("Savings overview page", () => {
  it("with the gate off, makes no plan requests and shows no plan UI", async () => {
    const calls = serve([goal(1), goal(2)], { 1: planData(1) });
    const view = await renderPage({ enabled: false });

    assert.equal(planCalls(calls).length, 0);
    assert.equal(view.container.querySelectorAll(".saving-goal-card").length, 2);
    assert.equal(view.container.querySelector(".goal-plan-chip"), null);
    assert.equal(view.container.querySelector(".upcoming-installments"), null);
    assert.equal(view.container.querySelector(".savings-goals-page--smart"), null);
    assert.equal(view.container.querySelector(".savings-goals-header__count"), null);
    await view.unmount();
  });

  it("with the gate off, keeps the original empty state", async () => {
    serve([]);
    const view = await renderPage({ enabled: false });
    const state = view.container.querySelector(".savings-goals-page__state");

    assert.equal(view.container.querySelector(".savings-goals-page__empty"), null);
    assert.deepEqual([...state.children].map((node) => node.tagName), ["P", "BUTTON"]);
    assert.equal(state.querySelector("button").textContent, "New goal");
    await view.unmount();
  });

  it("never labels an achieved or archived goal flexible", async () => {
    const calls = serve([goal(3, { status: "achieved" }), goal(4, { status: "archived" })]);
    const view = await renderPage();

    assert.equal(planCalls(calls).length, 0);
    assert.doesNotMatch(view.container.textContent, /Flexible saving/);
    assert.equal(view.container.querySelector(".goal-plan-chip"), null);
    await view.unmount();
  });

  it("tells smart plans from flexible goals and lists the next installments", async () => {
    const goals = [
      goal(1),
      goal(2),
      goal(3, { status: "achieved" }),
      goal(4, { status: "archived" }),
      goal(5),
    ];
    const calls = serve(goals, {
      1: planData(1, {}, { replanning_recommended: true }),
      5: { status: 500, body: { status: false, message: "boom" } },
    });
    const view = await renderPage();

    // Achieved and archived goals can't have an active plan: not looked up.
    assert.deepEqual(
      planCalls(calls).map((call) => call.url.match(/savings-goals\/(\d+)/)[1]).sort(),
      ["1", "2", "5"],
    );

    const cards = [...view.container.querySelectorAll(".saving-goal-card")];
    const chipText = (card) => card.querySelector(".goal-plan-chip")?.textContent ?? null;
    assert.equal(chipText(cards[0]), "Smart plan" + "Balanced");
    assert.ok(cards[0].classList.contains("saving-goal-card--smart"));
    assert.match(cards[0].querySelector(".saving-goal-card__plan").textContent, /Next installment.*312\.50/);
    assert.match(cards[0].textContent, /Review suggested/);
    assert.equal(chipText(cards[1]), "Flexible saving");
    assert.equal(chipText(cards[2]), null);
    assert.equal(chipText(cards[3]), null);
    assert.equal(chipText(cards[4]), "Plan status unavailable");

    const upcoming = view.container.querySelector(".upcoming-installments");
    assert.ok(upcoming);
    assert.equal(upcoming.querySelectorAll("li").length, 1);
    assert.match(upcoming.textContent, /Goal 1/);
    assert.equal(upcoming.querySelector("a").getAttribute("href"), "/dashboard/savings-goals/1");

    assert.match(view.container.querySelector(".savings-goals-header__count").textContent, /Total goals\s*5/);
    // Reading the overview never writes.
    assert.ok(calls.every((call) => call.method === "GET"));
    await view.unmount();
  });

  it("marks an overdue installment and a paused plan as on hold", async () => {
    const calls = serve([goal(1), goal(2, { status: "paused" })], {
      1: planData(1, { next_installment: { id: 1, planned_date: "2026-10-01", amount: "50.0000", is_overdue: true } }),
      2: planData(2, {}, { executable: false }),
    });
    const view = await renderPage();
    const cards = [...view.container.querySelectorAll(".saving-goal-card")];

    assert.ok(cards[0].querySelector(".saving-goal-card__plan--overdue"));
    assert.match(cards[0].textContent, /Overdue/);
    assert.match(cards[1].textContent, /Plan on hold while the goal is paused/);
    // A plan on hold has nothing due, so it isn't listed as upcoming.
    assert.equal(view.container.querySelectorAll(".upcoming-installments li").length, 1);
    assert.equal(planCalls(calls).length, 2);
    await view.unmount();
  });

  it("renders in Arabic with every key translated", async () => {
    serve([goal(1), goal(2)], { 1: planData(1) });
    const view = await renderPage({ language: "ar" });

    assert.match(view.container.textContent, /خطة ذكية/);
    assert.match(view.container.textContent, /ادخار مرن/);
    assert.match(view.container.textContent, /الأقساط القادمة/);
    assert.deepEqual(view.i18n.missingKeys, []);
    await view.unmount();
  });

  it("shows the first-run empty state with a create action", async () => {
    const calls = serve([]);
    const view = await renderPage();

    assert.match(view.container.querySelector(".savings-goals-page__empty").textContent, /Start your first savings goal/);
    assert.ok(view.container.querySelector(".savings-goals-page__empty-action"));
    assert.equal(planCalls(calls).length, 0);
    await view.unmount();
  });
});
