import "./helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement as h } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { flush, installDom, render } from "./helpers/dom.mjs";

/*
 * With Mobile off (the default, and what the test loader gives the route
 * table), the application's routing must be exactly the Desktop routing:
 * no /m routes, no redirect, no effect from a stored presentation choice.
 */

const dom = installDom();
const { window } = dom;
after(() => dom.window.close());

window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = class { observe() {} disconnect() {} };
window.HTMLCanvasElement.prototype.getContext = () => null;
for (const key of ["localStorage", "sessionStorage", "matchMedia", "IntersectionObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
}

const fetchCalls = [];
globalThis.fetch = window.fetch = async (...args) => {
  fetchCalls.push(args);
  throw new Error("no network in this test");
};

const { default: i18n } = await import("../src/i18n.js");
const { default: Router } = await import("../src/routes/Router.jsx");
const { routes, guestRoutes, emailLinkRoutes, userRoutes } = await import("../src/routes/Routes.jsx");
const { default: ThemeProvider } = await import("../src/contexts/theme/themeProvider.jsx");
const { default: LanguageProvider } = await import("../src/contexts/language/languageProvider.jsx");
const { AuthContext } = await import("../src/contexts/auth/authContext.js");
const { PRESENTATION_KEY } = await import("../src/mobile/presentation/preference.js");

const where = { current: null };
function Probe() {
  where.current = useLocation();
  return null;
}

const here = () => `${where.current.pathname}${where.current.search}${where.current.hash}`;
let view;

async function renderApp(path, { authenticated = false } = {}) {
  const auth = { initializing: false, isAuthenticated: authenticated, user: authenticated ? { id: 1, name: "Test" } : null };
  view = await render(
    h(MemoryRouter, { initialEntries: [path] },
      h(ThemeProvider, null,
        h(LanguageProvider, null,
          h(AuthContext.Provider, { value: auth }, h(Router), h(Probe))))),
  );
  await flush();
}

const allPaths = (list) => list.flatMap((route) => [route.path, ...allPaths(route.children ?? [])]).filter((path) => typeof path === "string");

beforeEach(async () => {
  window.localStorage.clear();
  await act(async () => { await i18n.changeLanguage("en"); });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("Mobile off: the route table is the Desktop one", () => {
  it("registers no /m route anywhere in the four Desktop groups", () => {
    const paths = allPaths([...routes, ...guestRoutes, ...emailLinkRoutes, ...userRoutes]);

    assert.ok(paths.length > 40, "the Desktop table was read");
    assert.deepEqual(paths.filter((path) => path === "/m" || path.startsWith("/m/") || path.startsWith("m/")), []);
  });

  it("an /m address is just an unknown address: the Desktop not-found page, with no redirect", async () => {
    for (const path of ["/m", "/m/activity?x=1", "/m/more#h"]) {
      await renderApp(path, { authenticated: true });
      assert.equal(here(), path, `${path} must not be redirected`);
      assert.ok(document.querySelector(".not-found-page"), `${path} shows the not-found page`);
      assert.equal(document.querySelector(".sm-root"), null);
      await view.unmount();
      view = null;
    }
  });

  it("a stored 'mobile' choice changes nothing", async () => {
    window.localStorage.setItem(PRESENTATION_KEY, "mobile");
    await renderApp("/", { authenticated: true });

    assert.equal(here(), "/");
    assert.equal(document.querySelectorAll(".smartspend-landing--page").length, 1);
    assert.equal(document.querySelector(".sm-root"), null);
  });

  it("a signed-out visit to a protected page still goes to sign-in, remembering the canonical address", async () => {
    await renderApp("/dashboard/accounts?x=1#h");
    assert.equal(here(), "/signin");
    assert.equal(where.current.state.from, "/dashboard/accounts?x=1#h");
  });

  it("made no network request while routing", () => {
    assert.deepEqual(fetchCalls.filter(([url]) => /\/api\//.test(String(url))), []);
  });
});
