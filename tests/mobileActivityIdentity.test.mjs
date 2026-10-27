import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { envelope, failure, installFakeApi, tx, transactionsBackend } from "./helpers/mobileApi.mjs";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, clearSessionStorage, dom, location, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Identity safety for Activity and a transaction's page: private records must
 * leave the screen the moment the signed-in identity stops being consistent,
 * and a response must never be shown to an identity other than the one whose
 * token sent it.
 */

after(() => dom.window.close());

const rowsFor = (token) =>
  token === TOKEN_B
    ? [tx(900, { description: "Bravo private payment", amount: "777.0000", ledger_entries: [] })]
    : Array.from({ length: 45 }, (_, index) => tx(index + 1, { description: index === 0 ? "Alpha private payment" : `Alpha row ${index + 1}`, occurred_at: `2026-10-${String(20 - (index % 15)).padStart(2, "0")}T10:00:00.000000Z` }));
const tokenOf = (call) => (call.auth === `Bearer ${TOKEN_B}` ? TOKEN_B : TOKEN_A);
const backend = (call) => transactionsBackend(rowsFor(tokenOf(call)))(call);
const SECRETS = /Alpha private payment|Alpha row|Bravo private payment|45\.25|777/;

let api;
let view;
const identityScreen = () => q("[data-sm-identity]");
const button = (label) => qa("button", q("main")).find((item) => item.textContent.trim() === label);

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

describe("Activity under a changing identity", () => {
  it("loads the list for A with A's token", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    assert.match(q("main").textContent, /Alpha private payment/);
    assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
  });

  it("another tab signs out: every record is removed at once and nothing more is requested", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    const before = api.calls.length;

    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(qa("[data-sm-tx]").length, 0);
    assert.equal(api.calls.length, before);
  });

  it("another tab signs in as B: A's records are removed and B's token is never used", async () => {
    view = await mountMobile({ entry: "/m/activity?type=expense" });

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
  });

  it("the filter sheet and its choices go too", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    await click(q(".sm-toolbar button"));
    await settle();
    assert.ok(q("[role='dialog']"));

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(q("[role='dialog']"), null);
    assert.equal(q("select"), null);
  });

  it("a list request in flight when the identity changes: its answer is never shown", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    view = await mountMobile({ entry: "/m/activity" });
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "loading");

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("while a later page is loading: page 1 goes with the rest, and the late page is never shown", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    assert.match(q("main").textContent, /Alpha private payment/);

    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" && call.query.page === "2" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    await click(button("Load more"));
    await settle(3);

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.ok(identityScreen());
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(qa("[data-sm-tx]").length, 0);
  });

  it("a refresh in flight when the identity changes: the rows on screen and the answer both go", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    await click(button("Refresh"));
    await settle(2);

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.ok(identityScreen());
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("a session-only login here, then a 'remember me' login elsewhere: Activity fails closed, and B's token is not used", async () => {
    clearSessionStorage();
    storeSession({ token: TOKEN_A, user: USER_A, where: "session" });
    view = await mountMobile({ entry: "/m/activity" });
    assert.match(q("main").textContent, /Alpha private payment/);

    storeSession({ token: TOKEN_B, user: USER_B, where: "local" });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
  });

  it("blocked storage: nothing is requested and nothing is shown", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    const before = api.calls.length;
    const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() {}, removeItem() {}, key: () => null, length: 0 };
    const originals = [globalThis.localStorage, globalThis.sessionStorage];

    Object.defineProperty(globalThis, "localStorage", { value: blocked, configurable: true, writable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: blocked, configurable: true, writable: true });
    try {
      window.dispatchEvent(new window.Event("focus"));
      await settle();
      assert.equal(identityScreen().dataset.smIdentity, "storage-unavailable");
      assert.doesNotMatch(document.body.textContent, SECRETS);
      assert.equal(api.calls.length, before);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: originals[0], configurable: true, writable: true });
      Object.defineProperty(globalThis, "sessionStorage", { value: originals[1], configurable: true, writable: true });
    }
  });
});

describe("a transaction's page under a changing identity", () => {
  it("another tab signs in as B: the record, its ledger lines and its notes go", async () => {
    view = await mountMobile({ entry: "/m/activity/1" });
    assert.match(q("main").textContent, /Alpha private payment/);

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
  });

  it("a detail request in flight when the identity changes: its answer is never shown", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions/1" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    view = await mountMobile({ entry: "/m/activity/1" });

    clearSessionStorage();
    release();
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("a 401 on the record shows the session ended, then Mobile follows the app to sign-in with nothing left", async () => {
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions/1" ? failure(401, "Unauthenticated.") : backend(call)));
    view = await mountMobile({ entry: "/m/activity/1" });

    assert.equal(q("[data-sm-error]").dataset.smError, "session");
    await view.setAuth({ isAuthenticated: false, initializing: false, token: null, user: null });
    await settle();

    assert.equal(location(), "/signin");
    assert.equal(q("[data-sm-screen]"), null);
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });
});

describe("a new session in the same tab", () => {
  it("starts with nothing of the previous one: A's rows never reappear while B's load, and only B's token is used afterwards", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    assert.match(q("main").textContent, /Alpha private payment/);

    let releaseB;
    api.restore();
    api = installFakeApi((call) => (call.auth === `Bearer ${TOKEN_B}` && call.path === "/transactions" ? new Promise((resolve) => { releaseB = () => resolve(backend(call)); }) : backend(call)));

    clearSessionStorage();
    storeSession({ token: TOKEN_B, user: USER_B });
    await view.setAuth({ isAuthenticated: true, initializing: false, token: TOKEN_B, user: USER_B, workspace: { id: 2 } });
    await settle(3);

    assert.doesNotMatch(document.body.textContent, /Alpha/);
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "loading");

    releaseB();
    await settle();
    assert.match(q("main").textContent, /Bravo private payment/);
    assert.doesNotMatch(q("main").textContent, /Alpha/);
    assert.equal(api.calls.every((call) => call.auth === `Bearer ${TOKEN_B}`), true, "after B's session starts, A's token is not used");
    assert.match(q("main").textContent, /Showing 1 of 1/, "B's list does not inherit A's count or pages");
  });

  it("does not show A's transaction under B: the same id is asked for again, with B's token", async () => {
    view = await mountMobile({ entry: "/m/activity/1" });
    assert.match(q("main").textContent, /Alpha private payment/);

    clearSessionStorage();
    storeSession({ token: TOKEN_B, user: USER_B });
    await view.setAuth({ isAuthenticated: true, initializing: false, token: TOKEN_B, user: USER_B, workspace: { id: 2 } });
    await settle();

    assert.doesNotMatch(document.body.textContent, /Alpha/);
    assert.equal(q("[data-sm-error]").dataset.smError, "notFound", "B has no transaction 1");
  });
});

describe("leaving", () => {
  it("a response that arrives after the screen was left is dropped", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions/1" ? new Promise((resolve) => { release = () => resolve(backend(call)); }) : backend(call)));
    view = await mountMobile({ entry: "/m/activity/1" });

    await click(qa("nav.sm-nav a").find((link) => link.textContent.trim() === "More"));
    await settle();
    release();
    await settle();

    assert.equal(location(), "/m/more");
    assert.doesNotMatch(document.body.textContent, SECRETS);
  });

  it("makes no write and no storage entry about transactions", async () => {
    view = await mountMobile({ entry: "/m/activity" });
    await click(q("[data-sm-tx]"));
    await settle();

    assert.deepEqual(api.violations, []);
    const stored = JSON.stringify([window.localStorage, window.sessionStorage].map((storage) => Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`)));
    assert.doesNotMatch(stored, /Alpha|payment|45\.25|transaction/i);
    void envelope;
  });
});
