import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { PATH, getBudgetDetailsPath, getRecurringDetailsPath, getSavingsGoalDetailsPath } from "../src/routes/Path.js";
import { MOBILE_SCREENS, budgetDetailPath, currentOf, goalDetailPath, recurringDetailPath } from "../src/mobile/navigation.js";
import { getRedirect, resolveLocation } from "../src/mobile/presentation/resolver.js";
import { installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, qa, resetEnvironment, storeSession } from "./helpers/mobileHarness.mjs";
import { budget, goal, planningBackend, rule } from "./helpers/planningFixture.mjs";

/*
 * Planning's routes and the canonical Desktop pages they are NOT allowed to
 * replace. Desktop's Budgets, Savings goals and Recurring pages create, edit,
 * contribute, confirm and skip; Mobile's are read-only, so a visit to the
 * Desktop page is never sent to the Mobile one, in any mode, until there is
 * parity or an approved fallback.
 */

after(() => dom.window.close());

const mobile = { enabled: true, authenticated: true, mode: "mobile" };
const desktop = { enabled: true, authenticated: true, mode: "desktop" };

const CANONICAL = [
  PATH.USER.BUDGETS,
  getBudgetDetailsPath(7),
  PATH.USER.SAVINGS_GOALS,
  getSavingsGoalDetailsPath(7),
  `${PATH.USER.SAVINGS_GOALS}?new=1`,
  PATH.USER.SAVINGS_SMART_PLAN_NEW,
  "/dashboard/savings-goals/7/smart-plan",
  "/dashboard/savings-goals/7/smart-plan/revise/schedule",
  PATH.USER.RECURRING,
  getRecurringDetailsPath(7),
  PATH.USER.DEBTS,
  "/dashboard/debts/7",
  PATH.USER.CALENDAR,
  PATH.USER.CATEGORIES,
  PATH.USER.REPORTS,
  PATH.USER.REPORT_EXPORTS,
];

describe("Desktop's Planning pages are never replaced", () => {
  it("none of them is redirected to Mobile, with Mobile as the chosen presentation, with or without a query", () => {
    for (const pathname of CANONICAL) {
      for (const [search, hash] of [["", ""], ["?status=archived&progress_status=exceeded", ""], ["", "#top"]]) {
        assert.equal(getRedirect({ pathname, search, hash }, mobile), null, `${pathname}${search}${hash}`);
        assert.equal(getRedirect({ pathname, search, hash }, desktop), null, `${pathname}${search}${hash}`);
      }
    }
  });

  it("the Planning destination is not marked as coming from a canonical page", () => {
    const planning = MOBILE_SCREENS.find((screen) => screen.id === "planning");

    assert.equal(planning.fromCanonical, false);
    assert.equal(planning.canonical, PATH.USER.BUDGETS);
    assert.deepEqual(MOBILE_SCREENS.filter((screen) => screen.fromCanonical).map((screen) => screen.id), ["home"]);
  });
});

describe("Mobile Planning addresses go back to the Desktop page of the same thing", () => {
  const cases = [
    ["/m/planning", PATH.USER.BUDGETS],
    ["/m/planning/budgets", PATH.USER.BUDGETS],
    ["/m/planning/budgets/7", getBudgetDetailsPath(7)],
    ["/m/planning/goals", PATH.USER.SAVINGS_GOALS],
    ["/m/planning/goals/7", getSavingsGoalDetailsPath(7)],
    ["/m/planning/recurring", PATH.USER.RECURRING],
    ["/m/planning/recurring/7", getRecurringDetailsPath(7)],
  ];

  it("in the full-version presentation, carrying the query and the hash", () => {
    for (const [from, to] of cases) {
      assert.deepEqual(getRedirect({ pathname: from, search: "?status=archived", hash: "#x" }, desktop), { pathname: to, search: "?status=archived", hash: "#x" }, from);
    }
  });

  it("an id that is not plain digits, an extra segment or an unknown Planning page is not forwarded as an id", () => {
    for (const from of ["/m/planning/budgets/007", "/m/planning/budgets/abc", "/m/planning/budgets/7/deeper", "/m/planning/goals/0", "/m/planning/recurring/1e3", "/m/planning/debts", "/m/planning/budgets/%2e%2e"]) {
      assert.deepEqual(getRedirect({ pathname: from, search: "?a=1", hash: "" }, desktop), { pathname: PATH.USER.DASHBOARD, search: "", hash: "" }, from);
    }
  });

  it("in the Mobile presentation nothing under /m/planning moves", () => {
    for (const [from] of cases) assert.equal(getRedirect({ pathname: from, search: "", hash: "" }, mobile), null, from);
  });

  it("never loops: a result is never sent anywhere else, and a Desktop result is not a Mobile address", () => {
    for (const [from] of cases) {
      const once = resolveLocation({ pathname: from, search: "?x=1", hash: "" }, desktop);
      assert.equal(once.pathname.startsWith("/m"), false, from);
      assert.deepEqual(resolveLocation(once, desktop), once, from);
      assert.deepEqual(resolveLocation(once, mobile), once, from);
    }
  });

  it("is a no-op when Mobile is off or the visitor is signed out", () => {
    for (const [from] of cases) {
      assert.equal(getRedirect({ pathname: from, search: "", hash: "" }, { enabled: false, authenticated: true, mode: "desktop" }), null, from);
      assert.equal(getRedirect({ pathname: from, search: "", hash: "" }, { enabled: true, authenticated: false, mode: "desktop" }), null, from);
    }
  });
});

describe("Planning's links", () => {
  let api;
  let view;

  beforeEach(async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A });
  });

  afterEach(async () => {
    await view?.unmount();
    view = null;
    api?.restore();
  });

  it("builds a record's address from its id only, encoded", () => {
    assert.equal(budgetDetailPath("7"), "/m/planning/budgets/7");
    assert.equal(goalDetailPath("7"), "/m/planning/goals/7");
    assert.equal(recurringDetailPath("7"), "/m/planning/recurring/7");
    assert.equal(budgetDetailPath("a/b"), "/m/planning/budgets/a%2Fb");
  });

  it("the Planning destination is current on the overview and on every page inside it, and nowhere else", () => {
    const planning = MOBILE_SCREENS.find((screen) => screen.id === "planning");

    assert.equal(currentOf(planning, "/m/planning"), "page");
    for (const inside of ["/m/planning/budgets", "/m/planning/goals/7", "/m/planning/recurring/7"]) assert.equal(currentOf(planning, inside), "true", inside);
    for (const outside of ["/m", "/m/activity", "/m/more", "/m/planning-x"]) assert.equal(currentOf(planning, outside), undefined, outside);
  });

  it("every link on every Planning page goes to a Mobile Planning page or to the full version, never anywhere else", async () => {
    const data = { budgets: [budget(1)], goals: [goal(1)], rules: [rule(1)] };
    const hrefs = new Set();

    for (const entry of ["/m/planning", "/m/planning/budgets", "/m/planning/budgets/1", "/m/planning/goals", "/m/planning/goals/1", "/m/planning/recurring", "/m/planning/recurring/1"]) {
      api = installFakeApi(planningBackend(data));
      view = await mountMobile({ entry });
      for (const anchor of qa("main a")) hrefs.add(anchor.getAttribute("href"));
      await view.unmount();
      view = null;
      api.restore();
    }

    assert.ok(hrefs.size > 10);
    for (const href of hrefs) {
      assert.match(href, /^\/(m(\/(planning|accounts|activity)(\/[1-9]\d{0,14}|\/(budgets|goals|recurring)(\/[1-9]\d{0,14})?)?)?|dashboard\/[a-z-]+(\/\d+)?)(\?[a-z_=&-]+)?$/, href);
    }
    // The full version is the way to do anything that changes data: it is linked, and it is a page the app already has.
    assert.ok(hrefs.has(PATH.USER.DEBTS) && hrefs.has(PATH.USER.BUDGETS) && hrefs.has(getBudgetDetailsPath(1)));
    assert.equal(q("body > a"), null);
  });
});
