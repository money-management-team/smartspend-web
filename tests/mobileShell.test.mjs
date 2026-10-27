import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement as h } from "react";
import { MemoryRouter, useLocation, useNavigationType, useRoutes } from "react-router-dom";
import { click, flush, installDom, render } from "./helpers/dom.mjs";

/*
 * The Mobile route tree inside a router, with the real theme and language
 * providers and the app's own i18next instance. Auth is a plain context
 * value plus a matching session in storage (the identity boundary compares
 * the two). No API exists in this file: every fetch is recorded and refused,
 * and the last test asserts that any request Mobile made was a GET.
 */

const dom = installDom();
const { window } = dom;
after(() => dom.window.close());

window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
for (const key of ["localStorage", "sessionStorage", "matchMedia"]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

const fetchCalls = [];
Object.defineProperty(globalThis, "fetch", {
  value: (...args) => { fetchCalls.push(args); return Promise.reject(new Error("no network in this test")); },
  configurable: true,
  writable: true,
});

const { default: i18n } = await import("../src/i18n.js");
const { AuthContext } = await import("../src/contexts/auth/authContext.js");
const { default: ThemeProvider } = await import("../src/contexts/theme/themeProvider.jsx");
const { default: LanguageProvider } = await import("../src/contexts/language/languageProvider.jsx");
const { default: MobileEntry } = await import("../src/mobile/entry/MobileEntry.jsx");
const { default: PresentationGate } = await import("../src/mobile/presentation/PresentationGate.jsx");
const { MOBILE_MESSAGES } = await import("../src/mobile/i18n/messages.js");
const { PRESENTATION_KEY } = await import("../src/mobile/presentation/preference.js");
const { markPresentationBusy, resetPresentationGuard, resetRedirectHistory } = await import("../src/mobile/presentation/guard.js");
const { isCompactNav } = await import("../src/mobile/shell/useCompactNav.js");
const { MOBILE_SCREENS, COMPACT_NAV_MAX_REM } = await import("../src/mobile/navigation.js");

const stub = (id, text = id) => h("div", { id }, text);
const DESKTOP_ROUTES = [
  { path: "/dashboard", element: stub("desktop-dashboard") },
  { path: "/dashboard/settings", element: stub("desktop-settings") },
  { path: "/dashboard/accounts", element: stub("desktop-accounts") },
  { path: "/dashboard/financial-operations", element: stub("desktop-operations") },
  { path: "/signin", element: stub("desktop-signin") },
  { path: "/verify-email/:id/:hash", element: stub("desktop-verify") },
  { path: "*", element: stub("desktop-not-found") },
];

function Desktop() {
  return useRoutes(DESKTOP_ROUTES);
}

function Probe() {
  const { pathname, search, hash, state } = useLocation();
  const type = useNavigationType();
  return h("output", { id: "probe", "data-from": state?.from ?? "", "data-nav": type }, `${pathname}${search}${hash}`);
}

let mounted;

const SESSION = { token: "token-user-a", user: { id: 1, name: "Test User" } };

async function mount({ entry = "/m/more", authenticated = true, initializing = false, preference = "mobile", gate } = {}) {
  if (preference) window.localStorage.setItem(PRESENTATION_KEY, preference);
  if (authenticated) {
    window.localStorage.setItem("ACCESS_TOKEN", SESSION.token);
    window.localStorage.setItem("user", JSON.stringify(SESSION.user));
  }
  const auth = { isAuthenticated: authenticated, initializing, token: authenticated ? SESSION.token : null, user: authenticated ? SESSION.user : null };
  const router = gate
    ? h(PresentationGate, gate, null)
    : h(MobileEntry, { desktop: h(Desktop) });

  mounted = await render(
    h(ThemeProvider, null,
      h(LanguageProvider, null,
        h(AuthContext.Provider, { value: auth },
          h(MemoryRouter, { initialEntries: [entry] }, h(Probe), router)))),
  );
  // The Mobile screens are a lazy chunk: wait for the boot state to give way.
  for (let attempt = 0; attempt < 100 && document.querySelector(".sm-boot"); attempt += 1) await flush();
  await flush();
  return mounted.container;
}

const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const location = () => q("#probe").textContent;
const mainNav = () => q("nav.sm-nav");
const pressKey = (key, options = {}) =>
  act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  });
const setViewport = async (width, rootFontPx) => {
  window.innerWidth = width;
  document.documentElement.style.fontSize = rootFontPx ? `${rootFontPx}px` : "";
  await act(async () => { window.dispatchEvent(new window.Event("resize")); });
};

beforeEach(async () => {
  window.localStorage.clear();
  window.innerWidth = 390;
  document.documentElement.style.fontSize = "";
  resetPresentationGuard();
  resetRedirectHistory();
  await act(async () => { await i18n.changeLanguage("en"); });
  document.documentElement.removeAttribute("data-theme");
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("Mobile shell: structure", () => {
  it("shows the four destinations and a central Add button, in order, with accessible names", async () => {
    await mount();
    const nav = mainNav();
    const items = [...nav.children];

    assert.deepEqual(items.map((item) => item.tagName), ["A", "A", "BUTTON", "A", "A"]);
    assert.deepEqual(items.map((item) => item.textContent.trim()), ["Home", "Activity", "Add", "Planning", "More"]);
    assert.deepEqual(items.filter((item) => item.tagName === "A").map((item) => item.getAttribute("href")), ["/m", "/m/activity", "/m/planning", "/m/more"]);
    assert.equal(qa("a", nav).length, 4, "Add is not a fifth destination");
    assert.equal(items[2].getAttribute("href"), null, "Add is a button, not a link");
    assert.equal(items[2].getAttribute("type"), "button");
  });

  it("marks the current destination with aria-current and follows navigation", async () => {
    await mount({ entry: "/m/activity" });
    const current = () => qa("[aria-current]", mainNav()).map((item) => item.textContent.trim());

    assert.deepEqual(current(), ["Activity"]);

    await click(qa("a", mainNav()).find((link) => link.textContent.trim() === "Planning"));
    assert.equal(location(), "/m/planning");
    assert.deepEqual(current(), ["Planning"]);
  });

  it("has one h1 (the page title), headings below it, one main and one skip link", async () => {
    await mount({ entry: "/m/planning" });

    assert.deepEqual(qa("h1").map((node) => node.textContent), ["Planning"]);
    assert.ok(qa("h2").length >= 1);
    assert.equal(qa("h3, h4, h5, h6").length, 0);
    assert.equal(qa("main").length, 1);
    assert.equal(q(".sm-skip").getAttribute("href"), "#sm-main");
    assert.equal(q("#sm-main").tagName, "MAIN");
  });

  it("shows placeholders only: no money figures, no form, no input", async () => {
    for (const entry of ["/m/planning"]) {
      await mount({ entry });
      const text = q("main").textContent;

      assert.doesNotMatch(text, /\d[\d,.]*\s?(ILS|USD|EUR|₪|\$)/);
      assert.equal(qa("form, input, textarea, select", q("main")).length, 0);
      assert.match(text, /not available in mobile yet/i);
      await mounted.unmount();
      mounted = null;
    }
  });

  it("shows 'not available' for an unknown Mobile address, inside the shell", async () => {
    await mount({ entry: "/m/nothing-here" });
    assert.equal(q("h1").textContent, "Not available");
    assert.ok(q('a[href="/m"]', q("main")));
  });

  it("moves focus to the page title after navigating, not on first load", async () => {
    await mount({ entry: "/m/activity" });
    assert.notEqual(document.activeElement, q("h1"));

    await click(qa("a", mainNav()).find((link) => link.textContent.trim() === "More"));
    assert.equal(document.activeElement, q("h1"));
  });

  it("keeps the English and Arabic Mobile strings in exact key parity", () => {
    const keys = (value, prefix = "") =>
      Object.entries(value).flatMap(([key, item]) => (typeof item === "object" ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]));

    assert.deepEqual(keys(MOBILE_MESSAGES.ar).sort(), keys(MOBILE_MESSAGES.en).sort());
    for (const text of keys(MOBILE_MESSAGES.en).map((key) => key.split(".").reduce((node, part) => node[part], MOBILE_MESSAGES.ar))) {
      assert.ok(text.length > 0);
    }
  });
});

describe("Mobile shell: Add action", () => {
  const openAdd = async () => {
    const add = qa("button", mainNav()).find((button) => button.textContent.trim() === "Add");
    add.focus();
    await click(add);
    return add;
  };

  it("opens an informational dialog with no form, and nothing is requested", async () => {
    await mount();
    await openAdd();
    const dialog = q('[role="dialog"]');

    assert.ok(dialog);
    assert.equal(dialog.getAttribute("aria-modal"), "true");
    assert.equal(q(`#${dialog.getAttribute("aria-labelledby")}`).textContent, "Add");
    assert.match(dialog.textContent, /not available/i);
    assert.equal(qa("form, input, textarea, select", dialog).length, 0);
    assert.ok(q(".sm-portal").contains(dialog), "the dialog lives in the Mobile overlay container");
    assert.ok(q(".sm-root").contains(dialog), "and inside the Mobile root");
  });

  it("moves focus into the dialog, makes the page behind inert, and closes on Escape with focus restored", async () => {
    await mount();
    const add = await openAdd();
    const dialog = q('[role="dialog"]');

    assert.ok(dialog.contains(document.activeElement));
    for (const behind of ["header", "main", ".sm-nav-wrap"]) assert.ok(q(behind).hasAttribute("inert"), `${behind} is inert`);

    await pressKey("Escape");
    assert.equal(q('[role="dialog"]'), null);
    assert.equal(document.activeElement, add);
    for (const behind of ["header", "main", ".sm-nav-wrap"]) assert.equal(q(behind).hasAttribute("inert"), false, `${behind} is live again`);
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    await mount();
    await openAdd();
    const dialog = q('[role="dialog"]');
    const [first, last] = [qa("button", dialog)[0], qa("button", dialog).at(-1)];

    last.focus();
    await pressKey("Tab");
    assert.equal(document.activeElement, first);

    await pressKey("Tab", { shiftKey: true });
    assert.equal(document.activeElement, last);
  });

  it("closes from the Close button and from the backdrop, each restoring focus", async () => {
    await mount();
    let add = await openAdd();
    await click(qa("button", q('[role="dialog"]')).find((button) => button.textContent === "Close"));
    assert.equal(q('[role="dialog"]'), null);
    assert.equal(document.activeElement, add);

    add = await openAdd();
    await click(q(".sm-sheet-backdrop"));
    assert.equal(q('[role="dialog"]'), null);
    assert.equal(document.activeElement, add);
  });
});

describe("Mobile shell: compact navigation (Menu + Add)", () => {
  it("applies the rule in rem: the threshold, enlarged text and a normal phone", () => {
    assert.equal(COMPACT_NAV_MAX_REM, 17);
    assert.equal(isCompactNav(390, 16), false);
    assert.equal(isCompactNav(272, 16), false, "exactly 17rem is still the standard bar");
    assert.equal(isCompactNav(271, 16), true);
    assert.equal(isCompactNav(390, 24), true, "1.5x text turns a 390px phone into a 16.25rem screen");
    assert.equal(isCompactNav(0, 16), false);
    assert.equal(isCompactNav(300, 0), false, "an unreadable font size falls back to 16px");
    assert.equal(isCompactNav(300, 20, 15), false, "the threshold is a parameter");
  });

  it("switches to Menu + Add on a narrow screen and back, without remounting the page", async () => {
    await mount({ entry: "/m/more" });
    assert.equal(q(".sm-root").dataset.smNav, "standard");
    const title = q("h1");

    await setViewport(240);
    assert.equal(q(".sm-root").dataset.smNav, "compact");
    assert.deepEqual(qa("button", mainNav()).map((button) => button.textContent.trim()), ["Menu", "Add"]);
    assert.equal(qa("a", mainNav()).length, 0);
    assert.equal(q("h1"), title, "same page element: no remount");

    await setViewport(390);
    assert.equal(q(".sm-root").dataset.smNav, "standard");
  });

  it("goes compact on a normal-width phone when the text is enlarged", async () => {
    await mount();
    await setViewport(390, 24);
    assert.equal(q(".sm-root").dataset.smNav, "compact");
  });

  it("the menu lists every primary destination and Escape closes it, returning focus to Menu", async () => {
    await mount();
    await setViewport(240);
    const menu = qa("button", mainNav()).find((button) => button.textContent.trim() === "Menu");
    menu.focus();
    await click(menu);

    const dialog = q('[role="dialog"]');
    assert.equal(menu.getAttribute("aria-expanded"), "true");
    assert.deepEqual(qa("a", dialog).map((link) => link.textContent.trim()), ["Home", "Activity", "Planning", "More"]);
    assert.deepEqual(qa("a", dialog).map((link) => link.getAttribute("href")), MOBILE_SCREENS.map((screen) => screen.mobile));
    assert.ok(dialog.contains(document.activeElement));

    await pressKey("Escape");
    assert.equal(q('[role="dialog"]'), null);
    assert.equal(document.activeElement, menu);
    assert.equal(menu.getAttribute("aria-expanded"), "false");
  });

  it("opens with the keyboard path (a button), moves with the arrow keys, and navigates with Enter's click", async () => {
    await mount();
    await setViewport(240);
    const menu = qa("button", mainNav()).find((button) => button.textContent.trim() === "Menu");
    menu.focus();
    await click(menu);

    const links = qa("a", q('[role="dialog"]'));
    assert.equal(document.activeElement, links[0]);

    await pressKey("ArrowDown");
    assert.equal(document.activeElement, links[1]);
    await pressKey("End");
    assert.equal(document.activeElement, links[3]);
    await pressKey("ArrowDown");
    assert.equal(document.activeElement, links[0], "wraps around");
    await pressKey("ArrowUp");
    assert.equal(document.activeElement, links[3]);

    await click(links[2]);
    assert.equal(location(), "/m/planning");
    assert.equal(q('[role="dialog"]'), null, "choosing a destination closes the menu");
    assert.equal(q("h1").textContent, "Planning");
  });

  it("Add still works in the compact layout", async () => {
    await mount();
    await setViewport(240);
    const add = qa("button", mainNav()).find((button) => button.textContent.trim() === "Add");
    add.focus();
    await click(add);
    assert.ok(q('[role="dialog"]'));
    await pressKey("Escape");
    assert.equal(document.activeElement, add);
  });

  it("closes an open menu if the screen becomes wide again (no orphan overlay)", async () => {
    await mount();
    await setViewport(240);
    await click(qa("button", mainNav()).find((button) => button.textContent.trim() === "Menu"));
    assert.ok(q('[role="dialog"]'));

    await setViewport(390);
    assert.equal(q('[role="dialog"]'), null);
    assert.equal(q(".sm-root").querySelector("[inert]"), null, "nothing stays inert");

    await setViewport(240);
    assert.equal(q('[role="dialog"]'), null, "narrowing again does not bring the old menu back");
  });
});

describe("Mobile shell: language, direction and theme", () => {
  it("switches to Arabic: right-to-left document, translated labels, same DOM order", async () => {
    await mount({ entry: "/m/more" });
    const before = qa("a, button", mainNav()).length;

    await click(qa("button", q("main")).find((button) => button.getAttribute("lang") === "ar"));

    assert.equal(document.documentElement.dir, "rtl");
    assert.equal(document.documentElement.lang, "ar");
    assert.deepEqual([...mainNav().children].map((item) => item.textContent.trim()), ["الرئيسية", "النشاط", "إضافة", "التخطيط", "المزيد"]);
    assert.equal(qa("a, button", mainNav()).length, before);
    assert.equal(q("h1").textContent, "المزيد");
    assert.equal(mainNav().getAttribute("aria-label"), "التنقل الرئيسي");
    assert.equal(q(".sm-root").getAttribute("dir"), null, "direction comes from the document, not a copy on the root");
  });

  it("returns to English and left-to-right", async () => {
    await mount({ entry: "/m/more" });
    await click(qa("button", q("main")).find((button) => button.getAttribute("lang") === "ar"));
    await click(qa("button", q("main")).find((button) => button.getAttribute("lang") === "en"));

    assert.equal(document.documentElement.dir, "ltr");
    assert.equal(q("h1").textContent, "More");
  });

  it("switches theme through the app's own provider (html[data-theme]) and says which is pressed", async () => {
    await mount({ entry: "/m/more" });
    const button = (label) => qa("button", q("main")).find((item) => item.textContent === label);

    await click(button("Dark"));
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(button("Dark").getAttribute("aria-pressed"), "true");
    assert.equal(button("Light").getAttribute("aria-pressed"), "false");
    assert.equal(window.localStorage.getItem("theme"), "dark");

    await click(button("Light"));
    assert.equal(document.documentElement.dataset.theme, "light");
  });
});

describe("Presentation: redirects, preference and safety", () => {
  it("sends a signed-in visitor on a canonical page to Mobile when Mobile is chosen, keeping query and hash", async () => {
    await mount({ entry: "/dashboard?period=month#cards", preference: "mobile" });
    assert.equal(location(), "/m?period=month#cards");
    assert.equal(q("h1").textContent, "Home");
    assert.equal(q("#desktop-dashboard"), null, "the Desktop page never mounted");
  });

  it("redirects by replacing the history entry, so Back never returns to the redirected address", async () => {
    await mount({ entry: "/dashboard", preference: "mobile" });
    assert.equal(location(), "/m");
    assert.equal(q("#probe").dataset.nav, "REPLACE");
  });

  it("leaves a page without a Mobile equivalent on Desktop", async () => {
    await mount({ entry: "/dashboard/accounts?x=1", preference: "mobile" });
    assert.equal(location(), "/dashboard/accounts?x=1");
    assert.ok(q("#desktop-accounts"));
  });

  it("does not replace a working Desktop page with a placeholder", async () => {
    await mount({ entry: "/dashboard/financial-operations?new=expense", preference: "mobile" });
    assert.equal(location(), "/dashboard/financial-operations?new=expense");
    assert.ok(q("#desktop-operations"));
  });

  it("never redirects emailed links or authentication pages", async () => {
    await mount({ entry: "/verify-email/1/abc?expires=1&signature=a%2Bb", preference: "mobile" });
    assert.equal(location(), "/verify-email/1/abc?expires=1&signature=a%2Bb");
    assert.ok(q("#desktop-verify"));
  });

  it("shows Desktop when Mobile is chosen off: a Mobile address goes back to its canonical page", async () => {
    await mount({ entry: "/m/more?a=1", preference: "desktop" });
    assert.equal(location(), "/dashboard/settings?a=1");
    assert.ok(q("#desktop-settings"));
  });

  it("an unknown Mobile address goes to the Desktop dashboard when Desktop is chosen", async () => {
    await mount({ entry: "/m/unknown?x=1", preference: "desktop" });
    assert.equal(location(), "/dashboard");
  });

  it("waits while the session is still being restored", async () => {
    await mount({ entry: "/dashboard", preference: "mobile", initializing: true });
    assert.equal(location(), "/dashboard");
  });

  it("does not redirect a signed-out visitor; the Mobile tree sends them to sign-in with the Mobile address remembered", async () => {
    await mount({ entry: "/dashboard", preference: "mobile", authenticated: false });
    assert.equal(location(), "/dashboard", "the canonical address stays the one the guards remember");

    await mounted.unmount();
    mounted = null;
    await mount({ entry: "/m/activity?x=1", authenticated: false });
    assert.equal(location(), "/signin");
    assert.equal(q("#probe").dataset.from, "/m/activity?x=1");
  });

  it("the Desktop choice in More leaves Mobile for the matching canonical page and is stored on this device", async () => {
    await mount({ entry: "/m/more", preference: "mobile" });
    const radios = qa('input[name="sm-presentation"]');

    assert.deepEqual(radios.map((radio) => radio.value), ["auto", "mobile", "desktop"]);
    assert.equal(radios.find((radio) => radio.checked).value, "mobile");

    await click(radios.find((radio) => radio.value === "desktop"));
    assert.equal(window.localStorage.getItem(PRESENTATION_KEY), "desktop");
    assert.equal(location(), "/dashboard/settings");
  });

  it("'Open the full version' also switches to Desktop", async () => {
    await mount({ entry: "/m/more", preference: "mobile" });
    await click(qa("button", q("main")).find((button) => button.textContent === "Open the full version"));
    assert.equal(location(), "/dashboard/settings");
  });

  it("stores only the one presentation word, never anything financial", async () => {
    await mount({ entry: "/m/more", preference: "mobile" });
    await click(qa('input[name="sm-presentation"]').find((radio) => radio.value === "auto"));

    const stored = Object.fromEntries(Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)]));
    assert.equal(stored[PRESENTATION_KEY], undefined, "automatic removes the entry");

    // The session is what this test put there; Mobile adds nothing next to it.
    const fromThisTest = new Set(["ACCESS_TOKEN", "user"]);
    for (const key of Object.keys(stored).filter((name) => !fromThisTest.has(name))) assert.doesNotMatch(key, /amount|balance|transaction|token|account|currency/i, key);
    assert.equal(stored.ACCESS_TOKEN, SESSION.token);
  });

  it("does not redirect while a form is dirty or a request is in flight", async () => {
    const release = markPresentationBusy();
    await mount({ entry: "/dashboard", preference: "mobile" });
    assert.equal(location(), "/dashboard");
    assert.ok(q("#desktop-dashboard"));
    release();
  });

  it("does nothing at all when the gate is told Mobile is disabled, whatever the stored preference", async () => {
    window.localStorage.setItem(PRESENTATION_KEY, "mobile");
    await mount({ entry: "/dashboard", gate: { enabled: false } });
    assert.equal(location(), "/dashboard");

    await mounted.unmount();
    mounted = null;
    await mount({ entry: "/m/more", gate: { enabled: false } });
    assert.equal(location(), "/m/more");
  });

  it("the loop breaker stops a resolver that ping-pongs between two addresses", async () => {
    const pingPong = ({ pathname }) => (pathname === "/a" ? { pathname: "/b", search: "", hash: "" } : { pathname: "/a", search: "", hash: "" });
    const seen = [];
    const original = pingPong;
    const spy = (loc, context) => { seen.push(loc.pathname); return original(loc, context); };

    await mount({ entry: "/a", gate: { resolve: spy } });
    await flush();

    assert.ok(seen.length < 12, `rendered ${seen.length} times: the redirects did not stop`);
    assert.ok(["/a", "/b"].includes(location()));
  });
});

describe("Mobile only ever reads", () => {
  it("every request made in any test above was a GET", () => {
    for (const [url, init] of fetchCalls) {
      assert.equal((init?.method ?? "GET").toUpperCase(), "GET", String(url));
      assert.equal(init?.body, undefined, String(url));
    }
  });
});
