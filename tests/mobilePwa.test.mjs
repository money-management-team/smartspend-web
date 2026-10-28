import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PWA_CACHE_PREFIX, pwaEntrySource, pwaManifest, resolveMobilePwa, swSource } from "../scripts/mobilePwa.mjs";
import { mobileEntryPlugin } from "../scripts/mobileEntryPlugin.mjs";

const { registerWorker, removeWorker, syncPwa } = await import("../src/mobile/pwa/worker.js");

/*
 * The Mobile PWA: when it may exist (never in a production build), what its
 * worker intercepts (never /api, never a write, never a Desktop page), how a
 * build without it cleans up after one with it, and what the build emits.
 */

describe("when the PWA may exist", () => {
  const resolve = (env, { mobile = true, command = "build", mode = "staging" } = {}) => resolveMobilePwa({ mobileEnabled: mobile, command, mode, env });

  it("only the exact string, only with Mobile on, and never in a production build", () => {
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }), { enabled: true, refusedInProduction: false });
    assert.equal(resolve({ VITE_MOBILE_PWA: "true" }, { command: "serve", mode: "development" }).enabled, true);
    for (const value of ["TRUE", "1", "yes", " true", undefined, ""]) assert.equal(resolve({ VITE_MOBILE_PWA: value }).enabled, false, String(value));
    assert.equal(resolve({ VITE_MOBILE_PWA: "true" }, { mobile: false }).enabled, false, "no PWA without Mobile");
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true", SMARTSPEND_MOBILE_RELEASE_APPROVED: "true" }, { mode: "production" }), { enabled: false, refusedInProduction: true }, "no approval switch opens it in production");
  });

  it("the virtual module says off, and the plugin emits nothing, unless it is on", () => {
    assert.match(pwaEntrySource(false, ""), /MOBILE_PWA = false/);
    const emitted = (enabled, pwa) => {
      const files = [];
      const plugin = mobileEntryPlugin(enabled, { pwa });
      plugin.configResolved({ root: process.cwd() });
      plugin.generateBundle.call({ emitFile: (file) => files.push(file.fileName) }, {}, { "assets/index-a.js": {} });
      return files;
    };
    assert.deepEqual(emitted(true, false), []);
    assert.deepEqual(emitted(false, true), [], "Mobile off: no PWA even if asked");
    assert.deepEqual(emitted(true, true), ["m/sw.js", "m/manifest.webmanifest", "m/icon-256.png"]);
    const plugin = mobileEntryPlugin(true, { pwa: false });
    assert.match(plugin.load(plugin.resolveId("virtual:smartspend-mobile-pwa")), /MOBILE_PWA = false/);
  });

  it("the manifest is scoped to Mobile and starts there", () => {
    const manifest = pwaManifest();
    assert.equal(manifest.start_url, "/m/", "inside the scope: /m itself is not under /m/");
    assert.equal(manifest.scope, "/m/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#07142B");
  });
});

/* Runs the worker's source against a fake service-worker global. */
function runWorker() {
  const listeners = {};
  const stores = new Map([["sm-pwa-old", new Map()], ["other-app", new Map()]]);
  const fetched = [];
  let skipped = false;
  let online = true;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { match: async (request) => store.get(request.url), put: async (request, response) => store.set(request.url, response) };
    },
  };
  const fetchFn = async (request) => {
    fetched.push(request.url);
    if (!online) throw new TypeError("Failed to fetch");
    // A same-origin answer, as a browser reports it (type "basic").
    const response = { ok: true, status: 200, type: "basic", text: async () => "body" };
    response.clone = () => response;
    return response;
  };
  const self = { location: { origin: "https://app.test" }, clients: { claim: async () => {} }, skipWaiting: () => { skipped = true; }, addEventListener: (type, fn) => { listeners[type] = fn; } };
  new Function("self", "caches", "fetch", "Response", "URL", swSource("v1"))(self, caches, fetchFn, Response, URL);

  const fire = async (request) => {
    let responded = null;
    await listeners.fetch({ request: { method: "GET", mode: "cors", ...request }, respondWith: (promise) => { responded = promise; } });
    return responded ? await responded : null;
  };

  return {
    fire,
    stores,
    fetched,
    setOnline: (value) => { online = value; },
    activate: async () => { let work; listeners.activate({ waitUntil: (promise) => { work = promise; } }); await work; },
    message: (data) => listeners.message({ data }),
    skipped: () => skipped,
  };
}

describe("the service worker", () => {
  it("never touches the API, a write, another origin, or a page outside Mobile", async () => {
    const worker = runWorker();
    assert.equal(await worker.fire({ url: "https://app.test/api/accounts" }), null);
    assert.equal(await worker.fire({ url: "https://app.test/api/transactions/expense", method: "POST" }), null);
    assert.equal(await worker.fire({ url: "https://app.test/assets/index-a.js", method: "POST" }), null);
    assert.equal(await worker.fire({ url: "https://cdn.other.test/assets/x.js" }), null);
    assert.equal(await worker.fire({ url: "https://app.test/dashboard", mode: "navigate" }), null);
    assert.equal(await worker.fire({ url: "https://app.test/signin", mode: "navigate" }), null);
    assert.deepEqual(worker.fetched, [], "it did not even fetch them itself");
  });

  it("caches only hashed /assets files, and serves them from the cache afterwards", async () => {
    const worker = runWorker();
    const first = await worker.fire({ url: "https://app.test/assets/MobileApp-abc.js" });
    assert.equal(first.status, 200);
    await worker.fire({ url: "https://app.test/assets/MobileApp-abc.js" });
    assert.deepEqual(worker.fetched, ["https://app.test/assets/MobileApp-abc.js"], "the second came from the cache");
    assert.deepEqual([...worker.stores.get(`${PWA_CACHE_PREFIX}v1`).keys()], ["https://app.test/assets/MobileApp-abc.js"]);
    assert.equal(await worker.fire({ url: "https://app.test/assets/a.js?token=x" }), null, "nothing with a query");
    assert.equal(await worker.fire({ url: "https://app.test/m/manifest.webmanifest" }), null);
  });

  it("keeps Mobile navigations network-first, never caches them, and answers offline with a page that has no data", async () => {
    const worker = runWorker();
    const online = await worker.fire({ url: "https://app.test/m/activity", mode: "navigate" });
    assert.equal(online.status, 200);
    worker.setOnline(false);
    const offline = await worker.fire({ url: "https://app.test/m/activity", mode: "navigate" });
    assert.equal(offline.status, 503);
    const html = await offline.text();
    assert.match(html, /You're offline/);
    assert.match(html, /Nothing is saved or sent/);
    assert.equal(offline.headers.get("cache-control"), "no-store");
    for (const store of worker.stores.values()) for (const key of store.keys()) assert.doesNotMatch(key, /\/m\/|\/api\//);
  });

  it("on activation deletes only its own older caches; it takes over only when asked", async () => {
    const worker = runWorker();
    await worker.activate();
    assert.deepEqual([...worker.stores.keys()].sort(), ["other-app"]);
    assert.equal(worker.skipped(), false);
    worker.message("something else");
    assert.equal(worker.skipped(), false);
    worker.message("sm-pwa-skip-waiting");
    assert.equal(worker.skipped(), true);
  });
});

describe("registration and rollback in the page", () => {
  const fakeNavigator = (scopes) => {
    const removed = [];
    const registered = [];
    return {
      removed,
      registered,
      nav: {
        serviceWorker: {
          getRegistrations: async () => scopes.map((scope) => ({ scope, unregister: async () => { removed.push(scope); return true; } })),
          register: async (url, options) => { registered.push([url, options]); return { url }; },
        },
      },
    };
  };
  const fakeCaches = (names) => ({ names: new Set(names), keys: async function () { return [...this.names]; }, delete: async function (name) { return this.names.delete(name); } });
  const doc = () => {
    const head = { children: [], append(node) { this.children.push(node); } };
    head.insertAdjacentHTML = (where, html) => head.children.push(html);
    return { head, querySelector: () => null };
  };

  it("a build without the PWA removes a Mobile worker and its caches, and nothing else", async () => {
    const browser = fakeNavigator(["https://app.test/m/", "https://app.test/"]);
    const cacheStorage = fakeCaches(["sm-pwa-abc", "other"]);
    const result = await removeWorker({ nav: browser.nav, cacheStorage });
    assert.deepEqual(result, { state: "off", removed: 1 });
    assert.deepEqual(browser.removed, ["https://app.test/m/"]);
    assert.deepEqual([...cacheStorage.names], ["other"]);
    assert.deepEqual(browser.registered, []);
  });

  it("a PWA build registers /m/sw.js with scope /m/ and adds the manifest link", async () => {
    const browser = fakeNavigator([]);
    const page = doc();
    const result = await registerWorker({ nav: browser.nav, doc: page });
    assert.equal(result.state, "on");
    assert.deepEqual(browser.registered, [["/m/sw.js", { scope: "/m/", updateViaCache: "none" }]]);
    assert.match(page.head.children[0], /rel="manifest" href="\/m\/manifest\.webmanifest"/);
  });

  it("no service worker support: nothing happens; a failure is reported, not thrown", async () => {
    assert.deepEqual(await registerWorker({ nav: {} }), { state: "unsupported" });
    assert.deepEqual(await removeWorker({ nav: {} }), { state: "unsupported" });
    const broken = { serviceWorker: { register: async () => { throw new Error("SecurityError"); } } };
    assert.deepEqual(await registerWorker({ nav: broken, doc: doc() }), { state: "failed" });
  });

  it("in the shipped test build the module says off", async () => {
    const { PWA_BUILD } = await import("../src/mobile/pwa/worker.js");
    assert.equal(PWA_BUILD, false);
    // ...so syncPwa takes the clean-up path (here there is no service worker at all).
    assert.deepEqual(await syncPwa(), { state: "unsupported" });
  });
});
