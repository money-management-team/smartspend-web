import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, clearSessionStorage, dom, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { budget, goal, planningBackend, rule } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Identity safety for Planning: budgets, goals and recurring rules are private.
 * They must leave the screen the moment the signed-in identity stops being
 * consistent, and a response must never be shown to an identity other than the
 * one whose token sent it.
 */

after(() => dom.window.close());

const dataFor = (token) =>
  token === TOKEN_B
    ? { budgets: [budget(900, { name: "Bravo private budget", amount_limit: "777.0000" })], goals: [goal(900, { name: "Bravo private goal" })], rules: [rule(900, { name: "Bravo private rule" })] }
    : {
        budgets: Array.from({ length: 30 }, (_, index) => budget(index + 1, { name: index === 0 ? "Alpha private budget" : `Alpha budget ${index + 1}` })),
        goals: [goal(1, { name: "Alpha private goal" })],
        rules: [rule(1, { name: "Alpha private rule" })],
      };
const tokenOf = (call) => (call.auth === `Bearer ${TOKEN_B}` ? TOKEN_B : TOKEN_A);
const backend = (call) => planningBackend(dataFor(tokenOf(call)))(call);
const SECRETS = /Alpha|Bravo|777|800\.00|1,200\.00|3,000\.00|120\.00/;

let api;
let view;
const identityScreen = () => q("[data-sm-identity]");
const button = (label) => qa("button", q("main")).find((item) => item.textContent.trim() === label);
const switchToB = () => {
  storeSession({ token: TOKEN_B, user: USER_B });
  otherTabWrote("ACCESS_TOKEN", TOKEN_B);
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
  api = installFakeApi(backend);
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api.restore();
});

describe("Planning under a changing identity", () => {
  for (const [entry, shown] of [
    ["/m/planning/budgets", /Alpha private budget/],
    ["/m/planning/budgets/1", /Alpha private budget/],
    ["/m/planning/goals", /Alpha private goal/],
    ["/m/planning/goals/1", /Alpha private goal/],
    ["/m/planning/recurring", /Alpha private rule/],
    ["/m/planning/recurring/1", /Alpha private rule/],
  ]) {
    it(`${entry}: loads with the signed-in token, and another tab signing in as B removes everything at once`, async () => {
      view = await mountMobile({ entry });
      assert.match(q("main").textContent, shown);
      assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
      const before = api.calls.length;

      switchToB();
      await settle();

      assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
      assert.doesNotMatch(document.body.textContent, SECRETS);
      assert.equal(api.calls.length, before);
      assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
    });
  }

  it("another tab signs out: the overview's counts and alerts go, and nothing more is requested", async () => {
    view = await mountMobile({ entry: "/m/planning" });
    assert.match(q("main").textContent, /Active budgets: 30/);
    const before = api.calls.length;

    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.doesNotMatch(document.body.textContent, /Active budgets|Planning|Alpha/);
    assert.equal(api.calls.length, before);
  });

  it("a list request in flight when the identity changes: its answer is never shown", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/budgets" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    view = await mountMobile({ entry: "/m/planning/budgets" });
    assert.equal(q("[data-sm-screen='budgets']").dataset.smState, "loading");

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("while a later page is loading: page 1 goes with the rest, and the late page is never shown", async () => {
    view = await mountMobile({ entry: "/m/planning/budgets" });
    assert.match(q("main").textContent, /Alpha private budget/);

    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/budgets" && call.query.page === "2" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    await click(button("Load more"));
    await settle(3);

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.ok(identityScreen());
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(qa("[data-sm-budget]").length, 0);
  });

  it("a record request in flight when the session ends: its answer is never shown", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/savings-goals/1" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    view = await mountMobile({ entry: "/m/planning/goals/1" });

    clearSessionStorage();
    release();
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("one identity's cached Planning data is not available to the next: signing in as B starts from nothing", async () => {
    view = await mountMobile({ entry: "/m/planning/budgets" });
    await view.unmount();
    view = null;
    api.restore();

    clearSessionStorage();
    storeSession({ token: TOKEN_B, user: USER_B });
    api = installFakeApi(backend);
    view = await mountMobile({ entry: "/m/planning/budgets", auth: { isAuthenticated: true, initializing: false, token: TOKEN_B, user: USER_B, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } } });

    assert.match(q("main").textContent, /Bravo private budget/);
    assert.doesNotMatch(document.body.textContent, /Alpha/);
    assert.ok(api.calls.length > 0 && api.calls.every((call) => call.auth === `Bearer ${TOKEN_B}`));
  });
});
