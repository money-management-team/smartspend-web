import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h, useEffect } from "react";

import { flush, installDom, render } from "./helpers/dom.mjs";

/*
 * The shared AuthProvider and another tab. A sign-out or a sign-in as someone
 * else in another tab changes the token this tab's requests send (apiRequest
 * reads storage on every call); the provider must follow, and nothing under it
 * may keep what it read for the earlier identity. Fictional users and tokens.
 */

const dom = installDom();
const { window } = dom;
after(() => window.close());
// In a browser `globalThis` is the window: the provider's storage, storage events and pageshow come from it.
for (const key of ["localStorage", "sessionStorage", "StorageEvent"]) Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.removeEventListener = window.removeEventListener.bind(window);

const { default: AuthProvider } = await import("../src/contexts/auth/authProvider.jsx");
const { useAuthContext } = await import("../src/contexts/auth/useAuthContext.js");
const { crossTabChange } = await import("../src/contexts/auth/crossTabSession.js");

const USER_A = { id: 1, name: "Alex Example", role: "user" };
const USER_B = { id: 2, name: "Blake Example", role: "user" };

let mounts = 0;
let calls = [];
let view;

function Probe() {
  const auth = useAuthContext();
  useEffect(() => {
    mounts += 1;
  }, []);
  return h("output", { id: "auth" }, `${auth.initializing ? "init" : "ready"}|${auth.token ?? "none"}|${auth.user?.name ?? "nobody"}`);
}

const shown = () => window.document.getElementById("auth").textContent;
const store = (token, user, workspace) => {
  window.localStorage.setItem("ACCESS_TOKEN", token);
  window.localStorage.setItem("user", JSON.stringify(user));
  if (workspace) window.localStorage.setItem("workspace", JSON.stringify(workspace));
};
// What another tab's write looks like here: storage changes, then this tab hears about it.
const otherTab = async (key, newValue, oldValue = null) => {
  if (newValue === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, newValue);
  window.dispatchEvent(new window.StorageEvent("storage", { key, newValue, oldValue, storageArea: window.localStorage }));
  for (let turn = 0; turn < 10; turn += 1) await flush();
};

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mounts = 0;
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const token = (init.headers?.Authorization ?? "").replace("Bearer ", "");
    calls.push({ path: new URL(String(url), "http://x").pathname, method: init.method ?? "GET", token });
    const user = token === "token-b" ? USER_B : USER_A;
    return new Response(JSON.stringify({ status: true, message: "ok", data: { user, workspace: { id: token === "token-b" ? 2 : 1 } } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  store("token-a", USER_A, { id: 1 });
  view = await render(h(AuthProvider, null, h(Probe)));
  for (let turn = 0; turn < 10; turn += 1) await flush();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("another tab and this tab's session", () => {
  it("starts as the stored person, confirmed by GET /user", () => {
    assert.equal(shown(), "ready|token-a|Alex Example");
    assert.equal(mounts, 1);
    assert.deepEqual(calls.map((call) => `${call.method} ${call.path} ${call.token}`), ["GET /api/user token-a"]);
  });

  it("a sign-out elsewhere signs this tab out, and nothing is sent to the server from here", async () => {
    window.localStorage.removeItem("user");
    await otherTab("ACCESS_TOKEN", null, "token-a");

    assert.equal(shown(), "ready|none|nobody");
    assert.equal(calls.length, 1, "no logout request from this tab: the other tab already signed out");
    assert.equal(mounts, 2, "the pages below were mounted again: nothing read for Alex is kept");
  });

  it("a sign-in as someone else elsewhere: this tab becomes that person, re-reads GET /user with the new token, and remounts", async () => {
    window.localStorage.setItem("user", JSON.stringify(USER_B));
    await otherTab("ACCESS_TOKEN", "token-b", "token-a");

    assert.equal(shown(), "ready|token-b|Blake Example");
    assert.equal(mounts, 2);
    assert.deepEqual(calls.map((call) => call.token), ["token-a", "token-b"]);
  });

  it("while the new person is being confirmed the provider says it is initializing (the guards show Loading, not the old pages)", async () => {
    let release;
    globalThis.fetch = () => new Promise((resolve) => { release = () => resolve(new Response(JSON.stringify({ status: true, data: { user: USER_B } }), { status: 200, headers: { "content-type": "application/json" } })); });
    window.localStorage.setItem("user", JSON.stringify(USER_B));
    await otherTab("ACCESS_TOKEN", "token-b", "token-a");

    assert.equal(shown(), "init|token-b|Blake Example");
    release();
    for (let turn = 0; turn < 10; turn += 1) await flush();
    assert.equal(shown(), "ready|token-b|Blake Example");
  });

  it("another tab moving the session to a different workspace remounts; writing the same workspace again does not", async () => {
    await otherTab("workspace", JSON.stringify({ id: 1, name: "renamed" }), JSON.stringify({ id: 1 }));
    assert.equal(mounts, 1);
    await otherTab("workspace", JSON.stringify({ id: 7 }), JSON.stringify({ id: 1 }));
    assert.equal(mounts, 2);
    assert.equal(shown(), "ready|token-a|Alex Example");
  });

  it("after another tab's workspace switch, the re-read of GET /user does not write its workspace back over that choice", async () => {
    await otherTab("workspace", JSON.stringify({ id: 7 }), JSON.stringify({ id: 1 }));
    assert.equal(calls.length, 2, "the person is confirmed again");
    assert.equal(JSON.parse(window.localStorage.getItem("workspace")).id, 7, "the other tab's workspace stays");
  });

  it("a sign-in elsewhere still takes the new person's workspace from GET /user", async () => {
    window.localStorage.setItem("user", JSON.stringify(USER_B));
    await otherTab("ACCESS_TOKEN", "token-b", "token-a");
    assert.equal(JSON.parse(window.localStorage.getItem("workspace")).id, 2);
  });

  it("a profile edit elsewhere (same token, same person) and keys that are not the session's change nothing", async () => {
    await otherTab("user", JSON.stringify({ ...USER_A, name: "Alex E." }), JSON.stringify(USER_A));
    await otherTab("theme", "dark");
    await otherTab("i18nextLng", "ar");
    assert.equal(mounts, 1);
    assert.equal(calls.length, 1);
  });
});

describe("the decision on its own", () => {
  it("covers every case", () => {
    const e = (key, newValue = null, oldValue = null) => ({ key, newValue, oldValue });
    assert.equal(crossTabChange(e("ACCESS_TOKEN"), "a", null), "signed-out");
    assert.equal(crossTabChange(e(null), "a", null), "signed-out", "storage.clear() elsewhere");
    assert.equal(crossTabChange(e("ACCESS_TOKEN", "b"), "a", "b"), "switched");
    assert.equal(crossTabChange(e("ACCESS_TOKEN", "b"), null, "b"), "switched", "signed in elsewhere while signed out here");
    assert.equal(crossTabChange(e("workspace", "{\"id\":2}", "{\"id\":1}"), "a", "a"), "switched");
    assert.equal(crossTabChange(e("workspace", "{\"id\":1}", null), "a", "a"), null, "a first write is not a switch");
    assert.equal(crossTabChange(e("workspace", "{\"id\":2}", "{\"id\":1}"), null, null), null, "a signed-out tab ignores workspace writes");
    assert.equal(crossTabChange(e("user", "{}"), "a", "a"), null);
    assert.equal(crossTabChange(e("theme", "dark"), "a", null), null, "not a session key");
  });
});
