/*
 * The Mobile PWA (manifest + service worker), local and staging only.
 *
 *   VITE_MOBILE_PWA   only the exact string "true" asks for it, and only in a
 *                     build where Mobile itself is on.
 *   production mode   NEVER: `vite build` in mode "production" (the Hostinger
 *                     workflow) resolves the PWA to off whatever the variable
 *                     says, and warns. There is no approval switch; shipping it
 *                     to production needs a change to this file.
 *
 * When on, the build emits two files and nothing else:
 *   m/sw.js                 the worker; scope /m/, so it never controls a Desktop,
 *                           sign-in, signed-link or legal page
 *   m/manifest.webmanifest  start_url /m/ (inside the scope; /m itself is not), scope /m/, standalone, navy theme
 * and the virtual module "virtual:smartspend-mobile-pwa" says MOBILE_PWA = true.
 * When off, that module says false, neither file exists, and the Mobile code
 * that runs instead removes a worker an earlier build may have left (rollback).
 *
 * The worker never touches /api, a non-GET request or another origin; it caches
 * only hashed /assets/* files, keeps navigations network-first, answers an
 * offline navigation with a built-in page that has no user data, queues nothing
 * and replays nothing. tests/mobilePwa.test.mjs runs it against fake caches.
 */

export const PWA_FLAG = "VITE_MOBILE_PWA";
export const PWA_ENTRY_ID = "virtual:smartspend-mobile-pwa";
export const PWA_SCOPE = "/m/";
export const PWA_SW_PATH = "/m/sw.js";
export const PWA_CACHE_PREFIX = "sm-pwa-";

/** @returns {{ enabled: boolean, refusedInProduction: boolean }} */
export function resolveMobilePwa({ mobileEnabled, command, mode, env }) {
  const asked = env?.[PWA_FLAG] === "true";
  const production = mode === "production" && command === "build";
  if (asked && production) return { enabled: false, refusedInProduction: true };
  return { enabled: Boolean(asked && mobileEnabled && mode !== "production"), refusedInProduction: false };
}

export function pwaEntrySource(enabled, version) {
  return `export const MOBILE_PWA = ${enabled ? "true" : "false"};\nexport const PWA_VERSION = ${JSON.stringify(enabled ? version : "")};\nexport const PWA_SW_PATH = ${JSON.stringify(PWA_SW_PATH)};\nexport const PWA_SCOPE = ${JSON.stringify(PWA_SCOPE)};\nexport const PWA_CACHE_PREFIX = ${JSON.stringify(PWA_CACHE_PREFIX)};\n`;
}

export function pwaManifest() {
  return {
    name: "SmartSpend",
    short_name: "SmartSpend",
    id: "/m",
    start_url: "/m/",
    scope: PWA_SCOPE,
    display: "standalone",
    orientation: "portrait",
    theme_color: "#07142B",
    background_color: "#F4F6FB",
    icons: [{ src: "/m/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" }],
  };
}

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07142B"><title>SmartSpend — offline</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;font:16px/1.5 system-ui,sans-serif;background:#F4F6FB;color:#07142B}@media (prefers-color-scheme:dark){body{background:#050B17;color:#E6ECF8}}main{max-width:28rem}h1{font-size:1.25rem}button{min-height:44px;padding:0 1rem;font:inherit;border-radius:12px;border:0;background:#2563EB;color:#fff}</style></head>
<body><main><h1>You're offline</h1><p>SmartSpend needs a connection to show your money. Nothing is saved or sent while you're offline.</p><p lang="ar" dir="rtl">أنت غير متصل. يحتاج SmartSpend إلى اتصال لعرض أموالك، ولا يُحفظ أو يُرسل شيء أثناء انقطاع الاتصال.</p><button type="button" onclick="location.reload()">Try again</button></main></body></html>`;

/*
 * The worker's source. Pure text so it can be tested without a browser: it only
 * uses `self`, `caches`, `fetch`, `Response`, `URL`.
 */
export function swSource(version) {
  return `/* SmartSpend Mobile service worker ${version}. Scope /m/. Caches only hashed /assets/*; never /api. */
const VERSION = ${JSON.stringify(version)};
const CACHE = ${JSON.stringify(PWA_CACHE_PREFIX)} + VERSION;
const OFFLINE = ${JSON.stringify(OFFLINE_PAGE)};
const ASSET = /^\\/assets\\/[A-Za-z0-9._-]+\\.(?:js|css|woff2|png|svg|webp)$/;

self.addEventListener("install", () => {
  /* Nothing is fetched at install: a new worker waits until the person chooses to update. */
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(${JSON.stringify(PWA_CACHE_PREFIX)}) && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "sm-pwa-skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    if (!url.pathname.startsWith("/m")) return;
    event.respondWith(fetch(request).catch(() => new Response(OFFLINE, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })));
    return;
  }

  if (ASSET.test(url.pathname) && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })());
  }
});
`;
}
