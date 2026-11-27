import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";

import { PWA_APPROVAL, PWA_CACHE_PREFIX, PWA_ICONS, PWA_LEGACY_SW_PATH, PWA_SCOPE, PWA_SW_PATH, pwaEntrySource, pwaManifest, resolveMobilePwa, resolvePwaRetire, retireSwSource, swSource } from "../scripts/mobilePwa.mjs";
import { mobileEntryPlugin } from "../scripts/mobileEntryPlugin.mjs";

const { registerWorker, releaseHead, removeWorker, syncPwa } = await import("../src/mobile/pwa/worker.js");

/*
 * The Mobile PWA: when it may exist (in a production build only for an approved release), what its
 * worker intercepts (never /api, never a write, never a Desktop page), how a
 * build without it cleans up after one with it, and what the build emits.
 */

describe("when the PWA may exist", () => {
  const resolve = (env, { mobile = true, command = "build", mode = "staging", processEnv = {} } = {}) => resolveMobilePwa({ mobileEnabled: mobile, command, mode, env, processEnv });

  it("only the exact string, only with Mobile on, and in a production build only with the PWA approval", () => {
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }), { enabled: true, refusedInProduction: false });
    assert.equal(resolve({ VITE_MOBILE_PWA: "true" }, { command: "serve", mode: "development" }).enabled, true);
    for (const value of ["TRUE", "1", "yes", " true", undefined, ""]) assert.equal(resolve({ VITE_MOBILE_PWA: value }).enabled, false, String(value));
    assert.equal(resolve({ VITE_MOBILE_PWA: "true" }, { mobile: false }).enabled, false, "no PWA without Mobile");
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }, { mode: "production" }), { enabled: false, refusedInProduction: true }, "production without the approval stays off");
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }, { mode: "production", processEnv: { SMARTSPEND_MOBILE_RELEASE_APPROVED: "true" } }), { enabled: false, refusedInProduction: true }, "the Mobile approval alone does not approve the PWA");
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true", [PWA_APPROVAL]: "true" }, { mode: "production" }), { enabled: false, refusedInProduction: true }, "an env file cannot approve it: only the shell environment counts");
    for (const value of ["TRUE", "1", "yes", "true ", ""]) assert.equal(resolve({ VITE_MOBILE_PWA: "true" }, { mode: "production", processEnv: { [PWA_APPROVAL]: value } }).enabled, false, `approval ${JSON.stringify(value)}`);
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }, { mode: "production", processEnv: { [PWA_APPROVAL]: "true" } }), { enabled: true, refusedInProduction: false }, "an approved PWA release");
    assert.deepEqual(resolve({ VITE_MOBILE_PWA: "true" }, { mode: "production", mobile: false, processEnv: { [PWA_APPROVAL]: "true" } }), { enabled: false, refusedInProduction: true }, "approved, but Mobile is off");
    assert.deepEqual(resolve({}, { mode: "production", processEnv: { [PWA_APPROVAL]: "true" } }), { enabled: false, refusedInProduction: false }, "an approval alone asks for nothing");
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
    assert.deepEqual(emitted(true, true), ["smartspend-mobile-sw.js", "m/manifest.webmanifest", "m/icon-192.png", "m/icon-512.png", "m/icon-maskable-512.png", "m/apple-touch-icon.png"]);
    const plugin = mobileEntryPlugin(true, { pwa: false });
    assert.match(plugin.load(plugin.resolveId("virtual:smartspend-mobile-pwa")), /MOBILE_PWA = false/);
  });

  it("the worker lives at the root so its scope can be /m, which covers /m and /m/...", () => {
    assert.equal(PWA_SW_PATH, "/smartspend-mobile-sw.js");
    assert.equal(PWA_SCOPE, "/m");
    // A worker may only control its own directory or below: /m/sw.js could not have had scope /m.
    assert.ok(!PWA_SW_PATH.startsWith("/m/"));
    assert.equal(PWA_LEGACY_SW_PATH, "/m/sw.js");
    assert.match(pwaEntrySource(true, "v"), /PWA_SW_PATH = "\/smartspend-mobile-sw\.js"[\s\S]*PWA_SCOPE = "\/m";[\s\S]*PWA_LEGACY_SCOPE = "\/m\/"/);
  });

  it("the manifest is scoped to Mobile, starts there and is installable: 192 and 512 icons, a separate maskable one, theme colour", () => {
    const manifest = pwaManifest();
    assert.equal(manifest.start_url, "/m/");
    assert.ok(manifest.start_url.startsWith(manifest.scope), "start_url is inside the scope");
    assert.equal(manifest.scope, "/m");
    assert.equal(manifest.id, "/m");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#07142B");
    assert.ok(manifest.name && manifest.short_name);
    assert.deepEqual(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.type, icon.purpose]), [
      ["/m/icon-192.png", "192x192", "image/png", "any"],
      ["/m/icon-512.png", "512x512", "image/png", "any"],
      ["/m/icon-maskable-512.png", "512x512", "image/png", "maskable"],
    ]);
    for (const icon of manifest.icons) assert.ok(icon.src.startsWith("/m/"), "served from the Mobile folder");
    assert.ok(manifest.icons.every((icon) => !icon.purpose.includes(" ")), "any and maskable are never combined in one icon");
  });

  it("the committed icon files are real PNGs of the sizes the manifest and Apple's touch icon declare", () => {
    const size = (file) => {
      const png = readFileSync(new URL(`../src/mobile/pwa/icons/${file}`, import.meta.url));
      assert.equal(png.subarray(1, 4).toString(), "PNG", file);
      return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
    };
    for (const icon of PWA_ICONS) assert.equal(size(icon.file), icon.sizes, icon.file);
    assert.equal(size("apple-touch-icon.png"), "180x180");
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
  it("controls /m and /m/ alike, and anything under /m/, but not a sibling path that merely starts with m", async () => {
    const worker = runWorker();
    for (const url of ["https://app.test/m", "https://app.test/m/", "https://app.test/m/activity", "https://app.test/m/?x=1"]) {
      const response = await worker.fire({ url, mode: "navigate" });
      assert.equal(response.status, 200, url);
    }
    for (const url of ["https://app.test/mobile", "https://app.test/mx", "https://app.test/market"]) assert.equal(await worker.fire({ url, mode: "navigate" }), null, url);
  });

  it("an offline reload of /m or /m/ shows the offline page (not the browser's error), with no data and nothing cached", async () => {
    const worker = runWorker();
    worker.setOnline(false);
    for (const url of ["https://app.test/m", "https://app.test/m/"]) {
      const response = await worker.fire({ url, mode: "navigate" });
      assert.equal(response.status, 503, url);
      assert.match(await response.text(), /You're offline[\s\S]*أنت غير متصل/);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.equal(worker.stores.has(`${PWA_CACHE_PREFIX}v1`), false, "nothing was written to this build's cache");
  });

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

  it("a build without the PWA removes a Mobile worker (either scope) and its caches, and nothing else", async () => {
    const browser = fakeNavigator(["https://app.test/m/", "https://app.test/m", "https://app.test/"]);
    const cacheStorage = fakeCaches(["sm-pwa-abc", "other"]);
    const result = await removeWorker({ nav: browser.nav, cacheStorage });
    assert.deepEqual(result, { state: "off", removed: 2 });
    assert.deepEqual(browser.removed, ["https://app.test/m/", "https://app.test/m"]);
    assert.deepEqual([...cacheStorage.names], ["other"]);
    assert.deepEqual(browser.registered, []);
  });

  it("a PWA build registers the worker with scope /m and adds the installation metadata", async () => {
    const browser = fakeNavigator([]);
    const page = new JSDOM('<!doctype html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body></body>').window.document;
    const result = await registerWorker({ nav: browser.nav, doc: page });
    assert.equal(result.state, "on");
    assert.deepEqual(browser.registered, [["/smartspend-mobile-sw.js", { scope: "/m", updateViaCache: "none" }]]);
    assert.equal(page.querySelector('link[rel="manifest"]').getAttribute("href"), "/m/manifest.webmanifest");
    assert.equal(page.querySelector('meta[name="theme-color"]').getAttribute("content"), "#07142B");
    assert.equal(page.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"), "/m/apple-touch-icon.png");
    assert.equal(page.querySelector('meta[name="apple-mobile-web-app-capable"]').getAttribute("content"), "yes");
    assert.equal(page.querySelector('meta[name="viewport"]').getAttribute("content"), "width=device-width, initial-scale=1.0, viewport-fit=cover");
    assert.equal(page.querySelectorAll('link[rel="manifest"]').length, 1);
    await registerWorker({ nav: browser.nav, doc: page });
    assert.equal(page.querySelectorAll("[data-sm-pwa]").length, 6, "a second call adds nothing");
    assert.equal(page.querySelector('meta[name="viewport"]').getAttribute("content").match(/viewport-fit/g).length, 1);
  });

  it("leaving Mobile takes the metadata back out and restores the viewport, so a Desktop page never carries it", async () => {
    const page = new JSDOM('<!doctype html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>x</title></head><body></body>').window.document;
    await registerWorker({ nav: fakeNavigator([]).nav, doc: page });
    releaseHead(page);
    assert.equal(page.querySelectorAll("[data-sm-pwa]").length, 0);
    assert.equal(page.querySelector('link[rel="manifest"]'), null);
    assert.equal(page.querySelector('meta[name="viewport"]').getAttribute("content"), "width=device-width, initial-scale=1.0");
    assert.equal(page.querySelector("[data-sm-pwa-viewport]"), null);
    assert.equal(page.querySelector("title").textContent, "x");
    releaseHead(page);
    releaseHead(undefined);
  });

  it("a PWA build first unregisters the first builds' /m/ registration, so the old worker can't stay the more specific scope", async () => {
    const browser = fakeNavigator(["https://app.test/m/", "https://app.test/"]);
    await registerWorker({ nav: browser.nav, doc: new JSDOM("<!doctype html><head></head>").window.document });
    assert.deepEqual(browser.removed, ["https://app.test/m/"]);
    assert.equal(browser.registered.length, 1);
  });

  it("no service worker support: nothing happens; a failure is reported, not thrown", async () => {
    assert.deepEqual(await registerWorker({ nav: {} }), { state: "unsupported" });
    assert.deepEqual(await removeWorker({ nav: {} }), { state: "unsupported" });
    const broken = { serviceWorker: { register: async () => { throw new Error("SecurityError"); } } };
    assert.deepEqual(await registerWorker({ nav: broken, doc: new JSDOM("<!doctype html><head></head>").window.document }), { state: "failed" });
  });

  it("in the shipped test build the module says off", async () => {
    const { PWA_BUILD } = await import("../src/mobile/pwa/worker.js");
    assert.equal(PWA_BUILD, false);
    // ...so syncPwa takes the clean-up path (here there is no service worker at all).
    assert.deepEqual(await syncPwa(), { state: "unsupported" });
  });
});

describe("retiring the PWA from an origin (the rollback a flag-off build can't do itself)", () => {
  it("is asked for with the exact string, only in a build without the PWA, production included", () => {
    const env = { SMARTSPEND_MOBILE_PWA_RETIRE: "true" };
    assert.deepEqual(resolvePwaRetire({ pwaEnabled: false, command: "build", mode: "staging", env }), { enabled: true, refusedInProduction: false });
    assert.deepEqual(resolvePwaRetire({ pwaEnabled: false, command: "build", mode: "production", env }), { enabled: true, refusedInProduction: false }, "rolling back a production PWA needs no release approval");
    assert.equal(resolvePwaRetire({ pwaEnabled: false, command: "build", mode: "production", env: {} }).enabled, false, "never without the variable");
    assert.equal(resolvePwaRetire({ pwaEnabled: true, command: "build", mode: "staging", env }).enabled, false, "a PWA build has its real worker");
    assert.equal(resolvePwaRetire({ pwaEnabled: false, command: "build", mode: "staging", env: { SMARTSPEND_MOBILE_PWA_RETIRE: "TRUE" } }).enabled, false);
    assert.equal(resolvePwaRetire({ pwaEnabled: false, command: "serve", mode: "development", env }).enabled, false);
  });

  it("emits only the retire worker, also when Mobile is off", () => {
    const emitted = (enabled, options) => {
      const files = [];
      const plugin = mobileEntryPlugin(enabled, options);
      plugin.configResolved({ root: process.cwd() });
      plugin.generateBundle.call({ emitFile: (file) => files.push([file.fileName, String(file.source)]) }, {}, {});
      return files;
    };
    const off = emitted(false, { retire: true });
    // The current worker's address, and the first builds' one (a staging origin may still hold either).
    assert.deepEqual(off.map(([name]) => name), ["smartspend-mobile-sw.js", "m/sw.js"]);
    assert.deepEqual(off.map(([name]) => `/${name}`), [PWA_SW_PATH, PWA_LEGACY_SW_PATH]);
    for (const [, source] of off) assert.equal(source, retireSwSource());
    assert.deepEqual(emitted(false, {}), [], "without the option a flag-off build emits nothing, as before");
  });

  it("the retire worker deletes only the PWA's caches, unregisters itself and reloads the pages it controlled", async () => {
    const listeners = {};
    const stores = new Set(["sm-pwa-abc", "sm-pwa-def", "other-app"]);
    const reloaded = [];
    let unregistered = false;
    let skipped = false;
    const self = {
      skipWaiting: () => { skipped = true; },
      registration: { unregister: async () => { unregistered = true; return true; } },
      clients: { matchAll: async () => [{ url: "https://app.test/m/accounts", navigate: async (url) => reloaded.push(url) }] },
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    const caches = { keys: async () => [...stores], delete: async (name) => stores.delete(name) };
    new Function("self", "caches", retireSwSource())(self, caches);
    listeners.install({});
    assert.equal(skipped, true);
    let work;
    listeners.activate({ waitUntil: (promise) => { work = promise; } });
    await work;
    assert.deepEqual([...stores], ["other-app"]);
    assert.equal(unregistered, true);
    assert.deepEqual(reloaded, ["https://app.test/m/accounts"]);
    assert.equal(listeners.fetch, undefined, "it intercepts nothing");
    assert.doesNotMatch(retireSwSource(), /fetch|\/api|postMessage/);
  });
});
