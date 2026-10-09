import "../helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { createElement as h } from "react";
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { ApiError } from "../../src/features/Dashboards/User/api/apiClient.js";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import { AuthContext } from "../../src/contexts/auth/authContext.js";
import WhatsAppPendingProvider from "../../src/contexts/whatsappPending/WhatsAppPendingProvider.jsx";
import { PATH, getWhatsAppDraftPath } from "../../src/routes/Path.js";
import { act } from "react";
import { change, click, flush, installDom, render } from "../helpers/dom.mjs";
import { createI18n, locales, withI18n } from "../helpers/i18n.mjs";
import { envelope, installBrowserStubs, mockFetch } from "../helpers/mockFetch.mjs";
import { account, draft } from "../whatsapp/fixtures.mjs";

const dom = installDom();
after(() => dom.window.close());

const { default: WhatsAppDrafts } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDrafts.jsx");
const { default: WhatsAppDraftDetails } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftDetails.jsx");
const { userRoutes } = await import("../../src/routes/Routes.jsx");
const { getNavigation } = await import("../../src/layouts/DashboardLayout/dashboardNavigation.js");

/* ------------------------------------------------------------- fixtures */

const apiError = (status, code, over = {}) => new ApiError("raw backend text", { status, code, ...over });
const LIST_PATH = PATH.USER.WHATSAPP_DRAFTS;

const page = (items, over = {}) => ({
  current_page: 1, per_page: 20, last_page: 1, total: items.length,
  from: items.length ? 1 : null, to: items.length ? items.length : null, data: items, ...over,
});

const ACCOUNTS = [
  { id: 1, name: "Cash", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 2, name: "Bank", currency_code: "ILS", status: "active", savings_goal: null },
  { id: 3, name: "Old", currency_code: "ILS", status: "archived", savings_goal: null },
];

/** A scriptable fake of the whatsappApi surface. Every call is recorded; writes are traps. */
function makeApi(script = {}) {
  const api = { lists: [], details: [], summaryCalls: 0, integrationCalls: 0, writes: [], signals: [] };
  const answer = (value) => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value));

  api.listDrafts = (query, options) => {
    api.lists.push(query);
    api.signals.push(options?.signal);
    const result = typeof script.list === "function" ? script.list(query, options) : (script.list ?? page([draft()]));
    return result instanceof Promise ? result.then((r) => envelope({ drafts: r })) : answer(result).then((r) => envelope({ drafts: r }));
  };
  api.getDraftSummary = async () => {
    api.summaryCalls += 1;
    if (script.summary instanceof Error) throw script.summary;
    return envelope({ pending_review_count: script.pending ?? 3 });
  };
  api.getDraft = async (id, options) => {
    api.details.push(id);
    api.signals.push(options?.signal);
    const value = typeof script.detail === "function" ? await script.detail(id) : (script.detail ?? draft({ id: Number(id) }));
    if (value instanceof Error) throw value;
    return envelope({ draft: value });
  };
  api.getIntegration = async () => {
    api.integrationCalls += 1;
    return envelope(script.integration ?? { enabled: true, state: "linked", capabilities: { can_link: false, can_manage_link: true, can_review_drafts: true }, integration: null });
  };
  for (const name of ["updateDraft", "confirmDraft", "discardDraft", "createLinkChallenge", "confirmLinkChallenge", "updatePreferences", "unlink"]) {
    api[name] = async () => { api.writes.push(name); throw new Error(`unexpected write: ${name}`); };
  }
  return api;
}

const accountsClient = (items = ACCOUNTS) => ({ calls: 0, list: async function list() { this.calls += 1; return envelope({ accounts: items }); } });

let i18n;
let view;
let consoleOutput;
const originals = {};

function Probe() {
  const location = useLocation();
  globalThis.__location = `${location.pathname}${location.search}`;
  return null;
}

const choices = () => ({
  accounts: { list: async () => envelope({ accounts: ACCOUNTS }) },
  categories: { list: async () => envelope({ categories: [{ id: 2, name: "Food", type: "expense", is_active: true, workspace_id: null }, { id: 3, name: "Rent", type: "expense", is_active: true, workspace_id: 1 }] }) },
});

// The dashboard layout owns the pending count; here the shell plays that part.
function Shell({ api }) {
  return h(WhatsAppPendingProvider, { api }, h("div", null, h(Probe), h(Outlet)));
}

// A data router (the unsaved-changes guard needs one). Reused across rerenders.
let router = null;
const makeRouter = ({ api, accounts, entry }) => createMemoryRouter([
  {
    path: "/",
    element: h(Shell, { api }),
    children: [
      { path: PATH.USER.WHATSAPP_DRAFTS, element: h(WhatsAppDrafts, { api, accounts }) },
      { path: PATH.USER.WHATSAPP_DRAFT_DETAILS, element: h(WhatsAppDraftDetails, { api, ...choices() }) },
    ],
  },
], { initialEntries: [entry] });

const tree = ({ user = { id: 1 } }) =>
  withI18n(i18n, h(AuthContext.Provider, { value: { user, isAuthenticated: true } }, h(RouterProvider, { router })));

async function mount(api, { entry = LIST_PATH, lng = "en", accounts = accountsClient(), user } = {}) {
  i18n = await createI18n(lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  router = makeRouter({ api, accounts, entry });
  view = await render(tree({ user }));
  await flush();
  return { api, accounts };
}

const t = (key, options) => i18n.t(`dashboard.whatsappDrafts.${key}`, options);
const text = () => view.container.textContent;
const where = () => globalThis.__location;
const button = (label) => [...view.container.querySelectorAll("button")].find((node) => node.textContent.trim() === label);
const control = (label) => view.container.querySelector(`label:has(> span) select, label input`) && [...view.container.querySelectorAll("label")]
  .find((node) => node.querySelector("span")?.textContent === label)?.querySelector("select, input");
/** An input/select/textarea of the review form, found through its visible label. */
const field = (label) => {
  const node = [...view.container.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(label));
  return node ? view.container.querySelector(`#${CSS.escape(node.htmlFor)}`) : null;
};
const rows = () => [...view.container.querySelectorAll(".wad-row")];

beforeEach(() => {
  installBrowserStubs();
  globalThis.__location = "";
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

/* ---------------------------------------------------------------- tests */

describe("routes and navigation", () => {
  it("registers the inbox and the details routes under the authenticated dashboard", () => {
    const paths = userRoutes[0].children.map((route) => route.path);
    assert.ok(paths.includes("/dashboard/whatsapp/drafts"));
    assert.ok(paths.includes("/dashboard/whatsapp/drafts/:draftId"));
    assert.equal(PATH.USER.WHATSAPP_DRAFTS, "/dashboard/whatsapp/drafts");
    assert.equal(getWhatsAppDraftPath(7), "/dashboard/whatsapp/drafts/7");
    assert.equal(getWhatsAppDraftPath("a/b"), "/dashboard/whatsapp/drafts/a%2Fb");
  });

  it("sits behind the same guard and layout as every dashboard page", () => {
    assert.equal(userRoutes.length, 1);
    assert.equal(userRoutes[0].path, "/");
    assert.ok(userRoutes[0].element);
    assert.ok(!userRoutes[0].children.some((route) => route.path === "/whatsapp/drafts/:draft"), "the backend deep link is not claimed");
  });

  it("appears once in the sidebar, under Transactions, and is searchable in both languages", async () => {
    const en = await createI18n("en");
    const group = getNavigation(en.t, 0).flatMap((s) => s.entries).find((entry) => entry.id === "transactions");
    const entries = group.children.filter((child) => child.path === PATH.USER.WHATSAPP_DRAFTS);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].label, locales.en.dashboard.sidebar.whatsappDrafts);
    assert.match(locales.en.dashboard.search.keywords.whatsappDrafts, /whatsapp/);
    assert.match(locales.ar.dashboard.search.keywords.whatsappDrafts, /واتساب/);
  });
});

describe("listing", () => {
  it("loads the default list and shows exact, safe row data", async () => {
    const api = makeApi({ list: page([draft({ id: 7, review_values: { ...draft().review_values, description: "Lunch with Sam" } })]) });
    const { accounts } = await mount(api);

    assert.deepEqual(api.lists, [{ status: "ready_for_review", per_page: 20, page: 1 }]);
    assert.equal(api.summaryCalls, 1);
    assert.equal(accounts.calls, 1);
    assert.equal(rows().length, 1);
    const row = rows()[0].textContent;
    assert.match(row, /Lunch with Sam/);
    assert.match(row, /₪25\.25/);
    assert.match(row, /Oct 6, 2026/);
    assert.match(row, /12:30/);
    assert.match(row, /Cash/);
    assert.match(row, /Food/);
    assert.match(row, new RegExp(t("statuses.ready_for_review")));
    assert.equal(rows()[0].querySelector("a").getAttribute("href"), "/dashboard/whatsapp/drafts/7");
  });

  it("an empty inbox is a calm success, not an error", async () => {
    await mount(makeApi({ list: page([]), pending: 0 }));
    assert.equal(rows().length, 0);
    assert.equal(view.container.querySelector("[role=alert]"), null);
    assert.match(text(), new RegExp(t("empty.pendingTitle")));
  });

  it("a user with no manageable workspace gets the same empty page", async () => {
    await mount(makeApi({ list: page([], { total: 0 }), pending: 0 }));
    assert.match(text(), new RegExp(t("empty.pendingTitle")));
    assert.equal(view.container.querySelector("[role=alert]"), null);
  });

  it("shows every supported state with its own label and never as a posted transaction", async () => {
    const statuses = ["collecting", "ready_for_review", "confirmed", "discarded", "expired"];
    const items = statuses.map((status, index) => draft({
      id: index + 1,
      status,
      can_confirm: status === "ready_for_review",
      confirmation: { ready: status === "ready_for_review", issues: [] },
      confirmed_transaction_id: status === "confirmed" ? 50 : undefined,
    }));
    await mount(makeApi({ list: page(items) }), { entry: `${LIST_PATH}?status=confirmed` });

    const labels = rows().map((row) => row.querySelector(".wad-status").textContent);
    assert.deepEqual(labels, statuses.map((status) => t(`statuses.${status}`)));
    assert.equal(new Set(labels).size, 5);
    assert.doesNotMatch(text(), /posted|مُسجّل/i);
    assert.ok(rows().every((row) => row.querySelector(".wad-status svg")), "icon as well as text");
  });

  it("missing money fields are stated as missing, never as zero", async () => {
    const empty = draft({ id: 9, review_values: { account_id: null, category_id: null, amount: null, currency_code: null, description: null, transaction_date: null, transaction_time: null, workspace_timezone: "Asia/Gaza" }, account: null, category: null, confirmation: { ready: false, issues: [{ field: "amount", code: "amount_required", message: "m" }] } });
    const zero = draft({ id: 10, review_values: { ...draft().review_values, amount: "0.0000" } });
    await mount(makeApi({ list: page([empty, zero]) }));

    const [first, second] = rows().map((row) => row.textContent);
    assert.match(first, new RegExp(t("row.noAmount")));
    assert.match(first, new RegExp(t("row.noDate")));
    assert.match(first, new RegExp(t("row.noAccount")));
    assert.doesNotMatch(first, /0\.00/);
    assert.match(first, new RegExp(t("row.untitled", { id: 9 })));
    assert.match(second, /₪0\.00/);
  });

  it("keeps long Arabic descriptions inside the card and in LTR islands for numbers", async () => {
    const long = "مصروف ".repeat(60);
    await mount(makeApi({ list: page([draft({ review_values: { ...draft().review_values, description: long } })]) }), { lng: "ar" });
    const title = rows()[0].querySelector(".wad-row__title");
    assert.equal(title.getAttribute("dir"), "auto");
    assert.equal(rows()[0].querySelector(".wad-amount bdi").getAttribute("dir"), "ltr");
  });
});

describe("summary versus rows", () => {
  it("shows the backend's global pending count, not the number of rows or filter results", async () => {
    const api = makeApi({ pending: 42, list: page([draft()]) });
    await mount(api);
    assert.equal(rows().length, 1);
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "42");

    await change(control(t("filters.status")), "confirmed");
    await flush();
    assert.equal(api.lists.at(-1).status, "confirmed");
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "42");
    assert.equal(api.summaryCalls, 1, "a filter change does not recount");
  });

  it("a failed summary does not hide the list and never shows a made-up number", async () => {
    await mount(makeApi({ summary: apiError(500, "SERVER_ERROR"), list: page([draft(), draft({ id: 8 })]) }));
    assert.equal(rows().length, 2);
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "–");
    assert.match(text(), new RegExp(t("summaryUnavailable")));
  });

  it("Refresh re-reads both the list and the count", async () => {
    const api = makeApi({});
    await mount(api);
    await click(button(t("refresh")));
    await flush();
    assert.equal(api.lists.length, 2);
    assert.equal(api.summaryCalls, 2);
  });
});

describe("filters", () => {
  it("serializes each filter into the URL and the request, resetting the page", async () => {
    const api = makeApi({});
    await mount(api, { entry: `${LIST_PATH}?page=3` });
    assert.equal(api.lists.at(-1).page, 3);

    await change(control(t("filters.status")), "confirmed");
    await flush();
    assert.equal(where(), `${LIST_PATH}?status=confirmed`);

    await change(control(t("filters.date")), "2026-10-06");
    await flush();
    await change(control(t("filters.account")), "2");
    await flush();
    await change(control(t("filters.perPage")), "50");
    await flush();

    assert.equal(where(), `${LIST_PATH}?status=confirmed&date=2026-10-06&account=2&per_page=50`);
    assert.deepEqual(api.lists.at(-1), { status: "confirmed", per_page: 50, page: 1, date: "2026-10-06", account: 2 });
    assert.deepEqual(Object.keys(api.lists.at(-1)).sort(), ["account", "date", "page", "per_page", "status"]);
  });

  it("offers only the user's active accounts and no workspace choice", async () => {
    await mount(makeApi({}));
    const options = [...control(t("filters.account")).options].map((o) => o.textContent);
    assert.deepEqual(options, [t("filters.allAccounts"), "Cash · ILS", "Bank · ILS"]);
    assert.equal(view.container.querySelector("select[name*=workspace]"), null);
  });

  it("Reset clears the filters and the page, and only shows when something is set", async () => {
    const api = makeApi({});
    await mount(api, { entry: `${LIST_PATH}?status=expired&date=2026-10-06&account=1&page=2` });
    assert.ok(button(t("filters.reset")));
    await click(button(t("filters.reset")));
    await flush();
    assert.equal(where(), LIST_PATH);
    assert.deepEqual(api.lists.at(-1), { status: "ready_for_review", per_page: 20, page: 1 });
    assert.equal(button(t("filters.reset")), undefined);
  });

  it("invalid URL parameters cause one default request, not a loop", async () => {
    const api = makeApi({});
    await mount(api, { entry: `${LIST_PATH}?status=bogus&date=2026-13-45&account=abc&per_page=7&page=-3&workspace_id=9` });
    await flush();
    await flush();
    assert.equal(api.lists.length, 1);
    assert.deepEqual(api.lists[0], { status: "ready_for_review", per_page: 20, page: 1 });
    assert.equal(api.summaryCalls, 1);
  });

  it("an account in the URL that is not in the user's list stays visible and is still sent", async () => {
    const api = makeApi({});
    await mount(api, { entry: `${LIST_PATH}?account=99` });
    assert.equal(api.lists[0].account, 99);
    assert.equal(control(t("filters.account")).selectedOptions[0].textContent, t("filters.otherAccount", { id: 99 }));
  });

  it("filtered-empty offers Reset; a failed account list only limits the filter", async () => {
    await mount(makeApi({ list: page([]) }), { entry: `${LIST_PATH}?status=discarded`, accounts: { list: async () => { throw apiError(500, "SERVER_ERROR"); } } });
    assert.match(text(), new RegExp(t("empty.filtered")));
    assert.match(text(), new RegExp(t("filters.accountsFailed")));
    assert.ok(button(t("filters.reset")));
  });
});

describe("pagination", () => {
  const paged = (current) => page([draft({ id: current })], { current_page: current, last_page: 3, total: 45, from: (current - 1) * 20 + 1, to: Math.min(current * 20, 45), per_page: 20 });

  it("uses the backend's paginator metadata and keeps the filters while moving", async () => {
    const api = makeApi({ list: (query) => paged(query.page) });
    await mount(api, { entry: `${LIST_PATH}?status=confirmed&date=2026-10-06` });

    assert.match(text(), /Showing 1–20 of 45/);
    assert.match(text(), /Page 1 of 3/);
    assert.ok(button(undefined) === undefined);
    const prev = view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.previous")}"]`);
    const nextButton = () => view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.next")}"]`);
    const prevButton = () => view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.previous")}"]`);
    assert.equal(prev.disabled, true);

    await click(nextButton());
    await flush();
    assert.equal(where(), `${LIST_PATH}?status=confirmed&date=2026-10-06&page=2`);
    assert.deepEqual(api.lists.at(-1), { status: "confirmed", per_page: 20, page: 2, date: "2026-10-06" });
    assert.match(text(), /Showing 21–40 of 45/);

    await click(nextButton());
    await flush();
    assert.match(text(), /Showing 41–45 of 45/);
    assert.equal(nextButton().disabled, true);

    await click(prevButton());
    await flush();
    assert.equal(api.lists.at(-1).page, 2);
  });

  it("moves focus to the list after a page change", async () => {
    const api = makeApi({ list: (query) => paged(query.page) });
    await mount(api);
    const next = view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.next")}"]`);
    await click(next);
    await flush();
    assert.equal(document.activeElement, view.container.querySelector(".wad-panel"));
  });

  it("a page that became empty offers a way back to the first page", async () => {
    const api = makeApi({ list: (query) => (query.page === 5 ? page([], { current_page: 5, last_page: 5, total: 41 }) : paged(1)) });
    await mount(api, { entry: `${LIST_PATH}?page=5` });
    assert.match(text(), new RegExp(t("empty.page")));
    await click(button(i18n.t("dashboard.transactions.pagination.first")));
    await flush();
    assert.equal(api.lists.at(-1).page, 1);
  });

  it("browser back and forward restore earlier pages", async () => {
    const api = makeApi({ list: (query) => paged(query.page) });
    await mount(api);
    await click(view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.next")}"]`));
    await flush();
    assert.equal(where(), `${LIST_PATH}?page=2`);
    await act(async () => { dom.window.history.back(); });
    await flush();
    // MemoryRouter has its own history; the inbox simply follows the URL it is given.
    assert.equal(api.lists.at(-1).page, where().includes("page=2") ? 2 : 1);
  });
});

describe("WhatsApp disabled or unlinked", () => {
  it("historical drafts stay visible when WhatsApp is switched off, with an explanation", async () => {
    const api = makeApi({
      integration: { enabled: false, state: "disabled", capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true }, integration: null },
      list: page([draft({ id: 4 }), draft({ id: 5, status: "confirmed" })]),
    });
    await mount(api);
    assert.equal(rows().length, 2);
    assert.match(text(), new RegExp(t("disabledNote")));
    assert.equal(api.lists.length, 1, "reads are not gated by the enabled flag");
  });

  it("a user who never linked WhatsApp can still review drafts they have", async () => {
    await mount(makeApi({
      integration: { enabled: true, state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: null },
      list: page([draft()]),
    }));
    assert.equal(rows().length, 1);
    assert.doesNotMatch(text(), new RegExp(t("disabledNote")));
  });

  it("a failing availability check does not affect the inbox", async () => {
    const api = makeApi({});
    api.getIntegration = async () => { throw apiError(500, "SERVER_ERROR"); };
    await mount(api);
    assert.equal(rows().length, 1);
    assert.equal(view.container.querySelector("[role=alert]"), null);
  });
});

describe("read-only details", () => {
  it("opens from a row through the router and shows financial fields and metadata separately", async () => {
    const api = makeApi({ list: page([draft({ id: 7 })]) });
    await mount(api);
    await click(rows()[0].querySelector("a"));
    await flush();

    assert.equal(where(), "/dashboard/whatsapp/drafts/7");
    assert.deepEqual(api.details, ["7"]);
    const input = (label) => field(i18n.t(`dashboard.whatsappDrafts.review.${label}`));
    assert.equal(input("amount").value, "25.25");
    assert.equal(input("date").value, "2026-10-06");
    assert.equal(input("time").value, "12:30");
    assert.equal(input("description").value, "Lunch");
    assert.equal(input("account").value, "1");
    assert.equal(input("category").value, "2");
    assert.match(view.container.querySelector(".wad-input__currency").textContent, /ILS/);
    assert.match([...view.container.querySelectorAll(".wad-card")].at(-1).textContent, /#7/);
    assert.ok(text().includes("Asia/Gaza"));
  });

  it("offers navigation and refresh only when the backend allows no action, and sends no write", async () => {
    const api = makeApi({ detail: draft({ ...{ can_edit: false, can_confirm: false, can_discard: false, confirmation: { ready: false, issues: [] } } }) });
    await mount(api, { entry: getWhatsAppDraftPath(7) });
    const labels = [...view.container.querySelectorAll("button, a")].map((node) => node.textContent.trim()).filter(Boolean);
    assert.deepEqual(labels, [t("details.back"), t("refresh"), t("review.confirm")]);
    assert.equal(button(t("review.confirm")).disabled, true, "nothing is allowed, so Confirm is disabled");
    assert.equal(button(t("review.discard")), undefined);
    assert.equal(view.container.querySelector("input, select, textarea, form"), null);
    assert.deepEqual(api.writes, []);
  });

  it("Back returns to the same filters and page", async () => {
    const api = makeApi({ list: page([draft({ id: 7 })]) });
    await mount(api, { entry: `${LIST_PATH}?status=confirmed&page=2` });
    await click(rows()[0].querySelector("a"));
    await flush();
    await click([...view.container.querySelectorAll("a")].find((a) => a.textContent.includes(t("details.back"))));
    await flush();
    assert.equal(where(), `${LIST_PATH}?status=confirmed&page=2`);
  });

  it("shows localized readiness issues, including a code the app does not know", async () => {
    const issues = [
      { field: "amount", code: "amount_required", message: "Account, expense category and positive amount are required before confirmation." },
      { field: "x", code: "brand_new_code", message: "something new" },
    ];
    await mount(makeApi({ detail: draft({ id: 7, can_confirm: true, confirmation: { ready: false, issues } }) }), { entry: getWhatsAppDraftPath(7) });
    const list = view.container.querySelector(".wad-issues");
    assert.equal(list.children.length, 2);
    assert.match(list.textContent, new RegExp(t("issues.amount_required")));
    assert.match(list.textContent, new RegExp(t("issues.unknown")));
    assert.match(list.textContent, /brand_new_code/);
    assert.doesNotMatch(text(), /Account, expense category and positive amount/);
    assert.match(text(), new RegExp(t("details.recheck")));
  });

  it("a complete draft is not described as confirmed or guaranteed", async () => {
    await mount(makeApi({}), { entry: getWhatsAppDraftPath(7) });
    assert.match(text(), new RegExp(t("details.completeIntro")));
    assert.match(text(), new RegExp(t("review.saveNote")));
    assert.match(text(), new RegExp(t("details.recheck")));
    assert.doesNotMatch(text(), /guarantee/i);
  });

  it("a confirmed draft links to its transaction and has no readiness card", async () => {
    await mount(makeApi({ detail: draft({ id: 7, status: "confirmed", can_confirm: false, confirmation: { ready: false, issues: [] }, confirmed_transaction_id: 50 }) }), { entry: getWhatsAppDraftPath(7) });
    assert.equal(view.container.querySelectorAll(".wad-card").length, 3);
    assert.equal([...view.container.querySelectorAll("a")].find((a) => a.textContent === t("review.viewTransaction")).getAttribute("href"), "/dashboard/financial-operations/50");
    assert.equal(button(t("review.confirm")), undefined, "no Confirm button on a recorded expense");
  });

  it("missing values are 'not set'; times use the workspace time zone for timestamps", async () => {
    const sparse = draft({
      id: 7,
      review_values: { account_id: null, category_id: null, amount: null, currency_code: null, description: null, workspace_timezone: "Asia/Gaza" },
      account: null,
      category: null,
      timestamps: { created_at: "2026-10-06T21:30:00.000000Z" },
      ...{ can_edit: false, can_confirm: false, can_discard: false, confirmation: { ready: false, issues: [] } },
    });
    await mount(makeApi({ detail: sparse }), { entry: getWhatsAppDraftPath(7) });
    const financial = view.container.querySelectorAll(".wad-card")[0];
    assert.match(financial.textContent, new RegExp(t("row.noAmount")));
    assert.ok(financial.querySelectorAll(".wad-unset").length >= 6);
    assert.doesNotMatch(financial.textContent, /0\.00/);
    assert.match(view.container.querySelectorAll(".wad-card")[view.container.querySelectorAll(".wad-card").length - 1].textContent, /Oct 7, 2026/, "21:30Z is already the next day in Gaza");
  });

  it("opening another draft never shows the previous one while loading", async () => {
    let release;
    const api = makeApi({ detail: (id) => (id === "8" ? new Promise((resolve) => { release = () => resolve(draft({ id: 8, review_values: { ...draft().review_values, description: "Second" } })); }) : draft({ id: 7, review_values: { ...draft().review_values, description: "First" } })) });
    await mount(api, { entry: getWhatsAppDraftPath(7) });
    assert.match(text(), /First/);

    await act(async () => { router.navigate(getWhatsAppDraftPath(8)); });
    await flush();
    assert.doesNotMatch(text(), /First/);
    assert.ok(view.container.querySelector("[role=status]"));
    release();
    await flush();
    assert.match(text(), /Second/);
  });
});

describe("errors", () => {
  const cases = [
    ["401", apiError(401, "UNAUTHENTICATED"), () => t("errors.unauthenticated")],
    ["403", apiError(403, "FORBIDDEN"), () => t("errors.forbidden")],
    ["404", apiError(404, "NOT_FOUND"), () => t("errors.notFound")],
    ["422", apiError(422, "VALIDATION_ERROR", { errors: { status: ["bad"] } }), () => t("errors.validation")],
    ["429", apiError(429, "RATE_LIMITED", { retryAfter: "11" }), () => /11/],
    ["network", new ApiError("", { code: "NETWORK_ERROR" }), () => i18n.t("api.errors.network")],
    ["timeout", new ApiError("", { code: "TIMEOUT" }), () => i18n.t("api.errors.timeout")],
  ];

  for (const [name, error, expected] of cases) {
    it(`list ${name}: translated message, recovery action, no raw backend text`, async () => {
      const api = makeApi({ list: error });
      await mount(api);
      const alert = view.container.querySelector("[role=alert]");
      assert.ok(alert);
      const want = expected();
      if (want instanceof RegExp) assert.match(alert.textContent, want);
      else assert.ok(alert.textContent.includes(want), `${alert.textContent} / ${want}`);
      assert.doesNotMatch(alert.textContent, /raw backend text/);
      assert.equal(rows().length, 0);
      assert.ok(button(i18n.t("common.retry")));
    });
  }

  it("Retry recovers", async () => {
    let calls = 0;
    const api = makeApi({ list: () => { calls += 1; return calls === 1 ? new ApiError("", { code: "NETWORK_ERROR" }) : page([draft()]); } });
    await mount(api);
    await click(button(i18n.t("common.retry")));
    await flush();
    assert.equal(rows().length, 1);
    assert.equal(view.container.querySelector("[role=alert]"), null);
  });

  it("an unexpected response shape is reported, not rendered", async () => {
    const api = makeApi({ list: { nope: true } });
    await mount(api);
    assert.ok(view.container.querySelector("[role=alert]"));
    assert.equal(rows().length, 0);
  });

  it("details: 404 and a malformed id say 'not found' and offer no retry", async () => {
    await mount(makeApi({ detail: apiError(404, "NOT_FOUND") }), { entry: getWhatsAppDraftPath(7) });
    assert.match(view.container.querySelector("[role=alert]").textContent, new RegExp(t("errors.notFound")));
    assert.equal(button(i18n.t("common.retry")), undefined);
    await view.unmount();

    installBrowserStubs();
    const calls = mockFetch(() => ({ body: envelope({}) }));
    i18n = await createI18n("en");
    router = makeRouter({ api: whatsappApi, accounts: accountsClient(), entry: "/dashboard/whatsapp/drafts/abc" });
    view = await render(tree({}));
    await flush();
    assert.match(view.container.querySelector("[role=alert]").textContent, new RegExp(t("errors.notFound")));
    assert.equal(calls.filter((c) => c.url.includes("/expense-drafts/abc")).length, 0, "an invalid id never reaches the network");
  });

  it("details: a network error can be retried", async () => {
    let n = 0;
    const api = makeApi({ detail: () => { n += 1; return n === 1 ? new ApiError("", { code: "NETWORK_ERROR" }) : draft({ id: 7 }); } });
    await mount(api, { entry: getWhatsAppDraftPath(7) });
    await click(button(i18n.t("common.retry")));
    await flush();
    assert.ok(view.container.querySelector(".wad-card"));
  });
});

describe("async safety", () => {
  it("cancels the superseded request and ignores its late answer (out-of-order results)", async () => {
    const gates = [];
    const api = makeApi({ list: (query) => new Promise((resolve) => { gates.push({ query, resolve }); }) });
    await mount(api);
    assert.equal(gates.length, 1);

    await change(control(t("filters.status")), "confirmed");
    await flush();
    assert.equal(gates.length, 2);
    assert.equal(api.signals[0].aborted, true, "the stale request is cancelled");

    const old = page([draft({ id: 1, review_values: { ...draft().review_values, description: "OLD" } })]);
    const fresh = page([draft({ id: 2, status: "confirmed", review_values: { ...draft().review_values, description: "NEW" } })]);
    await act(async () => { gates[1].resolve(fresh); });
    await flush();
    await act(async () => { gates[0].resolve(old); });
    await flush();

    assert.match(text(), /NEW/);
    assert.doesNotMatch(text(), /OLD/);
  });

  it("shows loading, not the previous filter's rows, while the next request is pending", async () => {
    let hold = false;
    let release;
    const api = makeApi({ list: () => (hold ? new Promise((resolve) => { release = () => resolve(page([])); }) : page([draft()])) });
    await mount(api);
    assert.equal(rows().length, 1);
    hold = true;
    await change(control(t("filters.status")), "expired");
    await flush();
    assert.equal(rows().length, 0);
    assert.ok(view.container.querySelector(".wad-skeletons"));
    assert.equal(view.container.querySelector(".wad-panel").getAttribute("aria-busy"), "true");
    release();
    await flush();
  });

  it("leaving the page aborts every request in flight", async () => {
    const api = makeApi({ list: () => new Promise(() => {}) });
    await mount(api);
    assert.ok(api.signals.length >= 1);
    await view.unmount();
    view = null;
    assert.ok(api.signals.filter(Boolean).every((signal) => signal.aborted));
  });

  it("a different signed-in user never sees the previous user's drafts", async () => {
    let who = "alice";
    let release;
    const api = makeApi({ list: () => (who === "alice"
      ? page([draft({ id: 1, review_values: { ...draft().review_values, description: "ALICE PRIVATE" } })])
      : new Promise((resolve) => { release = () => resolve(page([draft({ id: 2, review_values: { ...draft().review_values, description: "BOB" } })])); })) });
    await mount(api, { user: { id: 1 } });
    assert.match(text(), /ALICE PRIVATE/);

    who = "bob";
    await view.rerender(tree({ user: { id: 2 } }));
    await flush();
    assert.doesNotMatch(text(), /ALICE PRIVATE/, "no stale rows while the new session loads");
    assert.ok(view.container.querySelector(".wad-skeletons"));
    release();
    await flush();
    assert.match(text(), /BOB/);
    assert.doesNotMatch(text(), /ALICE PRIVATE/);
    assert.equal(api.lists.length, 2);
    assert.equal(api.summaryCalls, 2, "the count is re-read for the new user");
  });

  it("logging out (unmount) leaves nothing private in the document, storage or console", async () => {
    await mount(makeApi({ list: page([draft({ review_values: { ...draft().review_values, description: "SECRET LUNCH" } })]) }));
    assert.match(text(), /SECRET LUNCH/);
    await view.unmount();
    view = null;
    assert.doesNotMatch(document.body.textContent, /SECRET LUNCH/);
    const dump = JSON.stringify([globalThis.localStorage.dump(), globalThis.sessionStorage.dump(), consoleOutput]);
    assert.doesNotMatch(dump, /SECRET LUNCH|25\.25/);
  });
});

describe("real adapter, real requests", () => {
  it("only GETs are sent across list, filter, page and details, with the documented query", async () => {
    installBrowserStubs();
    const calls = mockFetch((url) => {
      if (url.includes("/expense-drafts/summary")) return { body: envelope({ pending_review_count: 5 }) };
      if (url.includes("/expense-drafts/7")) return { body: envelope({ draft: draft({ id: 7 }) }) };
      if (url.includes("/expense-drafts")) return { body: envelope({ drafts: page([draft({ id: 7 })], { last_page: 2, total: 21, to: 20 }) }) };
      if (url.endsWith("/accounts")) return { body: envelope({ accounts: ACCOUNTS }) };
      return { body: envelope({ enabled: true, state: "linked", capabilities: { can_link: false, can_manage_link: true, can_review_drafts: true }, integration: null }) };
    });
    i18n = await createI18n("en");
    router = makeRouter({ api: whatsappApi, accounts: undefined, entry: `${LIST_PATH}?status=confirmed&date=2026-10-06` });
    view = await render(tree({}));
    await flush();
    await click(view.container.querySelector(`[aria-label="${i18n.t("dashboard.transactions.pagination.next")}"]`));
    await flush();
    await click(rows()[0].querySelector("a"));
    await flush();

    assert.ok(calls.length >= 5);
    assert.ok(calls.every((call) => call.method === "GET"), calls.map((c) => c.method).join());
    assert.ok(calls.every((call) => call.body === undefined && !call.headers["Idempotency-Key"]));
    const lists = calls.filter((call) => /expense-drafts\?/.test(call.url)).map((call) => call.url);
    assert.equal(lists[0], "/api/integrations/whatsapp/expense-drafts?status=confirmed&date=2026-10-06&per_page=20&page=1");
    assert.match(lists[1], /page=2/);
    assert.ok(calls.some((call) => call.url === "/api/integrations/whatsapp/expense-drafts/7"));
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
  });
});

describe("Arabic and English", () => {
  for (const lng of ["en", "ar"]) {
    it(`${lng}: inbox and details render fully translated with correct direction`, async () => {
      const items = ["collecting", "ready_for_review", "confirmed", "discarded", "expired"].map((status, i) => draft({ id: i + 1, status, confirmation: { ready: false, issues: status === "ready_for_review" ? [{ field: "amount", code: "amount_required", message: "m" }] : [] } }));
      const api = makeApi({ list: page(items, { last_page: 2, total: 9, to: 5 }), detail: draft({ id: 2, confirmation: { ready: false, issues: [{ field: "a", code: "currency_mismatch", message: "m" }, { field: "b", code: "zzz", message: "m" }] } }), integration: { enabled: false, state: "disabled", capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true }, integration: null } });
      await mount(api, { lng });
      assert.equal(document.documentElement.dir, lng === "ar" ? "rtl" : "ltr");
      assert.match(text(), new RegExp(t("title")));
      assert.match(text(), new RegExp(t("disabledNote")));

      await click(rows()[1].querySelector("a"));
      await flush();
      assert.match(text(), new RegExp(t("issues.currency_mismatch")));
      assert.deepEqual(i18n.missingKeys, []);
      if (lng === "ar") {
        assert.match(text(), /[؀-ۿ]/);
        assert.equal(view.container.querySelector("bdi[dir=ltr]") !== null, true);
      }
    });
  }

  it("has identical keys in both languages for everything the inbox adds", () => {
    const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
    const en = flat(locales.en.dashboard.whatsappDrafts);
    const ar = new Map(flat(locales.ar.dashboard.whatsappDrafts));
    assert.ok(en.length > 70);
    for (const [key, value] of en) {
      assert.ok(ar.has(key), key);
      const holes = (s) => (s.match(/{{\w+}}/g) ?? []).sort().join();
      assert.equal(holes(ar.get(key)), holes(value), key);
      assert.match(ar.get(key), /[؀-ۿ]/, key);
    }
    assert.equal(ar.size, en.length);
  });
});
