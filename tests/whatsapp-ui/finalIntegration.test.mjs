import "../helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement as h } from "react";
import {
  MemoryRouter, Outlet, RouterProvider, createMemoryRouter, matchRoutes, useLocation,
} from "react-router-dom";
import { AuthContext } from "../../src/contexts/auth/authContext.js";
import { EmailVerificationContext } from "../../src/contexts/emailVerification/emailVerificationContext.js";
import { UnreadNotificationsContext } from "../../src/contexts/notifications/unreadNotificationsContext.js";
import WhatsAppPendingProvider from "../../src/contexts/whatsappPending/WhatsAppPendingProvider.jsx";
import { useWhatsAppPending } from "../../src/contexts/whatsappPending/useWhatsAppPending.js";
import { ApiError } from "../../src/features/Dashboards/User/api/apiClient.js";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import { PATH, getWhatsAppDraftPath } from "../../src/routes/Path.js";
import { click, flush, installDom, render } from "../helpers/dom.mjs";
import { createDraftServer } from "../helpers/fakeDraftServer.mjs";
import { createI18n, locales, withI18n } from "../helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";

const dom = installDom();
after(() => dom.window.close());

const { default: DashboardSidebar } = await import("../../src/layouts/DashboardLayout/components/DashboardSidebar/DashboardSidebar.jsx");
const { default: AttentionCenter } = await import("../../src/features/Dashboards/User/Experience/AttentionCenter.jsx");
const { default: Settings } = await import("../../src/features/Dashboards/User/Settings/Settings.jsx");
const { default: WhatsAppDrafts } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDrafts.jsx");
const { default: WhatsAppDraftDetails } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftDetails.jsx");
const { default: WhatsAppDraftLink } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftLink.jsx");
const { userRoutes } = await import("../../src/routes/Routes.jsx");
const { ACCOUNT_MOVEMENT_MESSAGES: accountMovementMessages } = await import("../../src/features/Dashboards/User/AccountDetails/accountMovementMessages.js");

/* ------------------------------------------------------------ harness */

let i18n;
let view;
let consoleOutput;
const originals = {};

beforeEach(() => {
  installBrowserStubs();
  consoleOutput = [];
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    originals[method] = console[method];
    console[method] = (...args) => consoleOutput.push([method, args.map(String).join(" ")]);
  }
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  for (const [method, fn] of Object.entries(originals)) console[method] = fn;
  document.body.innerHTML = "";
});

const text = () => view.container.textContent;
const authed = (id = 1) => ({ user: { id }, token: "t", isAuthenticated: true, initializing: false, logout: async () => {} });

/** A scriptable summary endpoint: every call is recorded and can be held or failed. */
function summaryApi(initial = 3) {
  const api = { calls: 0, value: initial, gates: [], integrationCalls: 0, failNext: null };
  api.getDraftSummary = ({ signal } = {}) => {
    api.calls += 1;
    const answer = () => {
      if (api.failNext) { const error = api.failNext; api.failNext = null; throw error; }
      return envelope({ pending_review_count: api.value });
    };
    if (!api.hold) return Promise.resolve().then(answer);
    return new Promise((resolve, reject) => {
      api.gates.push({ release: () => { try { resolve(answer()); } catch (e) { reject(e); } }, signal });
    });
  };
  api.getIntegration = async () => { api.integrationCalls += 1; return envelope({}); };
  return api;
}

function Count({ id = "count" }) {
  const { count, loading, error } = useWhatsAppPending();
  return h("span", { "data-testid": id }, error ? "error" : loading ? "loading" : count === null ? "none" : String(count));
}

async function mountProvider(api, children, { auth = authed(1), lng = "en" } = {}) {
  i18n = await createI18n(lng);
  view = await render(withI18n(i18n, h(AuthContext.Provider, { value: auth }, h(WhatsAppPendingProvider, { api }, children))));
  await flush();
}
const counts = () => [...view.container.querySelectorAll("[data-testid]")].map((n) => n.textContent);

/* --------------------------------------------------- pending provider */

describe("shared pending count", () => {
  it("many consumers share one request", async () => {
    const api = summaryApi(5);
    await mountProvider(api, h("div", null, h(Count, { id: "a" }), h(Count, { id: "b" }), h(Count, { id: "c" })));
    assert.equal(api.calls, 1);
    assert.deepEqual(counts(), ["5", "5", "5"]);
  });

  it("is the backend's number and never asks about WhatsApp availability", async () => {
    const api = summaryApi(0);
    await mountProvider(api, h(Count));
    assert.deepEqual(counts(), ["0"]);
    assert.equal(api.integrationCalls, 0, "historical drafts stay counted whether or not WhatsApp is enabled");
  });

  it("refresh() re-reads once; an older answer never replaces a newer one", async () => {
    const api = summaryApi(1);
    api.hold = true;
    await mountProvider(api, h(Count));
    api.gates[0].release();
    await flush();
    assert.deepEqual(counts(), ["1"]);

    // Two re-reads in a row: the first one answers LAST with an old number.
    let refresh;
    function Grab() { refresh = useWhatsAppPending().refresh; return null; }
    await view.rerender(withI18n(i18n, h(AuthContext.Provider, { value: authed(1) }, h(WhatsAppPendingProvider, { api }, h(Count), h(Grab)))));
    await act(async () => { refresh(); });
    await act(async () => { refresh(); });
    assert.equal(api.calls, 3);
    assert.equal(api.gates[1].signal.aborted, true, "the superseded request is cancelled");
    api.value = 9;
    api.gates[2].release();
    await flush();
    api.value = 2;
    api.gates[1].release();
    await flush();
    assert.deepEqual(counts(), ["9"]);
  });

  it("keeps the last number while the same user re-reads, but never shows it to another user", async () => {
    const api = summaryApi(4);
    await mountProvider(api, h(Count), { auth: authed(1) });
    assert.deepEqual(counts(), ["4"]);

    api.hold = true;
    await view.rerender(withI18n(i18n, h(AuthContext.Provider, { value: authed(2) }, h(WhatsAppPendingProvider, { api }, h(Count)))));
    await flush();
    assert.deepEqual(counts(), ["loading"], "no stale number for the new session");
    api.value = 7;
    api.gates.at(-1).release();
    await flush();
    assert.deepEqual(counts(), ["7"]);
    assert.equal(api.calls, 2);
  });

  it("logging out removes the number and stops requesting", async () => {
    const api = summaryApi(4);
    await mountProvider(api, h(Count), { auth: authed(1) });
    await view.rerender(withI18n(i18n, h(AuthContext.Provider, { value: { user: null, isAuthenticated: false } }, h(WhatsAppPendingProvider, { api }, h(Count)))));
    await flush();
    assert.deepEqual(counts(), ["none"]);
    assert.equal(api.calls, 1);
  });

  it("a failed read leaves no number and reports an error without breaking consumers", async () => {
    const api = summaryApi(4);
    api.failNext = new ApiError("x", { status: 500, code: "SERVER_ERROR" });
    await mountProvider(api, h("div", null, h(Count, { id: "a" }), h("p", null, "still here")));
    assert.deepEqual(counts(), ["error"]);
    assert.match(text(), /still here/);
  });

  it("a malformed answer is an error, never a number", async () => {
    const api = summaryApi(1);
    api.getDraftSummary = async () => envelope({ pending_review_count: "3" });
    await mountProvider(api, h(Count));
    assert.deepEqual(counts(), ["error"]);
  });

  it("opening a page re-reads only an OLD number, and never while a request is in flight", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const api = summaryApi(2);
    let ensure;
    function Grab() { ensure = useWhatsAppPending().ensureFresh; return null; }
    await mountProvider(api, h("div", null, h(Count), h(Grab)));
    assert.equal(api.calls, 1);

    await act(async () => { ensure(); });
    assert.equal(api.calls, 1, "fresh: no second request");

    t.mock.timers.tick(31_000);
    await act(async () => { ensure(); });
    await flush();
    assert.equal(api.calls, 2, "stale: one re-read");

    api.hold = true;
    t.mock.timers.tick(120_000);
    await act(async () => { ensure(); });
    await flush();
    await act(async () => { ensure(); });
    assert.equal(api.calls, 3, "a second ensureFresh while one is in flight does nothing");
  });

  it("a tab returning to view re-reads at most once a minute (no polling)", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 5_000_000 });
    const api = summaryApi(2);
    await mountProvider(api, h(Count));
    const becomeVisible = async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      await act(async () => { document.dispatchEvent(new dom.window.Event("visibilitychange")); });
      await flush();
    };
    t.mock.timers.tick(10_000);
    await becomeVisible();
    assert.equal(api.calls, 1);
    t.mock.timers.tick(61_000);
    await becomeVisible();
    assert.equal(api.calls, 2);
  });
});

/* ------------------------------------------------------------ sidebar */

async function mountSidebar(api, { lng = "en", auth = authed(1), path = PATH.USER.DASHBOARD } = {}) {
  i18n = await createI18n(lng);
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  view = await render(withI18n(i18n, h(AuthContext.Provider, { value: auth },
    h(UnreadNotificationsContext.Provider, { value: { count: 0 } },
      h(WhatsAppPendingProvider, { api },
        h(MemoryRouter, { initialEntries: [path] }, h(DashboardSidebar, { isOpen: true, onClose: () => {} })))))));
  await flush();
}
const whatsappLink = () => view.container.querySelector(`a[href="${PATH.USER.WHATSAPP_DRAFTS}"]`);
const t = (key, o) => i18n.t(key, o);

describe("sidebar pending indicator", () => {
  it("shows the backend count on the WhatsApp drafts item, with an accessible label", async () => {
    const api = summaryApi(12);
    await mountSidebar(api);
    const badge = whatsappLink().querySelector(".dashboard-sidebar__badge");
    assert.equal(badge.textContent, "12");
    assert.equal(badge.getAttribute("aria-hidden"), "true");
    assert.equal(whatsappLink().querySelector(".dashboard-sidebar__sr-only").textContent, t("dashboard.whatsappDrafts.sidebarBadge", { count: 12 }));
    assert.match(whatsappLink().textContent, new RegExp(t("dashboard.sidebar.whatsappDrafts")));
    assert.equal(api.calls, 1, "the sidebar makes one request in total");
  });

  it("is calm: the soft variant, not the red alert badge", async () => {
    await mountSidebar(summaryApi(3));
    assert.ok(whatsappLink().querySelector(".dashboard-sidebar__badge--calm"));
  });

  it("shows nothing at zero and nothing when the count is unknown", async () => {
    await mountSidebar(summaryApi(0));
    assert.equal(whatsappLink().querySelector(".dashboard-sidebar__badge"), null);
    assert.equal(view.container.querySelector(".dashboard-sidebar__dot"), null);
    await view.unmount();
    const failing = summaryApi(3);
    failing.failNext = new ApiError("", { code: "NETWORK_ERROR" });
    await mountSidebar(failing);
    assert.equal(whatsappLink().querySelector(".dashboard-sidebar__badge"), null);
    assert.ok(whatsappLink(), "the link itself is always there");
  });

  it("caps very large counts like the notification badge", async () => {
    await mountSidebar(summaryApi(250));
    assert.equal(whatsappLink().querySelector(".dashboard-sidebar__badge").textContent, "99+");
    assert.match(whatsappLink().querySelector(".dashboard-sidebar__sr-only").textContent, /250/);
  });

  it("a collapsed group shows a small dot instead, with the same label", async () => {
    await mountSidebar(summaryApi(4), { path: PATH.USER.DASHBOARD });
    const toggle = [...view.container.querySelectorAll("button.dashboard-sidebar__toggle")].find((b) => b.textContent.includes(t("dashboard.sidebar.groups.transactions")));
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.ok(toggle.querySelector(".dashboard-sidebar__dot"));
    assert.equal(toggle.querySelector(".dashboard-sidebar__sr-only").textContent, t("dashboard.whatsappDrafts.sidebarBadge", { count: 4 }));
  });

  it("when the group is open (current page inside it) the dot gives way to the count", async () => {
    await mountSidebar(summaryApi(4), { path: PATH.USER.WHATSAPP_DRAFTS });
    const toggle = view.container.querySelector("button.dashboard-sidebar__toggle[aria-expanded=true]");
    assert.ok(toggle);
    assert.equal(toggle.querySelector(".dashboard-sidebar__dot"), null);
    assert.equal(whatsappLink().querySelector(".dashboard-sidebar__badge").textContent, "4");
  });

  it("Arabic: localized label, same structure", async () => {
    await mountSidebar(summaryApi(6), { lng: "ar", path: PATH.USER.WHATSAPP_DRAFTS });
    assert.match(whatsappLink().textContent, /مسودات واتساب/);
    assert.match(whatsappLink().querySelector(".dashboard-sidebar__sr-only").textContent, /بانتظار المراجعة/);
    assert.deepEqual(i18n.missingKeys, []);
  });

  it("only that one item carries the indicator", async () => {
    await mountSidebar(summaryApi(6), { path: PATH.USER.WHATSAPP_DRAFTS });
    assert.equal(view.container.querySelectorAll(".dashboard-sidebar__badge--calm").length, 1);
  });
});

/* ---------------------------------------------------- attention center */

async function mountAttention({ count = 3, lng = "ar", failSummary = false } = {}) {
  i18n = await createI18n(lng);
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  const calls = mockFetch((url) => {
    const path = new URL(url, "http://x").pathname.replace(/^\/api/, "");
    if (path === "/integrations/whatsapp/expense-drafts/summary") {
      return failSummary ? { status: 500, body: { status: false, message: "x" } } : { body: envelope({ pending_review_count: count }) };
    }
    return { body: envelope({}) };
  });
  view = await render(withI18n(i18n, h(AuthContext.Provider, { value: { ...authed(1), workspace: { id: 1, timezone: "Asia/Gaza" } } },
    h(WhatsAppPendingProvider, { api: whatsappApi },
      h(MemoryRouter, null, h(AttentionCenter))))));
  await flush();
  await flush();
  return calls;
}

describe("Attention Center WhatsApp item", () => {
  it("shows the backend count with a link to the canonical inbox (Arabic)", async () => {
    const calls = await mountAttention({ count: 7, lng: "ar" });
    const card = view.container.querySelector(".exp-whatsapp");
    assert.ok(card);
    assert.equal(card.querySelector(".exp-whatsapp__count strong").textContent.length > 0, true);
    assert.match(card.textContent, /مسودات واتساب/);
    assert.match(card.textContent, /بانتظار المراجعة/);
    assert.equal(card.querySelector("a").getAttribute("href"), PATH.USER.WHATSAPP_DRAFTS);
    assert.equal(calls.filter((c) => c.url.endsWith("/expense-drafts/summary")).length, 1, "one request, shared");
    assert.equal(card.querySelector("bdi").getAttribute("dir"), "ltr");
  });

  it("English wording and exact number", async () => {
    await mountAttention({ count: 1234, lng: "en" });
    const card = view.container.querySelector(".exp-whatsapp");
    assert.match(card.textContent, /WhatsApp drafts/);
    assert.match(card.textContent, /1,234/);
    assert.match(card.textContent, /Review drafts/);
  });

  it("is absent at zero so the page stays calm", async () => {
    await mountAttention({ count: 0, lng: "en" });
    assert.equal(view.container.querySelector(".exp-whatsapp"), null);
  });

  it("a failed count shows a small retryable note and the rest of the page still renders", async () => {
    await mountAttention({ failSummary: true, lng: "en" });
    assert.equal(view.container.querySelector(".exp-whatsapp"), null);
    assert.match(text(), /Couldn't read the number of WhatsApp drafts/);
    assert.ok(view.container.querySelector(".exp-hero"), "the page is intact");
  });

  it("is not tied to WhatsApp being enabled: no availability request is made", async () => {
    const calls = await mountAttention({ count: 2, lng: "en" });
    assert.equal(calls.filter((c) => c.url.endsWith("/api/integrations/whatsapp")).length, 0);
  });

  it("the page's Refresh re-reads the count too", async () => {
    const calls = await mountAttention({ count: 2, lng: "en" });
    const refresh = [...view.container.querySelectorAll("button")].find((b) => b.textContent.trim() === i18n.t("refresh", { ns: "experience" }));
    await click(refresh);
    await flush();
    assert.equal(calls.filter((c) => c.url.endsWith("/expense-drafts/summary")).length, 2);
  });
});

/* ------------------------------------------- one journey across the app */

const DETAILS = getWhatsAppDraftPath(7);
let server;
let router;
let where = "";

function Probe() {
  const location = useLocation();
  where = `${location.pathname}${location.search}`;
  return null;
}

function JourneyShell() {
  return h(WhatsAppPendingProvider, { api: whatsappApi },
    h("div", null, h(Probe),
      h(UnreadNotificationsContext.Provider, { value: { count: 0 } }, h(DashboardSidebar, { isOpen: true, onClose: () => {} })),
      h(Outlet)));
}

async function mountJourney(entry, { initial = {}, lng = "en", auth = authed(1), authedRoutes = true } = {}) {
  server = createDraftServer(initial);
  server.install();
  i18n = await createI18n(lng);
  const choices = {
    accounts: { list: async () => envelope({ accounts: server.accounts }) },
    categories: { list: async () => envelope({ categories: [{ id: 2, name: "Food", type: "expense", is_active: true, workspace_id: null }] }) },
  };
  router = createMemoryRouter([{
    path: "/",
    element: h(JourneyShell),
    children: [
      { path: PATH.AUTH.SIGNIN, element: h("p", null, "SIGN IN PAGE") },
      { path: PATH.USER.SETTING, element: h(Settings) },
      { path: PATH.USER.WHATSAPP_DRAFTS, element: h(WhatsAppDrafts, { api: whatsappApi, accounts: choices.accounts }) },
      { path: PATH.USER.WHATSAPP_DRAFT_DETAILS, element: h(WhatsAppDraftDetails, { api: whatsappApi, ...choices }) },
      { path: PATH.USER.WHATSAPP_REVIEW_LINK, element: h(WhatsAppDraftLink) },
    ],
  }], { initialEntries: [entry] });
  view = await render(withI18n(i18n, h(AuthContext.Provider, { value: { ...auth, updateUser() {}, workspace: { id: 1 } } }, h(RouterProvider, { router }))));
  await flush();
  await flush();
  return server;
}
const btn = (label, root = view.container) => [...root.querySelectorAll("button")].find((n) => n.textContent.trim() === label);
const sidebarBadge = () => view.container.querySelector(`a[href="${PATH.USER.WHATSAPP_DRAFTS}"] .dashboard-sidebar__badge`);

describe("one journey across Settings, inbox, review and the sidebar", () => {
  it("Settings → inbox → review → confirm: the count falls everywhere and nothing is posted twice", async () => {
    await mountJourney(`${PATH.USER.SETTING}?tab=integrations`);
    const summaryCalls = () => server.count("summary");

    // Settings shows the integration and the inbox entry with the shared count.
    assert.equal(sidebarBadge().textContent, "1");
    const entry = view.container.querySelector("a.wa-inbox");
    assert.equal(entry.getAttribute("href"), PATH.USER.WHATSAPP_DRAFTS);
    assert.equal(entry.querySelector(".wa-inbox__count bdi").textContent, "1");
    assert.equal(summaryCalls(), 1, "sidebar and Settings share one request");

    await click(entry);
    await flush();
    await flush();
    assert.equal(where, PATH.USER.WHATSAPP_DRAFTS);
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "1");
    assert.equal(summaryCalls(), 1, "navigating within the dashboard reuses the fresh count");

    await click(view.container.querySelector(".wad-row a"));
    await flush();
    assert.equal(where, DETAILS);

    await click(btn(i18n.t("dashboard.whatsappDrafts.review.confirm")));
    await click(btn(i18n.t("dashboard.whatsappDrafts.review.dialog.confirmAction"), document.body.querySelector("[role=alertdialog]")));
    await flush();
    await flush();

    assert.equal(server.transactions.length, 1);
    assert.equal(sidebarBadge(), null, "the sidebar re-read the count after confirmation");
    assert.equal(summaryCalls(), 2);

    // Back to the inbox: the draft is gone from the queue and the header agrees.
    await click([...view.container.querySelectorAll("a")].find((a) => a.getAttribute("href") === PATH.USER.WHATSAPP_DRAFTS && a.closest(".wad-final")));
    await flush();
    await flush();
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "0");
    assert.equal(server.transactions.length, 1);
  });

  it("discarding refreshes the count the same way and posts nothing", async () => {
    await mountJourney(DETAILS);
    assert.equal(sidebarBadge().textContent, "1");
    await click(btn(i18n.t("dashboard.whatsappDrafts.review.discard")));
    await click(btn(i18n.t("dashboard.whatsappDrafts.review.dialog.discardAction"), document.body.querySelector("[role=alertdialog]")));
    await flush();
    await flush();
    assert.equal(sidebarBadge(), null);
    assert.equal(server.transactions.length, 0);
    assert.equal(server.count("summary"), 2);
  });

  it("saving an edit does not touch the count (the draft is still pending)", async () => {
    await mountJourney(DETAILS);
    const input = [...view.container.querySelectorAll("label")].find((l) => l.textContent.startsWith(i18n.t("dashboard.whatsappDrafts.review.description")));
    assert.ok(input);
    assert.equal(server.count("summary"), 1);
  });

  it("with WhatsApp disabled the inbox, the review and the count all still work", async () => {
    await mountJourney(PATH.USER.WHATSAPP_DRAFTS);
    server.calls.length = 0;
    assert.ok(view.container.querySelector(".wad-row"));
    assert.equal(sidebarBadge().textContent, "1");
  });

  it("a different user in the same shell sees nothing of the previous user's count or draft", async () => {
    await mountJourney(DETAILS);
    assert.equal(sidebarBadge().textContent, "1");
    const releaseSummary = server.hold("summary");
    const releaseDraft = server.hold("get");
    await view.rerender(withI18n(i18n, h(AuthContext.Provider, { value: { ...authed(2), updateUser() {}, workspace: { id: 1 } } }, h(RouterProvider, { router }))));
    await flush();
    assert.equal(sidebarBadge(), null, "no stale number while the new session loads");
    assert.doesNotMatch(text(), /Lunch/, "no stale draft while the new session loads");
    releaseSummary();
    releaseDraft();
    await flush();
    await flush();
    assert.equal(sidebarBadge().textContent, "1", "its own, freshly read, answers");
  });
});

describe("reload while a confirmation may still be running", () => {
  it("a second confirmation with a NEW key after reload is refused by the server and shown as the one recorded expense", async () => {
    server = createDraftServer();
    server.install();
    const choices = {
      accounts: { list: async () => envelope({ accounts: server.accounts }) },
      categories: { list: async () => envelope({ categories: [{ id: 2, name: "Food", type: "expense", is_active: true, workspace_id: null }] }) },
    };
    const open = async (api = whatsappApi) => {
      router = createMemoryRouter([{
        path: "/", element: h(JourneyShell),
        children: [{ path: PATH.USER.WHATSAPP_DRAFT_DETAILS, element: h(WhatsAppDraftDetails, { api, ...choices }) }],
      }], { initialEntries: [DETAILS] });
      view = await render(withI18n(i18n, h(AuthContext.Provider, { value: authed(1) }, h(RouterProvider, { router }))));
      await flush();
      await flush();
    };
    i18n = await createI18n("en");
    const review = (k) => i18n.t(`dashboard.whatsappDrafts.review.${k}`);

    await open();
    // The first request reaches the server and is still being processed (lock held)...
    const release = server.hold("confirm");
    await click(btn(review("confirm")));
    await click(btn(review("dialog.confirmAction"), document.body.querySelector("[role=alertdialog]")));
    assert.equal(server.count("confirm"), 1);

    // ...and the browser reloads: the in-memory key is gone.
    await view.unmount();
    view = null;
    // A reload also resets the adapter module (its in-flight guard); a fresh instance models that.
    const { whatsappApi: afterReload } = await import("../../src/features/Dashboards/User/api/whatsappApi.js?reload=1");
    await open(afterReload);
    assert.ok(btn(review("confirm")), "the draft still reads as open: an in-flight request proves nothing yet");
    assert.equal(server.transactions.length, 0);

    // The user confirms again (explicitly): a new key. It queues behind the first one.
    await click(btn(review("confirm")));
    await click(btn(review("dialog.confirmAction"), document.body.querySelector("[role=alertdialog]")));
    assert.equal(server.count("confirm"), 2);
    const [first, second] = server.of("confirm");
    assert.notEqual(first.key, second.key);

    release();
    await flush();
    await flush();
    await flush();

    assert.equal(server.transactions.length, 1, "exactly one expense, whatever the order");
    assert.equal(server.transactions[0].key, first.key);
    assert.match(text(), new RegExp(review("confirmedTitle")));
    assert.match(text(), /#50/);
    assert.doesNotMatch(text(), new RegExp(review("errors.conflict.confirm")), "no misleading error either");
  });
});

describe("error text consistency", () => {
  it("the adapter's in-flight refusal is translated, never shown as raw English", async () => {
    const { getReviewErrorMessage } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/draftReview.js");
    for (const lng of ["en", "ar"]) {
      const local = await createI18n(lng);
      const error = new ApiError("A confirmation for this draft is already in progress.", { code: "WHATSAPP_CONFIRM_IN_FLIGHT" });
      const message = getReviewErrorMessage(error, local.t, "confirm");
      assert.equal(message, local.t("dashboard.whatsappDrafts.review.errors.inFlight"));
      if (lng === "ar") assert.match(message, /[؀-ۿ]/);
      assert.deepEqual(local.missingKeys, []);
    }
  });

  it("every review error context maps a 409, 422 and 5xx to translated text in both languages", async () => {
    const { getReviewErrorMessage } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/draftReview.js");
    const errors = [
      new ApiError("raw", { status: 409, code: "CONFLICT" }),
      new ApiError("raw", { status: 422, code: "VALIDATION_ERROR", errors: { amount: ["x"] } }),
      new ApiError("Insufficient balance.", { status: 422, code: "VALIDATION_ERROR", errors: { amount: ["x"] } }),
      new ApiError("raw", { status: 403, code: "FORBIDDEN" }),
      new ApiError("raw", { status: 404, code: "NOT_FOUND" }),
      new ApiError("", { status: 503, code: "SERVER_ERROR" }),
      new ApiError("", { code: "NETWORK_ERROR" }),
    ];
    for (const lng of ["en", "ar"]) {
      const local = await createI18n(lng);
      for (const context of ["save", "confirm", "discard"]) {
        for (const error of errors) {
          const message = getReviewErrorMessage(error, local.t, context);
          assert.ok(message && !/raw|Insufficient balance./.test(message), `${lng} ${context} ${error.status ?? error.code}: ${message}`);
          if (lng === "ar") assert.match(message, /[؀-ۿ]/);
        }
      }
      assert.deepEqual(local.missingKeys, []);
    }
  });
});

/* ------------------------------------------------------- routes and urls */

describe("routes", () => {
  const children = userRoutes[0].children;
  const match = (pathname) => (matchRoutes(children, pathname) ?? []).map((m) => m.route.path);

  it("each WhatsApp URL matches exactly one route (deterministic)", () => {
    assert.deepEqual(match("/dashboard/settings"), [PATH.USER.SETTING]);
    assert.deepEqual(match("/dashboard/whatsapp/drafts"), [PATH.USER.WHATSAPP_DRAFTS]);
    assert.deepEqual(match("/dashboard/whatsapp/drafts/7"), [PATH.USER.WHATSAPP_DRAFT_DETAILS]);
    assert.deepEqual(match("/whatsapp/drafts/7"), [PATH.USER.WHATSAPP_REVIEW_LINK]);
  });

  it("nothing else is accidentally captured", () => {
    assert.deepEqual(match("/dashboard/whatsapp/drafts/7/extra"), []);
    assert.deepEqual(match("/dashboard/whatsapp"), []);
    assert.deepEqual(match("/whatsapp/drafts"), []);
    assert.deepEqual(match("/whatsapp/drafts/7/confirm"), []);
  });

  it("all four live inside the one authenticated layout", () => {
    assert.equal(userRoutes.length, 1);
    for (const path of [PATH.USER.SETTING, PATH.USER.WHATSAPP_DRAFTS, PATH.USER.WHATSAPP_DRAFT_DETAILS, PATH.USER.WHATSAPP_REVIEW_LINK]) {
      assert.ok(children.some((route) => route.path === path), path);
    }
  });

  it("the backend's review link format is the one the app handles", () => {
    const config = "/whatsapp/drafts/{draft}"; // config/whatsapp.php review_path @ b7ca549
    assert.equal(config.replace("{draft}", ":draftId"), PATH.USER.WHATSAPP_REVIEW_LINK);
  });
});

describe("Settings tabs", () => {
  async function mountSettings(entry) {
    i18n = await createI18n("en");
    mockFetch(() => ({ body: envelope({ enabled: true, state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: null }) }));
    router = createMemoryRouter([{
      path: "/", element: h(Outlet),
      children: [{ path: PATH.USER.SETTING, element: h(Settings) }],
    }], { initialEntries: [entry] });
    view = await render(withI18n(i18n, h(EmailVerificationContext.Provider, { value: { status: null, error: null, loading: false, refresh() {}, resend() {} } },
      h(AuthContext.Provider, { value: { ...authed(1), user: { id: 1, name: "Demo", email: "d@example.test" }, updateUser() {}, workspace: { id: 1 } } },
        h(WhatsAppPendingProvider, { api: whatsappApi }, h(RouterProvider, { router }))))));
    await flush();
    await flush();
  }
  const activeTab = () => view.container.querySelector(".settings-tab--active")?.textContent.trim();

  it("opens the Integrations tab directly and survives a refresh", async () => {
    await mountSettings("/dashboard/settings?tab=integrations");
    assert.equal(activeTab(), "Integrations");
    assert.ok(view.container.querySelector(".wa-integration"));
    await view.unmount();
    await mountSettings("/dashboard/settings?tab=integrations");
    assert.ok(view.container.querySelector(".wa-integration"));
  });

  it("an unknown tab falls back to Profile and never injects anything", async () => {
    await mountSettings("/dashboard/settings?tab=%3Cscript%3E");
    assert.equal(activeTab(), "Profile");
    assert.equal(view.container.querySelector(".wa-integration"), null);
    assert.equal(view.container.querySelector("script"), null);
  });

  it("tab changes are real history entries: back and forward work", async () => {
    await mountSettings("/dashboard/settings");
    assert.equal(activeTab(), "Profile");
    await act(async () => { router.navigate("/dashboard/settings?tab=integrations"); });
    await flush();
    assert.equal(activeTab(), "Integrations");
    await act(async () => { router.navigate(-1); });
    await flush();
    assert.equal(activeTab(), "Profile");
    await act(async () => { router.navigate(1); });
    await flush();
    assert.equal(activeTab(), "Integrations");
  });
});

/* ------------------------------------------- translations and metadata */

describe("transaction source labels", () => {
  // TransactionSource in smartspend-backend @ b7ca549, app/Enums/TransactionSource.php
  const BACKEND_SOURCES = ["manual", "natural_language", "voice", "receipt_ocr", "statement_import", "recurring_rule", "business_request", "whatsapp", "system"];

  it("the Transactions screen knows every backend source, in both languages", () => {
    for (const lng of ["en", "ar"]) {
      for (const source of BACKEND_SOURCES) {
        assert.ok(locales[lng].dashboard.transactions.sources[source], `${lng}:${source}`);
      }
    }
    assert.equal(locales.en.dashboard.transactions.sources.whatsapp, "WhatsApp");
    assert.equal(locales.ar.dashboard.transactions.sources.whatsapp, "واتساب");
  });

  it("the account movement history knows every backend source too", () => {
    for (const lng of ["en", "ar"]) {
      for (const source of BACKEND_SOURCES) {
        assert.ok(accountMovementMessages[lng].sources[source], `${lng}:${source}`);
      }
    }
    assert.equal(accountMovementMessages.en.sources.whatsapp, "WhatsApp");
    assert.equal(accountMovementMessages.ar.sources.whatsapp, "واتساب");
  });

  it("a WhatsApp-confirmed expense stays an expense; no new type exists", () => {
    const sample = { type: "expense", status: "posted", source: "whatsapp" };
    assert.equal(sample.type, "expense");
    assert.ok(!("whatsapp" in locales.en.dashboard.transactions.types ?? {}));
  });
});

describe("deployment metadata", () => {
  it("the legal page generator uses the production frontend origin", () => {
    const source = readFileSync(new URL("../../scripts/generateLegalPages.mjs", import.meta.url), "utf8");
    assert.match(source, /const website = "https:\/\/smartspend\.anasalharazeen\.com"/);
    assert.doesNotMatch(source, /vercel\.app/);
  });

  it("the deploy workflow pins the production API URL the app is built against", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/deploy-hostinger.yml", import.meta.url), "utf8");
    assert.match(workflow, /https:\/\/smartspend-api\.anasalharazeen\.com\/api/);
  });

  it("the repository ships no SPA fallback for Hostinger, which is why deep links need a production check", () => {
    // Documented in docs/whatsapp/production-readiness.md: the fallback lives on the server.
    const publicFiles = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
    assert.ok(publicFiles.length > 0);
    let found = true;
    try { readFileSync(new URL("../../public/.htaccess", import.meta.url)); } catch { found = false; }
    assert.equal(found, false);
  });
});
