import "./domSetup.mjs";
import { Fragment, act, createElement as h, useState } from "react";
import { RouterProvider, createMemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { flush, installDom, render } from "./dom.mjs";

/*
 * The real Mobile tree (entry, gate, routes, identity boundary, screens) in a
 * router, with the app's real theme and language providers and i18next, and a
 * plain AuthContext value standing in for the AuthProvider. Browser storage is
 * jsdom's. The API is whatever fake the test installs (helpers/mobileApi.mjs).
 *
 * A second "tab" is simulated the only way one can be in a single window:
 * write to localStorage (the storage area tabs share) and dispatch the
 * `storage` event a real browser would deliver to this tab.
 */

export const dom = installDom();
export const { window } = dom;

window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
for (const key of ["localStorage", "sessionStorage", "matchMedia"]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

export const { default: i18n } = await import("../../src/i18n.js");
export const { AuthContext } = await import("../../src/contexts/auth/authContext.js");
const { default: AuthProvider } = await import("../../src/contexts/auth/authProvider.jsx");
const { default: ThemeProvider } = await import("../../src/contexts/theme/themeProvider.jsx");
const { default: LanguageProvider } = await import("../../src/contexts/language/languageProvider.jsx");
export const { default: MobileEntry } = await import("../../src/mobile/entry/MobileEntry.jsx");
export const { PRESENTATION_KEY } = await import("../../src/mobile/presentation/preference.js");
const { resetPreferenceStoresForTests } = await import("../../src/mobile/preferences/deviceStore.js");

/*
 * MobileEntry renders its screens through `lazy(() => import("../MobileApp.jsx"))`
 * (src/mobile/entry/MobileEntry.jsx), so settle()'s first call to that loader is the
 * same dynamic import() Node runs for any other module — it is not instant here: the
 * first time a process resolves that whole module graph (every Mobile screen, under
 * this harness's .jsx/.js loader hook, tests/helpers/loader.mjs) took about 3 seconds
 * on this machine. settle() below only advances event-loop turns (flush() is a single
 * setImmediate); 60 of those turns run out in well under 3 seconds of real transform
 * work, so a test could reach its assertions while MobileApp.jsx was still loading and
 * the Suspense fallback (MobileBoot, ".sm-boot") was still on screen.
 *
 * The fix is to pay that one-time cost here, deterministically, before any test in this
 * file calls mountMobile(): importing the exact same specifier again afterwards (what
 * React.lazy's loader does) resolves from Node's module cache, so the Suspense boundary
 * clears within a couple of microtask turns and settle()'s existing budget is enough.
 * This runs once per test FILE (module-level top-level await, like the imports above),
 * not globally: only a test that imports this harness pays it, and nothing is preloaded
 * for files that don't. Production is untouched — MobileEntry.jsx still calls a real
 * lazy() import, so a Desktop build never requests this chunk.
 */
const { MOBILE_SMART_SAVINGS } = await import("../../src/mobile/planning/smartSavingsGate.js");
await Promise.all([
  import("../../src/mobile/MobileApp.jsx"),
  // Smart Savings' own screen section is a second, independent lazy() boundary
  // (src/mobile/planning/smartSavingsGate.js) that only exists in the build that turns
  // the feature on (tests/mobileSavings.test.mjs's child process,
  // SMARTSPEND_TEST_SMART_SAVINGS=true). Warm it the same way, only when it exists —
  // calling import() on it while the flag is off would import a module the real build
  // never includes.
  ...(MOBILE_SMART_SAVINGS ? [import("../../src/mobile/planning/SmartPlanSection.jsx")] : []),
]);

export const USER_A = { id: 1, name: "Alex Example", timezone: "UTC" };
export const USER_B = { id: 2, name: "Blake Example", timezone: "UTC" };
export const TOKEN_A = "token-for-user-a";
export const TOKEN_B = "token-for-user-b";

/** Puts a session where the app keeps it: localStorage ("remember me") or sessionStorage (this tab only). */
export function storeSession({ token, user, where = "local" }) {
  const storage = where === "local" ? window.localStorage : window.sessionStorage;
  storage.setItem("ACCESS_TOKEN", token);
  storage.setItem("user", JSON.stringify(user));
}

export function clearSessionStorage() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of ["ACCESS_TOKEN", "token", "token_type", "user", "ROLE", "workspace", "remember_login"]) storage.removeItem(key);
  }
}

/** What another tab's write looks like to this one. */
export function otherTabWrote(key, newValue = null) {
  window.dispatchEvent(new window.StorageEvent("storage", { key, newValue, storageArea: window.localStorage }));
}

export const q = (selector, root = document) => root.querySelector(selector);
export const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

let navigateFromOutside = () => {};

function Probe() {
  const { pathname, search, hash } = useLocation();
  navigateFromOutside = useNavigate();
  return h("output", { id: "probe" }, `${pathname}${search}${hash}`);
}

/** The browser's Back (-1) or Forward (1) button, for the router in the harness. */
export const goBack = (steps = -1) => act(async () => { navigateFromOutside(steps); });

let setAuthFromOutside = () => {};

function AuthHarness({ initial, children }) {
  const [auth, setAuth] = useState(initial);
  setAuthFromOutside = setAuth;
  return h(AuthContext.Provider, { value: auth }, children);
}

const stub = (id) => h("div", { id }, id);

/**
 * @param {{ entry?: string, auth?: object, preference?: string }} options
 * `auth` is the AuthContext value; by default it is user A, matching what the caller stored.
 */
// `realAuth: true` mounts the app's real AuthProvider instead of a fixed context value (for tests of real sign-in dispatch).
export async function mountMobile({ entry = "/m", auth, preference = "mobile", realAuth = false } = {}) {
  if (preference) window.localStorage.setItem(PRESENTATION_KEY, preference);

  const value = auth ?? { isAuthenticated: true, initializing: false, token: TOKEN_A, user: USER_A, workspace: { id: 1, base_currency_code: "ILS", timezone: "UTC" } };
  const desktop = h("div", { id: "desktop" }, stub("desktop-page"));
  // A data router, as in the app (src/main.jsx), so screens can block navigation (useBlocker).
  const router = createMemoryRouter([{ path: "*", element: h(Fragment, null, h(Probe), h(MobileEntry, { desktop })) }], { initialEntries: [entry] });

  const view = await render(
    h(ThemeProvider, null,
      h(LanguageProvider, null,
        realAuth ? h(AuthProvider, null, h(RouterProvider, { router })) : h(AuthHarness, { initial: value },
          h(RouterProvider, { router })))),
  );

  await settle();

  return {
    ...view,
    router,
    unmount: async () => {
      await view.unmount();
      router.dispose();
    },
    /** Changes what the AuthProvider would report (same tab: login, logout, session end). */
    setAuth: (next) => act(async () => { setAuthFromOutside(next); }),
  };
}

/** Waits for the lazy chunk and for reads to finish: until nothing is loading, or a bounded number of turns. */
export async function settle(turns = 60) {
  for (let turn = 0; turn < turns; turn += 1) {
    await flush();
    const busy = document.querySelector(".sm-boot, [data-sm-state='loading'], [aria-busy='true'][role='status']");
    if (!busy) break;
  }
  await flush();
}

export const location = () => q("#probe")?.textContent;

export async function resetEnvironment(language = "en") {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // Mobile's device preferences are shared per identity in memory; a test starts from empty storage, so from nothing.
  resetPreferenceStoresForTests();
  window.innerWidth = 390;
  document.documentElement.style.fontSize = "";
  document.documentElement.removeAttribute("data-theme");
  await act(async () => { await i18n.changeLanguage(language); });
}
