import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

/*
 * Where sign-in leaves the visitor. Starting from Mobile sign-in (/m/signin) ends in Mobile (/m, or a safe
 * remembered /m/* page) even when the device resolves to the full version ("auto" on a desktop browser, or an
 * explicit "desktop" choice): the presentation gate sits above the route tree and, once the session exists,
 * would otherwise send any Mobile address of a desktop-mode visitor to /dashboard. Desktop sign-in still goes to
 * /dashboard. The identity calls are faked: nothing is sent anywhere.
 */

const { createElement: h, Fragment, useState } = await import("react");
const { Outlet, RouterProvider, createMemoryRouter, useLocation } = await import("react-router-dom");
const { change, flush, render, submit } = await import("./helpers/dom.mjs");
const { healthyBackend, installFakeApi } = await import("./helpers/mobileApi.mjs");
const { AuthContext, PRESENTATION_KEY, TOKEN_A, USER_A, dom, location, mountMobile, q, resetEnvironment, settle } = await import("./helpers/mobileHarness.mjs");
const { default: ThemeProvider } = await import("../src/contexts/theme/themeProvider.jsx");
await import("../src/mobile/i18n/register.js");
const { default: GoogleSignIn } = await import("../src/mobile/auth/GoogleSignIn.jsx");
const { default: PresentationGate } = await import("../src/mobile/presentation/PresentationGate.jsx");
const { default: useGoogleSignIn } = await import("../src/features/Auth/components/AuthSocial/useGoogleSignIn.js");

after(() => dom.window.close());

let api;
let view;
const SIGNED_OUT = { isAuthenticated: false, initializing: false, token: null, user: null };
const SIGNED_IN = { isAuthenticated: true, initializing: false, token: TOKEN_A, user: USER_A, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } };
const stored = () => window.localStorage.getItem(PRESENTATION_KEY);

beforeEach(async () => {
  await resetEnvironment();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

async function signInWithPassword(entry, { preference, fail } = {}) {
  api = installFakeApi(healthyBackend());
  const calls = [];
  const auth = {
    ...SIGNED_OUT,
    login: async (credentials) => {
      calls.push(credentials);
      if (fail) throw fail;
      await view.setAuth(SIGNED_IN);
      return USER_A;
    },
  };
  view = await mountMobile({ entry, auth, preference });
  await change(document.querySelector("input[autocomplete='username']"), "alex@example.test");
  await change(document.querySelector("input[autocomplete='current-password']"), "secret-1");
  await submit(document.querySelector("[data-sm-form='signin']"));
  await settle();
  return calls;
}

describe("Mobile email and password sign-in ends in Mobile, whatever the device resolves to", () => {
  for (const [label, preference] of [["automatic on a desktop browser", null], ["the full version chosen", "desktop"], ["Mobile chosen", "mobile"]]) {
    it(`from /m/signin with ${label}: Mobile Home, not /dashboard`, async () => {
      const calls = await signInWithPassword("/m/signin", { preference });
      assert.equal(calls.length, 1);
      assert.equal(location(), "/m");
      assert.notEqual(q("[data-sm-screen='signin']") !== null || q("#desktop") !== null, true, "neither sign-in nor the Desktop page is on screen");
      assert.equal(stored(), "mobile", "signing in on Mobile is the choice of Mobile");
    });
  }

  it("a remembered Mobile page is honoured, with its query, in desktop mode", async () => {
    await signInWithPassword({ pathname: "/m/signin", state: { from: "/m/activity?type=expense" } }, { preference: "desktop" });
    assert.equal(location(), "/m/activity?type=expense");
  });

  it("a signed-out visit to a Mobile page comes back to it after sign-in, in desktop mode", async () => {
    await signInWithPassword("/m/planning/budgets", { preference: null });
    assert.equal(location(), "/m/planning/budgets");
  });

  for (const from of ["/dashboard", "/dashboard/budgets", "//evil.example", "https://evil.example/m", "/\\evil.example", "/m/signin", "/m/register", "/signin"]) {
    it(`an unsafe or non-Mobile return address (${from}) falls back to Mobile Home`, async () => {
      await signInWithPassword({ pathname: "/m/signin", state: { from } }, { preference: "desktop" });
      assert.equal(location(), "/m");
    });
  }

  it("a failed sign-in changes nothing: the stored choice is as it was and sign-in stays", async () => {
    for (const preference of [null, "desktop"]) {
      await resetEnvironment();
      await signInWithPassword("/m/signin", { preference, fail: Object.assign(new Error("Wrong"), { code: "UNAUTHENTICATED" }) });
      assert.equal(location(), "/m/signin");
      assert.equal(stored(), preference, String(preference));
      await view.unmount();
      view = null;
      api.restore();
    }
  });
});

describe("Mobile Google sign-in ends in Mobile too", () => {
  function setup({ preference, from, loginWithGoogle }) {
    if (preference) window.localStorage.setItem(PRESENTATION_KEY, preference);
    let credentialHandler = null;
    const identity = {
      load: async () => ({ renderButton: (slot) => { const button = document.createElement("button"); button.textContent = "Continue with Google"; slot.append(button); } }),
      subscribe: (handler) => {
        credentialHandler = handler;
        return { state: "fake-state", unsubscribe: () => { credentialHandler = null; } };
      },
    };
    function Provider({ children }) {
      const [session, setSession] = useState(SIGNED_OUT);
      const value = { ...session, loginWithGoogle: async (_token, options) => { if (loginWithGoogle) await loginWithGoogle(options); setSession(SIGNED_IN); return USER_A; } };
      return h(AuthContext.Provider, { value }, children);
    }
    // The real presentation gate above the routes, as MobileEntry has it; the destinations are stubs.
    function Gate() {
      return h(PresentationGate, null, h(Fragment, null, h("output", { id: "probe" }, useLocation().pathname), h(Outlet)));
    }
    const page = (id, children) => h("div", { id }, children);
    const router = createMemoryRouter([{
      element: h(Gate),
      children: [
        { path: "/m/signin", element: page("signin", h(GoogleSignIn, { remember: true, identity })) },
        { path: "/m", element: page("mobile-home", "Mobile Home") },
        { path: "/m/accounts", element: page("mobile-accounts", "Accounts") },
        { path: "/dashboard", element: page("dashboard", "Dashboard") },
        { path: "*", element: page("other", "Other") },
      ],
    }], { initialEntries: [{ pathname: "/m/signin", state: from ? { from } : undefined }] });
    return { credential: (token) => credentialHandler?.(token), mount: async () => { view = await render(h(ThemeProvider, null, h(Provider, null, h(RouterProvider, { router })))); await flush(); await flush(); } };
  }

  const signIn = async (options) => {
    const google = setup(options);
    await google.mount();
    assert.equal(q("[data-sm-google]").dataset.smGoogle, "ready");
    await google.credential("fictional-id-token");
    await flush();
    await flush();
    return q("#probe").textContent;
  };

  for (const preference of [null, "desktop", "mobile"]) {
    it(`with no remembered page, ${preference ?? "automatic"} mode: Mobile Home, not /dashboard`, async () => {
      assert.equal(await signIn({ preference }), "/m");
      assert.equal(stored(), "mobile");
    });
  }

  it("a remembered Mobile page is honoured in desktop mode", async () => {
    assert.equal(await signIn({ preference: "desktop", from: "/m/accounts" }), "/m/accounts");
  });

  for (const from of ["/dashboard", "//evil.example", "https://evil.example", "/m/signin"]) {
    it(`an unsafe or non-Mobile return address (${from}) falls back to Mobile Home`, async () => {
      assert.equal(await signIn({ preference: "desktop", from }), "/m");
    });
  }

  it("a failed Google sign-in leaves the stored choice as it was", async () => {
    for (const preference of [null, "desktop"]) {
      await resetEnvironment();
      const google = setup({ preference, loginWithGoogle: async () => { throw Object.assign(new Error("Server error"), { name: "ApiError", code: "SERVER_ERROR", status: 500 }); } });
      await google.mount();
      await google.credential("fictional-id-token");
      await flush();
      assert.equal(q("#probe").textContent, "/m/signin");
      assert.equal(stored(), preference);
      await view.unmount();
      view = null;
    }
  });

  it("consent required, then cancelled, leaves the stored choice as it was; accepting then ends in Mobile", async () => {
    let first = true;
    const google = setup({ preference: "desktop", loginWithGoogle: async () => { if (first) { first = false; throw Object.assign(new Error("Consent required"), { status: 422, payload: { code: "google_consent_required" } }); } } });
    await google.mount();
    await google.credential("fictional-id-token");
    await flush();
    assert.equal(q("[data-sm-google-consent]") !== null, true);
    assert.equal(stored(), "desktop", "nothing is decided before consent");
    q("[data-sm-action='google-accept']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flush();
    await flush();
    assert.equal(q("#probe").textContent, "/m");
  });

  it("consent required, then the Cancel button: the stored choice is as it was and a later attempt still claims Mobile once", async () => {
    for (const preference of [null, "desktop"]) {
      await resetEnvironment();
      let attempts = 0;
      const google = setup({ preference, loginWithGoogle: async () => { attempts += 1; if (attempts === 1) throw Object.assign(new Error("Consent required"), { status: 422, payload: { code: "google_consent_required" } }); } });
      await google.mount();
      await google.credential("fictional-id-token");
      await flush();
      assert.equal(q("[data-sm-google-consent]") !== null, true);
      q("[data-sm-action='google-cancel']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await flush();
      assert.equal(q("[data-sm-google-consent]"), null, "the consent prompt is gone");
      assert.equal(stored(), preference, `cancelled with ${preference ?? "automatic"}`);
      assert.equal(q("#probe").textContent, "/m/signin");
      // The visitor tries again from the Google button: the retry reads the restored value, not a stale one.
      await google.credential("fictional-id-token");
      await flush();
      await flush();
      assert.equal(q("#probe").textContent, "/m");
      assert.equal(stored(), "mobile");
      await view.unmount();
      view = null;
    }
  });

  it("leaving the page while the request is on its way aborts it and restores the stored choice", async () => {
    for (const preference of [null, "desktop"]) {
      await resetEnvironment();
      const google = setup({
        preference,
        loginWithGoogle: ({ signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new window.DOMException("Cancelled", "AbortError")));
        }),
      });
      await google.mount();
      google.credential("fictional-id-token");
      await flush();
      assert.equal(stored(), "mobile", "claimed while the request is pending");
      await view.unmount();
      view = null;
      await flush();
      assert.equal(stored(), preference, `aborted with ${preference ?? "automatic"}`);
    }
  });
});

describe("Desktop sign-in is unchanged", () => {
  function probeHook({ from }) {
    let credentialHandler = null;
    function Where() {
      return h("output", { id: "probe" }, useLocation().pathname);
    }
    function Harness() {
      const google = useGoogleSignIn({ remember: true, onError: () => {} });
      credentialHandler = google.handleCredential;
      return h(Where);
    }
    const value = { ...SIGNED_OUT, loginWithGoogle: async () => USER_A };
    const router = createMemoryRouter([{ path: "*", element: h(Harness) }], { initialEntries: [{ pathname: "/signin", state: from ? { from } : undefined }] });
    return { credential: (token) => credentialHandler(token), mount: async () => { view = await render(h(AuthContext.Provider, { value }, h(RouterProvider, { router }))); await flush(); } };
  }

  it("Google from the full version's sign-in goes to /dashboard, or to the safe remembered page", async () => {
    const plain = probeHook({ from: null });
    await plain.mount();
    await plain.credential("fictional-id-token");
    await flush();
    assert.equal(q("#probe").textContent, "/dashboard");
    await view.unmount();

    const remembered = probeHook({ from: "/dashboard/budgets" });
    await remembered.mount();
    await remembered.credential("fictional-id-token");
    await flush();
    assert.equal(q("#probe").textContent, "/dashboard/budgets");
    await view.unmount();

    const unsafe = probeHook({ from: "//evil.example" });
    await unsafe.mount();
    await unsafe.credential("fictional-id-token");
    await flush();
    assert.equal(q("#probe").textContent, "/dashboard");
  });
});
