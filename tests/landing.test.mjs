import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement as h } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { click, change, flush, installDom, render, submit } from "./helpers/dom.mjs";

/*
 * The home page (landing design) inside the real route table, with the real
 * theme and language providers and the app's i18next instance. Auth is a
 * plain context value, so no session or API is involved.
 */

const dom = installDom();
const { window } = dom;
after(() => dom.window.close());

// Browser APIs jsdom does not provide.
let reducedMotion = false;
window.matchMedia = (query) => ({
  matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
});
window.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { queueMicrotask(() => this.callback([{ target, isIntersecting: true }])); }
  unobserve() {}
  disconnect() {}
};
window.ResizeObserver = class { observe() {} disconnect() {} };
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;
// The app reads these as bare globals, as in a browser.
for (const key of ["localStorage", "sessionStorage", "matchMedia", "IntersectionObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

// The landing must never reach the network: every fetch is recorded and refused.
const fetchCalls = [];
globalThis.fetch = window.fetch = async (...args) => {
  fetchCalls.push(args);
  throw new Error("The landing page must not call the network");
};

const { default: i18n } = await import("../src/i18n.js");
const { default: Router } = await import("../src/routes/Router.jsx");
const { default: ThemeProvider } = await import("../src/contexts/theme/themeProvider.jsx");
const { default: LanguageProvider } = await import("../src/contexts/language/languageProvider.jsx");
const { AuthContext } = await import("../src/contexts/auth/authContext.js");
const { MOTION_STORAGE_KEY } = await import("../src/features/PublicPage/Home/LandingProvider.jsx");
const { landingMessages } = await import("../src/features/PublicPage/Home/landingMessages.js");
const anchors = await import("../src/features/PublicPage/Home/homeAnchors.js");
const demo = await import("../src/features/PublicPage/Home/landingDemo.js");

const location = { current: null };
function LocationProbe() {
  location.current = useLocation();
  return null;
}

async function renderApp(path = "/", { authenticated = false } = {}) {
  const auth = { initializing: false, isAuthenticated: authenticated, user: authenticated ? { id: 1, name: "Test" } : null };
  const view = await render(h(MemoryRouter, { initialEntries: [path] },
    h(ThemeProvider, null,
      h(LanguageProvider, null,
        h(AuthContext.Provider, { value: auth }, h(Router), h(LocationProbe))))));
  await flush();
  return view;
}

const $ = (selector) => {
  const node = document.querySelector(selector);
  assert.ok(node, `Missing ${selector}`);
  return node;
};
const button = (text) => {
  const node = [...document.querySelectorAll("button")].find((element) => element.textContent.trim() === text);
  assert.ok(node, `Missing button "${text}"`);
  return node;
};
const href = (node) => node.getAttribute("href");
const setLanguage = (language) => act(async () => { await i18n.changeLanguage(language); });
const keydown = (node, key) => act(async () => {
  node.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
});

let view;
beforeEach(async () => {
  window.localStorage.clear();
  reducedMotion = false;
  document.title = "SmartSpend";
  await setLanguage("en");
});
afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("landing layout", () => {
  it("renders the landing header and footer once, without the shared public chrome", async () => {
    view = await renderApp("/");
    assert.equal(document.querySelectorAll(".smartspend-landing--page").length, 1);
    assert.equal(document.querySelectorAll("header").length, 1);
    assert.equal(document.querySelectorAll("footer").length, 1);
    assert.equal(document.querySelectorAll(".site-header").length, 1);
    assert.equal(document.querySelectorAll("footer.footer").length, 1);
    assert.equal(document.querySelector(".home-navbar, .home-footer, .public-layout"), null);
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert.ok(document.querySelectorAll("main section").length >= 9);
    // Centered logo and name, the star field, and no globe.
    assert.ok(document.querySelector(".hero-lockup .hero-logo img"));
    assert.equal(document.querySelector(".hero-lockup .wordmark").textContent, "SmartSpend");
    assert.ok(document.querySelector(".hero .gravity-stars"));
    assert.equal(document.querySelector(".hero-globe, .orbital-note, .static-globe, .hero-visual"), null);
  });

  it("keeps the shared navbar and footer on other public pages", async () => {
    view = await renderApp("/features");
    assert.ok(document.querySelector(".public-layout .home-navbar"));
    assert.ok(document.querySelector(".public-layout .home-footer"));
    assert.equal(document.querySelector(".smartspend-landing"), null);
    assert.equal(document.documentElement.dataset.motion, undefined);
  });

  it("has unique ids and every section link points at a section that exists", async () => {
    view = await renderApp("/");
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    assert.equal(new Set(ids).size, ids.length, "Duplicate HTML ids");
    for (const link of document.querySelectorAll('.smartspend-landing a[href^="/#"]')) {
      assert.ok(document.getElementById(href(link).slice(2)), `Broken section link ${href(link)}`);
    }
    for (const id of Object.values(anchors.HOME_SECTIONS)) assert.ok(document.getElementById(id), `Missing section #${id}`);
    // Links of the previous home page land on the matching sections.
    for (const legacy of ["how-it-works", "security", "dashboard-preview"]) {
      assert.ok(document.getElementById(anchors.resolveHomeSection(legacy)), `Legacy #${legacy}`);
    }
  });

  it("points the public navbar's section links at sections of the landing", async () => {
    view = await renderApp("/about");
    const links = [...document.querySelectorAll(".home-navbar__links a")].map(href);
    assert.deepEqual(links, ["/#features", "/#capture", "/#trust", "/#faq"]);
    await view.unmount();
    view = await renderApp("/");
    for (const link of links) assert.ok(document.getElementById(link.slice(2)), link);
  });
});

describe("landing actions", () => {
  it("sends signed-out visitors to sign-up and sign-in through the account type page", async () => {
    view = await renderApp("/");
    const register = "/account-type?intent=register";
    const signin = "/account-type?intent=signin";
    assert.equal(href($(".hero-actions .btn-primary")), register);
    assert.equal($(".hero-actions .btn-primary").textContent, "Start with SmartSpend");
    assert.equal(href($(".cta-actions .btn-primary")), register);
    assert.equal(href($(".island-cta")), signin);
    assert.equal($(".island-cta").textContent, "Sign in");
    const openPlatform = [...document.querySelectorAll(".footer-cols a")].find((a) => a.textContent.includes("Open the platform"));
    assert.equal(href(openPlatform), signin);
    // Nothing opens a new tab or leaves for an external platform URL any more.
    assert.equal(document.querySelector('.smartspend-landing a[target="_blank"], .smartspend-landing a[href^="http"]'), null);

    await click($(".hero-actions .btn-primary"));
    assert.equal(location.current.pathname, "/account-type");
    assert.equal(location.current.search, "?intent=register");
    assert.equal(document.querySelector(".smartspend-landing"), null, "Navigated away from the landing");
  });

  it("opens the dashboard for signed-in users", async () => {
    view = await renderApp("/", { authenticated: true });
    for (const selector of [".hero-actions .btn-primary", ".cta-actions .btn-primary", ".island-cta"]) {
      assert.equal(href($(selector)), "/dashboard", selector);
      assert.equal($(selector).textContent, "Open SmartSpend", selector);
    }
    const openPlatform = [...document.querySelectorAll(".footer-cols a")].find((a) => a.textContent.includes("Open the platform"));
    assert.equal(href(openPlatform), "/dashboard");
  });

  it("offers both sign-up and sign-in in the mobile menu for signed-out visitors", async () => {
    view = await renderApp("/");
    await click($(".menu-toggle"));
    assert.equal($(".menu-toggle").getAttribute("aria-expanded"), "true");
    const foot = [...document.querySelectorAll(".menu-sheet-foot a")].map((a) => [a.textContent, href(a)]);
    assert.deepEqual(foot, [["Start with SmartSpend", "/account-type?intent=register"], ["Sign in", "/account-type?intent=signin"]]);
    await click(document.querySelector('#mobile-navigation a[href="/#faq"]'));
    assert.equal(document.querySelector(".menu-sheet"), null);
    assert.equal(location.current.hash, "#faq");
  });

  it("links the footer to help pages and the generated legal pages", async () => {
    view = await renderApp("/");
    const legal = [...document.querySelectorAll(".footer-legal a")].map((a) => [a.textContent, href(a)]);
    assert.deepEqual(legal, [
      ["Contact", "/contact"],
      ["Support", "/support"],
      ["Terms & Conditions", "/terms.html"],
      ["Privacy Policy", "/privacy.html"],
    ]);
  });

  it("keeps the protected routes guarded", async () => {
    view = await renderApp("/dashboard");
    assert.equal(location.current.pathname, "/signin");
    assert.equal(location.current.state?.from, "/dashboard");
  });
});

describe("shared preferences", () => {
  it("switches language and theme through the app providers and their storage keys", async () => {
    view = await renderApp("/");
    await click($('[aria-label="التبديل إلى العربية"]'));
    assert.equal(i18n.language, "ar");
    assert.equal(document.documentElement.lang, "ar");
    assert.equal(document.documentElement.dir, "rtl");
    assert.equal(window.localStorage.getItem("i18nextLng"), "ar");
    assert.ok($("h1").textContent.includes("اعرف أين يذهب مالك"));
    assert.equal(document.title, "SmartSpend — اعرف أين يذهب مالك");

    const before = document.documentElement.dataset.theme;
    await click($(".theme-button"));
    const next = before === "dark" ? "light" : "dark";
    assert.equal(document.documentElement.dataset.theme, next);
    assert.equal(window.localStorage.getItem("theme"), next);

    const keys = Object.keys(window.localStorage);
    assert.equal(keys.some((key) => key.startsWith("smartspend-preview")), false, `Preview keys: ${keys}`);
  });

  it("pauses motion with the toggle, honours the device setting, and cleans up on leaving", async () => {
    view = await renderApp("/");
    assert.equal(document.documentElement.dataset.motion, "on");
    await click($(".motion-toggle"));
    assert.equal(document.documentElement.dataset.motion, "off");
    assert.equal(window.localStorage.getItem(MOTION_STORAGE_KEY), "off");
    await click($(".motion-toggle"));
    assert.equal(document.documentElement.dataset.motion, "on");

    await click([...document.querySelectorAll(".footer-legal a")].find((a) => href(a) === "/contact"));
    assert.equal(location.current.pathname, "/contact");
    assert.equal(document.documentElement.dataset.motion, undefined, "Landing attribute removed");
    assert.equal(document.title.startsWith("SmartSpend — "), false, "Landing title not left behind");
    await view.unmount();

    reducedMotion = true;
    view = await renderApp("/");
    assert.equal(document.documentElement.dataset.motion, "off");
    assert.equal($(".motion-toggle").disabled, true);
  });
});

describe("demo", () => {
  it("validates input, updates every figure, and stays consistent across sections and languages", async () => {
    view = await renderApp("/");
    await click(button("Add expense"));
    const dialog = $('[role="dialog"]');
    assert.ok(dialog.closest(".smartspend-landing--layer"), "Dialog keeps the landing scope");
    await change($("#expense-description"), "Preview grocery purchase");
    await change($("#expense-amount"), "0");
    await submit($(".expense-form"));
    assert.ok(document.querySelector('[role="alert"]'));
    await change($("#expense-amount"), "٤٥٫٥٠");
    await submit($(".expense-form"));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal($("#demo-balance").textContent, "$12,404.50");
    assert.equal($("#demo-expenses").textContent, "$3,795.50");
    assert.ok($(".transaction-list").textContent.includes("Preview grocery purchase"));

    await click($("#demo-tab-budgets"));
    assert.ok($(".budget-summary").textContent.includes("$3,795.50"));
    await click($("#demo-tab-goals"));
    assert.ok($(".goal-forecast").textContent.includes("12 months"));
    await change($("#monthly-saving"), "600");
    assert.ok($(".goal-forecast").textContent.includes("8 months"));
    assert.ok($(".goal-forecast").textContent.includes("June 2027"));
    await keydown($("#demo-tab-goals"), "Home");
    assert.equal($("#demo-tab-overview").getAttribute("aria-selected"), "true");

    await click($("#capture-tab-receipt"));
    await click(button("Review the result"));
    assert.ok($(".capture-result").textContent.includes("$62.50"));
    await click(button("Add to the demo"));
    assert.equal($("#demo-expenses").textContent, "$3,858");
    assert.equal($("#demo-balance").textContent, "$12,342");
    await click(button("How is this month looking?"));
    assert.ok($(".chat-response").textContent.includes("$3,858"));
    assert.ok($(".chat-response").textContent.includes("a surplus of $2,342"));

    // Arabic: the state survives the switch; figures stay isolated inside sentences.
    await click($('[aria-label="التبديل إلى العربية"]'));
    assert.equal($("#demo-expenses").textContent, "$3,858");
    assert.ok($(".chat-response").textContent.includes("الفائض ⁦$2,342⁩"));
    await click($("#demo-tab-goals"));
    assert.ok($(".goal-forecast").textContent.includes("حوالي 12 شهرًا"));
    await change($("#monthly-saving"), "600");
    assert.ok($(".goal-forecast").textContent.includes("حوالي 8 أشهر"));
    assert.ok($(".goal-forecast").textContent.includes("يونيو 2027"));
    await click($("#demo-tab-overview"));

    await click($("#capture-tab-text"));
    await change($("#capture-description"), "قهوة الصباح");
    await click($(".review-btn"));
    assert.ok($(".capture-result").textContent.includes("قهوة الصباح"));
    assert.ok($(".capture-result").textContent.includes("$28"));
    await click($(".capture-result .btn"));
    assert.equal($("#demo-expenses").textContent, "$3,886");
    assert.equal($("#demo-balance").textContent, "$12,314");
    await keydown($("#capture-tab-text"), "ArrowLeft");
    assert.equal($("#capture-tab-voice").getAttribute("aria-selected"), "true", "ArrowLeft moves forward and wraps in RTL");
    assert.equal(document.activeElement, $("#capture-tab-voice"));

    assert.equal(fetchCalls.length, 0, "The demo never calls the API");
  });

  it("keeps the business roadmap labelled as in development, with a working dialog", async () => {
    view = await renderApp("/");
    assert.ok($(".status-pill").textContent.includes("In development"));
    await click($(".business-button"));
    assert.ok($('[role="dialog"]').textContent.includes("In development"));
    await keydown(document, "Escape");
    assert.equal(document.querySelector('[role="dialog"]'), null);
    // Demo, capture and assistant examples each carry their sample-data label.
    for (const selector of [".demo-top .sample-badge", ".capture-head .sample-badge", ".assistant-head .sample-badge"]) assert.ok(document.querySelector(selector), selector);
  });

  it("shows no raw translation keys in either language", async () => {
    view = await renderApp("/");
    const pattern = /\b(?:meta|header|hero|ribbon|demo|features|capture|insights|trust|business|faq|closing|footer|toast|expense|info|categories|cta|home)\.[a-zA-Z]/;
    for (const language of ["en", "ar"]) {
      await setLanguage(language);
      await click($(".business-button"));
      const html = document.body.innerHTML;
      assert.equal(pattern.exec(html)?.[0] ?? null, null, `Untranslated key in ${language}: ${html.slice(pattern.exec(html)?.index - 40, pattern.exec(html)?.index + 40)}`);
      await keydown(document, "Escape");
    }
  });
});

describe("landing copy and arithmetic", () => {
  const leaves = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) =>
    typeof value === "object" ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  const withoutPlurals = (keys) => new Set(keys.map((key) => key.replace(/_(zero|one|two|few|many|other)$/, "")));

  it("has the same keys in Arabic and English", () => {
    assert.deepEqual([...withoutPlurals(leaves(landingMessages.ar))].sort(), [...withoutPlurals(leaves(landingMessages.en))].sort());
  });

  it("agrees month counts in Arabic and English", async () => {
    const months = (language, count) => i18n.getFixedT(language, "landing")("demo.goals.months", { count });
    assert.equal(months("ar", 1), "شهر واحد");
    assert.equal(months("ar", 2), "شهرين");
    assert.equal(months("ar", 8), "8 أشهر");
    assert.equal(months("ar", 12), "12 شهرًا");
    assert.equal(months("ar", 48), "48 شهرًا");
    assert.equal(months("en", 1), "1 month");
    assert.equal(months("en", 12), "12 months");
  });

  it("keeps the demo arithmetic of the approved design", () => {
    for (const invalid of ["", "0", "-1", "1e5", "NaN", "12.345", "100001", "1,25"]) assert.equal(demo.parseAmount(invalid), null, invalid);
    assert.equal(demo.parseAmount("١٢٫٥٠"), 12.5);
    assert.equal(demo.parseAmount("۱۲.۵"), 12.5);
    assert.equal(demo.parseAmount("100000"), 100000);
    const totals = demo.demoTotals([]);
    assert.equal(totals.budgets.reduce((sum, budget) => sum + budget.spent, 0), totals.expenses);
    assert.equal(demo.WEEKLY_SPENDING.reduce((sum, value) => sum + value, 0), totals.expenses, "Weekly chart sums to monthly spending");
    assert.equal(demo.monthAfter(12, "en"), "October 2027");
    for (let monthly = 100; monthly <= 1200; monthly += 50) {
      const count = demo.monthsToGoal(monthly);
      assert.ok(count * monthly >= 4800 && (count - 1) * monthly < 4800, `Month count for $${monthly}`);
    }
    assert.equal(demo.ltr("$1,450"), "⁦$1,450⁩");
    assert.equal(demo.money(12404.5), "12,404.50");
  });
});
