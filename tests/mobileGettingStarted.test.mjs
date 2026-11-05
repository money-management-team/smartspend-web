import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click } from "./helpers/dom.mjs";
import { envelope, failure, healthyBackend, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { paginator } from "./helpers/planningFixture.mjs";

const { SETUP_STEPS, hasAccount, hasListTotal, hasTransactions, stepState, summarize } = await import("../src/mobile/models/setup.js");
const { PATH, getNewOperationPath, getNewSavingsGoalPath } = await import("../src/routes/Path.js");

/*
 * Getting started on Mobile: four checks worked out from reads the app already makes (the same four the full
 * version's Getting Started makes), shown honestly. A step is done only when the backend says so; a read that fails
 * is "couldn't check" and is not counted; nothing is stored; and since Mobile cannot create these yet, a step that is
 * not done opens the full version. Fictional data, GET only.
 */

after(() => dom.window.close());

describe("Getting started: the rules", () => {
  const account = (extra = {}) => ({ id: 1, workspace_id: 1, status: "active", savings_goal: null, ...extra });

  it("an account counts only when it is active, in this workspace, and not a savings goal's own", () => {
    assert.equal(hasAccount({ accounts: [account()] }, 1), true);
    assert.equal(hasAccount({ accounts: [account({ status: "archived" })] }, 1), false);
    assert.equal(hasAccount({ accounts: [account({ workspace_id: 2 })] }, 1), false);
    assert.equal(hasAccount({ accounts: [account({ savings_goal: { id: 3 } })] }, 1), false);
    assert.equal(hasAccount({ accounts: [] }, 1), false);
    assert.throws(() => hasAccount({}, 1), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => hasAccount(null, 1), { code: "MALFORMED_RESPONSE" });
  });

  it("a transaction counts only from an answer about this workspace", () => {
    assert.equal(hasTransactions({ scope: { workspace_id: 1 }, recent_transactions: [{ id: 5 }] }, 1), true);
    assert.equal(hasTransactions({ scope: { workspace_id: "1" }, recent_transactions: [] }, 1), false);
    assert.throws(() => hasTransactions({ scope: { workspace_id: 2 }, recent_transactions: [{ id: 5 }] }, 1), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => hasTransactions({ recent_transactions: [{ id: 5 }] }, 1), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => hasTransactions({ scope: { workspace_id: 1 } }, 1), { code: "MALFORMED_RESPONSE" });
  });

  it("a list counts from the paginator's own total, and a total that is not a whole number is not known", () => {
    assert.equal(hasListTotal({ data: { budgets: { total: 2 } } }, "budgets"), true);
    assert.equal(hasListTotal({ data: { budgets: { total: 0 } } }, "budgets"), false);
    for (const bad of [{ data: { budgets: { total: "2" } } }, { data: { budgets: { total: -1 } } }, { data: {} }, null]) assert.throws(() => hasListTotal(bad, "budgets"), { code: "MALFORMED_RESPONSE" });
  });

  it("a step is unknown (null) when its read failed, has not arrived, or does not hold together", () => {
    assert.equal(stepState({ status: "error", data: undefined }, () => true), null);
    assert.equal(stepState({ status: "loading", data: undefined }, () => true), null);
    assert.equal(stepState({ status: "ready", data: {} }, () => { throw new Error("bad"); }), null);
    assert.equal(stepState({ status: "ready", data: {} }, () => false), false);
    assert.equal(stepState({ status: "stale", data: {} }, () => true), true, "an older answer is still an answer");
  });

  it("the summary counts only what was read as done, and never says confirmed while a step is unknown", () => {
    assert.deepEqual(SETUP_STEPS, ["account", "transaction", "budget", "goal"]);
    assert.deepEqual(summarize([true, true, false, false]), { total: 4, done: 2, unknown: 0, confirmed: true, complete: false, percent: "50" });
    assert.deepEqual(summarize([true, true, true, null]), { total: 4, done: 3, unknown: 1, confirmed: false, complete: false, percent: "75" });
    assert.equal(summarize([true, true, true, true]).complete, true);
    assert.equal(summarize([null, null, null, null]).done, 0);
  });
});

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const step = (id) => q(`[data-sm-step='${id}']`);

const world = ({ accounts = [{ id: 1, workspace_id: 1, status: "active", savings_goal: null, name: "Wallet" }], recent = [{ id: 1 }], budgets = [{ id: 1 }], goals = [], scope = 1, fail = [] } = {}) => (call) => {
  if (fail.includes(call.path)) return failure(500, "boom");
  if (call.path === "/accounts") return { body: envelope({ accounts }) };
  if (call.path === "/dashboard") return { body: envelope({ scope: { workspace_id: scope }, recent_transactions: recent, totals: {}, summary_by_currency: [], accounts: [] }) };
  if (call.path === "/budgets") return { body: envelope({ budgets: paginator(budgets) }) };
  if (call.path === "/savings-goals") return { body: envelope({ savings_goals: paginator(goals) }) };
  return healthyBackend()(call);
};
const open = async (backend, { workspace = { id: 1, name: "Home", base_currency_code: "ILS", timezone: "UTC" } } = {}) => {
  storeSession({ token: TOKEN_A, user: USER_A, workspace: workspace ?? undefined });
  api?.restore();
  api = installFakeApi(backend);
  // A session without a workspace has to be said in the auth value too (the harness fills the stored one from it).
  const auth = workspace ? undefined : { isAuthenticated: true, initializing: false, token: TOKEN_A, user: USER_A, workspace: null };
  view = await mountMobile({ entry: "/m/getting-started", auth });
};

beforeEach(async () => {
  await resetEnvironment();
});
afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("Getting started screen", () => {
  it("reads the four checks (and only reads) and shows what is done and what is not", async () => {
    await open(world());
    assert.equal(q(".sm-bar-title").textContent, "Getting started");
    assert.deepEqual(api.calls.map((call) => call.path).sort(), ["/accounts", "/budgets", "/dashboard", "/savings-goals"]);
    assert.ok(api.calls.every((call) => call.method === "GET"));
    assert.equal(api.calls.find((call) => call.path === "/dashboard").query.period, "all");
    assert.deepEqual(api.calls.find((call) => call.path === "/budgets").query, { workspace_id: "1", per_page: "1", page: "1" });
    assert.equal(q("[data-sm-progress]").dataset.smProgress, "3/4");
    assert.match(text(q("[data-sm-section='progress']")), /3 of 4 done/);
    assert.deepEqual(SETUP_STEPS.map((id) => step(id).dataset.smState), ["done", "done", "done", "todo"]);
    assert.equal(q("[data-sm-section='done']"), null, "not finished, so no celebration");
  });

  it("a done step looks at it on Mobile; a step still to do opens the full version, where it can be done", async () => {
    await open(world());
    assert.equal(q("[data-sm-action='view-account']").getAttribute("href"), "/m/accounts");
    assert.equal(q("[data-sm-action='view-transaction']").getAttribute("href"), "/m/activity");
    assert.equal(q("[data-sm-action='view-budget']").getAttribute("href"), "/m/planning/budgets");
    assert.equal(q("[data-sm-action='setup-goal']").getAttribute("href"), getNewSavingsGoalPath());
    assert.equal(q("[data-sm-action='setup-account']"), null, "a done step has no set-up button");
    assert.match(text(q("[data-sm-note='read-only']")), /Mobile can't create these yet.*nothing is saved here/);
  });

  it("a brand new person sees four steps to do, each opening the full version, and no step marked done", async () => {
    await open(world({ accounts: [], recent: [], budgets: [], goals: [] }));
    assert.match(text(q("[data-sm-section='progress']")), /0 of 4 done/);
    assert.deepEqual(SETUP_STEPS.map((id) => step(id).dataset.smState), ["todo", "todo", "todo", "todo"]);
    assert.deepEqual(qa("[data-sm-action^='setup-']").map((link) => link.getAttribute("href")), [PATH.USER.ACCOUNTS, getNewOperationPath("expense"), PATH.USER.BUDGETS, getNewSavingsGoalPath()]);
    assert.equal(qa("[data-sm-badge='done']").length, 0);
  });

  it("everything done says so, and only then", async () => {
    await open(world({ goals: [{ id: 1 }] }));
    assert.equal(q("[data-sm-screen='getting-started']").dataset.smState, "complete");
    assert.match(text(q("[data-sm-section='done']")), /You're all set/);
    assert.equal(qa("[data-sm-action^='setup-']").length, 0);
  });

  it("a read that fails is 'couldn't check' and is not counted as done, whatever the others say", async () => {
    await open(world({ goals: [{ id: 1 }], fail: ["/budgets"] }));
    assert.equal(step("budget").dataset.smState, "unknown");
    assert.match(text(step("budget")), /Couldn't check/);
    assert.ok(q("[data-sm-note='unknown-step']", step("budget")));
    assert.equal(q("[data-sm-progress]").dataset.smProgress, "3/4", "the unknown one is not counted");
    assert.match(text(q("[data-sm-note='unknown']")), /1 couldn't be checked/);
    assert.equal(q("[data-sm-section='done']"), null, "never 'all set' while a step could not be read");
    assert.ok(q("[data-sm-action='setup-budget']"), "it can still be set up");
  });

  it("an answer about another workspace is not trusted: that step is unknown, never done", async () => {
    await open(world({ scope: 2 }));
    assert.equal(step("transaction").dataset.smState, "unknown");
    assert.equal(q("[data-sm-progress]").dataset.smProgress, "2/4");
  });

  it("with no workspace nothing is read and nothing is called done", async () => {
    await open(world(), { workspace: null });
    assert.deepEqual(api.calls, []);
    assert.equal(qa("[data-sm-state='unknown']").length, 4);
    assert.match(text(q("[data-sm-note='unknown']")), /couldn't tell which workspace/);
    assert.equal(q("[data-sm-action='recheck']"), null, "nothing to check again");
  });

  it("Check again reads the four again", async () => {
    await open(world());
    const before = api.calls.length;
    await click(q("[data-sm-action='recheck']"));
    await settle();
    assert.equal(api.calls.length, before + 4);
  });

  it("is reachable from More and from Search, and Home is not cluttered with it", async () => {
    await open(world());
    await view.unmount();
    view = null;
    api.restore();
    api = installFakeApi(world());
    view = await mountMobile({ entry: "/m/more" });
    assert.equal(q("main a[href='/m/getting-started']").textContent.includes("Getting started"), true);
    await view.unmount();
    view = null;

    api.restore();
    api = installFakeApi(world());
    view = await mountMobile({ entry: "/m/search" });
    await change(q("main input"), "getting started");
    await settle();
    assert.ok(q("main a[href='/m/getting-started']"));
    await view.unmount();
    view = null;

    api.restore();
    api = installFakeApi(world());
    view = await mountMobile({ entry: "/m" });
    assert.equal(qa("a[href='/m/getting-started']").length, 0, "no card, banner or link on Home");
  });

  it("reads in Arabic, and the title follows the language", async () => {
    await i18n.changeLanguage("ar");
    try {
      await open(world());
      assert.equal(q(".sm-bar-title").textContent, "البدء");
      assert.match(text(q("[data-sm-section='progress']")), /اكتمل 3 من 4/);
      assert.match(text(step("goal")), /ابدأ هدف ادخار/);
    } finally {
      await i18n.changeLanguage("en");
    }
  });
});
