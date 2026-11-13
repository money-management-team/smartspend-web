import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { Component, createElement as h, lazy } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import { installFakeApi, healthyBackend } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { render } from "./helpers/dom.mjs";

/*
 * Mobile performance phase: the screens other than Home load on demand (src/mobile/lazyScreens.js), behind the shell's
 * ScreenBoundary. Here: the route table is exactly the one before the change, every lazy screen really resolves, the
 * boundary says "loading" and handles a failed download (and passes every other error on), and the idle prefetch only
 * runs when it is polite to. (The bundle's own sizes and the flag-off build are checked in mobileBundle.test.mjs.)
 */

after(() => dom.window.close());

const lazyScreens = await import("../src/mobile/lazyScreens.js");
const { mobileRoutes } = await import("../src/mobile/routes.jsx");
const { default: ScreenBoundary } = await import("../src/mobile/shell/ScreenBoundary.jsx");
const { default: i18n } = await import("../src/i18n.js");
await import("../src/mobile/i18n/register.js");

const { SCREEN_LOADERS, prefetchLikelyScreens, ...components } = lazyScreens;

const walk = (routes, base = "") => routes.flatMap((route) => [`${base}${route.path ?? (route.index ? "(index)" : "")}`, ...(route.children ? walk(route.children, `${base}${route.path ?? ""}/`) : [])]);

describe("the route table", () => {
  it("is exactly the table from before the screens became lazy: every path, in order", () => {
    const before = JSON.parse(readFileSync(new URL("./helpers/mobileRoutesBaseline.json", import.meta.url), "utf8"));
    assert.equal(before.length, 70);
    assert.deepEqual(walk(mobileRoutes), before);
  });
});

describe("the lazy screens", () => {
  it("every one resolves to a real component through its own preload (no misspelt module or export)", async () => {
    const names = Object.keys(components);
    assert.ok(names.length >= 50, `${names.length} lazy screens`);

    for (const name of names) {
      assert.equal(typeof components[name], "function", `${name} is a component`);
      assert.equal(typeof components[name].preload, "function", `${name} can be preloaded`);
      assert.equal(typeof (await components[name].preload()), "function", `${name} resolves to a component`);
    }
  });

  it("every screen module is listed once, so the prefetch and the test harness warm all of them", () => {
    assert.ok(Object.keys(SCREEN_LOADERS).length >= 40);
    assert.equal(Object.isFrozen(SCREEN_LOADERS), true);
    assert.ok(Object.values(SCREEN_LOADERS).every((load) => typeof load === "function"));
  });

  it("Home, the shell and the guards are not lazy: they are the first screen", () => {
    for (const eager of ["MobileHome", "MobileAppShell", "MobileRequireAuth", "MobileNotAvailable"]) assert.equal(eager in components, false, eager);
  });

  it("a screen whose module has already arrived renders at once, without the loading state", async () => {
    const { MobileNotifications } = components;
    await MobileNotifications.preload();

    // Rendering with the module present must not suspend: no fallback is ever on screen, even for one frame.
    const seen = [];
    const probe = new MutationObserver(() => seen.push(Boolean(document.querySelector("[data-sm-screen='loading']"))));
    probe.observe(document.body, { childList: true, subtree: true });
    const api = installFakeApi(healthyBackend());
    storeSession({ token: TOKEN_A, user: USER_A });
    try {
      view = await mountMobile({ entry: "/m/notifications" });
      await settle();
    } finally {
      probe.disconnect();
      api.restore();
    }
    assert.ok(q("[data-sm-screen='notifications']"), "the screen is there");
    assert.equal(seen.some(Boolean), false, "the loading state was never shown for a preloaded screen");
  });
});

/* A lazy screen whose code never arrives, one that fails to download, one that renders and one that throws while rendering. */
const never = lazy(() => new Promise(() => {}));
const failing = lazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: https://app.test/assets/Screen-abc12345.js")));
const fine = () => h("p", { id: "fine" }, "A screen that loaded");
const brokenRender = () => {
  throw new Error("a bug in the screen");
};

class Outer extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    return this.state.error ? h("p", { id: "outer" }, `outer caught: ${this.state.error.message}`) : this.props.children;
  }
}

let view;
const mount = async (element, entry = "/a") => {
  view = await render(h(MemoryRouter, { initialEntries: [entry] }, element));
  return view;
};
const flush = async () => {
  for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(async () => {
  await resetEnvironment();
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("the screen boundary", () => {
  it("says it is loading, in the page area, the way every screen does", async () => {
    await mount(h(ScreenBoundary, null, h(never)));

    const loading = q("[data-sm-screen='loading']");
    assert.equal(loading.dataset.smState, "loading");
    assert.equal(loading.getAttribute("aria-busy"), "true");
    assert.match(loading.textContent, /Loading/);
  });

  it("shows the screen when its code arrives", async () => {
    const arrives = lazy(() => Promise.resolve({ default: fine }));
    await mount(h(ScreenBoundary, null, h(arrives)));
    await flush();

    assert.ok(q("#fine"));
    assert.equal(q("[data-sm-screen='loading']"), null);
  });

  it("a download that fails says so and offers a reload; nothing else is touched", async () => {
    await mount(h(Outer, null, h(ScreenBoundary, null, h(failing))));
    await flush();

    const panel = q("[data-sm-screen='chunk-failed']");
    assert.ok(panel);
    assert.match(panel.textContent, /This screen couldn't be loaded/);
    assert.match(panel.textContent, /offline, reconnect and reload/);
    assert.equal(panel.querySelector("[role='alert']") !== null, true);
    assert.equal(q("[data-sm-action='reload-screen']").tagName, "BUTTON");
    assert.equal(q("#outer"), null, "the app's own error boundary was not triggered");
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    await mount(h(ScreenBoundary, null, h(failing)));
    await flush();

    assert.match(q("[data-sm-screen='chunk-failed']").textContent, /تعذّر تحميل هذه الشاشة/);
    assert.equal(q("[data-sm-action='reload-screen']").textContent.trim(), "إعادة التحميل");
  });

  it("any other error is not swallowed: it goes on to the app's own error boundary, as before", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      await mount(h(Outer, null, h(ScreenBoundary, null, h(brokenRender))));
      await flush();
    } finally {
      console.error = originalError;
    }

    assert.equal(q("[data-sm-screen='chunk-failed']"), null);
    assert.match(q("#outer").textContent, /a bug in the screen/);
  });

  it("going to another address clears a failed screen", async () => {
    let go;
    const Nav = () => {
      go = useNavigate();
      return null;
    };
    await mount(h("div", null, h(Nav), h(ScreenBoundary, null, h(Routes, null, h(Route, { path: "/a", element: h(failing) }), h(Route, { path: "/b", element: h(fine) })))), "/a");
    await flush();
    assert.ok(q("[data-sm-screen='chunk-failed']"));

    const { act } = await import("react");
    await act(async () => { go("/b"); });
    await flush();
    assert.equal(q("[data-sm-screen='chunk-failed']"), null);
    assert.ok(q("#fine"));
  });
});

describe("opening a screen in the real app", () => {
  let api;

  afterEach(async () => {
    await view?.unmount();
    view = null;
    api?.restore();
    api = null;
  });

  it("the shell stays up while a screen loads, and the screen then appears at its own address", async () => {
    api = installFakeApi(healthyBackend());
    storeSession({ token: TOKEN_A, user: USER_A });
    view = await mountMobile({ entry: "/m/activity" });
    await settle();

    assert.ok(q(".sm-bar-title"), "the app bar");
    assert.ok(q(".sm-nav, nav"), "the dock");
    assert.ok(q("[data-sm-screen='activity']"), "the lazy Activity screen loaded");
    assert.equal(q("[data-sm-screen='chunk-failed']"), null);
  });

  it("a signed-out visit loads sign-in through the same lazy path", async () => {
    api = installFakeApi(healthyBackend());
    view = await mountMobile({ entry: "/m/activity", auth: { isAuthenticated: false, initializing: false, token: null, user: null } });
    await settle();
    assert.ok(q("[data-sm-screen='signin']"));
  });

  it("the shell asks for the likely next screens once, when idle, and not again", async () => {
    api = installFakeApi(healthyBackend());
    storeSession({ token: TOKEN_A, user: USER_A });
    const scheduled = [];
    // In a browser `globalThis` is the window; Node has no such global, so the stub goes there.
    const original = { ric: globalThis.requestIdleCallback, cic: globalThis.cancelIdleCallback };
    globalThis.requestIdleCallback = (callback, options) => { scheduled.push(options); return 7; };
    globalThis.cancelIdleCallback = () => {};
    try {
      view = await mountMobile({ entry: "/m" });
      await settle();
      assert.equal(scheduled.length, 1);
      assert.deepEqual(scheduled[0], { timeout: 4000 });
    } finally {
      globalThis.requestIdleCallback = original.ric;
      globalThis.cancelIdleCallback = original.cic;
    }
  });
});

describe("the idle prefetch", () => {
  const fakeWindow = (over = {}) => {
    const calls = { idle: [], cancelled: [], timeouts: [], cleared: [] };
    const win = {
      navigator: { onLine: true, connection: { saveData: false, effectiveType: "4g" } },
      document: { visibilityState: "visible" },
      requestIdleCallback: (callback, options) => { calls.idle.push({ callback, options }); return 11; },
      cancelIdleCallback: (handle) => calls.cancelled.push(handle),
      setTimeout: (callback, ms) => { calls.timeouts.push({ callback, ms }); return 22; },
      clearTimeout: (handle) => calls.cleared.push(handle),
      ...over,
    };
    return { win, calls };
  };

  it("is scheduled for the browser's idle time, with a timeout so it cannot be starved, and can be cancelled", () => {
    const { win, calls } = fakeWindow();
    const cancel = prefetchLikelyScreens({ win });

    assert.equal(calls.idle.length, 1);
    assert.deepEqual(calls.idle[0].options, { timeout: 4000 });
    cancel();
    assert.deepEqual(calls.cancelled, [11]);
  });

  it("falls back to a short timer where the browser has no idle callback", () => {
    const { win, calls } = fakeWindow({ requestIdleCallback: undefined });
    const cancel = prefetchLikelyScreens({ win });

    assert.equal(calls.timeouts.length, 1);
    assert.equal(calls.timeouts[0].ms, 2000);
    cancel();
    assert.deepEqual(calls.cleared, [22]);
  });

  it("asks for nothing while offline, on Save-Data, on a 2G connection or in a hidden page", () => {
    const cases = [
      { navigator: { onLine: false, connection: {} } },
      { navigator: { onLine: true, connection: { saveData: true } } },
      { navigator: { onLine: true, connection: { effectiveType: "2g" } } },
      { navigator: { onLine: true, connection: { effectiveType: "slow-2g" } } },
      { document: { visibilityState: "hidden" } },
    ];

    for (const over of cases) {
      const { win, calls } = fakeWindow(over);
      const cancel = prefetchLikelyScreens({ win });
      assert.equal(calls.idle.length + calls.timeouts.length, 0, JSON.stringify(over));
      assert.doesNotThrow(() => cancel());
    }
  });

  it("when it runs it loads only screens (and a failure is ignored, never shown)", async () => {
    const { win, calls } = fakeWindow();
    prefetchLikelyScreens({ win });
    assert.doesNotThrow(() => calls.idle[0].callback());
    await flush();
  });

  it("a connection that does not say (no navigator.connection) counts as fine", () => {
    const { win, calls } = fakeWindow({ navigator: { onLine: true } });
    prefetchLikelyScreens({ win });
    assert.equal(calls.idle.length, 1);
  });
});
