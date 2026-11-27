import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { budget, goal, movement, planningBackend } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Phase 6UI.5C4: what was added around the budget and goal pages. The goal's money movements are read from the
 * backend's own history endpoints and shown as they come; the budget page gains the backend's status in words and a
 * link into Activity. Fictional data only; every request is checked to be a GET.
 */

after(() => dom.window.close());

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, data, options = {}) => {
  api?.restore();
  api = installFakeApi(typeof data === "function" ? data : planningBackend(data));
  view = await mountMobile({ entry, ...options });
  return view;
};
const callsTo = (path) => api.calls.filter((call) => call.path === path);
const section = () => q("[data-sm-section='goal-movements']");

const trail = () => [
  movement(1, 1, { type: "contribution", amount: "250.0000", occurred_at: "2026-10-20T09:00:00Z" }),
  movement(2, 1, { type: "withdrawal", amount: "100.0000", occurred_at: "2026-10-18T09:00:00Z", from_account: { id: 5, name: "Goal 1 jar", type: "savings" }, to_account: { id: 1, name: "Everyday wallet", type: "cash" } }),
  movement(3, 1, { type: "contribution", amount: "400.0000", occurred_at: "2026-10-10T09:00:00Z", is_reversed: true, transfer_status: "reversed" }),
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

describe("A goal's money movements", () => {
  it("lists them as the backend ordered them, with signs, reversals and a link to each transfer", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: trail() } });

    const rows = qa("[data-sm-movement]", section());
    assert.deepEqual(rows.map((row) => row.dataset.smMovement), ["1", "2", "3"]);
    assert.match(text(rows[0]), /Added.*Everyday wallet.*Goal 1 jar.*\+250\.00ILS/);
    assert.match(text(rows[1]), /Taken out.*−100\.00ILS/);
    assert.match(text(rows[2]), /Reversed/);
    assert.equal(rows[2].dataset.smReversed, "true");
    assert.ok(rows[2].querySelector(".sm-struck"));
    assert.equal(rows[0].querySelector("a").getAttribute("href"), "/m/transfers/701");
    assert.deepEqual(callsTo("/savings-goals/1/activity").map((call) => call.query), [{ per_page: "10" }]);
    assert.deepEqual(api.violations, []);
  });

  it("the tab is in the address, and each tab asks the endpoint that owns it", async () => {
    await open("/m/planning/goals/1?movements=withdrawal", { goals: [goal(1)], movements: { 1: trail() } });
    assert.deepEqual(callsTo("/savings-goals/1/activity").map((call) => call.query), [{ per_page: "10", type: "withdrawal" }]);
    assert.deepEqual(qa("[data-sm-movement]").map((row) => row.dataset.smMovement), ["2"]);
    assert.equal(q("[data-sm-movements-tab='withdrawal']").getAttribute("aria-current"), "true");

    await view.unmount();
    api.restore();
    await open("/m/planning/goals/1?movements=contribution", { goals: [goal(1)], movements: { 1: trail() } });
    assert.equal(callsTo("/savings-goals/1/contributions").length, 1);
    assert.equal(callsTo("/savings-goals/1/activity").length, 0);
    assert.deepEqual(qa("[data-sm-movement]").map((row) => row.dataset.smMovement), ["1", "3"]);
  });

  it("choosing a tab replaces the address, so Back leaves the goal in one step", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: trail() } });
    await click(q("[data-sm-movements-tab='contribution']"));
    await settle();

    assert.equal(location(), "/m/planning/goals/1?movements=contribution");
    assert.equal(q("[data-sm-movements-tab='contribution']").getAttribute("aria-current"), "true");
    assert.equal(qa("[data-sm-movement]").length, 2);
  });

  it("pages with the backend's paginator and shows which page this is", async () => {
    const many = Array.from({ length: 12 }, (_, index) => movement(index + 1, 1, { amount: `${index + 1}.0000` }));
    await open("/m/planning/goals/1?mp=2", { goals: [goal(1)], movements: { 1: many } });

    assert.deepEqual(callsTo("/savings-goals/1/activity").map((call) => call.query.page), ["2"]);
    assert.equal(qa("[data-sm-movement]").length, 2);
    assert.match(text(section()), /Page 2 of 2/);
    assert.equal(q("[data-sm-movements-page='1']").getAttribute("href"), "/m/planning/goals/1");
    assert.equal(q("[data-sm-movements-page='3']"), null);
  });

  it("says plainly when nothing has moved", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: [] } });
    assert.match(text(section()), /Nothing has been moved into or out of this goal yet/);
    assert.equal(qa("[data-sm-movement]").length, 0);
  });

  it("refuses a page that belongs to another goal or another currency, whole", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: [trail()[0], movement(9, 2)] } });
    assert.equal(qa("[data-sm-movement]").length, 0);
    assert.ok(section().querySelector("[role='alert'], .sm-error"));

    await view.unmount();
    api.restore();
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: [movement(1, 1, { currency_code: "USD" })] } });
    assert.equal(qa("[data-sm-movement]").length, 0);
  });

  it("a failed read leaves the rest of the goal's page standing and can be retried", async () => {
    let fail = true;
    const backend = planningBackend({ goals: [goal(1)], movements: { 1: trail() } });
    await open("/m/planning/goals/1", (call) => (call.path === "/savings-goals/1/activity" && fail ? failure(500, "Server error") : backend(call)));

    assert.match(text(q("[data-sm-screen='goal']")), /Saved\s*1,200\.00ILS/);
    assert.equal(qa("[data-sm-movement]").length, 0);

    fail = false;
    const retry = qa("button", section()).find((item) => /retry|try again/i.test(item.textContent));
    assert.ok(retry, "a Retry control");
    await click(retry);
    await settle();
    assert.equal(qa("[data-sm-movement]").length, 3);
  });

  it("the goal's account is a link", async () => {
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: [] } });
    assert.equal(q("[data-sm-screen='goal'] dl a").getAttribute("href"), "/m/accounts/5");
  });

  it("speaks Arabic with the arrow pointing the other way", async () => {
    await i18n.changeLanguage("ar");
    await open("/m/planning/goals/1", { goals: [goal(1)], movements: { 1: trail() } });
    assert.match(text(qa("[data-sm-movement]", section())[0]), /←/);
    assert.match(text(section()), /حركات المال/);
  });
});

describe("A budget's page", () => {
  const withStatus = (status, over = {}) => budget(1, { progress: { ...budget(1).progress, status }, ...over });

  it("says in words what the backend's status means, and only for statuses it knows", async () => {
    for (const [status, sentence] of [["safe", /well within the limit/], ["warning", /getting closer/], ["near_limit", /very close/], ["exceeded", /gone past/]]) {
      await open("/m/planning/budgets/1", { budgets: [withStatus(status)] });
      assert.match(text(q("[data-sm-screen='budget'] .sm-hero")), sentence);
      assert.equal(q("[data-sm-hint]").dataset.smHint, status);
      await view.unmount();
      api.restore();
    }

    await open("/m/planning/budgets/1", { budgets: [withStatus("frozen")] });
    assert.equal(q("[data-sm-hint]"), null);
  });

  it("keeps the bar on the hero beside the limit it measures", async () => {
    await open("/m/planning/budgets/1", { budgets: [budget(1)] });
    assert.ok(q("[data-sm-screen='budget'] .sm-detail-hero .sm-progress"));
    assert.equal(qa("[data-sm-screen='budget'] .sm-progress").length, 1);
  });

  it("links to the expenses of its period in Activity, with its category when it has one", async () => {
    await open("/m/planning/budgets/1", { budgets: [budget(1, { scope: "category", category_id: 4, category: { id: 4, name: "Groceries" } })] });
    const href = q("[data-sm-action='budget-expenses']").getAttribute("href");
    const url = new URL(href, "https://example.test");
    assert.equal(url.pathname, "/m/activity");
    assert.deepEqual(Object.fromEntries(url.searchParams), { type: "expense", date_from: "2026-10-01", date_to: "2026-10-31", category_id: "4" });

    await view.unmount();
    api.restore();
    await open("/m/planning/budgets/1", { budgets: [budget(1)] });
    const general = new URL(q("[data-sm-action='budget-expenses']").getAttribute("href"), "https://example.test");
    assert.equal(general.searchParams.get("category_id"), null);
    assert.deepEqual(api.violations, []);
  });

  it("makes no request of its own for that link", async () => {
    await open("/m/planning/budgets/1", { budgets: [budget(1)] });
    assert.equal(api.calls.filter((call) => call.path === "/transactions").length, 0);
  });
});
