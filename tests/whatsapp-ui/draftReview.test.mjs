import "../helpers/domSetup.mjs";
import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { act, createElement as h } from "react";
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { AuthContext } from "../../src/contexts/auth/authContext.js";
import WhatsAppPendingProvider from "../../src/contexts/whatsappPending/WhatsAppPendingProvider.jsx";
import { whatsappApi } from "../../src/features/Dashboards/User/api/whatsappApi.js";
import { PATH, getWhatsAppDraftPath } from "../../src/routes/Path.js";
import { getSafeRedirectPath, getPostAuthPath } from "../../src/routes/postAuthRedirect.js";
import { change, click, flush, installDom, render } from "../helpers/dom.mjs";
import { createDraftServer, SERVER_ACCOUNTS, SERVER_CATEGORIES } from "../helpers/fakeDraftServer.mjs";
import { createI18n, locales, withI18n } from "../helpers/i18n.mjs";
import { envelope, installBrowserStubs } from "../helpers/mockFetch.mjs";
import {
  changedFields, draftToForm, formToChanges, initialReviewState, reviewReducer, trimDecimal, validateForm,
} from "../../src/features/Dashboards/User/WhatsAppDrafts/draftReview.js";
import { parseWhatsAppDraft } from "../../src/features/Dashboards/User/FinancialOperations/whatsappContract.js";

const dom = installDom();
after(() => dom.window.close());

const { default: WhatsAppDrafts } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDrafts.jsx");
const { default: WhatsAppDraftDetails } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftDetails.jsx");
const { default: WhatsAppDraftLink } = await import("../../src/features/Dashboards/User/WhatsAppDrafts/WhatsAppDraftLink.jsx");
const { RequireAuth } = await import("../../src/routes/RouteGuards.jsx");
const { userRoutes } = await import("../../src/routes/Routes.jsx");

/* ------------------------------------------------------------- harness */

const DETAILS = getWhatsAppDraftPath(7);
const choices = () => ({
  accounts: {
    calls: [],
    list: async function list(query) { this.calls.push(query); return envelope({ accounts: SERVER_ACCOUNTS }); },
  },
  categories: {
    calls: [],
    list: async function list(query) { this.calls.push(query); return envelope({ categories: SERVER_CATEGORIES }); },
  },
});

let i18n;
let view;
let router;
let server;
let fetchCalls;
let options;
let consoleOutput;
const originals = {};

function Probe() {
  const location = useLocation();
  globalThis.__location = `${location.pathname}${location.search}`;
  globalThis.__state = location.state;
  return null;
}
// The dashboard layout owns the shared pending count; the shell plays that part here.
const Shell = () => h(WhatsAppPendingProvider, { api: whatsappApi }, h("div", null, h(Probe), h(Outlet)));

function makeRouter(entry, { authed = true } = {}) {
  const guarded = (element) => (authed ? element : h(RequireAuth, null, element));
  return createMemoryRouter([
    {
      path: "/",
      element: h(Shell),
      children: [
        { path: PATH.AUTH.SIGNIN, element: h("p", null, "SIGN IN PAGE") },
        { path: PATH.USER.WHATSAPP_DRAFTS, element: guarded(h(WhatsAppDrafts, { api: whatsappApi, accounts: options.accounts })) },
        { path: PATH.USER.WHATSAPP_DRAFT_DETAILS, element: guarded(h(WhatsAppDraftDetails, { api: whatsappApi, accounts: options.accounts, categories: options.categories })) },
        { path: PATH.USER.WHATSAPP_REVIEW_LINK, element: guarded(h(WhatsAppDraftLink)) },
      ],
    },
  ], { initialEntries: [entry] });
}

const tree = (auth = { user: { id: 1 }, initializing: false, isAuthenticated: true }) =>
  withI18n(i18n, h(AuthContext.Provider, { value: auth }, h(RouterProvider, { router })));

async function open(initial = {}, { entry = DETAILS, lng = "en", authed = true, auth } = {}) {
  server = createDraftServer(initial);
  fetchCalls = server.install();
  options = choices();
  i18n = await createI18n(lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  router = makeRouter(entry, { authed });
  view = await render(tree(auth));
  await flush();
  return server;
}

const t = (key, o) => i18n.t(`dashboard.whatsappDrafts.${key}`, o);
const text = () => view.container.textContent;
const where = () => globalThis.__location;
const button = (label, root = view.container) => [...root.querySelectorAll("button")].find((n) => n.textContent.trim() === label);
const dialog = () => document.body.querySelector("[role=alertdialog]");
const dialogButton = (label) => button(label, dialog());
const field = (label) => {
  const node = [...view.container.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(label));
  return node ? view.container.querySelector(`#${CSS.escape(node.htmlFor)}`) : null;
};
const F = (name) => field(t(`review.${name}`));
const set = async (name, value) => { await change(F(name), value); };
const save = async () => { await click(button(t("review.save"))); await flush(); await flush(); };
const confirmFlow = async () => {
  await click(button(t("review.confirm")));
  await click(dialogButton(t("review.dialog.confirmAction")));
  await flush();
  await flush();
};
const alerts = () => [...view.container.querySelectorAll("[role=alert]")].map((n) => n.textContent);

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

/* ------------------------------------------------------------- editing */

describe("editing a draft", () => {
  it("shows the saved values in the form, with the currency of the account", async () => {
    await open();
    assert.equal(F("amount").value, "25.25");
    assert.equal(F("account").value, "1");
    assert.equal(F("category").value, "2");
    assert.equal(F("date").value, "2026-10-06");
    assert.equal(F("time").value, "12:30");
    assert.equal(F("description").value, "Lunch");
    assert.match(view.container.querySelector(".wad-input__currency").textContent, /ILS/);
    assert.equal(button(t("review.save")).disabled, true);
    assert.equal(button(t("review.cancelEdit")).disabled, true);
  });

  it("offers only the user's own active accounts and expense categories of this workspace", async () => {
    await open();
    const accounts = [...F("account").options].map((o) => o.textContent);
    assert.deepEqual(accounts, [t("review.choose"), "Cash wallet · ILS", "Bank · USD"]);
    const categories = [...F("category").options].map((o) => o.textContent);
    assert.deepEqual(categories, [t("review.choose"), "Food", "Rent"]);
    assert.deepEqual(options.accounts.calls, [{ id_workspace: 1 }]);
    assert.deepEqual(options.categories.calls, [{ workspace_id: 1, type: "expense" }]);
  });

  it("sends no request when nothing changed", async () => {
    await open();
    await set("amount", "25.25");
    await set("description", "  Lunch ");
    assert.equal(button(t("review.save")).disabled, true);
    await click(button(t("review.save")));
    assert.equal(server.count("patch"), 0);
  });

  it("saves a changed amount with review_version and only that field, then shows the new version", async () => {
    await open();
    await set("amount", "12.5");
    assert.ok(view.container.textContent.includes(t("review.unsaved")));
    await save();

    const [call] = server.of("patch");
    assert.equal(call.method, "PATCH");
    assert.equal(call.path, "/integrations/whatsapp/expense-drafts/7");
    assert.deepEqual(call.body, { review_version: 1, amount: "12.5000" });
    assert.equal(server.draft.review_version, 2);
    assert.equal(F("amount").value, "12.5");
    assert.ok(!view.container.textContent.includes(t("review.unsaved")));
    assert.equal(server.count("confirm"), 0, "saving never confirms");
    assert.equal(server.transactions.length, 0);
  });

  it("updates review_version so a second save uses the new one", async () => {
    await open();
    await set("amount", "1");
    await save();
    await set("description", "Dinner");
    await save();
    assert.deepEqual(server.of("patch").map((c) => c.body.review_version), [1, 2]);
    assert.deepEqual(server.of("patch")[1].body, { review_version: 2, description: "Dinner" });
  });

  it("keeps exact decimal strings, never a float", async () => {
    await open();
    await set("amount", "123456789012345.9999");
    await save();
    assert.equal(server.of("patch")[0].body.amount, "123456789012345.9999");
    assert.equal(server.draft.values.amount, "123456789012345.9999");
    assert.equal(F("amount").value, "123456789012345.9999");

    await set("amount", "0.1");
    await save();
    assert.equal(server.of("patch")[1].body.amount, "0.1000");
    assert.equal(F("amount").type, "text", "not a number input");
  });

  it("changing the account shows its currency before saving and sends only the account id", async () => {
    await open();
    await set("account", "2");
    assert.match(view.container.querySelector(".wad-input__currency").textContent, /USD/);
    await save();
    assert.deepEqual(server.of("patch")[0].body, { review_version: 1, account_id: 2 });
    assert.equal(server.draft.values.currency_code, "USD", "the currency follows the account on the server");
    assert.equal(server.draft.values.amount, "25.2500", "no conversion of the amount");
  });

  it("changes the category", async () => {
    await open();
    await set("category", "3");
    await save();
    assert.deepEqual(server.of("patch")[0].body, { review_version: 1, category_id: 3 });
  });

  it("keeps the exact calendar date typed, with no timezone shift", async () => {
    await open();
    await set("date", "2026-12-31");
    await save();
    assert.equal(server.of("patch")[0].body.transaction_date, "2026-12-31");
    assert.equal(F("date").value, "2026-12-31");
  });

  it("refuses to clear the date, with no request", async () => {
    await open();
    await set("date", "");
    await save();
    assert.equal(server.count("patch"), 0);
    assert.match(view.container.textContent, new RegExp(t("review.fieldErrors.date_required")));
    assert.equal(F("date").getAttribute("aria-invalid"), "true");
  });

  it("allows clearing the optional time", async () => {
    await open();
    await click(button(t("review.clearTime")));
    await save();
    assert.deepEqual(server.of("patch")[0].body, { review_version: 1, transaction_time: null });
    assert.equal(F("time").value, "");
    assert.equal(button(t("review.clearTime")), undefined);
  });

  it("checks values locally before any request", async () => {
    await open();
    await set("amount", "abc");
    await save();
    assert.match(view.container.textContent, new RegExp(t("review.fieldErrors.amount_invalid")));
    await set("amount", "1.23456");
    await save();
    await set("amount", "-5");
    await save();
    assert.equal(server.count("patch"), 0);
    assert.equal(F("amount").value, "-5", "the typed value is kept");
  });

  it("a server rejection keeps what the user typed and marks the field", async () => {
    await open();
    await set("account", "2");
    server.accounts.find((a) => a.id === 2).status = "archived"; // archived behind the user's back
    await save();
    assert.equal(F("account").value, "2", "the selection is kept");
    assert.equal(F("account").getAttribute("aria-invalid"), "true");
    assert.ok(alerts().some((a) => a.includes(t("review.errors.account"))));
    assert.ok(view.container.textContent.includes(t("review.unsaved")));
    assert.equal(server.draft.review_version, 1, "nothing was saved");
  });

  it("a rejected time on a nonexistent local time is explained and can be corrected", async () => {
    await open();
    await set("time", "02:30");
    server.rejectTime = "02:30";
    await save();
    assert.ok(alerts().some((a) => a.includes(t("review.errors.timeInvalid"))));
    await set("time", "03:30");
    server.rejectTime = null;
    await save();
    assert.equal(server.draft.values.transaction_time, "03:30:00");
  });

  it("a double click on Save sends one request", async () => {
    await open();
    await set("amount", "9");
    const release = server.hold("patch");
    const saveButton = button(t("review.save"));
    await click(saveButton);
    await click(saveButton);
    await click(saveButton);
    assert.equal(server.count("patch"), 1);
    assert.equal(button(t("review.saving")).disabled, true);
    release();
    await flush();
    await flush();
    assert.equal(server.count("patch"), 1);
    assert.equal(server.draft.review_version, 2);
  });

  it("Cancel changes restores the saved values and sends nothing", async () => {
    await open();
    await set("amount", "99");
    await set("description", "x");
    await click(button(t("review.cancelEdit")));
    assert.equal(F("amount").value, "25.25");
    assert.equal(F("description").value, "Lunch");
    assert.equal(server.count("patch"), 0);
  });

  it("a stale review_version is a conflict: the latest is shown, edits are kept aside, nothing is overwritten", async () => {
    await open();
    server.draft.review_version = 2; // changed elsewhere
    server.draft.values.description = "Changed elsewhere";
    await set("amount", "50");
    await save();

    assert.equal(server.draft.values.amount, "25.2500", "the newer data was not overwritten");
    assert.match(view.container.querySelector(".wad-banner--conflict").textContent, new RegExp(t("review.conflictTitle")));
    assert.match(view.container.querySelector(".wad-banner--conflict").textContent, new RegExp(t("review.fields.amount")));
    assert.equal(F("description").value, "Changed elsewhere");
    assert.equal(F("amount").value, "25.25");
    assert.equal(server.count("confirm"), 0, "no automatic confirmation");
    assert.equal(button(t("review.confirm")).disabled, true, "a new review is required first");
    assert.match(view.container.textContent, new RegExp(t("review.blocked.conflict")));

    await click(button(t("review.reapply")));
    assert.equal(F("amount").value, "50");
    assert.equal(view.container.querySelector(".wad-banner--conflict"), null);
    await save();
    assert.deepEqual(server.of("patch").at(-1).body, { review_version: 2, amount: "50.0000" });
    assert.equal(server.draft.review_version, 3);
  });

  it("dropping the kept-aside edits keeps the latest version", async () => {
    await open();
    server.draft.review_version = 2;
    await set("amount", "50");
    await save();
    await click(button(t("review.discardMine")));
    assert.equal(F("amount").value, "25.25");
    assert.equal(view.container.querySelector(".wad-banner--conflict"), null);
  });

  it("asks before leaving the page with unsaved changes", async () => {
    await open();
    await set("amount", "77");
    await act(async () => { router.navigate(PATH.USER.WHATSAPP_DRAFTS); });
    await flush();
    assert.equal(where(), DETAILS, "navigation is held");
    const prompt = dialog();
    assert.ok(prompt);
    await click(button(i18n.t("common.unsavedChanges.stay"), prompt));
    assert.equal(where(), DETAILS);
    assert.equal(F("amount").value, "77", "the edit survives");
    await act(async () => { router.navigate(PATH.USER.WHATSAPP_DRAFTS); });
    await flush();
    await click(button(i18n.t("common.unsavedChanges.leave"), dialog()));
    await flush();
    assert.equal(where(), PATH.USER.WHATSAPP_DRAFTS);
  });

  it("a network error while saving keeps the edits and does not lose them", async () => {
    await open();
    await set("amount", "5");
    server.failNext("patch", { kind: "network" });
    await save();
    assert.equal(F("amount").value, "5");
    assert.ok(view.container.textContent.includes(t("review.unsaved")));
    assert.equal(server.draft.review_version, 1);
    await save();
    assert.equal(server.draft.values.amount, "5.0000");
  });

  it("a save whose answer was lost but which the server applied is recognised as saved", async () => {
    await open();
    await set("amount", "5");
    server.failNext("patch", { kind: "network", apply: true });
    await save();
    assert.ok(!view.container.textContent.includes(t("review.unsaved")));
    assert.equal(server.count("patch"), 1);
    assert.equal(server.draft.review_version, 2);
  });
});

describe("review reducer (pure rules)", () => {
  const parsed = (over = {}) => parseWhatsAppDraft({
    id: 7, workspace_id: 1, source: "whatsapp", status: "ready_for_review", review_version: 3,
    can_edit: true, can_confirm: true, can_discard: true,
    review_values: { account_id: 1, category_id: 2, amount: "25.2500", currency_code: "ILS", description: "x", transaction_date: "2026-10-06", transaction_time: "12:30:00", workspace_timezone: "Asia/Gaza" },
    confirmation: { ready: true, issues: [] }, ...over,
  });

  it("an older server answer never overwrites a newer draft", () => {
    let state = reviewReducer(initialReviewState, { type: "loaded", draft: parsed({ review_version: 5 }) });
    state = reviewReducer(state, { type: "saved", draft: parsed({ review_version: 4, review_values: { ...parsed().review_values, amount: "1.0000" } }) });
    assert.equal(state.draft.review_version, 5);
    assert.equal(state.saved.amount, "25.25");
    state = reviewReducer(state, { type: "refreshed", draft: parsed({ review_version: 3 }) });
    assert.equal(state.draft.review_version, 5);
  });

  it("a background refresh keeps the user's unsaved edits", () => {
    let state = reviewReducer(initialReviewState, { type: "loaded", draft: parsed() });
    state = reviewReducer(state, { type: "field", field: "amount", value: "99" });
    state = reviewReducer(state, { type: "refreshed", draft: parsed({ review_version: 4 }) });
    assert.equal(state.form.amount, "99");
    assert.equal(state.draft.review_version, 4);
  });

  it("form helpers compare decimals as strings", () => {
    assert.equal(trimDecimal("25.2500"), "25.25");
    assert.equal(trimDecimal("25.0000"), "25");
    assert.equal(trimDecimal("0.1000"), "0.1");
    const saved = draftToForm(parsed());
    assert.deepEqual(changedFields(saved, { ...saved, amount: "25.250" }), []);
    assert.deepEqual(changedFields(saved, { ...saved, amount: "25.251" }), ["amount"]);
    assert.deepEqual(formToChanges(saved, { ...saved, transaction_time: "", description: "  " }), { description: null, transaction_time: null });
    assert.equal(validateForm({ ...saved, transaction_date: "" }).transaction_date, "date_required");
    assert.equal(validateForm({ ...saved, transaction_date: "2026-02-30" }).transaction_date, "date_invalid");
    assert.equal(validateForm({ ...saved, transaction_time: "25:00" }).transaction_time, "time_invalid");
    assert.deepEqual(validateForm(saved), {});
  });
});

/* ---------------------------------------------------------- confirmation */

describe("confirmation readiness", () => {
  it("is disabled when the backend says the user cannot confirm", async () => {
    await open({ can_confirm: false });
    assert.equal(button(t("review.confirm")).disabled, true);
    assert.match(text(), new RegExp(t("review.blocked.forbidden")));
  });

  it("is disabled while confirmation.ready is false, and shows every issue translated", async () => {
    await open({ values: { ...createDraftServer().draft.values, amount: null, category_id: null } });
    assert.equal(button(t("review.confirm")).disabled, true);
    const issues = [...view.container.querySelectorAll(".wad-issues li")].map((li) => li.textContent);
    assert.equal(issues.length, 2);
    assert.ok(issues.some((s) => s.includes(t("issues.amount_required"))));
    assert.ok(issues.some((s) => s.includes(t("issues.category_required"))));
    assert.match(text(), new RegExp(t("review.blocked.notReady")));
  });

  it("is disabled with unsaved edits and enabled again once they are saved", async () => {
    await open();
    assert.equal(button(t("review.confirm")).disabled, false);
    await set("amount", "30");
    assert.equal(button(t("review.confirm")).disabled, true);
    assert.match(text(), new RegExp(t("review.blocked.dirty")));
    await save();
    assert.equal(button(t("review.confirm")).disabled, false);
  });

  it("filling in what was missing and saving makes the draft confirmable", async () => {
    await open({ values: { ...createDraftServer().draft.values, amount: null } });
    assert.equal(button(t("review.confirm")).disabled, true);
    await set("amount", "10");
    await save();
    assert.equal(button(t("review.confirm")).disabled, false);
    assert.equal(view.container.querySelectorAll(".wad-issues li").length, 0);
  });

  it("never confirms by itself: not on load, refresh, save or opening the dialog", async () => {
    await open();
    await click(button(t("refresh")));
    await flush();
    await set("amount", "11");
    await save();
    await click(button(t("review.confirm")));
    assert.ok(dialog());
    assert.equal(server.count("confirm"), 0);
    assert.equal(server.transactions.length, 0);
  });
});

describe("confirming", () => {
  it("needs an explicit second step: the dialog says what will be recorded", async () => {
    await open();
    await click(button(t("review.confirm")));
    const prompt = dialog();
    assert.ok(prompt);
    assert.match(prompt.textContent, new RegExp(t("review.dialog.confirmBody")));
    assert.match(prompt.textContent, /₪25\.25/);
    assert.match(prompt.textContent, /Cash wallet/);
    assert.equal(prompt.querySelector("button").textContent, t("review.dialog.cancel"), "the safe choice is first");
    await click(dialogButton(t("review.dialog.cancel")));
    assert.equal(dialog(), null);
    assert.equal(server.count("confirm"), 0);
  });

  it("sends the exact contract: POST, a valid Idempotency-Key and only review_version", async () => {
    await open();
    await confirmFlow();
    const [call] = server.of("confirm");
    assert.equal(call.method, "POST");
    assert.equal(call.path, "/integrations/whatsapp/expense-drafts/7/confirm");
    assert.match(call.key, /^[A-Za-z0-9._:-]{8,255}$/);
    assert.match(call.key, /^wa-draft-7-confirm-/);
    assert.deepEqual(call.body, { review_version: 1 });
    assert.equal(fetchCalls.find((c) => c.method === "POST").rawBody, '{"review_version":1}');
  });

  it("uses the review_version of the latest saved draft", async () => {
    await open();
    await set("amount", "8");
    await save();
    await confirmFlow();
    assert.deepEqual(server.of("confirm")[0].body, { review_version: 2 });
  });

  it("shows success only from the backend's answer: recorded state, transaction link, no second Confirm", async () => {
    await open();
    await confirmFlow();
    assert.equal(server.transactions.length, 1);
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.match(text(), /#50/);
    const link = [...view.container.querySelectorAll("a")].find((a) => a.textContent === t("review.viewTransaction"));
    assert.equal(link.getAttribute("href"), "/dashboard/financial-operations/50");
    assert.equal(button(t("review.confirm")), undefined);
    assert.equal(view.container.querySelector("form"), null, "no longer editable");
    assert.equal(button(t("review.discard")), undefined);
    assert.ok([...view.container.querySelectorAll("a")].some((a) => a.getAttribute("href") === PATH.USER.WHATSAPP_DRAFTS));
  });

  it("a double click confirms once", async () => {
    await open();
    const release = server.hold("confirm");
    await click(button(t("review.confirm")));
    const go = dialogButton(t("review.dialog.confirmAction"));
    await click(go);
    await click(go);
    assert.equal(server.count("confirm"), 1);
    assert.equal(button(t("review.confirming")).disabled, true);
    assert.equal(dialog(), null);
    release();
    await flush();
    await flush();
    assert.equal(server.count("confirm"), 1);
    assert.equal(server.transactions.length, 1);
  });

  it("a recorded expense cannot be confirmed again, even after a reload", async () => {
    await open();
    await confirmFlow();
    await view.unmount();
    view = null;
    router = makeRouter(DETAILS);
    view = await render(tree());
    await flush();
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.match(text(), /#50/);
    assert.equal(button(t("review.confirm")), undefined);
    assert.equal(server.count("confirm"), 1);
    assert.equal(server.transactions.length, 1);
  });

  it("an already confirmed draft opens as recorded and offers no action", async () => {
    await open({ status: "confirmed", confirmed_transaction_id: 77 });
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.match(text(), /#77/);
    assert.equal(view.container.querySelector("form"), null);
    assert.equal(button(t("review.confirm")), undefined);
    assert.equal(server.count("confirm"), 0);
  });
});

describe("uncertain confirmation outcomes", () => {
  it("a lost connection keeps one attempt: it checks the draft, then retries with the SAME key", async () => {
    await open();
    server.failNext("confirm", { kind: "network" });
    await confirmFlow();

    assert.match(text(), new RegExp(t("review.uncertainTitle")));
    assert.match(text(), new RegExp(t("review.notRecordedYet")));
    assert.equal(server.count("get"), 2, "the draft was re-read (initial load + reconciliation)");
    assert.equal(server.transactions.length, 0);
    assert.equal(button(t("review.confirm")), undefined, "no fresh Confirm while the outcome is unknown");

    await click(button(t("review.retrySame")));
    await flush();
    await flush();

    const posts = server.of("confirm");
    assert.equal(posts.length, 2);
    assert.equal(posts[1].key, posts[0].key, "the very same Idempotency-Key");
    assert.deepEqual(posts[1].body, posts[0].body);
    assert.equal(server.transactions.length, 1);
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
  });

  it("when the answer was lost but the expense was recorded, it reconciles and shows the real transaction without another POST", async () => {
    await open();
    server.failNext("confirm", { kind: "network", apply: true });
    await confirmFlow();
    assert.equal(server.count("confirm"), 1);
    assert.equal(server.transactions.length, 1);
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.match(text(), /#50/);
    assert.match(text(), new RegExp(t("review.reconciledNote")));
  });

  it("an HTTP 5xx is treated as unknown, not as a rejection", async () => {
    await open();
    server.failNext("confirm", { kind: "http", status: 503 });
    await confirmFlow();
    assert.match(text(), new RegExp(t("review.uncertainTitle")));
    assert.ok(!alerts().some((a) => a.includes(t("review.errors.validation"))));
    server.failNext("confirm", { kind: "http", status: 500, apply: true });
    await click(button(t("review.retrySame")));
    await flush();
    await flush();
    assert.equal(server.transactions.length, 1, "replayed, not duplicated");
    assert.deepEqual([...new Set(server.of("confirm").map((c) => c.key))].length, 1);
  });

  it("when the draft cannot be re-read either, it says so and lets the user check again", async () => {
    await open();
    server.failNext("confirm", { kind: "network", apply: true });
    server.failNext("get", { kind: "network" });
    await confirmFlow();
    assert.match(text(), new RegExp(t("review.uncertainTitle")));
    assert.match(text(), new RegExp(t("review.unreadable")));
    assert.equal(server.transactions.length, 1, "it was recorded; the screen does not claim otherwise");
    assert.equal(button(t("review.confirmedTitle")), undefined);

    await click(button(t("review.checkStatus")));
    await flush();
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.equal(server.count("confirm"), 1, "checking never posts");
  });

  it("Check status only reads", async () => {
    await open();
    server.failNext("confirm", { kind: "network" });
    await confirmFlow();
    const posts = server.count("confirm");
    await click(button(t("review.checkStatus")));
    await click(button(t("review.checkStatus")));
    await flush();
    assert.equal(server.count("confirm"), posts);
  });

  it("after a reload the lost attempt is not assumed: the draft is read first, then confirming is a new explicit step", async () => {
    await open();
    server.failNext("confirm", { kind: "network" });
    await confirmFlow();
    const firstKey = server.of("confirm")[0].key;

    await view.unmount();
    view = null;
    router = makeRouter(DETAILS);
    view = await render(tree());
    await flush();

    assert.equal(server.count("confirm"), 1, "nothing is sent on load");
    assert.equal(server.transactions.length, 0);
    assert.equal(button(t("review.confirm")).disabled, false);

    await confirmFlow();
    assert.equal(server.transactions.length, 1);
    assert.notEqual(server.of("confirm")[1].key, firstKey, "a reload cannot reuse the lost in-memory key");
    assert.equal(server.transactions.length, 1);
  });

  it("after a reload an expense that WAS recorded is shown as recorded and nothing is sent", async () => {
    await open();
    server.failNext("confirm", { kind: "network", apply: true });
    server.failNext("get", { kind: "network" });
    await confirmFlow();
    await view.unmount();
    view = null;
    router = makeRouter(DETAILS);
    view = await render(tree());
    await flush();
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.equal(server.count("confirm"), 1);
    assert.equal(server.transactions.length, 1);
  });

  it("a logical attempt never gets a new key by itself: repeated retries share one", async () => {
    await open();
    server.failNext("confirm", { kind: "network" });
    server.failNext("confirm", { kind: "network" });
    server.failNext("confirm", { kind: "network" });
    await confirmFlow();
    await click(button(t("review.retrySame")));
    await flush();
    await click(button(t("review.retrySame")));
    await flush();
    await flush();
    assert.equal(server.count("confirm"), 3);
    assert.equal(server.transactions.length, 0);
    await click(button(t("review.retrySame")));
    await flush();
    await flush();
    const keys = new Set(server.of("confirm").map((c) => c.key));
    assert.equal(server.count("confirm"), 4);
    assert.equal(keys.size, 1);
    assert.equal(server.transactions.length, 1);
  });
});

describe("definitive rejections and conflicts", () => {
  it("a stale review_version on confirm shows the changed draft and requires a new review", async () => {
    await open();
    server.draft.review_version = 2;
    server.draft.values.description = "Edited elsewhere";
    await confirmFlow();

    assert.equal(server.transactions.length, 0);
    assert.doesNotMatch(text(), new RegExp(t("review.confirmedTitle")));
    assert.ok(view.container.querySelector(".wad-banner--conflict"));
    assert.equal(F("description").value, "Edited elsewhere");
    assert.equal(button(t("review.confirm")).disabled, true);

    await click(button(t("review.understood")));
    assert.equal(button(t("review.confirm")).disabled, false);
    await confirmFlow();
    const [first, second] = server.of("confirm");
    assert.deepEqual(second.body, { review_version: 2 });
    assert.notEqual(second.key, first.key, "a fresh, explicit confirmation is a new logical attempt");
    assert.equal(server.transactions.length, 1);
  });

  it("a conflict because the draft was already confirmed elsewhere resolves to the recorded expense, with no duplicate", async () => {
    await open();
    // Another session confirmed it with its own key while this screen was open.
    server.draft.status = "confirmed";
    server.draft.confirmed_transaction_id = 50;
    server.transactions.push({ id: 50, key: "other-session-key-1", draftId: 7, resource: { id: 50, type: "expense", status: "posted" } });
    await confirmFlow();
    assert.equal(server.transactions.length, 1);
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
    assert.match(text(), /#50/);
  });

  it("insufficient balance is explained, nothing is recorded and no success is shown", async () => {
    await open();
    server.balance = "5.0000";
    await confirmFlow();
    assert.equal(server.transactions.length, 0);
    assert.ok(alerts().some((a) => a.includes(t("review.errors.insufficient"))));
    assert.doesNotMatch(text(), new RegExp(t("review.confirmedTitle")));
    assert.equal(button(t("review.confirm")).disabled, false, "the user can try again after fixing the balance");

    server.balance = "1000.0000";
    await confirmFlow();
    assert.equal(server.transactions.length, 1);
    const [first, second] = server.of("confirm");
    assert.notEqual(first.key, second.key, "a refused confirmation records nothing, so a new explicit one is a new attempt");
  });

  it("an account archived since the last save is refused", async () => {
    await open();
    server.accounts.find((a) => a.id === 1).status = "archived";
    await confirmFlow();
    assert.equal(server.transactions.length, 0);
    assert.doesNotMatch(text(), new RegExp(t("review.confirmedTitle")));
    assert.ok(alerts().length >= 1);
    // The readiness was re-read, so the screen now lists the account problem.
    assert.ok([...view.container.querySelectorAll(".wad-issues li")].some((li) => li.textContent.includes(t("issues.account_not_usable"))));
    assert.equal(button(t("review.confirm")).disabled, true);
  });

  it("an invalid category is refused with a category message", async () => {
    await open();
    server.rejectCategory = true;
    await confirmFlow();
    assert.equal(server.transactions.length, 0);
    assert.ok(alerts().some((a) => a.includes(t("review.errors.category"))));
  });

  it("a rejected confirmation never produces a success state", async () => {
    await open();
    server.balance = "1.0000";
    await confirmFlow();
    assert.equal(view.container.querySelector(".wad-final--ok"), null);
    assert.equal(server.draft.status, "ready_for_review");
  });

  it("a draft that is no longer reviewable is explained", async () => {
    await open();
    server.draft.status = "expired";
    await confirmFlow();
    assert.equal(server.transactions.length, 0);
    assert.match(text(), new RegExp(t("review.expiredTitle")), "the screen follows the server's state");
    assert.equal(button(t("review.confirm")), undefined);
  });

  it("403 and 429 on confirm are definitive refusals, translated", async () => {
    await open();
    server.failNext("confirm", { kind: "http", status: 403 });
    await confirmFlow();
    assert.ok(alerts().some((a) => a.includes(t("review.errors.forbidden"))));
    server.failNext("confirm", { kind: "http", status: 429 });
    await confirmFlow();
    assert.ok(alerts().length >= 1);
    assert.equal(server.transactions.length, 0);
  });
});

describe("session isolation", () => {
  it("a different signed-in user starts clean: no attempt, edit or answer carries over", async () => {
    await open();
    const release = server.hold("confirm");
    await click(button(t("review.confirm")));
    await click(dialogButton(t("review.dialog.confirmAction")));
    assert.equal(server.count("confirm"), 1);
    assert.ok(button(t("review.confirming")), "the first session is mid-confirmation");

    await view.rerender(tree({ user: { id: 2 }, initializing: false, isAuthenticated: true }));
    await flush();
    // The new session has no attempt of its own and no progress state.
    assert.ok(button(t("review.confirm")), "a fresh instance, not the pending one");
    assert.ok(button(t("review.confirming")) === undefined);
    assert.equal(server.count("get"), 2, "it read the draft itself");

    release();
    await flush();
    await flush();
    // The first session's answer was dropped, so it changes nothing on this screen.
    assert.ok(view.container.querySelector(".wad-final--ok") === null);
    assert.doesNotMatch(text(), new RegExp(t("review.reconciledNote")));
    assert.equal(server.transactions.length, 1, "the server finished the one request it had received");
    assert.equal(server.count("confirm"), 1, "the new session sent nothing");
  });

  it("another draft id is another instance: the previous draft is never shown while loading", async () => {
    await open();
    assert.match(text(), /Lunch/);
    const release = server.hold("other-draft");
    await act(async () => { router.navigate(getWhatsAppDraftPath(8)); });
    await flush();
    assert.doesNotMatch(text(), /Lunch/);
    assert.ok(F("amount") === null);
    release();
    await flush();
    assert.match(text(), new RegExp(t("errors.notFound")));
  });

  it("leaving the page does not apply a late answer to anything", async () => {
    await open();
    const release = server.hold("confirm");
    await click(button(t("review.confirm")));
    await click(dialogButton(t("review.dialog.confirmAction")));
    await act(async () => { router.navigate(PATH.USER.WHATSAPP_DRAFTS); });
    await flush();
    release();
    await flush();
    await flush();
    assert.equal(server.transactions.length, 1, "the server finished the request it received once");
    assert.equal(consoleOutput.filter(([method]) => method === "error").length, 0, "no state update after unmount");
  });
});

/* ------------------------------------------------------------------ discard */

describe("discarding a draft", () => {
  it("needs a confirmation dialog and explains that recorded expenses are untouched", async () => {
    await open();
    await click(button(t("review.discard")));
    const prompt = dialog();
    assert.match(prompt.textContent, new RegExp(t("review.dialog.discardBody")));
    assert.equal(prompt.querySelector("button").textContent, t("review.dialog.keep"));
    await click(dialogButton(t("review.dialog.keep")));
    assert.equal(server.count("delete"), 0);
    assert.equal(server.draft.status, "ready_for_review");
  });

  it("discards with DELETE once, then shows the terminal state with no way to edit or confirm", async () => {
    await open();
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    const [call] = server.of("delete");
    assert.equal(call.method, "DELETE");
    assert.equal(call.path, "/integrations/whatsapp/expense-drafts/7");
    assert.equal(call.body, undefined);
    assert.equal(server.count("delete"), 1);
    assert.match(text(), new RegExp(t("review.discardedTitle")));
    assert.equal(view.container.querySelector("form"), null);
    assert.equal(button(t("review.confirm")), undefined);
    assert.equal(server.transactions.length, 0);
  });

  it("is not offered when the backend does not permit it", async () => {
    await open({ can_discard: false });
    assert.equal(button(t("review.discard")), undefined);
    assert.equal(view.container.querySelector(".wad-discard"), null);
  });

  it("a double click discards once", async () => {
    await open();
    const release = server.hold("delete");
    await click(button(t("review.discard")));
    const go = dialogButton(t("review.dialog.discardAction"));
    await click(go);
    await click(go);
    assert.equal(server.count("delete"), 1);
    release();
    await flush();
    await flush();
    assert.equal(server.count("delete"), 1);
  });

  it("a timed-out DELETE is reconciled by reading the draft: it was discarded", async () => {
    await open();
    server.failNext("delete", { kind: "network", apply: true });
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    assert.match(text(), new RegExp(t("review.discardedTitle")));
    assert.equal(server.count("delete"), 1, "never assumed it failed and resent");
  });

  it("a timed-out DELETE that did not apply says so and allows another try", async () => {
    await open();
    server.failNext("delete", { kind: "network" });
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    assert.ok(alerts().some((a) => a.includes(t("review.notDiscarded"))));
    assert.ok(button(t("review.discard")));
    assert.equal(server.draft.status, "ready_for_review");
  });

  it("a draft that is no longer open cannot be discarded and the screen follows the server", async () => {
    await open();
    server.draft.status = "confirmed";
    server.draft.confirmed_transaction_id = 50;
    server.transactions.push({ id: 50, key: "k-confirmed-1", draftId: 7, resource: { id: 50 } });
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    assert.equal(server.draft.status, "confirmed", "a confirmed draft is never turned into a discarded one");
    assert.match(text(), new RegExp(t("review.confirmedTitle")));
  });

  it("only draft endpoints are ever called: no reversal, no transaction write", async () => {
    await open();
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    assert.ok(fetchCalls.every((c) => c.url.startsWith("/api/integrations/whatsapp/")), fetchCalls.map((c) => c.url).join());
    assert.ok(fetchCalls.every((c) => !/reverse|transactions/.test(c.url)));
  });

  it("the pending count read by the inbox afterwards reflects it", async () => {
    await open();
    await click(button(t("review.discard")));
    await click(dialogButton(t("review.dialog.discardAction")));
    await flush();
    await flush();
    await act(async () => { router.navigate(PATH.USER.WHATSAPP_DRAFTS); });
    await flush();
    await flush();
    assert.equal(view.container.querySelector(".wad-pending__count").textContent, "0");
  });
});

describe("other draft states", () => {
  for (const [status, title] of [["discarded", "review.discardedTitle"], ["expired", "review.expiredTitle"], ["collecting", "review.collectingTitle"]]) {
    it(`${status}: shows its state and offers no edit, confirm or discard`, async () => {
      await open({ status });
      assert.match(text(), new RegExp(t(title)));
      assert.equal(view.container.querySelector("form"), null);
      assert.equal(button(t("review.confirm")), undefined);
      assert.equal(button(t("review.discard")), undefined);
      assert.equal(server.calls.filter((c) => c.method !== "GET").length, 0);
    });
  }

  it("a draft the user may not edit is read-only even though it is ready for review", async () => {
    await open({ can_edit: false });
    assert.equal(view.container.querySelector("form"), null);
    assert.ok(button(t("review.confirm")));
  });
});

/* --------------------------------------------------------------- deep link */

describe("the backend review link", () => {
  it("is registered as a route inside the authenticated dashboard", () => {
    const paths = userRoutes[0].children.map((route) => route.path);
    assert.ok(paths.includes("/whatsapp/drafts/:draftId"));
    assert.equal(PATH.USER.WHATSAPP_REVIEW_LINK, "/whatsapp/drafts/:draftId");
    assert.equal(userRoutes[0].path, "/");
  });

  it("an authenticated user is forwarded to the review page", async () => {
    await open({}, { entry: "/whatsapp/drafts/7" });
    assert.equal(where(), DETAILS);
    assert.ok(F("amount"));
    assert.equal(server.count("get"), 1);
  });

  it("an anonymous visitor is sent to sign-in first, sees no draft data, and returns after login", async () => {
    const anonymous = { user: null, initializing: false, isAuthenticated: false };
    await open({}, { entry: "/whatsapp/drafts/7", authed: false, auth: anonymous });
    assert.equal(where(), PATH.AUTH.SIGNIN);
    assert.match(text(), /SIGN IN PAGE/);
    assert.equal(server.calls.length, 0, "no draft request before authentication");
    assert.doesNotMatch(text(), /Lunch/);
    const from = globalThis.__state.from;
    assert.equal(from, "/whatsapp/drafts/7");
    assert.equal(getPostAuthPath({ from }), "/whatsapp/drafts/7");

    // The user signs in; the app navigates to the stored destination.
    await view.rerender(tree({ user: { id: 1 }, initializing: false, isAuthenticated: true }));
    await act(async () => { router.navigate(getPostAuthPath({ from })); });
    await flush();
    await flush();
    assert.equal(where(), DETAILS);
    assert.ok(F("amount"));
  });

  it("a refresh on the review page loads it directly", async () => {
    await open({}, { entry: DETAILS });
    assert.ok(F("amount"));
    await view.unmount();
    router = makeRouter(DETAILS);
    view = await render(tree());
    await flush();
    assert.ok(F("amount"));
  });

  it("a draft that is not the user's is a safe not-found, with no data", async () => {
    await open({}, { entry: "/whatsapp/drafts/99" });
    assert.equal(where(), getWhatsAppDraftPath(99));
    assert.ok(alerts().some((a) => a.includes(t("errors.notFound"))));
    assert.ok(F("amount") === null);
    assert.doesNotMatch(text(), /Lunch/);
  });

  it("can never redirect outside the app, whatever the link carries", async () => {
    for (const hostile of ["//evil.example", "..%2F..%2Fevil", "https%3A%2F%2Fevil.example", "%5Cevil", "7%2Fconfirm"]) {
      await open({}, { entry: `/whatsapp/drafts/${hostile}` });
      // Either it forwards to the fixed dashboard path or, for a shape the route does not match, nowhere.
      assert.ok(where() === "" || where().startsWith("/dashboard/whatsapp/drafts/"), `${hostile} -> ${where()}`);
      assert.equal(where().includes("evil.example/"), false);
      assert.doesNotMatch(dom.window.location.href, /evil/);
      assert.ok(fetchCalls.every((c) => c.url.startsWith("/api/integrations/whatsapp/") || c.url.startsWith("/api/accounts")));
      await view.unmount();
      view = null;
    }
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/signin"]) {
      assert.equal(getSafeRedirectPath(bad), null, bad);
    }
  });
});

/* ------------------------------------------------------------- privacy */

describe("workspace isolation and privacy", () => {
  it("only the draft's own workspace is used for accounts and categories", async () => {
    await open();
    assert.deepEqual(options.accounts.calls, [{ id_workspace: 1 }]);
    assert.deepEqual(options.categories.calls, [{ workspace_id: 1, type: "expense" }]);
    assert.ok(![...F("account").options].some((o) => o.textContent.includes("Other workspace")));
  });

  it("nothing private reaches storage, the URL or the console during a full journey", async () => {
    await open();
    await set("amount", "31.5");
    await set("description", "SECRET DINNER");
    await save();
    server.failNext("confirm", { kind: "network" });
    await confirmFlow();
    const key = server.of("confirm")[0].key;
    await click(button(t("review.retrySame")));
    await flush();
    await flush();
    const dump = JSON.stringify([
      globalThis.localStorage.dump(), globalThis.sessionStorage.dump(), consoleOutput, dom.window.location.href, document.cookie,
    ]);
    for (const secret of ["SECRET DINNER", "31.5", key, "wa-draft-7"]) assert.equal(dump.includes(secret), false, secret);
    assert.equal(where().includes("SECRET"), false);
  });

  it("makes no request to anything but the WhatsApp draft endpoints", async () => {
    await open();
    await set("amount", "2");
    await save();
    await confirmFlow();
    assert.ok(fetchCalls.every((c) => c.url.startsWith("/api/integrations/whatsapp/")));
    assert.ok(fetchCalls.every((c) => !/^https?:/.test(c.url)));
  });
});

/* ------------------------------------------------------- i18n and layout */

describe("Arabic and English", () => {
  for (const lng of ["en", "ar"]) {
    it(`${lng}: edit, confirm and discard render fully translated`, async () => {
      await open({}, { lng });
      assert.equal(document.documentElement.dir, lng === "ar" ? "rtl" : "ltr");
      assert.ok(F("amount"));
      await set("amount", "40");
      assert.ok(text().includes(t("review.unsaved")));
      await save();
      await click(button(t("review.confirm")));
      assert.match(dialog().textContent, new RegExp(t("review.dialog.confirmTitle")));
      await click(dialogButton(t("review.dialog.cancel")));
      await click(button(t("review.discard")));
      assert.match(dialog().textContent, new RegExp(t("review.dialog.discardTitle")));
      await click(dialogButton(t("review.dialog.keep")));

      server.failNext("confirm", { kind: "network" });
      await confirmFlow();
      assert.match(text(), new RegExp(t("review.uncertainTitle")));
      await click(button(t("review.retrySame")));
      await flush();
      await flush();
      assert.match(text(), new RegExp(t("review.confirmedTitle")));

      assert.deepEqual(i18n.missingKeys, []);
      if (lng === "ar") assert.match(text(), /[؀-ۿ]/);
    });
  }

  it("amount, currency and dates sit in left-to-right islands inside Arabic text", async () => {
    await open({}, { lng: "ar" });
    assert.equal(F("amount").getAttribute("dir"), "ltr");
    assert.equal(view.container.querySelector(".wad-input__currency").getAttribute("dir"), "ltr");
  });

  it("has identical review keys and placeholders in both languages", () => {
    const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
    const en = flat(locales.en.dashboard.whatsappDrafts.review);
    const ar = new Map(flat(locales.ar.dashboard.whatsappDrafts.review));
    assert.ok(en.length > 80);
    for (const [key, value] of en) {
      assert.ok(ar.has(key), key);
      const holes = (s) => (s.match(/{{\w+}}/g) ?? []).sort().join();
      assert.equal(holes(ar.get(key)), holes(value), key);
      assert.match(ar.get(key), /[؀-ۿ]/, key);
    }
    assert.equal(ar.size, en.length);
  });

  it("the dialog is a modal alertdialog with labelled title and description", async () => {
    await open();
    await click(button(t("review.confirm")));
    const prompt = dialog();
    assert.equal(prompt.getAttribute("aria-modal"), "true");
    assert.ok(prompt.getAttribute("aria-labelledby") && prompt.getAttribute("aria-describedby"));
  });

  it("form fields have visible labels and errors are tied to their fields", async () => {
    await open();
    for (const name of ["amount", "account", "category", "date", "time", "description"]) {
      assert.ok(F(name), name);
    }
    await set("date", "");
    await save();
    const describedBy = F("date").getAttribute("aria-describedby");
    assert.ok(view.container.querySelector(`#${CSS.escape(describedBy)}`).textContent.length > 0);
  });
});
