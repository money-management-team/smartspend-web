import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { IdentityError, createIdentityGuard, fingerprint, identityOf, readStoredIdentity } from "../src/mobile/identity/guard.js";
import { createResourceStore } from "../src/mobile/data/resourceStore.js";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, clearSessionStorage, dom, location, mountMobile, otherTabWrote, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { account, dashboard, failure, healthyBackend, installFakeApi, envelope } from "./helpers/mobileApi.mjs";

/*
 * Identity safety. The AuthProvider keeps "who is signed in" in memory; every
 * API request reads its token from storage when it is sent. These tests change
 * storage under a mounted Mobile screen the way another tab can, and check
 * that private figures are removed, nothing is requested under the wrong
 * identity, and a response from the previous identity is never shown.
 */

after(() => dom.window.close());

const A = { id: "1", name: "Alpha account" };
const accountsFor = (token) => (token === TOKEN_B ? [account({ id: 9, workspace_id: 2, name: "Bravo account", current_balance: "777.0000" })] : [account({ id: 1, name: A.name, current_balance: "1234.5000" })]);

describe("fingerprint", () => {
  it("tells two tokens apart, is stable, and does not contain the token", () => {
    assert.equal(fingerprint(TOKEN_A), fingerprint(TOKEN_A));
    assert.notEqual(fingerprint(TOKEN_A), fingerprint(TOKEN_B));
    assert.doesNotMatch(fingerprint(TOKEN_A), /token|user/);
    assert.notEqual(fingerprint("ab"), fingerprint("ba"));
    assert.notEqual(fingerprint(""), fingerprint("x"));
  });
});

describe("the identity guard (storage read injected)", () => {
  const stored = (over = {}) => ({ available: true, token: TOKEN_A, userId: 1, ...over });
  const guardFor = (read) => createIdentityGuard(identityOf(TOKEN_A, 1), { read });

  it("is fine while storage still holds this identity", () => {
    const guard = guardFor(() => stored());
    assert.equal(guard.check(), true);
    assert.doesNotThrow(() => guard.assert());
    assert.deepEqual(guard.getStatus(), { ok: true, reason: null });
  });

  for (const [reason, state] of [
    ["signed-out-elsewhere", { token: null, userId: null }],
    ["changed-elsewhere", { token: TOKEN_B }],
    ["changed-elsewhere", { userId: 2 }],
    ["storage-unavailable", { available: false, token: null, userId: null }],
  ]) {
    it(`fails closed with ${reason} when storage says ${JSON.stringify(state)}`, () => {
      const guard = guardFor(() => stored(state));
      let notified = 0;
      guard.subscribe(() => (notified += 1));

      assert.equal(guard.check(), false);
      assert.equal(guard.getStatus().reason, reason);
      assert.throws(() => guard.assert(), (error) => error instanceof IdentityError && error.reason === reason && error.code === "IDENTITY_CHANGED");
      assert.equal(notified, 1, "listeners hear about it once");
    });
  }

  it("never recovers by itself: a failure is latched even if storage later matches again", () => {
    let current = stored({ token: TOKEN_B });
    const guard = guardFor(() => current);

    assert.equal(guard.check(), false);
    current = stored();
    assert.equal(guard.check(), false);
    assert.throws(() => guard.assert(), IdentityError);
  });

  it("does not hold the token: only its fingerprint", () => {
    const identity = identityOf(TOKEN_A, 1);
    assert.equal(JSON.stringify(identity).includes(TOKEN_A), false);
  });
});

describe("readStoredIdentity reads storage the way the API client does", () => {
  beforeEach(() => resetEnvironment());

  it("prefers localStorage over sessionStorage, like getAuthToken", () => {
    storeSession({ token: TOKEN_A, user: USER_A, where: "session" });
    assert.equal(readStoredIdentity().token, TOKEN_A);

    storeSession({ token: TOKEN_B, user: USER_B, where: "local" });
    assert.deepEqual(readStoredIdentity(), { available: true, token: TOKEN_B, userId: 2 });
  });

  it("reports an empty but working storage as signed out, and a blocked one as unavailable", () => {
    assert.deepEqual(readStoredIdentity(), { available: true, token: null, userId: null });

    const blocked = { getItem() { throw new Error("SecurityError"); } };
    const originals = [globalThis.localStorage, globalThis.sessionStorage];
    Object.defineProperty(globalThis, "localStorage", { value: blocked, configurable: true, writable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: blocked, configurable: true, writable: true });
    try {
      assert.deepEqual(readStoredIdentity(), { available: false, token: null, userId: null });
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: originals[0], configurable: true, writable: true });
      Object.defineProperty(globalThis, "sessionStorage", { value: originals[1], configurable: true, writable: true });
    }
  });
});

describe("the resource store", () => {
  const okGuard = () => ({ assert() {}, check: () => true });
  const wait = () => new Promise((resolve) => setImmediate(resolve));

  it("keeps earlier figures as stale when a refresh fails with a transient error, and says so", async () => {
    const store = createResourceStore(okGuard(), { now: () => 100 });
    await store.load("k", async () => ({ n: 1 }));
    assert.equal(store.get("k").status, "ready");

    await store.load("k", async () => { throw Object.assign(new Error("x"), { code: "NETWORK_ERROR" }); });
    assert.equal(store.get("k").status, "stale");
    assert.deepEqual(store.get("k").data, { n: 1 });
    assert.equal(store.get("k").updatedAt, 100);
    assert.equal(store.get("k").error.code, "NETWORK_ERROR");
  });

  it("never keeps figures after the session ended, access was refused, or the thing is gone", async () => {
    for (const code of ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "WORKSPACE_UNAVAILABLE"]) {
      const store = createResourceStore(okGuard());
      await store.load("k", async () => ({ n: 1 }));
      await store.load("k", async () => { throw Object.assign(new Error("x"), { code }); });

      assert.equal(store.get("k").status, "error", code);
      assert.equal(store.get("k").data, undefined, code);
    }
  });

  it("shows no stale figures when the first read fails", async () => {
    const store = createResourceStore(okGuard());
    await store.load("k", async () => { throw Object.assign(new Error("x"), { code: "SERVER_ERROR" }); });

    assert.equal(store.get("k").status, "error");
    assert.equal(store.get("k").data, undefined);
  });

  it("goes through refreshing, keeping the previous figures on screen while it runs", async () => {
    const store = createResourceStore(okGuard());
    await store.load("k", async () => ({ n: 1 }));

    let release;
    const refresh = store.load("k", () => new Promise((resolve) => { release = () => resolve({ n: 2 }); }));
    assert.equal(store.get("k").status, "refreshing");
    assert.deepEqual(store.get("k").data, { n: 1 });

    release();
    await refresh;
    assert.deepEqual(store.get("k").data, { n: 2 });
  });

  it("asks the guard before sending and after the response, and throws the response away if identity changed in between", async () => {
    let ok = true;
    const asserts = [];
    const guard = { assert() { asserts.push(ok); if (!ok) throw new IdentityError("changed-elsewhere"); } };
    const store = createResourceStore(guard);

    let release;
    const running = store.load("k", () => new Promise((resolve) => { release = () => resolve({ secret: "user A's figures" }); }));
    await wait();
    assert.deepEqual(asserts, [true], "checked before the request");

    ok = false; // another tab signs in as someone else while the request is in flight
    release();
    await running;

    assert.deepEqual(asserts, [true, false], "checked again when the response arrived");
    assert.equal(store.get("k").status, "loading", "the response was never stored");
    assert.equal(store.get("k").data, undefined);
  });

  it("does not send a request at all when the identity is already wrong", async () => {
    const guard = { assert() { throw new IdentityError("signed-out-elsewhere"); } };
    const store = createResourceStore(guard);
    let sent = 0;

    await store.load("k", async () => { sent += 1; return {}; });
    assert.equal(sent, 0);
  });

  it("dispose() drops every figure, cancels what is running, and ignores late results", async () => {
    const store = createResourceStore(okGuard());
    await store.load("done", async () => ({ n: 1 }));

    let signal;
    let release;
    const running = store.load("slow", (s) => { signal = s; return new Promise((resolve) => { release = () => resolve({ late: true }); }); });
    await wait();

    store.dispose();
    assert.equal(signal.aborted, true);
    assert.equal(store.get("done").status, "idle");
    assert.equal(store.get("done").data, undefined);

    release();
    await running;
    assert.equal(store.get("slow").status, "idle", "the late result is not stored");
    assert.equal(store.isDisposed(), true);
    await store.load("again", async () => ({ n: 2 }));
    assert.equal(store.get("again").status, "idle", "a disposed store never loads again");
  });

  it("clear() is reusable (React may replay effects), dispose() is not", async () => {
    const store = createResourceStore(okGuard());
    await store.load("k", async () => ({ n: 1 }));
    store.clear();
    assert.equal(store.get("k").status, "idle");

    await store.load("k", async () => ({ n: 3 }));
    assert.deepEqual(store.get("k").data, { n: 3 });
  });

  it("shares one request between two callers asking for the same key at once", async () => {
    const store = createResourceStore(okGuard());
    let sent = 0;
    const loader = async () => { sent += 1; return {}; };

    await Promise.all([store.load("k", loader), store.load("k", loader)]);
    assert.equal(sent, 1);
  });
});

/* ---------- The Mobile screens under a changing identity ---------- */

describe("cross-tab identity: a mounted Mobile screen", () => {
  let api;
  let view;

  const backend = (call) => healthyBackend({ accounts: accountsFor(call.auth === `Bearer ${TOKEN_B}` ? TOKEN_B : TOKEN_A) })(call);

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

  const showsAccountA = () => q("main")?.textContent.includes(A.name) && q("main").textContent.includes("1,234.50");
  const identityScreen = () => q("[data-sm-identity]");

  it("loads Accounts for user A with A's token, and nothing else", async () => {
    view = await mountMobile({ entry: "/m/accounts" });

    assert.ok(showsAccountA());
    assert.deepEqual(api.summary(), ["GET /accounts"]);
    assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
    assert.deepEqual(api.violations, []);
  });

  it("A -> another tab signs out: the figures are removed at once and nothing more is requested", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    assert.ok(showsAccountA());
    const before = api.calls.length;

    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
    assert.equal(q("main"), null, "the whole shell is gone");
    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/);
    assert.match(identityScreen().textContent, /signed out in another tab/);
    assert.equal(qa("button", identityScreen()).map((button) => button.textContent).join(), "Reload");
    assert.equal(api.calls.length, before, "no request after the change");
  });

  it("A -> another tab signs in as B: A's figures are removed and no request is ever made with B's token", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    assert.ok(showsAccountA());

    storeSession({ token: TOKEN_B, user: USER_B });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
    assert.doesNotMatch(document.body.textContent, /Alpha account|Bravo account|1,234\.50|777/);
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false, "B's token was never used by this screen");
  });

  it("a different user id alone (same token slot rewritten with another user) also fails closed", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    window.localStorage.setItem("user", JSON.stringify(USER_B));
    otherTabWrote("user", JSON.stringify(USER_B));
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
  });

  it("a request already in flight when the identity changes: its response is never shown", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => new Promise((resolve) => {
      release = () => resolve({ body: envelope({ accounts: accountsFor(TOKEN_A) }) });
      void call;
    }));

    view = await mountMobile({ entry: "/m/accounts" });
    assert.equal(q("[data-sm-state='loading']") !== null, true, "still waiting for the response");

    storeSession({ token: TOKEN_B, user: USER_B }); // the switch happens; no event reached this tab yet
    release();
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere", "the response arrival re-checks identity");
    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/);
  });

  it("a switch while a refresh is running: the figures already on screen go too", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    assert.ok(showsAccountA());

    let release;
    api.restore();
    api = installFakeApi(() => new Promise((resolve) => { release = () => resolve({ body: envelope({ accounts: accountsFor(TOKEN_A) }) }); }));

    const refresh = qa("button", q("main")).find((button) => button.textContent === "Refresh");
    refresh.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle(2);

    storeSession({ token: TOKEN_B, user: USER_B });
    release();
    await settle();

    assert.ok(identityScreen());
    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/);
  });

  it("an event for an unrelated storage key does not disturb the screen", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    window.localStorage.setItem("theme", "dark");
    otherTabWrote("theme", "dark");
    await settle();

    assert.equal(identityScreen(), null);
    assert.ok(showsAccountA());
  });

  it("is caught when the tab comes back to the foreground even if no storage event arrived", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    storeSession({ token: TOKEN_B, user: USER_B });
    window.dispatchEvent(new window.Event("focus"));
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "changed-elsewhere");
  });

  it("is caught on visibilitychange and on pageshow too", async () => {
    for (const dispatch of [() => document.dispatchEvent(new window.Event("visibilitychange")), () => window.dispatchEvent(new window.Event("pageshow"))]) {
      await resetEnvironment();
      storeSession({ token: TOKEN_A, user: USER_A });
      view = await mountMobile({ entry: "/m/accounts" });

      clearSessionStorage();
      dispatch();
      await settle();

      assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
      await view.unmount();
      view = null;
    }
  });

  it("a storage clear() in another tab (key null) removes the figures: the presentation choice goes with it, so the page leaves Mobile", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    window.localStorage.clear();
    otherTabWrote(null);
    await settle();

    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234.50/);
    assert.equal(q("[data-sm-screen='accounts']"), null);
    assert.equal(api.calls.length, 1, "nothing was requested after the clear");
  });

  it("the same clear with the presentation choice kept is a sign-out on screen", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    const choice = window.localStorage.getItem("smartspend:presentation:v1");
    window.localStorage.clear();
    window.localStorage.setItem("smartspend:presentation:v1", choice);
    otherTabWrote(null);
    await settle();

    assert.equal(identityScreen().dataset.smIdentity, "signed-out-elsewhere");
  });

  it("stays failed: restoring the old token in storage does not bring the screen back", async () => {
    view = await mountMobile({ entry: "/m/accounts" });
    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();
    assert.ok(identityScreen());

    storeSession({ token: TOKEN_A, user: USER_A });
    otherTabWrote("ACCESS_TOKEN", TOKEN_A);
    await settle();

    assert.ok(identityScreen(), "only a reload starts again");
    assert.doesNotMatch(document.body.textContent, /Alpha account/);
  });
});

describe("persistent versus session-only sessions", () => {
  let api;
  let view;

  beforeEach(async () => {
    await resetEnvironment();
    api = installFakeApi((call) => healthyBackend({ accounts: accountsFor(call.auth === `Bearer ${TOKEN_B}` ? TOKEN_B : TOKEN_A) })(call));
  });

  afterEach(async () => {
    await view?.unmount();
    view = null;
    api.restore();
  });

  it("a session-only login (sessionStorage) is not changed by another tab's session-only login: there is nothing to see, and nothing is claimed", async () => {
    storeSession({ token: TOKEN_A, user: USER_A, where: "session" });
    view = await mountMobile({ entry: "/m/accounts" });

    // Another tab's sessionStorage is a different area; this tab gets no event and storage is unchanged.
    window.dispatchEvent(new window.Event("focus"));
    await settle();

    assert.equal(q("[data-sm-identity]"), null);
    assert.match(q("main").textContent, /Alpha account/);
    assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
  });

  it("a session-only login here, then a 'remember me' login elsewhere: localStorage wins for requests, so Mobile fails closed", async () => {
    storeSession({ token: TOKEN_A, user: USER_A, where: "session" });
    view = await mountMobile({ entry: "/m/accounts" });

    storeSession({ token: TOKEN_B, user: USER_B, where: "local" });
    otherTabWrote("ACCESS_TOKEN", TOKEN_B);
    await settle();

    assert.equal(q("[data-sm-identity]").dataset.smIdentity, "changed-elsewhere");
    assert.equal(api.calls.some((call) => call.auth === `Bearer ${TOKEN_B}`), false);
  });

  it("a persistent login here, then another tab's session-only login (which clears localStorage): fails closed as signed out", async () => {
    storeSession({ token: TOKEN_A, user: USER_A, where: "local" });
    view = await mountMobile({ entry: "/m/accounts" });

    // persistAuthSession() in the other tab clears the shared localStorage entries first.
    clearSessionStorage();
    otherTabWrote("ACCESS_TOKEN", null);
    await settle();

    assert.equal(q("[data-sm-identity]").dataset.smIdentity, "signed-out-elsewhere");
  });

  it("a persistent login here and a persistent login as the same user and token elsewhere changes nothing", async () => {
    storeSession({ token: TOKEN_A, user: USER_A, where: "local" });
    view = await mountMobile({ entry: "/m/accounts" });

    storeSession({ token: TOKEN_A, user: USER_A, where: "local" });
    otherTabWrote("ACCESS_TOKEN", TOKEN_A);
    await settle();

    assert.equal(q("[data-sm-identity]"), null);
  });
});

describe("storage unavailable", () => {
  it("fails closed before asking for anything when the browser blocks storage", async () => {
    await resetEnvironment();
    const api = installFakeApi(healthyBackend());
    const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() {}, key() { return null; }, length: 0 };
    const originals = [globalThis.localStorage, globalThis.sessionStorage];
    let view;

    try {
      // The app's providers need a working localStorage to mount; block it for Mobile's reads only after mounting the shell.
      storeSession({ token: TOKEN_A, user: USER_A });
      view = await mountMobile({ entry: "/m/more" });
      Object.defineProperty(globalThis, "localStorage", { value: blocked, configurable: true, writable: true });
      Object.defineProperty(globalThis, "sessionStorage", { value: blocked, configurable: true, writable: true });
      window.dispatchEvent(new window.Event("focus"));
      await settle();

      assert.equal(q("[data-sm-identity]").dataset.smIdentity, "storage-unavailable");
      assert.match(q("[data-sm-identity]").textContent, /blocking the storage/);
      assert.deepEqual(api.calls, []);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: originals[0], configurable: true, writable: true });
      Object.defineProperty(globalThis, "sessionStorage", { value: originals[1], configurable: true, writable: true });
      await view?.unmount();
      api.restore();
    }
  });
});

describe("session end and a new session", () => {
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

  it("a 401 during a read removes the figures, says the session ended, and Mobile follows the app to sign-in", async () => {
    api = installFakeApi((call) => (call.path === "/accounts" ? failure(401, "Unauthenticated.") : healthyBackend()(call)));
    view = await mountMobile({ entry: "/m/accounts" });

    assert.equal(q("[data-sm-error]").dataset.smError, "session");
    assert.match(q("main").textContent, /session has ended/);
    assert.equal(q("[data-sm-error] button"), null, "no retry for a session that ended");
    assert.doesNotMatch(q("main").textContent, /Alpha account/);

    // apiClient also cleared the session and the AuthProvider reacts to that event.
    await view.setAuth({ isAuthenticated: false, initializing: false, token: null, user: null });
    await settle();

    assert.equal(location(), "/m/signin", "Mobile sign-in (auth/guards.jsx): a Mobile visitor stays in Mobile");
    assert.deepEqual(qa("[data-sm-screen]").map((node) => node.dataset.smScreen), ["signin"], "no Mobile screen left but sign-in");
  });

  it("a 401 on a refresh drops the figures that were on screen (they are not kept as stale)", async () => {
    let expire = false;
    api = installFakeApi((call) => (call.path === "/accounts" && expire ? failure(401, "Unauthenticated.") : healthyBackend({ accounts: accountsFor(TOKEN_A) })(call)));
    view = await mountMobile({ entry: "/m/accounts" });
    assert.match(q("main").textContent, /Alpha account/);

    expire = true;
    qa("button", q("main")).find((button) => button.textContent === "Refresh").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await settle();

    assert.equal(q("[data-sm-error]").dataset.smError, "session");
    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/);
  });

  it("a new session in the same tab starts with nothing from the previous one, and the previous figures never reappear while the new ones load", async () => {
    let releaseB;
    api = installFakeApi((call) => {
      if (call.auth === `Bearer ${TOKEN_B}` && call.path === "/accounts") return new Promise((resolve) => { releaseB = () => resolve({ body: envelope({ accounts: accountsFor(TOKEN_B) }) }); });
      return healthyBackend({ accounts: accountsFor(TOKEN_A) })(call);
    });
    view = await mountMobile({ entry: "/m/accounts" });
    assert.match(q("main").textContent, /Alpha account/);

    // Sign-in as B in this tab: the AuthProvider writes the new session and swaps the context value.
    clearSessionStorage();
    storeSession({ token: TOKEN_B, user: USER_B });
    await view.setAuth({ isAuthenticated: true, initializing: false, token: TOKEN_B, user: USER_B, workspace: { id: 2 } });
    await settle(3);

    assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/, "A's figures are gone while B's are still loading");
    assert.equal(q("[data-sm-state='loading']") !== null, true);

    releaseB();
    await settle();

    assert.match(q("main").textContent, /Bravo account/);
    assert.doesNotMatch(q("main").textContent, /Alpha account/);
    const bCalls = api.calls.filter((call) => call.auth === `Bearer ${TOKEN_B}`);
    assert.ok(bCalls.length > 0);
    assert.equal(api.calls.filter((call) => call.auth === `Bearer ${TOKEN_A}`).some((call) => api.calls.indexOf(call) > api.calls.indexOf(bCalls[0])), false, "A's token is not used after B's session starts");
  });
});

describe("session restore is its own state", () => {
  it("while the app is still restoring the session, Mobile shows the guard's loading state, reads nothing and shows no figure; the read starts only once the session is known", async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A });
    const api = installFakeApi(healthyBackend({ accounts: accountsFor(TOKEN_A) }));
    const restoring = { isAuthenticated: true, initializing: true, token: TOKEN_A, user: null };
    const view = await mountMobile({ entry: "/m/accounts", auth: restoring });

    try {
      assert.deepEqual(api.calls, [], "nothing is requested while the session is being restored");
      assert.equal(q("main"), null, "no Mobile shell yet");
      assert.doesNotMatch(document.body.textContent, /Alpha account|1,234\.50/);

      await view.setAuth({ ...restoring, initializing: false, user: USER_A, workspace: { id: 1 } });
      await settle();

      assert.match(q("main").textContent, /Alpha account/);
      assert.deepEqual(api.summary(), ["GET /accounts"]);
    } finally {
      await view.unmount();
      api.restore();
    }
  });
});

describe("what Mobile keeps", () => {
  it("writes nothing to storage about the session or the data, and no second auth context exists", async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A });
    const api = installFakeApi(healthyBackend());
    const snapshot = () => ({ local: Object.fromEntries(Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(window.sessionStorage).map((key) => [key, window.sessionStorage.getItem(key)])) });
    const view = await mountMobile({ entry: "/m" });
    await settle();
    const before = snapshot();

    // Visit Accounts as well: both screens read, neither may store.
    qa("a", q("main")).find((link) => link.getAttribute("href") === "/m/accounts").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await settle();
    assert.equal(location(), "/m/accounts");
    const after = snapshot();
    await view.unmount();
    api.restore();

    assert.deepEqual(after, before, "reading data changes no storage");
    const everything = JSON.stringify(after);
    assert.equal(everything.includes("1,234"), false);
    assert.equal(everything.includes("1234.5000"), false, "no financial payload is stored");
    assert.equal(Object.keys(after.session).length, 0);
    assert.equal(Object.keys(after.local).filter((key) => /fingerprint|identity|mobile:data|cache/i.test(key)).length, 0);
  });
});
