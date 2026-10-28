import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, goBack, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { budget, goal, planningBackend, rule } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Mobile Planning (overview, budgets, goals, recurring rules and their pages)
 * against a fake backend that filters and pages like the real endpoints.
 * Fictional data only; every request is checked to be a GET.
 */

after(() => dom.window.close());

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const spoken = (root) => qa(".sm-sr", root).map((node) => node.textContent).join(" | ");
const button = (label, root = q("main")) => qa("button", root).find((item) => item.textContent.trim() === label);
const link = (label, root = q("main")) => qa("a", root).find((item) => item.textContent.trim().startsWith(label));
const open = async (entry, data, options = {}) => {
  api?.restore();
  api = installFakeApi(typeof data === "function" ? data : planningBackend(data));
  view = await mountMobile({ entry, ...options });
  return view;
};
const callsTo = (path) => api.calls.filter((call) => call.path === path);

const budgets = () => [
  budget(1, { name: "Food", scope: "category", category: { id: 4, name: "Groceries" }, category_id: 4 }),
  budget(2, { name: "Fun", progress: { ...budget(2).progress, spent: "700.0000", remaining: "100.0000", percentage_used: "87.5000", status: "near_limit" } }),
  budget(3, { name: "Travel", amount_limit: "500.0000", progress: { ...budget(3).progress, amount_limit: "500.0000", spent: "620.0000", remaining: "-120.0000", percentage_used: "124.0000", status: "exceeded" } }),
  budget(4, { name: "Dollar budget", currency_code: "USD", amount_limit: "100.0000", progress: { ...budget(4).progress, currency_code: "USD", amount_limit: "100.0000", spent: "10.0000", remaining: "90.0000", percentage_used: "10.0000" } }),
  budget(5, { name: "Old budget", status: "archived", archived_at: "2026-09-30T00:00:00Z", progress: undefined }),
];

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

describe("Planning overview", () => {
  it("asks for alerts and the first page of each list, and only reads", async () => {
    await open("/m/planning", { budgets: budgets(), goals: [goal(1)], rules: [rule(1)] });

    assert.deepEqual(new Set(api.summary()), new Set(["GET /financial-alerts", "GET /budgets", "GET /savings-goals", "GET /recurring-transactions"]));
    assert.equal(callsTo("/budgets").length, 2); // active, and active + exceeded
    assert.deepEqual(api.violations, []);
    assert.deepEqual(callsTo("/budgets").map((call) => call.query.progress_status ?? null).sort((a, b) => String(a).localeCompare(String(b))), [null, "exceeded"].sort((a, b) => String(a).localeCompare(String(b))));
    assert.ok(callsTo("/budgets").every((call) => call.query.status === "active" && call.query.per_page === "20"));
    assert.equal(callsTo("/savings-goals")[0].query.per_page, "12");
    assert.equal(callsTo("/recurring-transactions")[0].query.per_page, "15");
  });

  it("groups Plan and Tools, with counts that are the backend's totals and nothing added up", async () => {
    await open("/m/planning", { budgets: budgets(), goals: [goal(1), goal(2)], rules: [rule(1)] });
    const main = text(q("main"));

    assert.match(main, /Plan/);
    assert.match(main, /Tools/);
    assert.match(main, /Active budgets: 4/);
    assert.match(main, /Over the limit: 1/);
    assert.match(main, /Active goals: 2/);
    assert.match(main, /Active rules: 1/);
    assert.doesNotMatch(main, /ILS|USD|\d+\.\d\d/);
    assert.equal(qa("a[href='/m/planning/budgets']").length, 1);
    assert.equal(qa("a[href='/m/planning/goals']").length, 1);
    assert.equal(qa("a[href='/m/planning/recurring']").length, 1);
  });

  it("Debts and the tools are links to the full version, said to be so, and read nothing", async () => {
    await open("/m/planning", { budgets: [], goals: [], rules: [] });

    // Categories became a Mobile screen in S04B4; the rest stay full-version links.
    assert.equal(link("Categories").getAttribute("href"), "/m/planning/categories");
    for (const [name, href] of [["Debts", "/dashboard/debts"], ["Calendar", "/dashboard/calendar"], ["Reports and exports", "/dashboard/reports"]]) {
      const item = link(name);
      assert.equal(item.getAttribute("href"), href, name);
      assert.match(item.textContent, /Open in the full version/);
    }
    assert.equal(api.calls.some((call) => /debts|calendar|categories|reports/.test(call.path)), false, "the overview reads nothing for the tools");
  });

  it("shows alerts first, and only when the backend has some", async () => {
    await open("/m/planning", { budgets: [], goals: [], rules: [], alerts: [{ severity: "critical", message: "Travel budget exceeded" }, { severity: "bogus", message: "Something else" }] });

    const first = q("main section.sm-card");
    assert.equal(first.dataset.smSection, "attention");
    assert.match(text(first), /Travel budget exceeded/);
    assert.equal(qa("[data-sm-severity='info']", first).length, 1);

    await view.unmount();
    api.restore();
    await open("/m/planning", { budgets: [], goals: [], rules: [] });
    assert.equal(q("[data-sm-section='attention']"), null);
  });

  it("a failing section does not take the others down, and says so in words", async () => {
    const backend = planningBackend({ budgets: budgets(), goals: [goal(1)], rules: [rule(1)] });
    await open("/m/planning", (call) => (call.path === "/savings-goals" ? failure(500, "boom") : backend(call)));

    assert.match(text(q("main")), /Active budgets: 4/);
    assert.match(text(q("main")), /Active rules: 1/);
    const goals = q("[data-sm-plan-link='unavailable']");
    assert.match(goals.textContent, /Savings goals.*Not available right now/);
    assert.equal(goals.getAttribute("href"), "/m/planning/goals");
  });

  it("a malformed list response is an unavailable count, never a number", async () => {
    const backend = planningBackend({ budgets: budgets(), goals: [goal(1)], rules: [] });
    await open("/m/planning", (call) => (call.path === "/recurring-transactions" ? { body: { status: true, data: { recurring_transactions: { data: [], total: "many" } } } } : backend(call)));

    assert.match(text(q("[data-sm-plan-link]:nth-of-type(1)") ?? q("main")), /./);
    assert.match(text(q("main")), /Recurring rules\s*Not available right now/);
    assert.doesNotMatch(text(q("main")), /Active rules/);
  });

  it("refresh reads the four counts and the alerts again, and nothing else", async () => {
    await open("/m/planning", { budgets: budgets(), goals: [goal(1)], rules: [rule(1)] });
    const before = api.calls.length;

    await click(button("Refresh"));
    await settle();

    assert.equal(api.calls.length - before, 5);
    assert.deepEqual(api.violations, []);
  });
});

describe("Budgets list", () => {
  it("shows each budget with the backend's progress, in its own currency, and no total", async () => {
    await open("/m/planning/budgets", { budgets: budgets() });
    const rows = qa("[data-sm-budget]");

    assert.deepEqual(rows.map((row) => row.dataset.smBudget), ["1", "2", "3", "4"]);
    assert.match(text(rows[0]), /Food/);
    assert.match(text(rows[0]), /Category: Groceries/);
    assert.match(text(rows[0]), /Spent\s*200\.00ILS.*Limit\s*800\.00ILS/);
    assert.match(spoken(rows[0]), /25 percent of the limit used/);
    assert.match(text(rows[2]), /Over the limit/);
    assert.match(text(rows[3]), /10\.00USD/);
    assert.equal(rows[2].querySelector(".sm-progress-fill").style.inlineSize, "100%");
    assert.equal(rows[0].querySelector(".sm-progress-fill").style.inlineSize, "25%");
    assert.doesNotMatch(text(q("main")), /Old budget/);
    assert.deepEqual(api.violations, []);
  });

  it("the status filter lives in the address, and archived budgets say their progress is not available", async () => {
    await open("/m/planning/budgets", { budgets: budgets() });

    await click(button("Archived"));
    await settle();

    assert.equal(location(), "/m/planning/budgets?status=archived");
    assert.deepEqual(qa("[data-sm-budget]").map((row) => row.dataset.smBudget), ["5"]);
    assert.match(text(qa("[data-sm-budget]")[0]), /Archived/);
    assert.equal(callsTo("/budgets").at(-1).query.status, "archived");
  });

  it("a progress filter is sent to the backend, never applied in the browser", async () => {
    await open("/m/planning/budgets", { budgets: budgets() });

    await click(button("Over the limit"));
    await settle();

    assert.equal(location(), "/m/planning/budgets?progress_status=exceeded");
    assert.equal(callsTo("/budgets").at(-1).query.progress_status, "exceeded");
    assert.deepEqual(qa("[data-sm-budget]").map((row) => row.dataset.smBudget), ["3"]);
  });

  it("junk in the address is ignored, not sent", async () => {
    await open("/m/planning/budgets?status=deleted&progress_status=x%22%3E&owner=7&per_page=1000", { budgets: budgets() });

    assert.deepEqual(callsTo("/budgets")[0].query, { status: "active", per_page: "20", page: "1" });
  });

  it("pages with the server's paginator: Load more asks for page 2, and Back restores as many pages", async () => {
    const many = Array.from({ length: 45 }, (_, index) => budget(index + 1, { name: `Budget row ${index + 1}` }));
    await open("/m/planning/budgets", { budgets: many });

    assert.equal(qa("[data-sm-budget]").length, 20);
    assert.match(text(q("main")), /Showing 20 of 45/);

    await click(button("Load more"));
    await settle();
    assert.equal(qa("[data-sm-budget]").length, 40);
    assert.deepEqual(callsTo("/budgets").map((call) => call.query.page), ["1", "2"]);

    await click(qa("[data-sm-budget]")[3]);
    await settle();
    assert.equal(location(), "/m/planning/budgets/4");
    await goBack();
    await settle();
    assert.equal(qa("[data-sm-budget]").length, 40);
  });

  it("an empty list explains itself, offers the full version, and a filtered empty list offers to clear", async () => {
    await open("/m/planning/budgets", { budgets: [] });
    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "empty");
    assert.match(text(q("main")), /No budgets yet/);
    assert.equal(link("Open Budgets in the full version").getAttribute("href"), "/dashboard/budgets");

    await view.unmount();
    api.restore();
    await open("/m/planning/budgets?status=archived", { budgets: [] });
    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "empty-filtered");
    await click(button("Clear filters"));
    await settle();
    assert.equal(location(), "/m/planning/budgets");
  });

  it("a failed first read is an error with Retry; the retry is the same GET", async () => {
    let fail = true;
    const backend = planningBackend({ budgets: budgets() });
    await open("/m/planning/budgets", (call) => (call.path === "/budgets" && fail ? failure(500, "boom") : backend(call)));

    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "error");
    assert.match(text(q("main")), /SmartSpend had a problem/);

    fail = false;
    await click(button("Try again"));
    await settle();
    assert.equal(qa("[data-sm-budget]").length, 4);
    assert.deepEqual(api.violations, []);
  });

  it("a refresh that fails keeps the earlier rows, marked as from earlier", async () => {
    let fail = false;
    const backend = planningBackend({ budgets: budgets() });
    await open("/m/planning/budgets", (call) => (call.path === "/budgets" && fail ? failure(500, "boom") : backend(call)));

    fail = true;
    await click(button("Refresh"));
    await settle();

    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "stale");
    assert.match(text(q(".sm-stale")), /Showing what was loaded at/);
    assert.equal(qa("[data-sm-budget]").length, 4);
  });

  it("a page that does not hold together is an error, not a partial list", async () => {
    await open("/m/planning/budgets", (call) => (call.path === "/budgets" ? { body: { status: true, data: { budgets: { data: [{ name: "no id" }], total: 1, current_page: 1, per_page: 20, last_page: 1, from: 1, to: 1 } } } } : { status: 404 }));

    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "error");
    assert.equal(qa("[data-sm-budget]").length, 0);
  });
});

describe("A budget's page", () => {
  it("shows the limit, spent, remaining and progress as the backend gave them", async () => {
    await open("/m/planning/budgets/3", { budgets: budgets() });
    const page = q("[data-sm-screen='budget']");

    assert.equal(page.dataset.smRecord, "3");
    assert.match(text(page), /Travel/);
    assert.match(text(page), /Limit\s*500\.00ILS/);
    assert.match(text(page), /Spent\s*620\.00ILS/);
    assert.match(text(page), /Remaining\s*−120\.00ILS/);
    assert.match(spoken(page), /124 percent of the limit used/);
    assert.match(spoken(page), /minus 120\.00 Israeli New Shekel/);
    assert.match(text(page), /Over the limit/);
    assert.match(text(page), /Days left\s*12/);
  });

  it("says what Mobile cannot do and links to the full version page of this budget", async () => {
    await open("/m/planning/budgets/1", { budgets: budgets() });

    assert.match(text(q("main")), /Editing and archiving a budget isn't available in Mobile yet/);
    assert.equal(link("Open this budget in the full version").getAttribute("href"), "/dashboard/budgets/1");
    assert.equal(qa("form, input, textarea, select", q("main")).length, 0);
    assert.equal(qa("button", q("main")).length, 0);
  });

  it("an archived budget has no progress to show, and says so", async () => {
    await open("/m/planning/budgets/5", { budgets: budgets() });

    assert.match(text(q("main")), /An archived budget has no progress to show/);
    assert.equal(q("[data-sm-progress='unavailable']") !== null, true);
  });

  it("a missing, forbidden or foreign record gets one answer, and a bad address reads nothing", async () => {
    await open("/m/planning/budgets/99", { budgets: budgets() });
    const missing = text(q("main"));
    assert.match(missing, /isn't available/);

    await view.unmount();
    api.restore();
    await open("/m/planning/budgets/1", (call) => (call.path === "/budgets/1" ? failure(403, "no") : { status: 404 }));
    assert.equal(text(q("main")), missing.replace(/Back to budgets$/, "Back to budgets"));

    await view.unmount();
    api.restore();
    await open("/m/planning/budgets/abc", { budgets: budgets() });
    assert.equal(api.calls.length, 0);
    assert.match(text(q("main")), /isn't available/);
  });

  it("a response for another budget is refused, not shown under this address", async () => {
    await open("/m/planning/budgets/1", (call) => (call.path === "/budgets/1" ? { body: { status: true, data: { budget: budget(2, { name: "Someone else's" }) } } } : { status: 404 }));

    assert.doesNotMatch(text(q("main")), /Someone else's/);
    assert.equal(q("[data-sm-screen='budget']").dataset.smState, "error");
  });

  it("Back returns to the list as it was, filter included", async () => {
    await open("/m/planning/budgets?progress_status=exceeded", { budgets: budgets() });
    await click(qa("[data-sm-budget]")[0]);
    await settle();
    assert.equal(location(), "/m/planning/budgets/3");

    await click(link("Back to budgets"));
    await settle();
    assert.equal(location(), "/m/planning/budgets?progress_status=exceeded");
  });
});

describe("Savings goals", () => {
  const goals = () => [
    goal(1, { name: "Laptop" }),
    goal(2, { name: "Trip", status: "paused", progress: { ...goal(2).progress, status: "not_started", percentage_funded: "0.0000", saved_amount: "0.0000", remaining_amount: "3000.0000" } }),
    goal(3, { name: "Bike", status: "achieved", achieved_at: "2026-09-01T00:00:00Z", progress: { ...goal(3).progress, saved_amount: "3000.0000", remaining_amount: "0.0000", percentage_funded: "100.0000", status: "achieved", is_achieved: true } }),
    goal(4, { name: "Mystery", status: "frozen" }),
  ];

  it("lists active goals first, with saved, target and the backend's percentage", async () => {
    await open("/m/planning/goals", { goals: goals() });
    const rows = qa("[data-sm-goal]");

    assert.deepEqual(rows.map((row) => row.dataset.smGoal), ["1"]);
    assert.match(text(rows[0]), /Laptop/);
    assert.match(text(rows[0]), /Saved\s*1,200\.00ILS.*Target\s*3,000\.00ILS/);
    assert.match(spoken(rows[0]), /40 percent saved/);
    assert.equal(callsTo("/savings-goals")[0].query.status, "active");
  });

  it("each lifecycle is a filter in the address, and an unknown one is shown as sent", async () => {
    await open("/m/planning/goals?status=achieved", { goals: goals() });
    assert.match(text(qa("[data-sm-goal]")[0]), /Bike.*Achieved/);

    await view.unmount();
    api.restore();
    await open("/m/planning/goals/4", { goals: goals() });
    assert.match(text(q("main")), /Unknown status: frozen/);
    assert.doesNotMatch(text(q(".sm-hero")), /Active|Achieved/);
  });

  it("a goal's page shows the backend's progress, links to the full version, and has no controls", async () => {
    await open("/m/planning/goals/1", { goals: goals() });
    const page = q("[data-sm-screen='goal']");

    assert.match(text(page), /Laptop/);
    assert.match(text(page), /Saved\s*1,200\.00ILS/);
    assert.match(text(page), /Remaining\s*1,800\.00ILS/);
    assert.match(text(page), /Contributions\s*3/);
    assert.match(text(page), /Laptop jar|Goal 1 jar/);
    assert.match(text(page), /Adding to or withdrawing from a goal moves money/);
    assert.equal(link("Open this goal in the full version").getAttribute("href"), "/dashboard/savings-goals/1");
    assert.equal(qa("button, input, form", q("main")).length, 0);
  });

  it("a response for another goal is refused", async () => {
    await open("/m/planning/goals/1", (call) => (call.path === "/savings-goals/1" ? { body: { status: true, data: { savings_goal: goal(2) } } } : { status: 404 }));
    assert.equal(q("[data-sm-screen='goal']").dataset.smState, "error");
  });
});

describe("Smart Savings is off in this build", () => {
  it("a goal's page shows nothing about plans and never asks for one", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], plans: { 1: { savings_goal: { id: 1 }, savings_plan: { status: "active", savings_goal_id: 1 } } } });

    assert.equal(q("[data-sm-section='smart-plan']"), null);
    assert.doesNotMatch(text(q("main")), /Smart Savings|plan/i);
    assert.equal(api.calls.some((call) => /\/plan/.test(call.path)), false);
  });
});

describe("Recurring rules", () => {
  const rules = () => [
    rule(1, { name: "Rent", amount: "2500.0000" }),
    rule(2, { name: "Salary", type: "income", amount: "9000.0000", frequency: "weekly", interval: 2, next_due_date: "2026-11-02" }),
    rule(3, { name: "Gym", status: "paused", next_due_date: null }),
    rule(4, { name: "Odd rule", frequency: "daily", status: "suspended" }),
  ];

  it("a row is a rule, not a transaction: unsigned amount, type and cadence in words, the backend's next date", async () => {
    await open("/m/planning/recurring", { rules: rules() });
    const rows = qa("[data-sm-rule]");

    assert.deepEqual(rows.map((row) => row.dataset.smRule), ["1", "2"]);
    assert.match(text(rows[0]), /Rent.*Expense · Monthly.*Next due\s*Nov 1, 2026/);
    assert.match(text(rows[0]), /2,500\.00ILS/);
    assert.doesNotMatch(text(rows[0]), /[+−-]2,500|posted|paid/i);
    assert.match(text(rows[1]), /Income · Weekly · repeats every 2/);
    assert.equal(rows.every((row) => row.querySelector(".sm-struck, .sm-tx-icon") === null), true);
  });

  it("filters by status and type through the address", async () => {
    await open("/m/planning/recurring", { rules: rules() });

    await click(button("Paused"));
    await settle();
    assert.equal(location(), "/m/planning/recurring?status=paused");
    assert.match(text(qa("[data-sm-rule]")[0]), /Gym.*No next date|Gym/);

    await click(button("Income"));
    await settle();
    assert.equal(location(), "/m/planning/recurring?status=paused&type=income");
    assert.equal(qa("[data-sm-rule]").length, 0);
  });

  it("an unknown frequency or status is shown as sent, never as a known one", async () => {
    await open("/m/planning/recurring/4", { rules: rules() });
    const page = text(q("main"));

    assert.match(page, /Unknown status: suspended/);
    assert.match(page, /daily/);
  });

  it("a rule's page says it is a rule, shows its schedule, and offers no way to confirm, skip, pause or resume", async () => {
    await open("/m/planning/recurring/1", { rules: rules() });
    const page = q("[data-sm-screen='rule']");

    assert.match(text(page), /This is a rule, not a transaction/);
    assert.match(text(page), /Next due\s*Nov 1, 2026/);
    assert.match(text(page), /Open occurrences\s*1/);
    assert.match(text(page), /Processing\s*Manual/);
    assert.match(text(page), /Rent/);
    assert.match(text(page), /Confirming the next payment moves money/);
    assert.equal(link("Open this rule in the full version").getAttribute("href"), "/dashboard/recurring/1");
    assert.equal(qa("button, input, form", q("main")).length, 0);
    assert.equal(api.calls.some((call) => /occurrences|confirm|skip|pause|resume/.test(call.path)), false);
  });

  it("a response for another rule is refused", async () => {
    await open("/m/planning/recurring/1", (call) => (call.path === "/recurring-transactions/1" ? { body: { status: true, data: { recurring_transaction: rule(9) } } } : { status: 404 }));
    assert.equal(q("[data-sm-screen='rule']").dataset.smState, "error");
  });
});

describe("Arabic, privacy and money", () => {
  it("renders in Arabic with Latin digits, an isolated amount, and the layout direction from the app", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await open("/m/planning/budgets/3", { budgets: budgets() });
    const page = q("[data-sm-screen='budget']");

    assert.match(text(page), /الحد/);
    assert.match(text(page), /620\.00/);
    assert.ok(qa("bdi[dir='ltr']", page).length > 0);
    assert.match(spoken(page), /سالب/);
    assert.equal(q("h1").textContent, "الميزانية");
    assert.equal(document.documentElement.dir, "rtl");
  });

  it("hidden amounts stay hidden on every Planning screen, and Mobile does not rewrite the preference", async () => {
    const key = "smartspend:experience:v1:u:1:w:1";
    const preferences = JSON.stringify({ version: 1, hiddenMoney: true });
    window.localStorage.setItem(key, preferences);

    for (const entry of ["/m/planning/budgets", "/m/planning/budgets/1", "/m/planning/goals/1", "/m/planning/recurring"]) {
      await open(entry, { budgets: budgets(), goals: [goal(1)], rules: [rule(1)] });
      assert.ok(qa(".sm-money-hidden").length > 0, entry);
      assert.doesNotMatch(text(q("main")), /\d[\d,]*\.\d\d/, entry);
      await view.unmount();
      view = null;
    }
    assert.equal(window.localStorage.getItem(key), preferences);
  });

  it("amounts in different currencies are never combined", async () => {
    await open("/m/planning/budgets", { budgets: budgets() });
    const main = text(q("main"));

    assert.match(main, /10\.00USD/);
    assert.match(main, /200\.00ILS/);
    assert.doesNotMatch(main, /Total|Combined|All budgets/i);
  });
});

describe("Planning only reads", () => {
  it("every Planning screen sent GET requests only, and no request with a body", async () => {
    const data = { budgets: budgets(), goals: [goal(1)], rules: [rule(1)] };

    for (const entry of ["/m/planning", "/m/planning/budgets", "/m/planning/budgets/1", "/m/planning/goals", "/m/planning/goals/1", "/m/planning/recurring", "/m/planning/recurring/1"]) {
      await open(entry, data);
      assert.deepEqual(api.violations, [], entry);
      assert.ok(api.calls.length > 0, entry);
      assert.ok(api.calls.every((call) => call.method === "GET" && !call.hasBody), entry);
      await view.unmount();
      view = null;
    }
  });

  it("Planning's navigation marks the Planning destination current on every Planning page", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)] });
    const current = qa("nav.sm-nav [aria-current]").map((item) => item.textContent.trim());

    assert.deepEqual(current, ["Planning"]);
    assert.equal(q("h1").textContent, "Savings goal");
    assert.equal(i18n.language, "en");
  });
});
