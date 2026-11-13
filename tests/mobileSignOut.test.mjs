import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { act } from "react";

import { change, click, submit } from "./helpers/dom.mjs";
import { account, envelope, healthyBackend } from "./helpers/mobileApi.mjs";
import { TOKEN_A, TOKEN_B, USER_A, USER_B, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";

const { rememberScroll, recallScroll } = await import("../src/mobile/activity/scrollMemory.js");
const { MOBILE_WRITES, isWriteOpen } = await import("../src/mobile/data/writeGate.js");
const { clearSignOutNotice } = await import("../src/mobile/auth/signOutNotice.js");

/*
 * Phase: Mobile sign-out. One real "Sign out" button in Profile, through the app's own AuthProvider (the full version's
 * logout: POST /logout, the stored session cleared, the other tabs following). Tested here against a local fake server
 * only, with the real provider: what is cleared, where it returns to, Back and reload, a second account, a duplicate
 * tap, a failed request, and what Mobile says (and does not claim) about the server.
 */

after(() => dom.window.close());

// In a browser `globalThis` is the window: the AuthProvider's storage listener (another tab signing out) hears the
// window's events. Node has no such global, so it is bound here, as tests/authCrossTab.test.mjs does.
globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);

let server;
let view;
const text = (root = document.body) => root.textContent.replace(/\s+/g, " ");
const WORKSPACE = { id: 1, name: "Home", base_currency_code: "ILS", timezone: "UTC" };

/*
 * A fake backend for two fictional people, told apart by the token each request carries. `logout` decides what POST
 * /logout answers: "ok", 401, 500, "network" (the request never arrives) or "hang" (it waits until `release()`).
 */
function fakeServer({ logout = "ok" } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  const people = { [TOKEN_A]: { user: USER_A, reads: healthyBackend({ accounts: [account({ id: 1, name: "Alex wallet" })] }) }, [TOKEN_B]: { user: USER_B, reads: healthyBackend({ accounts: [account({ id: 2, name: "Blake savings" })] }) } };
  const state = { release: null };

  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url), "http://localhost");
    const path = parsed.pathname.replace(/^\/api/, "");
    const method = String(init.method ?? "GET").toUpperCase();
    const token = String(init.headers?.Authorization ?? "").replace("Bearer ", "") || null;
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, token, body });
    const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

    if (method === "POST" && path === "/logout") {
      if (logout === "network") throw new TypeError("Failed to fetch");
      if (logout === "hang") await new Promise((resolve) => { state.release = resolve; });
      if (logout === 401) return reply(401, { status: false, message: "Unauthenticated.", errors: {} });
      if (logout === 500) return reply(500, { status: false, message: "Server error", errors: {} });
      return reply(200, envelope(null));
    }
    if (method === "POST" && path === "/login") {
      const who = String(body?.identifier).startsWith("blake") ? TOKEN_B : TOKEN_A;
      return reply(200, envelope({ token: who, user: people[who].user }));
    }

    const person = people[token];
    if (!person) return reply(401, { status: false, message: "Unauthenticated.", errors: {} });
    if (path === "/user") return reply(200, envelope({ user: person.user, workspace: WORKSPACE }));
    if (method !== "GET") return reply(500, { status: false, message: "unexpected", errors: {} });

    const answer = person.reads({ path, query: Object.fromEntries(parsed.searchParams) });
    return reply(answer?.status ?? 200, answer?.body ?? answer);
  };

  return { calls, release: () => state.release?.(), restore: () => { globalThis.fetch = original; }, writes: () => calls.filter((call) => call.method !== "GET") };
}

const signedInAs = (token = TOKEN_A, user = USER_A) => storeSession({ token, user, workspace: WORKSPACE });
const open = async (entry) => {
  view = await mountMobile({ entry, realAuth: true });
  await settle();
};
const signOutButton = () => q("[data-sm-action='sign-out']");
const stored = () => ({ token: window.localStorage.getItem("ACCESS_TOKEN"), user: window.localStorage.getItem("user"), workspace: window.localStorage.getItem("workspace") });
const signIn = async (identifier) => {
  await change(q("input[autocomplete='username']"), identifier);
  await change(q("input[autocomplete='current-password']"), "fictional-pass-1");
  await submit(q("[data-sm-form='signin']"));
  await settle();
};

beforeEach(async () => {
  await resetEnvironment();
  clearSignOutNotice();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  server?.restore();
  server = null;
});

describe("the Sign out action", () => {
  it("is one real, labelled button in its own Session group on Profile, and not a closed note", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");

    const group = q("[data-sm-group='session']");
    assert.ok(group);
    assert.equal(signOutButton().tagName, "BUTTON");
    assert.equal(signOutButton().getAttribute("type"), "button");
    assert.equal(signOutButton().textContent.trim(), "Sign out");
    assert.equal(signOutButton().disabled, false);
    assert.match(text(group), /Ends your session on this device and returns to sign-in/);
    assert.equal(q("[data-sm-note='sign-out-closed']"), null, "the old 'not available' note is gone");
    assert.equal(q("[data-sm-write='auth.logout']"), null, "and it is not a financial write gate entry");
    assert.equal(qa("[data-sm-action='sign-out']").length, 1);
  });

  it("does not go through the financial write gate, and the gate stays closed", () => {
    assert.equal(Object.keys(MOBILE_WRITES).some((operation) => isWriteOpen(operation)), false, "no operation is open");
    assert.equal(Object.hasOwn(MOBILE_WRITES, "auth.logout"), false, "and signing out is not one of the gated operations");
    const source = readFileSync(new URL("../src/mobile/auth/useSignOut.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /writeGate|assertWriteOpen|isWriteOpen|authApi|apiRequest|apiClient|fetch\(/, "it reuses the provider's logout and builds no request of its own");
    assert.match(source, /useAuthContext/);
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    server = fakeServer();
    signedInAs();
    await open("/m/profile");

    assert.equal(signOutButton().textContent.trim(), "تسجيل الخروج");
    assert.match(text(q("[data-sm-group='session']")), /ينهي جلستك على هذا الجهاز/);
  });
});

describe("signing out", () => {
  it("sends POST /logout with this session's token, clears the stored session, returns to sign-in and says it was confirmed", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    assert.deepEqual(server.writes().map((call) => `${call.method} ${call.path} ${call.token}`), [`POST /logout ${TOKEN_A}`]);
    assert.deepEqual(stored(), { token: null, user: null, workspace: null });
    assert.equal(location(), "/m/signin");
    assert.equal(q("[data-sm-signed-out]").dataset.smSignedOut, "confirmed");
    assert.match(text(q("[data-sm-signed-out]")), /You have been signed out\./);
    assert.equal(q("[data-sm-identity]"), null, "no 'your session changed' panel flashed on the way");
    assert.equal(q("[data-sm-screen='profile']"), null);
    assert.doesNotMatch(text(), /Alex Example|Alex wallet/, "nothing of the person is left on screen");
  });

  it("drops what Mobile held for the person: its pending-write keys, remembered scroll positions and loaded data", async () => {
    server = fakeServer();
    signedInAs();
    window.localStorage.setItem("smartspend:mobile:pending-write:v1:u:1:w:1:category.create", "{\"v\":\"v1\"}");
    window.localStorage.setItem("smartspend:mobile:pending-write:v1:u:2:w:1:category.create", "{\"v\":\"v1\"}");
    rememberScroll("activity:default", 480);
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    assert.equal(window.localStorage.getItem("smartspend:mobile:pending-write:v1:u:1:w:1:category.create"), null, "this person's pending key is gone");
    assert.notEqual(window.localStorage.getItem("smartspend:mobile:pending-write:v1:u:2:w:1:category.create"), null, "another person's is not touched");
    assert.equal(recallScroll("activity:default"), 0);
  });

  it("keeps device settings that are not the person's data (the presentation choice stays)", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    const before = window.localStorage.getItem("smartspend:presentation:v1");
    await click(signOutButton());
    await settle();

    assert.equal(before, "mobile");
    assert.equal(window.localStorage.getItem("smartspend:presentation:v1"), "mobile");
  });

  it("Back from sign-in does not show the previous person's pages, and a reload starts at sign-in", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/accounts");
    assert.match(text(q("main")), /Alex wallet/);
    await click(q("a[href='/m/more']"));
    await settle();
    await click(qa("a").find((item) => item.getAttribute("href") === "/m/profile"));
    await settle();
    await click(signOutButton());
    await settle();
    assert.equal(location(), "/m/signin");

    await act(async () => { view.router.navigate(-1); });
    await settle();
    assert.equal(location(), "/m/signin", "Back is sent straight back to sign-in");
    assert.doesNotMatch(text(), /Alex wallet|Alex Example/);
    assert.equal(server.calls.filter((call) => call.path === "/accounts" && call.token === TOKEN_A).length, 1, "no request is made for the old pages after sign-out");

    await view.unmount();
    view = null;
    await open("/m/accounts");
    assert.equal(location(), "/m/signin", "a reload: storage holds no session");
    assert.doesNotMatch(text(), /Alex wallet/);
  });

  it("a second account signing in afterwards starts at Home with its own data and its own token, never the previous person's", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();
    await signIn("blake@example.test");

    assert.equal(location(), "/m", "no return address is carried: not the Profile page the previous person left");
    assert.equal(q("[data-sm-signed-out]"), null);
    assert.equal(window.localStorage.getItem("ACCESS_TOKEN"), TOKEN_B);

    await click(q("a[href='/m/more']"));
    await settle();
    await click(qa("a").find((item) => item.getAttribute("href") === "/m/accounts"));
    await settle();
    assert.match(text(q("main")), /Blake savings/);
    assert.doesNotMatch(text(), /Alex wallet|Alex Example/);
    assert.equal(server.calls.filter((call) => call.token === TOKEN_A).every((call) => call.path === "/user" || call.path === "/logout" || call.path === "/notifications/preferences" || call.method === "GET"), true);
    assert.equal(server.calls.slice(server.calls.findIndex((call) => call.path === "/logout") + 1).some((call) => call.token === TOKEN_A), false, "after sign-out, no request carries the old token");
  });

  it("the same person signing in again also starts at Home", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();
    await signIn("alex@example.test");
    assert.equal(location(), "/m");
  });
});

describe("a double tap and a failing network", () => {
  it("two taps in the same moment send one request; the button is disabled, busy and announced while it is on its way", async () => {
    server = fakeServer({ logout: "hang" });
    signedInAs();
    await open("/m/profile");

    await act(async () => {
      signOutButton().click();
      signOutButton().click();
    });
    await settle(5);

    assert.equal(server.writes().length, 1, "one POST /logout");
    assert.equal(signOutButton().disabled, true);
    assert.equal(signOutButton().getAttribute("aria-busy"), "true");
    assert.equal(signOutButton().textContent.trim(), "Signing out…");
    assert.match(text(q("[data-sm-section='sign-out'] [role='status']")), /Signing you out/);
    assert.equal(location(), "/m/profile", "still signed in until the server answers");

    await act(async () => { server.release(); });
    await settle();
    assert.equal(server.writes().length, 1);
    assert.equal(location(), "/m/signin");
    assert.equal(q("[data-sm-signed-out]").dataset.smSignedOut, "confirmed");
  });

  it("a tap after the sign-out has finished does nothing (there is no session to end, and no button)", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    const button = signOutButton();
    await click(button);
    await settle();
    await click(button);
    await settle();

    assert.equal(server.writes().length, 1);
  });

  for (const [label, logout] of [["the network fails", "network"], ["the server answers 500", 500]]) {
    it(`when ${label}: this device is signed out, and Mobile does not claim the server ended the session`, async () => {
      server = fakeServer({ logout });
      signedInAs();
      await open("/m/profile");
      await click(signOutButton());
      await settle();

      assert.deepEqual(stored(), { token: null, user: null, workspace: null }, "the session is cleared on this device regardless");
      assert.equal(location(), "/m/signin");
      const notice = q("[data-sm-signed-out]");
      assert.equal(notice.dataset.smSignedOut, "unconfirmed");
      assert.match(text(notice), /signed out on this device/);
      assert.match(text(notice), /did not confirm that it ended your session on its server/);
      assert.doesNotMatch(text(notice), /You have been signed out\.\s*$/);
      assert.equal(server.writes().length, 1, "no automatic retry");
      assert.equal(q("[data-sm-identity]"), null);
    });
  }

  it("when the server says 401 the session had already ended: said as that, not as a confirmation", async () => {
    server = fakeServer({ logout: 401 });
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    assert.equal(location(), "/m/signin");
    assert.equal(q("[data-sm-signed-out]").dataset.smSignedOut, "ended");
    assert.match(text(q("[data-sm-signed-out]")), /says the session had already ended/);
    assert.deepEqual(stored(), { token: null, user: null, workspace: null });
  });

  it("the warning is Arabic in Arabic", async () => {
    await i18n.changeLanguage("ar");
    server = fakeServer({ logout: "network" });
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    assert.match(text(q("[data-sm-signed-out]")), /لم يؤكد أنه أنهى جلستك على خادمه/);
  });
});

describe("other tabs and the session", () => {
  it("a sign-out in another tab signs this one out too, with no logout request from here", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    const before = server.calls.length;

    window.localStorage.removeItem("user");
    window.localStorage.removeItem("workspace");
    window.localStorage.removeItem("ACCESS_TOKEN");
    window.dispatchEvent(new window.StorageEvent("storage", { key: "ACCESS_TOKEN", newValue: null, oldValue: TOKEN_A, storageArea: window.localStorage }));
    await settle();

    assert.equal(location(), "/m/signin");
    assert.equal(server.calls.slice(before).some((call) => call.path === "/logout"), false);
    assert.equal(q("[data-sm-signed-out]"), null, "this tab did not sign out; it says nothing about a sign-out it did not make");
    assert.doesNotMatch(text(), /Alex Example/);
  });

  it("this sign-out is visible to other tabs the usual way: the stored session is removed", async () => {
    server = fakeServer();
    signedInAs();
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    for (const key of ["ACCESS_TOKEN", "user", "workspace", "token", "ROLE"]) assert.equal(window.localStorage.getItem(key), null, key);
    for (const key of ["ACCESS_TOKEN", "user", "workspace"]) assert.equal(window.sessionStorage.getItem(key), null, key);
  });

  it("a session kept only for this tab (not remembered) is cleared the same way", async () => {
    server = fakeServer();
    storeSession({ token: TOKEN_A, user: USER_A, workspace: WORKSPACE, where: "session" });
    await open("/m/profile");
    await click(signOutButton());
    await settle();

    assert.equal(window.sessionStorage.getItem("ACCESS_TOKEN"), null);
    assert.equal(location(), "/m/signin");
  });
});
