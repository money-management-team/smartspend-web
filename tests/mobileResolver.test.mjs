import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MOBILE_PREFIX, MOBILE_SCREENS } from "../src/mobile/navigation.js";
import {
  AUTO_MOBILE_MAX_SHORT_SIDE_PX,
  PRESENTATION_KEY,
  detectEnvironment,
  parsePreference,
  readPreference,
  resolveMode,
  writePreference,
} from "../src/mobile/presentation/preference.js";
import {
  getRedirect,
  isMobilePath,
  isProtectedPath,
  resolveLocation,
  toPath,
} from "../src/mobile/presentation/resolver.js";
import {
  isPresentationBusy,
  isRedirectLoop,
  markPresentationBusy,
  recordRedirect,
  resetPresentationGuard,
  resetRedirectHistory,
} from "../src/mobile/presentation/guard.js";
import { PATH } from "../src/routes/Path.js";
import { getPostAuthPath, getSafeRedirectPath } from "../src/routes/postAuthRedirect.js";

const ctx = (overrides = {}) => ({ enabled: true, authenticated: true, mode: "mobile", ...overrides });
const loc = (pathname, search = "", hash = "") => ({ pathname, search, hash });

// Every path the app knows about, plus awkward ones.
const KNOWN_PATHS = [
  "/",
  PATH.HOME,
  ...Object.values(PATH.PUBLIC),
  ...Object.values(PATH.AUTH),
  `${PATH.AUTH.VERIFY_EMAIL}/12/abcdef`,
  ...Object.values(PATH.USER).filter((value) => typeof value === "string"),
  "/dashboard/accounts/7",
  "/dashboard/financial-operations/99",
  "/whatsapp/drafts/5",
  "/privacy.html",
  "/terms.html",
  "/api/transactions",
  MOBILE_PREFIX,
  `${MOBILE_PREFIX}/`,
  `${MOBILE_PREFIX}/activity`,
  `${MOBILE_PREFIX}/planning`,
  `${MOBILE_PREFIX}/more`,
  `${MOBILE_PREFIX}/nope`,
  `${MOBILE_PREFIX}/accounts`,
  `${MOBILE_PREFIX}/accounts/`,
  `${MOBILE_PREFIX}/accounts/7`,
  `${MOBILE_PREFIX}/accounts/007`,
  `${MOBILE_PREFIX}/accounts/abc`,
  `${MOBILE_PREFIX}/accounts/7/deeper`,
  `${MOBILE_PREFIX}/enter`,
  `${MOBILE_PREFIX}/enter/`,
  `${MOBILE_PREFIX}/activity/7`,
  `${MOBILE_PREFIX}/activity/007`,
  `${MOBILE_PREFIX}/activity/abc`,
  `${MOBILE_PREFIX}/activity/7/deeper`,
  "/dashboard/financial-operations/7",
  `${MOBILE_PREFIX}/more/deep/er`,
  "/mission",
  "/m-x",
  "/dashboard/",
  "/dashboard//",
];

const SUFFIXES = [["", ""], ["?x=1&y=2", ""], ["", "#top"], ["?q=a%20b", "#h"]];

describe("canonical resolver", () => {
  it("sends a canonical page with a Mobile equivalent to it, when Mobile is the chosen presentation", () => {
    assert.deepEqual(getRedirect(loc(PATH.USER.DASHBOARD), ctx()), loc(MOBILE_PREFIX));
  });

  it("keeps the query string and the hash unchanged", () => {
    assert.deepEqual(
      getRedirect(loc(PATH.USER.DASHBOARD, "?period=month&x=a%2Bb", "#cards"), ctx()),
      loc(MOBILE_PREFIX, "?period=month&x=a%2Bb", "#cards"),
    );
    assert.equal(toPath(getRedirect(loc("/dashboard/", "?a=1", "#z"), ctx())), "/m?a=1#z");
  });

  it("leaves a canonical page without a Mobile equivalent on the Desktop page", () => {
    for (const path of [
      PATH.USER.ACCOUNTS,
      "/dashboard/accounts/7",
      PATH.USER.TRANSFERS,
      PATH.USER.REPORTS,
      "/dashboard/financial-operations/99",
      "/dashboard/whatsapp/drafts/5",
    ]) {
      assert.equal(getRedirect(loc(path, "?a=1"), ctx()), null, path);
    }
  });

  it("does not replace a working Desktop page with a placeholder (only screens marked fromCanonical redirect)", () => {
    for (const screen of MOBILE_SCREENS.filter((item) => !item.fromCanonical)) {
      assert.equal(getRedirect(loc(screen.canonical, "?new=expense"), ctx()), null, screen.canonical);
    }

    assert.deepEqual(MOBILE_SCREENS.filter((item) => item.fromCanonical).map((item) => item.id), ["home"]);
  });

  it("sends a Mobile address back to its canonical page when Desktop is chosen", () => {
    for (const screen of MOBILE_SCREENS) {
      assert.deepEqual(
        getRedirect(loc(screen.mobile, "?a=1", "#h"), ctx({ mode: "desktop" })),
        loc(screen.canonical, "?a=1", "#h"),
        screen.mobile,
      );
    }
  });

  it("Accounts and an account's page map to their Desktop pages when Desktop is chosen, keeping query and hash", () => {
    assert.deepEqual(getRedirect(loc("/m/accounts", "?a=1", "#h"), ctx({ mode: "desktop" })), loc(PATH.USER.ACCOUNTS, "?a=1", "#h"));
    assert.deepEqual(getRedirect(loc("/m/accounts/7", "?a=1", "#h"), ctx({ mode: "desktop" })), loc("/dashboard/accounts/7", "?a=1", "#h"));
    assert.deepEqual(getRedirect(loc("/m/accounts/7/", "", ""), ctx({ mode: "desktop" })), loc("/dashboard/accounts/7"), "a trailing slash is normalised");
  });

  it("an account address that is not an id goes to the dashboard on Desktop, never into an Accounts URL", () => {
    for (const bad of ["/m/accounts/abc", "/m/accounts/0", "/m/accounts/007", "/m/accounts/7/deeper", "/m/accounts/1e3", "/m/accounts/-5"]) {
      assert.deepEqual(getRedirect(loc(bad, "?a=1", "#h"), ctx({ mode: "desktop" })), loc(PATH.USER.DASHBOARD), bad);
    }
  });

  it("a transaction's Mobile page maps to its Desktop page when Desktop is chosen, keeping query and hash", () => {
    assert.deepEqual(getRedirect(loc("/m/activity/7", "?a=1", "#h"), ctx({ mode: "desktop" })), loc("/dashboard/financial-operations/7", "?a=1", "#h"));
    assert.deepEqual(getRedirect(loc("/m/activity", "?type=expense&status=posted"), ctx({ mode: "desktop" })), loc(PATH.USER.FINANCIAL_OPERATIONS, "?type=expense&status=posted"));
    for (const bad of ["/m/activity/abc", "/m/activity/0", "/m/activity/007", "/m/activity/7/deeper", "/m/activity/1e3"]) {
      assert.deepEqual(getRedirect(loc(bad, "?a=1"), ctx({ mode: "desktop" })), loc(PATH.USER.DASHBOARD), bad);
    }
  });

  it("Desktop financial operations, and a transaction's Desktop page, are never redirected to Mobile: they record, correct and reverse money", () => {
    for (const path of [PATH.USER.FINANCIAL_OPERATIONS, "/dashboard/financial-operations/7", "/dashboard/financial-operations/new"]) {
      assert.equal(getRedirect(loc(path, "?new=expense&type=expense"), ctx()), null, path);
    }
    assert.equal(MOBILE_SCREENS.find((item) => item.id === "activity").fromCanonical, false);
    assert.equal(getRedirect(loc("/m/activity/7"), ctx()), null, "and Activity itself stays Mobile in Mobile mode");
  });

  it("/dashboard/accounts stays Desktop in Mobile mode: Desktop's Accounts page can create, edit and archive, Mobile's cannot", () => {
    assert.equal(getRedirect(loc(PATH.USER.ACCOUNTS, "?a=1"), ctx()), null);
    assert.equal(getRedirect(loc("/dashboard/accounts/7"), ctx()), null);
    assert.equal(getRedirect(loc("/m/accounts/7"), ctx()), null, "and a Mobile account page stays in Mobile");
  });

  it("/m/enter is never redirected, in any mode: it is how a Desktop-mode visitor asks for Mobile", () => {
    for (const mode of ["mobile", "desktop"]) {
      for (const [search, hash] of [["", ""], ["?a=1", "#h"]]) assert.equal(getRedirect(loc("/m/enter", search, hash), ctx({ mode })), null, `${mode}${search}${hash}`);
    }

    assert.equal(getRedirect(loc("/m/enter/"), ctx({ mode: "desktop" })), null);
    assert.equal(getRedirect(loc("/m/entering"), ctx({ mode: "desktop" })).pathname, PATH.USER.DASHBOARD, "a lookalike is just an unknown Mobile address");
  });

  it("sends an unknown Mobile address to the dashboard on Desktop, dropping its query", () => {
    assert.deepEqual(getRedirect(loc("/m/nope", "?a=1", "#h"), ctx({ mode: "desktop" })), loc(PATH.USER.DASHBOARD));
  });

  it("keeps an unknown Mobile address in Mobile (the shell shows 'not available')", () => {
    assert.equal(getRedirect(loc("/m/nope"), ctx()), null);
  });

  it("does nothing when Mobile is disabled, whatever the stored preference says", () => {
    for (const mode of ["mobile", "desktop"]) {
      for (const path of KNOWN_PATHS) {
        assert.equal(getRedirect(loc(path), ctx({ enabled: false, mode })), null, `${mode} ${path}`);
      }
    }
  });

  it("does nothing for a signed-out visitor: the route guards keep the canonical return address", () => {
    for (const mode of ["mobile", "desktop"]) {
      for (const path of KNOWN_PATHS) {
        assert.equal(getRedirect(loc(path), ctx({ authenticated: false, mode })), null, `${mode} ${path}`);
      }
    }
  });

  it("never touches protected paths, in any mode, with any query", () => {
    const protectedPaths = [
      `${PATH.AUTH.VERIFY_EMAIL}/12/abcdef`,
      PATH.AUTH.RESET_PASSWORD,
      PATH.AUTH.SIGNIN,
      PATH.AUTH.COMPANY_SIGNIN,
      PATH.AUTH.REGISTER,
      PATH.AUTH.FORGOT_PASSWORD,
      PATH.AUTH.ACCOUNT_TYPE,
      PATH.AUTH.PASSWORD_CHANGED,
      PATH.AUTH.VERIFY_CODE,
      "/whatsapp/drafts/5",
      "/privacy.html",
      "/terms.html",
      "/api/anything",
    ];

    for (const path of protectedPaths) {
      assert.equal(isProtectedPath(path), true, path);
      for (const mode of ["mobile", "desktop"]) {
        assert.equal(getRedirect(loc(path, "?expires=1&signature=abc%3D", "#x"), ctx({ mode })), null, `${mode} ${path}`);
      }
    }
  });

  it("matches whole path segments only", () => {
    assert.equal(isProtectedPath("/signing"), false);
    assert.equal(isMobilePath("/mission"), false);
    assert.equal(isMobilePath("/m-x"), false);
    assert.equal(isMobilePath("/m"), true);
    assert.equal(isMobilePath("/m/"), true);
    assert.equal(isMobilePath("/m/activity"), true);
  });

  it("is idempotent for every known path, mode, query and hash", () => {
    for (const mode of ["mobile", "desktop"]) {
      for (const authenticated of [true, false]) {
        for (const path of KNOWN_PATHS) {
          for (const [search, hash] of SUFFIXES) {
            const context = ctx({ mode, authenticated });
            const once = resolveLocation(loc(path, search, hash), context);
            const twice = resolveLocation(once, context);
            assert.deepEqual(twice, once, `${mode} ${authenticated} ${path}${search}${hash}`);
            // A redirect target is final: the resolver has nothing further to say.
            assert.equal(getRedirect(once, context), null, `${mode} ${path}`);
          }
        }
      }
    }
  });

  it("an automatic redirect never leads back to where it came from (no ping-pong between modes)", () => {
    for (const path of KNOWN_PATHS) {
      const toMobile = getRedirect(loc(path), ctx({ mode: "mobile" }));
      if (toMobile) assert.equal(getRedirect(toMobile, ctx({ mode: "mobile" })), null);
      const toDesktop = getRedirect(loc(path), ctx({ mode: "desktop" }));
      if (toDesktop) assert.equal(getRedirect(toDesktop, ctx({ mode: "desktop" })), null);
    }
  });

  it("composes with the post-sign-in destination: the stored canonical address resolves per mode", () => {
    // RequireAuth stores the canonical address; sign-in validates it, then the resolver maps it.
    const stored = "/dashboard?period=month#cards";
    const safe = getPostAuthPath({ from: stored });
    assert.equal(safe, stored);

    const url = new URL(safe, "https://app.test");
    const target = resolveLocation({ pathname: url.pathname, search: url.search, hash: url.hash }, ctx());
    assert.equal(toPath(target), "/m?period=month#cards");

    // A Mobile address stored by a signed-out visit is still a safe same-origin path ...
    assert.equal(getSafeRedirectPath("/m/activity?x=1"), "/m/activity?x=1");
    // ... and on Desktop it resolves back to the canonical page.
    assert.equal(toPath(resolveLocation(loc("/m/activity", "?x=1"), ctx({ mode: "desktop" }))), "/dashboard/financial-operations?x=1");
  });

  it("tolerates trailing slashes and odd input without throwing", () => {
    assert.deepEqual(getRedirect(loc("/dashboard//"), ctx()), loc(MOBILE_PREFIX));
    assert.doesNotThrow(() => getRedirect(loc(undefined), ctx()));
    assert.doesNotThrow(() => getRedirect({ pathname: "no-leading-slash" }, ctx()));
  });
});

describe("presentation preference", () => {
  const memory = (initial = {}) => {
    const data = { ...initial };
    return {
      data,
      getItem: (key) => (key in data ? data[key] : null),
      setItem: (key, value) => { data[key] = String(value); },
      removeItem: (key) => { delete data[key]; },
    };
  };

  it("reads only the three known words, anything else is automatic", () => {
    for (const value of ["auto", "mobile", "desktop"]) assert.equal(parsePreference(value), value);
    for (const value of [null, undefined, "", "Mobile", "phone", "1", "{}"]) assert.equal(parsePreference(value), "auto");
  });

  it("stores one harmless word and nothing else", () => {
    const storage = memory();
    assert.equal(writePreference("desktop", storage, null), true);
    assert.deepEqual(storage.data, { [PRESENTATION_KEY]: "desktop" });
    assert.equal(readPreference(storage), "desktop");

    writePreference("auto", storage, null);
    assert.deepEqual(storage.data, {}, "automatic removes the entry instead of storing it");
  });

  it("survives blocked storage", () => {
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    assert.equal(readPreference(blocked), "auto");
    assert.equal(writePreference("mobile", blocked, null), false);
  });

  it("an explicit choice beats the device; automatic asks the device", () => {
    const phone = { coarsePointer: true, shortSidePx: 390 };
    const desktop = { coarsePointer: false, shortSidePx: 1080 };

    assert.equal(resolveMode("auto", phone), "mobile");
    assert.equal(resolveMode("auto", desktop), "desktop");
    assert.equal(resolveMode("desktop", phone), "desktop");
    assert.equal(resolveMode("mobile", desktop), "mobile");
  });

  it("uses the shorter screen side, so rotating a phone never switches presentation", () => {
    const portrait = detectEnvironment({ screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }) });
    const landscape = detectEnvironment({ screen: { width: 844, height: 390 }, matchMedia: () => ({ matches: true }) });

    assert.deepEqual(portrait, landscape);
    assert.equal(resolveMode("auto", portrait), "mobile");
    assert.equal(resolveMode("auto", landscape), "mobile");
  });

  it("does not treat a tablet, a mouse-driven small window, or an unknown screen as a phone", () => {
    assert.equal(resolveMode("auto", { coarsePointer: true, shortSidePx: AUTO_MOBILE_MAX_SHORT_SIDE_PX + 1 }), "desktop");
    assert.equal(resolveMode("auto", { coarsePointer: false, shortSidePx: 360 }), "desktop");
    assert.equal(resolveMode("auto", detectEnvironment({})), "desktop");
  });
});

describe("presentation guard", () => {
  it("is busy while a registration is open, and releases exactly once", () => {
    resetPresentationGuard();
    assert.equal(isPresentationBusy(), false);

    const releaseA = markPresentationBusy();
    const releaseB = markPresentationBusy();
    assert.equal(isPresentationBusy(), true);

    releaseA();
    releaseA(); // a second call must not release B's registration
    assert.equal(isPresentationBusy(), true);

    releaseB();
    assert.equal(isPresentationBusy(), false);
  });

  it("refuses a redirect straight back to where the previous one came from, within a second", () => {
    resetRedirectHistory();
    recordRedirect("/a", "/b", 1000);

    assert.equal(isRedirectLoop("/b", "/a", 1500), true);
    assert.equal(isRedirectLoop("/b", "/a", 2500), false, "after the window it is a fresh navigation");
    assert.equal(isRedirectLoop("/b", "/c", 1500), false);
    assert.equal(isRedirectLoop("/x", "/y", 1500), false);
    resetRedirectHistory();
  });
});
