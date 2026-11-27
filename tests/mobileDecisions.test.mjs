import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

/*
 * The product decisions applied to Mobile:
 *   A  PDF: backend-built exports only; a ready one downloads under a safe name;
 *      denied, gone, expired and failed downloads say so; nothing is created.
 *   C  Google sign-in: the app's own hook and loader, with a fake Google here
 *      (no real Google request is made, and no real OAuth is claimed).
 * And how sign-in is tested: through a fake context (other files), and here
 * through the app's REAL AuthProvider with a fake server, to see the actual
 * HTTP requests sign-in and registration send (POST /login, POST /register:
 * the existing auth contract, separate from the financial write gate).
 *
 * The object-URL API is stubbed before Mobile loads, because jsdom has none.
 */

const saved = [];
URL.createObjectURL = () => "blob:smartspend-test";
URL.revokeObjectURL = () => {};

const { createElement: h, Fragment } = await import("react");
const { RouterProvider, createMemoryRouter, useLocation } = await import("react-router-dom");
const { change, click, flush, render, submit } = await import("./helpers/dom.mjs");
const { envelope, failure, healthyBackend, installFakeApi } = await import("./helpers/mobileApi.mjs");
const { AuthContext, TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } = await import("./helpers/mobileHarness.mjs");
const { paginator } = await import("./helpers/planningFixture.mjs");
const { default: ThemeProvider } = await import("../src/contexts/theme/themeProvider.jsx");
await import("../src/mobile/i18n/register.js");
const { default: GoogleSignIn } = await import("../src/mobile/auth/GoogleSignIn.jsx");

dom.window.HTMLAnchorElement.prototype.click = function captureDownload() {
  if (this.download) saved.push(this.download);
};

after(() => dom.window.close());

let api;
let view;
const text = (root = document.body) => root.textContent.replace(/\s+/g, " ");

beforeEach(async () => {
  await resetEnvironment();
  saved.length = 0;
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("Decision A: PDF from the backend only", () => {
  const exp = (id, over = {}) => ({ id, report: "overview", format: "pdf", status: "completed", download_available: true, created_at: "2026-10-20T10:00:00Z", ...over });
  const backend = (download) => (call) => {
    if (call.path === "/report-exports") return { body: envelope({ report_exports: paginator([exp(1), exp(2), exp(3), exp(4, { status: "expired", download_available: false })]) }) };
    const id = /\/report-exports\/(\d+)\/download$/.exec(call.path)?.[1];
    return id ? download(id) : failure(404);
  };
  const pdf = (name) => ({ status: 200, body: "%PDF-1.7 fictional", headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });

  it("a ready PDF downloads under a safe name; denied, gone and expired files say so; only GETs are made", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(backend((id) => (id === "1" ? pdf("..\\..\\reports/<evil>:report?.pdf") : id === "2" ? failure(403, "Forbidden") : failure(410, "Gone"))));
    view = await mountMobile({ entry: "/m/exports" });
    assert.match(q("[data-sm-export='1'] button").textContent, /Download PDF/);
    assert.match(text(q("[data-sm-note='pdf']")), /only in the full version/);
    await click(q("[data-sm-export='1'] button"));
    await settle();
    assert.deepEqual(saved, ["evilreport.pdf"], "no folder part, no reserved characters");
    await click(q("[data-sm-export='2'] button"));
    await settle();
    assert.equal(q("[data-sm-export='2'] [data-sm-download-error]").dataset.smDownloadError, "denied");
    await click(q("[data-sm-export='3'] button"));
    await settle();
    assert.equal(q("[data-sm-export='3'] [data-sm-download-error]").dataset.smDownloadError, "gone");
    assert.ok(q("[data-sm-export='4'] [data-sm-note='expired']"));
    assert.equal(qa("button", q("[data-sm-export='4']")).length, 0, "no download for an expired export");
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });

  it("a file with no usable name gets the full version's built name", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(backend(() => pdf("...")));
    view = await mountMobile({ entry: "/m/exports" });
    await click(q("[data-sm-export='1'] button"));
    await settle();
    assert.deepEqual(saved, ["smartspend-overview-1.pdf"]);
  });

  it("the export form offers PDF and never sends", async () => {
    storeSession({ token: TOKEN_A, user: USER_A });
    api = installFakeApi(healthyBackend());
    view = await mountMobile({ entry: "/m/add/export" });
    assert.ok(qa("[data-sm-field='format'] input").some((input) => input.value === "pdf"));
    await click(q("[data-sm-field='report'] input"));
    await click(qa("[data-sm-field='format'] input").find((input) => input.value === "pdf"));
    await submit(q("form.sm-draft-form"));
    assert.equal(q("[data-sm-action='send']").disabled, true);
    assert.ok(api.calls.every((call) => call.method === "GET"));
  });
});

describe("Decision C: Google sign-in with the app's own hook (fake Google, fake provider)", () => {
  function setup({ loginWithGoogle, load } = {}) {
    let credentialHandler = null;
    const identity = {
      load: load ?? (async () => ({ renderButton: (slot) => { const button = document.createElement("button"); button.textContent = "Continue with Google"; slot.append(button); } })),
      subscribe: (handler) => {
        credentialHandler = handler;
        return { state: "fake-state", unsubscribe: () => { credentialHandler = null; } };
      },
    };
    const calls = [];
    const value = { isAuthenticated: false, initializing: false, token: null, user: null, loginWithGoogle: async (token, options) => { calls.push({ token, options: { ...options, signal: Boolean(options.signal) } }); return loginWithGoogle ? loginWithGoogle(calls.length) : USER_A; } };
    function Probe() {
      const where = useLocation();
      return h("output", { id: "probe" }, where.pathname);
    }
    const router = createMemoryRouter([{ path: "*", element: h(Fragment, null, h(Probe), h("div", { className: "sm-root" }, h(GoogleSignIn, { remember: true, identity }))) }], { initialEntries: [{ pathname: "/m/signin", state: { from: "/m/accounts" } }] });
    return { calls, credential: (token) => credentialHandler?.(token), mount: async () => { view = await render(h(ThemeProvider, null, h(AuthContext.Provider, { value }, h(RouterProvider, { router })))); await flush(); await flush(); } };
  }

  it("Google's button is rendered; a credential goes to the provider's loginWithGoogle with Remember me, then to the remembered Mobile page", async () => {
    const google = setup();
    await google.mount();
    assert.equal(q("[data-sm-google]").dataset.smGoogle, "ready");
    await google.credential("fictional-id-token");
    await flush();
    assert.deepEqual(google.calls, [{ token: "fictional-id-token", options: { acceptedPolicies: false, remember: true, signal: true } }]);
    assert.equal(q("#probe").textContent, "/m/accounts");
  });

  it("closing Google's window sends nothing; consent required asks first, and Cancel sends nothing more", async () => {
    const google = setup({ loginWithGoogle: (n) => { if (n === 1) throw Object.assign(new Error("Consent required"), { status: 422, payload: { code: "google_consent_required" } }); return USER_A; } });
    await google.mount();
    assert.equal(google.calls.length, 0, "no credential, no request");
    await google.credential("fictional-id-token");
    await flush();
    assert.ok(q("[data-sm-google-consent]"));
    assert.equal(document.activeElement, q("[data-sm-google-consent]"));
    await click(q("[data-sm-action='google-cancel']"));
    assert.equal(q("[data-sm-google-consent]"), null);
    assert.equal(google.calls.length, 1);
  });

  it("consent accepted sends the same credential again with the policies accepted", async () => {
    const google = setup({ loginWithGoogle: (n) => { if (n === 1) throw Object.assign(new Error("Consent required"), { status: 422, payload: { code: "google_consent_required" } }); return USER_A; } });
    await google.mount();
    await google.credential("fictional-id-token");
    await flush();
    await click(q("[data-sm-action='google-accept']"));
    await flush();
    assert.equal(google.calls[1].options.acceptedPolicies, true);
    assert.equal(google.calls[1].token, "fictional-id-token");
  });

  it("a failure is said and sign-in stays; Google not loading leaves the password sign-in", async () => {
    const failing = setup({ loginWithGoogle: () => { throw Object.assign(new Error("Server error"), { name: "ApiError", code: "SERVER_ERROR", status: 500 }); } });
    await failing.mount();
    await failing.credential("fictional-id-token");
    await flush();
    assert.ok(q("[data-sm-google-error]"));
    assert.equal(q("#probe").textContent, "/m/signin");
    await view.unmount();
    view = null;
    const blocked = setup({ load: async () => { throw new Error("Google sign-in could not load."); } });
    await blocked.mount();
    assert.equal(q("[data-sm-google]").dataset.smGoogle, "unavailable");
    assert.match(text(q("[data-sm-note='google-unavailable']")), /password/);
  });

  it("on the Mobile sign-in page, with Google not configured (as in tests), the page says so and password sign-in stays", async () => {
    api = installFakeApi(healthyBackend());
    view = await mountMobile({ entry: "/m/signin", auth: { isAuthenticated: false, initializing: false, token: null, user: null, login: async () => {}, loginWithGoogle: async () => {} } });
    await settle();
    assert.equal(q("[data-sm-google]").dataset.smGoogle, "unavailable");
    assert.ok(q("[data-sm-form='signin']"));
  });
});

describe("sign-in and registration through the REAL AuthProvider (fake server)", () => {
  const USER = { id: 1, name: "Alex Example", email: "alex@example.test" };
  function fakeServer({ loginStatus = 200 } = {}) {
    const calls = [];
    const original = globalThis.fetch;
    const reads = healthyBackend();
    globalThis.fetch = async (url, init = {}) => {
      const parsed = new URL(String(url), "http://localhost");
      const path = parsed.pathname.replace(/^\/api/, "");
      const method = String(init.method ?? "GET").toUpperCase();
      calls.push({ method, path, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined });
      const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (method === "POST" && path === "/login") return loginStatus === 200 ? reply(200, envelope({ token: "fictional-token-2", user: USER })) : reply(loginStatus, { status: false, message: "These credentials do not match our records.", errors: {} });
      if (method === "POST" && path === "/register") return reply(201, envelope({ token: "fictional-token-3", user: USER }));
      if (method === "GET" && path === "/user") return reply(200, envelope({ user: USER, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } }));
      if (method !== "GET") return reply(500, { status: false, message: "unexpected", errors: {} });
      const answer = reads({ path, query: Object.fromEntries(parsed.searchParams) });
      return reply(answer?.status ?? 200, answer?.body ?? answer);
    };
    return { calls, restore: () => { globalThis.fetch = original; } };
  }

  it("sign-in sends POST /login then GET /user, stores the session where the app always does, and opens the page asked for; no other request writes", async () => {
    const server = fakeServer();
    try {
      view = await mountMobile({ entry: "/m/accounts", realAuth: true });
      await settle();
      assert.equal(location(), "/m/signin");
      await change(q("input[autocomplete='username']"), "alex@example.test");
      await change(q("input[autocomplete='current-password']"), "fictional-pass-1");
      await submit(q("[data-sm-form='signin']"));
      await settle();
      assert.equal(location(), "/m/accounts");
      const writes = server.calls.filter((call) => call.method !== "GET");
      assert.deepEqual(writes.map((call) => `${call.method} ${call.path}`), ["POST /login"], "the only non-GET is the existing sign-in contract");
      assert.deepEqual(writes[0].body, { identifier: "alex@example.test", password: "fictional-pass-1" });
      assert.ok(server.calls.findIndex((call) => call.path === "/user") > server.calls.findIndex((call) => call.path === "/login"));
      assert.equal(window.localStorage.getItem("ACCESS_TOKEN"), "fictional-token-2", "Remember me on: the provider's own key in localStorage");
    } finally {
      server.restore();
    }
  });

  it("a refused sign-in (401) stays on sign-in, says so, stores nothing and is not retried", async () => {
    const server = fakeServer({ loginStatus: 401 });
    try {
      view = await mountMobile({ entry: "/m/signin", realAuth: true });
      await settle();
      await change(q("input[autocomplete='username']"), "alex@example.test");
      await change(q("input[autocomplete='current-password']"), "wrong");
      await submit(q("[data-sm-form='signin']"));
      await settle();
      assert.equal(location(), "/m/signin");
      assert.ok(q("[data-sm-auth-error]"));
      assert.equal(server.calls.filter((call) => call.path === "/login").length, 1);
      assert.equal(window.localStorage.getItem("ACCESS_TOKEN"), null);
    } finally {
      server.restore();
    }
  });

  it("registration sends POST /register with the full version's fields, then Profile shows the email status", async () => {
    const server = fakeServer();
    try {
      view = await mountMobile({ entry: "/m/register", realAuth: true });
      await settle();
      const form = q("[data-sm-form='register']");
      await change(q("input[autocomplete='name']", form), "Alex Example");
      await change(q("input[autocomplete='username']", form), "alex@example.test");
      const [password, confirmation] = qa("input[autocomplete='new-password']", form);
      await change(password, "fictional-pass-1");
      await change(confirmation, "fictional-pass-1");
      await click(q("input[type='checkbox']", form));
      await submit(form);
      await settle();
      assert.equal(location(), "/m/profile");
      const writes = server.calls.filter((call) => call.method !== "GET");
      assert.deepEqual(writes.map((call) => `${call.method} ${call.path}`), ["POST /register"]);
      assert.deepEqual(Object.keys(writes[0].body).sort(), ["identifier", "name", "password", "password_confirmation", "privacy_accepted", "terms_accepted"]);
      assert.ok(q("[data-sm-section='email']"));
    } finally {
      server.restore();
    }
  });
});
