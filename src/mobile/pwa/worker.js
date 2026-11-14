import { MOBILE_PWA, PWA_CACHE_PREFIX, PWA_LEGACY_SCOPE, PWA_SCOPE, PWA_SW_PATH } from "virtual:smartspend-mobile-pwa";

/*
 * The only Mobile code that touches the service worker API. What it does depends
 * on the build (scripts/mobilePwa.mjs):
 *
 * - PWA on (a local or staging build that asked for it): adds the installation
 *   metadata to the head (manifest, theme colour, Apple touch icon, viewport-fit)
 *   and registers the worker (scope /m, so both /m and /m/... are covered). The
 *   worker only ever controls Mobile pages. The metadata is removed again when
 *   Mobile unmounts (releaseHead), so a Desktop page never carries it.
 * - PWA off (every other build, production included): removes any worker an
 *   earlier build registered for /m or /m/ and deletes its caches. This is the
 *   rollback path: a build without the PWA cleans up after one that had it, the
 *   next time a Mobile page loads (navigations are network-first, so that page is
 *   the new build's).
 *
 * Nothing here ever reads or stores financial data.
 */

const MOBILE_SCOPES = new Set([PWA_SCOPE, PWA_LEGACY_SCOPE]);

const scopeOf = (registration) => {
  try {
    return new URL(registration.scope).pathname;
  } catch {
    return null;
  }
};

const ownsScope = (registration) => MOBILE_SCOPES.has(scopeOf(registration));

// Every tag carries data-sm-pwa so releaseHead can remove exactly these.
// Plain string concatenation, not an array join: a call expression would keep these strings in a build without the PWA.
const HEAD_TAGS =
  '<link rel="manifest" href="/m/manifest.webmanifest" data-sm-pwa="true">' +
  '<meta name="theme-color" content="#07142B" data-sm-pwa="true">' +
  '<link rel="apple-touch-icon" href="/m/apple-touch-icon.png" data-sm-pwa="true">' +
  '<meta name="apple-mobile-web-app-capable" content="yes" data-sm-pwa="true">' +
  '<meta name="mobile-web-app-capable" content="yes" data-sm-pwa="true">' +
  '<meta name="apple-mobile-web-app-title" content="SmartSpend" data-sm-pwa="true">';

function addHeadLinks(doc) {
  if (!doc?.head || doc.head.querySelector("[data-sm-pwa]")) return;
  doc.head.insertAdjacentHTML("beforeend", HEAD_TAGS);
  // viewport-fit=cover lets the screen reach the notch and the home bar; Mobile's own safe-area
  // padding (styles/mobile.css --sm-safe-*) keeps its content clear of them.
  const viewport = doc.head.querySelector('meta[name="viewport"]');
  const content = viewport?.getAttribute("content") ?? "";
  if (viewport && !/viewport-fit/.test(content)) {
    viewport.setAttribute("data-sm-pwa-viewport", content);
    viewport.setAttribute("content", `${content}${content ? ", " : ""}viewport-fit=cover`);
  }
}

/** Takes the installation metadata back out of the head and restores the viewport (Mobile is unmounting). */
export function releaseHead(doc = globalThis.document) {
  const head = doc?.head;
  if (!head) return;
  head.querySelectorAll("[data-sm-pwa]").forEach((node) => node.remove());
  const viewport = head.querySelector("[data-sm-pwa-viewport]");
  if (viewport) {
    viewport.setAttribute("content", viewport.getAttribute("data-sm-pwa-viewport"));
    viewport.removeAttribute("data-sm-pwa-viewport");
  }
}

/** Removes a worker an earlier build registered for /m or /m/, and its caches. */
export async function removeWorker({ nav = globalThis.navigator, cacheStorage = globalThis.caches } = {}) {
  const container = nav?.serviceWorker;
  if (!container) return { state: "unsupported" };
  try {
    let removed = 0;
    for (const registration of await container.getRegistrations()) {
      if (ownsScope(registration) && (await registration.unregister())) removed += 1;
    }
    if (cacheStorage) {
      for (const name of await cacheStorage.keys()) if (name.startsWith(PWA_CACHE_PREFIX)) await cacheStorage.delete(name);
    }
    return { state: "off", removed };
  } catch {
    return { state: "failed" };
  }
}

/*
 * Adds the installation metadata and registers the worker for scope /m. A registration the
 * first PWA builds made (script /m/sw.js, scope /m/) is unregistered first: left alone it
 * would be the more specific scope for every /m/... page and keep serving the old worker.
 * Reachable only in a PWA build (syncPwa).
 */
export async function registerWorker({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const container = nav?.serviceWorker;
  if (!container) return { state: "unsupported" };
  try {
    addHeadLinks(doc);
    for (const registration of (await container.getRegistrations?.()) ?? []) {
      if (scopeOf(registration) === PWA_LEGACY_SCOPE) await registration.unregister();
    }
    const registration = await container.register(PWA_SW_PATH, { scope: PWA_SCOPE, updateViaCache: "none" });
    return { state: "on", registration };
  } catch {
    return { state: "failed" };
  }
}

/*
 * The build constant alone decides: in a build without the PWA, MOBILE_PWA is the
 * literal false, so the bundler drops registerWorker and nothing in that build can
 * register a worker.
 */
export const syncPwa = () => (MOBILE_PWA ? registerWorker() : removeWorker());

/** Asks a waiting worker to take over; the page reloads when it does (see usePwa.js). */
export const activateWaiting = (registration) => registration?.waiting?.postMessage("sm-pwa-skip-waiting");

export const PWA_BUILD = MOBILE_PWA;

/** Calls `onChange` when a new worker takes control of this page; returns the unsubscribe. */
export function watchController(onChange, nav = globalThis.navigator) {
  const container = nav?.serviceWorker;
  container?.addEventListener?.("controllerchange", onChange);
  return () => container?.removeEventListener?.("controllerchange", onChange);
}

/** Whether this page is already controlled by a worker (an update then waits for the person). */
export const hasController = (nav = globalThis.navigator) => Boolean(nav?.serviceWorker?.controller);
