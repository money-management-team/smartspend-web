import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { buildDraftSummary, buildWhatsApp, normalizeDraft } from "../src/mobile/models/assist.js";
import { click } from "./helpers/dom.mjs";
import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { draftIssue, integrationAnswer, whatsappBackend, whatsappDraft } from "./helpers/whatsappFixture.mjs";

/*
 * Phase 6UI.5C7: WhatsApp on Mobile, read-only. The connection (state, link status, number, language, default account,
 * SmartSpend's number), how many drafts wait for review, the drafts one status at a time, and one draft in detail. Every
 * value is the backend's; where the contract offers nothing (message history, usage limits) the screen says so. Fictional
 * data only; every request is checked to be a GET.
 */

after(() => dom.window.close());

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, data) => {
  api?.restore();
  api = installFakeApi(typeof data === "function" ? data : whatsappBackend(data));
  view = await mountMobile({ entry });
};
const callsTo = (path) => api.calls.filter((call) => call.path === path);
const DRAFTS = "/integrations/whatsapp/expense-drafts";

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], [], "only reads");
  api?.restore();
  api = null;
});

describe("models", () => {
  it("the connection keeps the backend's state, the link's own status, the language, the default account and SmartSpend's number", () => {
    const linked = buildWhatsApp(integrationAnswer());

    assert.equal(linked.state, "linked");
    assert.equal(linked.linkStatus, "active");
    assert.equal(linked.linkStatusKnown, true);
    assert.equal(linked.language, "ar");
    assert.equal(linked.defaultAccountId, "3");
    assert.equal(linked.defaultAccountName, "Everyday wallet");
    assert.equal(linked.publicNumber, "970591234567");
    assert.equal(linked.phoneLastDigits, "4321");

    assert.equal(buildWhatsApp(integrationAnswer({ public_number: "call me" })).publicNumber, null, "only digits are a number");
    assert.equal(buildWhatsApp(integrationAnswer({ public_number: null })).publicNumber, null);
    const odd = buildWhatsApp(integrationAnswer({ integration: { ...integrationAnswer().integration, status: "suspended" } }));
    assert.equal(odd.linkStatus, "suspended");
    assert.equal(odd.linkStatusKnown, false, "a status the contract does not list is kept as sent, not mapped");
  });

  it("a connection answer that does not hold together is refused", () => {
    assert.throws(() => buildWhatsApp(integrationAnswer({ state: "maybe" })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildWhatsApp(integrationAnswer({ enabled: "yes" })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildWhatsApp(integrationAnswer({ capabilities: null })), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildWhatsApp(null), { code: "MALFORMED_RESPONSE" });
  });

  it("the pending count is the backend's integer and nothing else", () => {
    assert.deepEqual(buildDraftSummary({ pending_review_count: 3 }), { pending: 3 });
    assert.deepEqual(buildDraftSummary({ pending_review_count: 0 }), { pending: 0 });
    for (const bad of [{ pending_review_count: "3" }, { pending_review_count: -1 }, { pending_review_count: 1.5 }, {}, null]) assert.throws(() => buildDraftSummary(bad), { code: "MALFORMED_RESPONSE" });
  });

  it("a draft takes its moments from `timestamps`, its detail from the contract, and invents no message", () => {
    const draft = normalizeDraft(whatsappDraft(8, { status: "confirmed", confirmed_transaction_id: 55, timestamps: { created_at: "2026-10-28T07:15:30Z", ready_for_review_at: "2026-10-28T07:16:00Z", confirmed_at: "2026-10-28T08:00:00Z", expires_at: "2099-11-04T07:16:00Z" }, source_text: "Taxi 18" }));

    assert.equal(draft.createdAt, "2026-10-28T07:15:30Z");
    assert.equal(draft.readyAt, "2026-10-28T07:16:00Z");
    assert.equal(draft.confirmedAt, "2026-10-28T08:00:00Z");
    assert.equal(draft.discardedAt, null);
    assert.equal(draft.confirmedTransactionId, "55");
    assert.equal(draft.categoryName, "Transport");
    assert.equal(draft.accountId, "3");
    assert.equal(draft.accountBalance, "1284.5000");
    assert.equal(draft.timezone, "Asia/Hebron");
    assert.equal(draft.canConfirm, true);
    assert.equal("message" in draft, false, "the backend sends no message text, so none is read");
    assert.equal(normalizeDraft({ ...whatsappDraft(8), created_at: "2026-01-01T00:00:00Z", timestamps: undefined }).createdAt, null, "a top-level created_at is not in the contract");
  });

  it("issues keep the backend's code and message; a balance needs the account's currency; an unknown status refuses the draft", () => {
    const draft = normalizeDraft(whatsappDraft(8, { confirmation: { ready: false, issues: [draftIssue("account_required", "Account is required."), draftIssue("something_new", "A new rule.", "amount")] } }));
    assert.deepEqual(draft.issues, ["account_required", "something_new"]);
    assert.deepEqual(draft.issueDetails.map((row) => row.message), ["Account is required.", "A new rule."]);
    assert.equal(draft.ready, false);

    assert.equal(normalizeDraft(whatsappDraft(8, { account: { id: 3, name: "x", current_balance: "5.0000" } })).accountBalance, null, "no currency, no balance");
    assert.equal(normalizeDraft(whatsappDraft(8, { status: "teleporting" })), null);
  });
});

describe("The WhatsApp connection", () => {
  it("linked: the number's last digits, when it was linked, the link's status, the reply language, the default account and SmartSpend's number", async () => {
    await open("/m/whatsapp", { drafts: [], pending: 3 });

    const screen = q("[data-sm-screen='whatsapp']");
    const card = q("[data-sm-section='connection']");
    assert.equal(screen.dataset.smWhatsapp, "linked");
    assert.match(text(card), /Linked/);
    assert.match(text(card), /Number\s*•••• 4321/);
    assert.match(text(card), /Linked on\s*Sep 1, 2026/);
    assert.equal(q("[data-sm-link-chip]", card).dataset.smLinkChip, "active");
    assert.match(text(card), /Link\s*Active/);
    assert.match(text(card), /Replies in\s*Arabic/);
    assert.equal(card.querySelector("a[href='/m/accounts/3']").textContent.trim(), "Everyday wallet");
    assert.equal(q("[data-sm-public-number]").textContent, "+970591234567");
    assert.deepEqual(api.calls.map((call) => call.path), ["/integrations/whatsapp", `${DRAFTS}/summary`]);
  });

  it("offers SmartSpend's chat as a plain link to WhatsApp, only when linked, and sends nothing", async () => {
    await open("/m/whatsapp", { drafts: [], pending: 0 });
    const chat = q("[data-sm-action='open-chat']");

    assert.equal(chat.getAttribute("href"), "https://wa.me/970591234567");
    assert.equal(chat.getAttribute("target"), "_blank");
    assert.match(chat.getAttribute("rel"), /noopener/);
    assert.match(text(q("[data-sm-section='connection']")), /Nothing is sent from here/);
    await view.unmount();

    await open("/m/whatsapp", { integration: integrationAnswer({ state: "not_linked", integration: null, capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true } }), pending: 0 });
    assert.equal(q("[data-sm-action='open-chat']"), null);
    assert.equal(q("[data-sm-public-number]").textContent, "+970591234567", "the number can still be read");
  });

  it("shows how many drafts wait for review, the backend's own count, with a link to them", async () => {
    await open("/m/whatsapp", { drafts: [whatsappDraft(8)], pending: 7 });

    const card = q("[data-sm-section='pending-review']");
    assert.equal(q("[data-sm-pending]", card).dataset.smPending, "7", "the count is the backend's, not the one draft on a page");
    assert.match(text(card), /Waiting for review: 7/);
    assert.equal(q("a[data-sm-action='drafts']", card).getAttribute("href"), "/m/whatsapp/drafts");
  });

  it("says plainly when nothing waits, and when the count is not available, and leaves the rest standing", async () => {
    await open("/m/whatsapp", { pending: 0 });
    assert.match(text(q("[data-sm-section='pending-review']")), /Nothing is waiting for review/);
    await view.unmount();

    await open("/m/whatsapp", { pending: null });
    assert.match(text(q("[data-sm-section='pending-review']")), /isn't available right now/);
    assert.equal(q("[data-sm-screen='whatsapp']").dataset.smState, "ready");
    assert.match(text(q("[data-sm-section='connection']")), /4321/);
  });

  it("explains that there is no message history or usage meter to show, and links to what messages became", async () => {
    await open("/m/whatsapp", { pending: 1 });

    const card = q("[data-sm-section='limits']");
    assert.match(text(card), /doesn't offer your WhatsApp messages or a usage meter/);
    assert.match(text(card), /Mobile can't show either/);
    assert.equal(card.querySelector("a").getAttribute("href"), "/m/whatsapp/drafts");
    assert.equal(api.calls.some((call) => /message|usage|limit/i.test(call.path)), false, "no endpoint is guessed");
  });

  it("not linked: how linking works, no token is asked for; an earlier link that ended is said as it is", async () => {
    const earlier = integrationAnswer({ state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: { ...integrationAnswer().integration, linked: false, status: "revoked", revoked_at: "2026-10-12T08:00:00Z" } });
    await open("/m/whatsapp", { integration: earlier, pending: 0 });

    assert.ok(q("[data-sm-section='linking']"));
    assert.match(text(q("[data-sm-note='earlier-link']")), /An earlier link ended on Oct 12, 2026/);
    assert.doesNotMatch(text(q("[data-sm-section='connection']")), /4321/, "a number that is no longer linked is not shown as the current one");
    assert.equal(q("[data-sm-action='disconnect']"), null);
    assert.deepEqual(api.calls.filter((call) => /link-challenges/.test(call.path)), []);
  });

  it("a link that was started but not finished says so, and a status the contract does not list is shown as sent", async () => {
    const make = (status) => integrationAnswer({ state: "not_linked", capabilities: { can_link: true, can_manage_link: false, can_review_drafts: true }, integration: { ...integrationAnswer().integration, linked: false, status } });

    await open("/m/whatsapp", { integration: make("pending"), pending: 0 });
    assert.match(text(q("[data-sm-section='connection']")), /Link\s*Started, not finished/);
    await view.unmount();

    await open("/m/whatsapp", { integration: make("suspended"), pending: 0 });
    assert.match(text(q("[data-sm-link-chip]")), /suspended/);
  });

  it("disabled: says so, still lets existing drafts be reached, and shows no chat link or number", async () => {
    await open("/m/whatsapp", { integration: integrationAnswer({ enabled: false, state: "not_linked", public_number: null, capabilities: { can_link: false, can_manage_link: false, can_review_drafts: true } }), pending: 2 });

    assert.equal(q("[data-sm-screen='whatsapp']").dataset.smWhatsapp, "disabled");
    assert.match(text(q("[data-sm-note='disabled-drafts']")), /Drafts you already received can still be reviewed/);
    assert.equal(q("[data-sm-pending]").dataset.smPending, "2");
    assert.equal(q("[data-sm-action='open-chat']"), null);
    assert.equal(q("[data-sm-public-number]"), null);
    assert.equal(q("[data-sm-section='linking']"), null);
  });

  it("disconnecting stays closed: the confirmation is shown and its last step is disabled", async () => {
    await open("/m/whatsapp", { pending: 0 });
    await click(q("[data-sm-action='disconnect']"));

    assert.equal(q("[data-sm-action='confirm-disconnect']").disabled, true);
    assert.equal(q("[data-sm-note='write-closed'][data-sm-write='whatsapp.unlink']").dataset.smWrite, "whatsapp.unlink");
    await click(q("[data-sm-action='keep-linked']"));
    assert.equal(q("[role='dialog']"), null);
    assert.equal(api.calls.some((call) => call.method !== "GET"), false);
  });

  it("a failed read can be retried", async () => {
    let fail = true;
    const backend = whatsappBackend({ pending: 1 });
    await open("/m/whatsapp", (call) => (fail ? failure(500, "Server error") : backend(call)));

    assert.equal(q("[data-sm-screen='whatsapp']").dataset.smState, "error");
    fail = false;
    await click(qa("button", q("main")).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(q("[data-sm-screen='whatsapp']").dataset.smState, "ready");
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    await open("/m/whatsapp", { pending: 4 });

    assert.match(text(q("[data-sm-section='connection']")), /لغة الردود\s*العربية/);
    assert.match(text(q("[data-sm-section='pending-review']")), /بانتظار المراجعة: 4/);
    assert.match(text(q("[data-sm-section='limits']")), /لا يتيح SmartSpend رسائل واتساب/);
    assert.equal(q("[data-sm-public-number]").textContent, "+970591234567");
  });
});

describe("The drafts", () => {
  const all = () => [
    whatsappDraft(1),
    whatsappDraft(2, { review_values: { ...whatsappDraft(1).review_values, account_id: null, category_id: null, amount: null, description: "Lunch" }, confirmation: { ready: false, issues: [draftIssue("account_required", "Account is required."), draftIssue("amount_required", "Amount is required.", "amount")] }, account: null, category: null }),
    whatsappDraft(3, { status: "collecting", can_edit: false, can_confirm: false, confirmation: { ready: false, issues: [] } }),
    whatsappDraft(4, { status: "confirmed", confirmed_transaction_id: 55, can_edit: false, can_confirm: false, can_discard: false }),
    whatsappDraft(5, { status: "discarded", can_edit: false, can_confirm: false, can_discard: false }),
    whatsappDraft(6, { status: "expired", can_edit: false, can_confirm: false, can_discard: false }),
  ];

  it("opens on the drafts waiting for review, naming the status it asks for, with no 'All'", async () => {
    await open("/m/whatsapp/drafts", { drafts: all() });

    assert.deepEqual(callsTo(DRAFTS).map((call) => call.query.status), ["ready_for_review"]);
    assert.deepEqual(qa("[data-sm-draft]").map((row) => row.dataset.smDraft), ["1", "2"]);
    assert.equal(qa("button", q("[data-sm-screen='whatsapp-drafts']")).some((item) => item.textContent.trim() === "All"), false);
    for (const label of ["Being collected", "Ready to review", "Recorded", "Discarded", "Expired"]) assert.ok(qa("button").some((item) => item.textContent.trim() === label), label);
    assert.equal(q("[data-sm-total]").dataset.smTotal, "2");
    assert.match(text(q("[data-sm-hint='ready_for_review']")), /Nothing is recorded until it is confirmed/);
  });

  it("each row says its amount and currency, account, date, status, whether it is complete and until when it can be reviewed", async () => {
    await open("/m/whatsapp/drafts", { drafts: all() });

    assert.match(text(q("[data-sm-draft='1']")), /Taxi.*18\.00ILS.*Everyday wallet.*Oct 28, 2026.*Ready to review.*Details complete.*Review by .*2099/);
    assert.equal(q("[data-sm-draft='1']").dataset.smReady, "true");
    assert.match(text(q("[data-sm-draft='2']")), /Lunch.*No amount yet.*Needs attention: 2/);
    assert.equal(q("[data-sm-draft='2']").dataset.smReady, "false");
    assert.equal(q("[data-sm-draft='1']").getAttribute("href"), "/m/whatsapp/drafts/1");
  });

  it("each status is its own tab and its own request, kept in the address; the default is not written there", async () => {
    await open("/m/whatsapp/drafts", { drafts: all() });

    await click(qa("button").find((item) => item.textContent.trim() === "Recorded"));
    await settle();
    assert.equal(location(), "/m/whatsapp/drafts?status=confirmed");
    assert.deepEqual(qa("[data-sm-draft]").map((row) => row.dataset.smDraft), ["4"]);
    assert.equal(callsTo(DRAFTS).at(-1).query.status, "confirmed");
    assert.match(text(q("[data-sm-hint='confirmed']")), /Recorded as an expense/);
    assert.equal(q("[data-sm-draft='4']").dataset.smReady, undefined, "readiness is only said for a draft waiting for review");

    await click(qa("button").find((item) => item.textContent.trim() === "Ready to review"));
    await settle();
    assert.equal(location(), "/m/whatsapp/drafts");
    assert.deepEqual(qa("[data-sm-draft]").map((row) => row.dataset.smDraft), ["1", "2"]);
  });

  it("an unknown status in the address is ignored: the default is shown and asked for", async () => {
    await open("/m/whatsapp/drafts?status=everything", { drafts: all() });
    assert.deepEqual(callsTo(DRAFTS).map((call) => call.query.status), ["ready_for_review"]);
    assert.equal(q("[data-sm-screen='whatsapp-drafts']").dataset.smStatus, "ready_for_review");
  });

  it("says what each empty status means", async () => {
    await open("/m/whatsapp/drafts", { drafts: [] });
    assert.match(text(q("[data-sm-empty='whatsapp-drafts']")), /Nothing is waiting for review/);

    for (const [status, pattern] of [["collecting", /No drafts are being collected/], ["confirmed", /No draft has been recorded yet/], ["discarded", /No discarded drafts/], ["expired", /No expired drafts/]]) {
      await view.unmount();
      await open(`/m/whatsapp/drafts?status=${status}`, { drafts: [] });
      assert.match(text(q("[data-sm-empty='whatsapp-drafts']")), pattern, status);
    }
  });

  it("pages with the backend's paginator", async () => {
    const many = Array.from({ length: 22 }, (_, index) => whatsappDraft(index + 1));
    await open("/m/whatsapp/drafts", { drafts: many });

    assert.equal(qa("[data-sm-draft]").length, 20);
    assert.equal(q("[data-sm-total]").dataset.smTotal, "22");
    await click(qa("button").find((item) => item.textContent.trim() === "Older"));
    await settle();
    assert.deepEqual(callsTo(DRAFTS).at(-1).query, { status: "ready_for_review", page: "2", per_page: "20" });
    assert.equal(qa("[data-sm-draft]").length, 2);
  });

  it("a failed read can be retried", async () => {
    let fail = true;
    const backend = whatsappBackend({ drafts: all() });
    await open("/m/whatsapp/drafts", (call) => (fail ? failure(500, "Server error") : backend(call)));

    assert.equal(qa("[data-sm-draft]").length, 0);
    fail = false;
    await click(qa("button", q("main")).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(qa("[data-sm-draft]").length, 2);
  });
});

describe("One draft", () => {
  const open8 = (over = {}, extra = {}) => open("/m/whatsapp/drafts/8", { drafts: [whatsappDraft(8, over)], ...extra });

  it("shows what SmartSpend read: amount, account and its balance, category, date, time and time zone", async () => {
    await open8();

    const card = q("[data-sm-section='draft-summary']");
    assert.equal(q("[data-sm-screen='whatsapp-draft']").dataset.smVersion, "3");
    assert.match(text(card), /Amount\s*18\.00ILS/);
    assert.match(text(card), /Account\s*Everyday wallet/);
    assert.match(text(card), /Balance of that account\s*1,284\.50ILS/);
    assert.match(text(card), /Category\s*Transport/);
    assert.match(text(card), /Date\s*Oct 28, 2026/);
    assert.match(text(card), /Time\s*09:15/);
    assert.match(text(card), /Time zone\s*Asia\/Hebron/);
    assert.match(text(card), /Description\s*Taxi/);
    assert.equal(card.querySelector("a[href='/m/accounts/3']").textContent.trim(), "Everyday wallet");
    assert.match(text(q("[data-sm-hint='ready_for_review']")), /Ready for you to review/);
  });

  it("says plainly that the original message is not available, and invents none", async () => {
    await open8({ source_text: "Taxi 18 please", message_text: "Taxi 18 please" });

    assert.match(text(q("[data-sm-note='message']")), /original WhatsApp message isn't available to Mobile/);
    assert.doesNotMatch(text(q("main")), /Taxi 18 please/);
    assert.equal(q("blockquote"), null);
  });

  it("a draft that is complete says so; one with issues lists them in words, and a code it does not know keeps the backend's message", async () => {
    await open8();
    assert.equal(q("[data-sm-section='draft-readiness']").dataset.smReady, "true");
    assert.match(text(q("[data-sm-section='draft-readiness']")), /Details complete.*SmartSpend says the saved details are complete/);
    await view.unmount();

    await open8({ confirmation: { ready: false, issues: [draftIssue("account_required", "Account is required."), draftIssue("amount_invalid", "The amount must be positive.", "amount"), draftIssue("brand_new_rule", "A rule SmartSpend added later.", "category_id")] } });
    const section = q("[data-sm-section='draft-readiness']");
    assert.equal(section.dataset.smReady, "false");
    assert.match(text(section), /Needs attention/);
    assert.deepEqual(qa("[data-sm-issue]", section).map((row) => row.dataset.smIssue), ["account_required", "amount_invalid", "brand_new_rule"]);
    assert.match(text(q("[data-sm-issue='account_required']")), /Choose an account\./);
    assert.match(text(q("[data-sm-issue='amount_invalid']")), /positive number with up to 4 decimals/);
    assert.match(text(q("[data-sm-issue='brand_new_rule']")), /A rule SmartSpend added later\./);
    assert.match(text(section), /checked again when a draft is confirmed/);
  });

  it("a timeline of every moment the backend sends, in the draft's own time zone", async () => {
    await open8();

    const labels = qa("dt", q("[data-sm-section='draft-timeline']")).map((item) => item.textContent.trim());
    assert.deepEqual(labels, ["Created", "Ready for review", "Review by"]);
    assert.match(text(q("[data-sm-section='draft-timeline']")), /Created\s*Oct 28, 2026, 09:15 AM/);
    assert.match(text(q("[data-sm-section='draft-timeline']")), /Review by\s*Nov 4, 2099/);
    assert.match(text(q("[data-sm-section='draft-about']")), /Reference\s*#8.*Source\s*WhatsApp/);
  });

  it("a recorded draft links to the expense it became, has no readiness to judge and offers no review", async () => {
    await open8({ status: "confirmed", confirmed_transaction_id: 55, can_edit: false, can_confirm: false, can_discard: false, confirmation: { ready: false, issues: [] }, timestamps: { created_at: "2026-10-28T07:15:30Z", ready_for_review_at: "2026-10-28T07:16:00Z", confirmed_at: "2026-10-28T08:00:00Z", expires_at: "2099-11-04T07:16:00Z" } });

    assert.equal(q("[data-sm-link='confirmed-transaction']").getAttribute("href"), "/m/activity/55");
    assert.equal(q("[data-sm-section='draft-readiness']"), null);
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "draftClosed");
    assert.equal(q("form"), null);
    assert.deepEqual(qa("dt", q("[data-sm-section='draft-timeline']")).map((item) => item.textContent.trim()), ["Created", "Ready for review", "Recorded"], "the review deadline is only said while it is waiting");
  });

  it("expired and discarded drafts say so and show their moment", async () => {
    await open8({ status: "expired", can_edit: false, can_confirm: false, can_discard: false, timestamps: { created_at: "2026-10-28T07:15:30Z", expired_at: "2026-11-04T07:16:00Z", expires_at: "2026-11-04T07:16:00Z" } });
    assert.equal(q("[data-sm-note='ineligible']").dataset.smReason, "draftExpired");
    assert.match(text(q("[data-sm-section='draft-timeline']")), /Expired\s*Nov 4, 2026/);
    assert.equal(q("[data-sm-link='confirmed-transaction']"), null);
    await view.unmount();

    await open8({ status: "discarded", can_edit: false, can_confirm: false, can_discard: false, timestamps: { created_at: "2026-10-28T07:15:30Z", discarded_at: "2026-10-29T10:00:00Z" } });
    assert.match(text(q("[data-sm-hint='discarded']")), /Discarded\. Nothing was recorded/);
    assert.match(text(q("[data-sm-section='draft-timeline']")), /Discarded\s*Oct 29, 2026/);
  });

  it("an amount that is missing is 'Not set', never zero, and a balance needs the account's currency", async () => {
    await open8({ review_values: { ...whatsappDraft(8).review_values, amount: null }, account: { id: 3, name: "Everyday wallet", current_balance: "1284.5000" } });

    const card = text(q("[data-sm-section='draft-summary']"));
    assert.match(card, /Amount\s*Not set/);
    assert.doesNotMatch(card, /0\.00/);
    assert.doesNotMatch(card, /Balance of that account/);
  });

  it("an answer about another draft is refused, and an id that is not a number is not asked for", async () => {
    await open("/m/whatsapp/drafts/8", () => ({ body: { status: true, data: { draft: whatsappDraft(9) } } }));
    assert.equal(q("[data-sm-screen='whatsapp-draft']").dataset.smState, "error");
    await view.unmount();

    await open("/m/whatsapp/drafts/abc", { drafts: [] });
    assert.equal(q("[data-sm-screen='whatsapp-draft']").dataset.smState, "error");
    assert.deepEqual(api.calls, []);
  });

  it("a draft that is gone says so", async () => {
    await open("/m/whatsapp/drafts/99", { drafts: [] });
    assert.equal(q("[data-sm-screen='whatsapp-draft']").dataset.smState, "error");
    assert.match(text(q("main")), /removed or isn't yours/);
  });

  it("Back leads to the list it came from", async () => {
    await open("/m/whatsapp/drafts?status=expired", { drafts: [whatsappDraft(6, { status: "expired", can_edit: false })] });
    await click(q("[data-sm-draft='6']"));
    await settle();

    assert.equal(location(), "/m/whatsapp/drafts/6");
    assert.equal(q(".sm-back").getAttribute("href"), "/m/whatsapp/drafts?status=expired");
  });

  it("speaks Arabic, with the backend's own message for a code it has no words for", async () => {
    await i18n.changeLanguage("ar");
    await open8({ confirmation: { ready: false, issues: [draftIssue("account_required", "Account is required."), draftIssue("brand_new_rule", "A rule SmartSpend added later.")] } });

    assert.match(text(q("[data-sm-section='draft-summary']")), /ما قرأه SmartSpend/);
    assert.match(text(q("[data-sm-issue='account_required']")), /اختر حسابًا/);
    assert.match(text(q("[data-sm-issue='brand_new_rule']")), /A rule SmartSpend added later\./);
    assert.match(text(q("[data-sm-section='draft-timeline']")), /أُنشئت/);
  });

  it("sends nothing: only GETs, and no request to confirm, discard or save", async () => {
    await open8();
    assert.equal(api.calls.every((call) => call.method === "GET"), true);
    assert.equal(api.calls.some((call) => /confirm|discard/.test(call.path)), false);
  });
});
