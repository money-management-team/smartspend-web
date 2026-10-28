import { MOBILE_PWA, PWA_CACHE_PREFIX, PWA_SCOPE, PWA_SW_PATH } from "virtual:smartspend-mobile-pwa";

/*
 * The only Mobile code that touches the service worker API. What it does depends
 * on the build (scripts/mobilePwa.mjs):
 *
 * - PWA on (a local or staging build that asked for it): adds the manifest link
 *   and the theme colour, and registers /m/sw.js with scope /m/. The worker only
 *   ever controls Mobile pages.
 * - PWA off (every other build, production included): removes any worker an
 *   earlier build registered for /m/ and deletes its caches. This is the
 *   rollback path: a build without the PWA cleans up after one that had it, the
 *   next time a Mobile page loads (navigations are network-first, so that page is
 *   the new build's).
 *
 * Nothing here ever reads or stores financial data.
 */

const sameScope = (registration) => {
  try {
    return new URL(registration.scope).pathname === PWA_SCOPE;
  } catch {
    return false;
  }
};

const HEAD_TAGS = '<link rel="manifest" href="/m/manifest.webmanifest" data-sm-pwa="true"><meta name="theme-color" content="#07142B" data-sm-pwa="true">';

function addHeadLinks(doc) {
  if (!doc?.head || doc.querySelector("[data-sm-pwa]")) return;
  doc.head.insertAdjacentHTML("beforeend", HEAD_TAGS);
}

/** Removes a worker an earlier build registered for /m/, and its caches. */
export async function removeWorker({ nav = globalThis.navigator, cacheStorage = globalThis.caches } = {}) {
  const container = nav?.serviceWorker;
  if (!container) return { state: "unsupported" };
  try {
    let removed = 0;
    for (const registration of await container.getRegistrations()) {
      if (sameScope(registration) && (await registration.unregister())) removed += 1;
    }
    if (cacheStorage) {
      for (const name of await cacheStorage.keys()) if (name.startsWith(PWA_CACHE_PREFIX)) await cacheStorage.delete(name);
    }
    return { state: "off", removed };
  } catch {
    return { state: "failed" };
  }
}

/** Adds the manifest link and registers /m/sw.js for scope /m/. Reachable only in a PWA build (syncPwa). */
export async function registerWorker({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  const container = nav?.serviceWorker;
  if (!container) return { state: "unsupported" };
  try {
    addHeadLinks(doc);
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
