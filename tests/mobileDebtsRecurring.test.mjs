import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { buildDebtSummary, buildPaymentsPage } from "../src/mobile/models/debts.js";
import { buildOccurrencesPage, buildRuleDetail, normalizeOccurrence } from "../src/mobile/models/recurring.js";
import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { debt, moreBackend, payment, summaryRow, summarySide } from "./helpers/moreFixture.mjs";
import { occurrence, paginator, planningBackend, rule } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Phase 6UI.5C5: debts and recurring rules on Mobile. The debt summary (GET /debts/summary), the whole payment history
 * of a debt, a rule's next occurrence and its occurrence history (GET /recurring-transactions/{id}/occurrences). Every
 * figure is the backend's, every request is a GET (installFakeApi refuses anything else), currencies stay apart.
 */

after(() => dom.window.close());

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, backend) => {
  api?.restore();
  api = installFakeApi(backend);
  view = await mountMobile({ entry });
};
const openDebts = (entry, data) => open(entry, typeof data === "function" ? data : moreBackend(data));
const openRules = (entry, data) => open(entry, typeof data === "function" ? data : planningBackend(data));
const callsTo = (path) => api.calls.filter((call) => call.path === path);

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

const SUMMARY = () => [
  summaryRow("ILS", {
    payable: summarySide({ original_amount: "2500.0000", paid_amount: "500.0000", remaining_amount: "2000.0000", debts_count: 2, overdue_count: 1 }),
    receivable: summarySide({ original_amount: "400.0000", paid_amount: "100.0000", remaining_amount: "300.0000", debts_count: 1 }),
    active_debts_count: 3,
    overdue_debts_count: 1,
    net_position: "-1700.0000",
  }),
  summaryRow("USD", {
    receivable: summarySide({ original_amount: "90.0000", paid_amount: "0.0000", remaining_amount: "90.0000", debts_count: 1 }),
    active_debts_count: 1,
    net_position: "90.0000",
  }),
];

describe("models", () => {
  it("the summary keeps each currency's figures and the backend's net position, and adds nothing", () => {
    const rows = buildDebtSummary({ summary: { by_currency: SUMMARY() } });

    assert.deepEqual(rows.map((row) => row.currency), ["ILS", "USD"]);
    assert.equal(rows[0].payable.remaining, "2000.0000");
    assert.equal(rows[0].receivable.remaining, "300.0000");
    assert.equal(rows[0].net, "-1700.0000");
    assert.equal(rows[0].netSign, "negative");
    assert.equal(rows[1].netSign, "positive");
    assert.equal(rows[0].overdueCount, 1);
    assert.equal(buildDebtSummary({ summary: { by_currency: [summaryRow("EUR")] } })[0].netSign, "zero");
    assert.deepEqual(buildDebtSummary({ summary: { by_currency: [] } }), []);
  });

  it("the summary is refused whole when a currency repeats, a side is missing or an amount is not a decimal", () => {
    const bad = (rows) => assert.throws(() => buildDebtSummary({ summary: { by_currency: rows } }), { code: "MALFORMED_RESPONSE" });

    bad([summaryRow("ILS"), summaryRow("ILS")]);
    bad([{ ...summaryRow("ILS"), receivable: undefined }]);
    bad([summaryRow("ILS", { payable: summarySide({ remaining_amount: "12,5" }) })]);
    bad([summaryRow("ILS", { net_position: null })]);
    bad([summaryRow("shekel")]);
    assert.throws(() => buildDebtSummary(null), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildDebtSummary({ summary: {} }), { code: "MALFORMED_RESPONSE" });
  });

  it("a payment carries its reversal movement, when it was reversed and its note", () => {
    const response = { status: true, data: { payments: paginator([payment(1, 5, { status: "reversed", is_reversed: true, reversal_transaction_id: 77, reversed_at: "2026-09-16T21:30:00Z", notes: "Wrong account" })], { perPage: 10 }) } };
    const [row] = buildPaymentsPage(response, { page: 1, perPage: 10 }, "5", "ILS").rows;

    assert.equal(row.reversalTransactionId, "77");
    assert.equal(row.reversedAt, "2026-09-16T21:30:00Z");
    assert.equal(row.notes, "Wrong account");
    assert.equal(row.account.id, "1");
  });

  it("an occurrence of another rule, in another currency or with a bad amount is not shown", () => {
    const mine = { id: "1", currency: "ILS" };

    assert.equal(normalizeOccurrence(occurrence(1, 1), mine).amount, "120.0000");
    assert.equal(normalizeOccurrence(occurrence(1, 2), mine), null);
    assert.equal(normalizeOccurrence(occurrence(1, 1, { currency_code: "USD" }), mine), null);
    assert.equal(normalizeOccurrence(occurrence(1, 1, { amount: "12.50.1" }), mine).amount, null);
    assert.equal(normalizeOccurrence({ ...occurrence(1, 1), id: null }, mine), null);
    assert.equal(normalizeOccurrence(occurrence(1, 1, { is_overdue: 1 }), mine).overdue, true);
    assert.equal(normalizeOccurrence(occurrence(1, 1, { is_overdue: null }), mine).overdue, false);
  });

  it("a history page is refused whole when a row is not the status that was asked for", () => {
    const rule1 = { id: "1", currency: "ILS" };
    const response = (rows) => ({ status: true, data: { occurrences: paginator(rows, { perPage: 10 }) } });

    assert.equal(buildOccurrencesPage(response([occurrence(1, 1, { status: "failed" })]), rule1, { status: "failed", page: 1 }).rows.length, 1);
    assert.throws(() => buildOccurrencesPage(response([occurrence(1, 1, { status: "posted" })]), rule1, { status: "failed", page: 1 }), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildOccurrencesPage(response([occurrence(1, 1), occurrence(1, 1)]), rule1, { status: "", page: 1 }), { code: "MALFORMED_RESPONSE" });
  });

  it("a rule carries the backend's next occurrence, and none when the schedule is missing or says none", () => {
    const withNext = buildRuleDetail({ recurring_transaction: rule(1, { schedule: { next_occurrence: occurrence(5, 1, { status: "due", is_overdue: true }), open_occurrences_count: 2 } }) }, "1");
    assert.equal(withNext.nextOccurrence.status, "due");
    assert.equal(withNext.nextOccurrence.overdue, true);
    assert.equal(withNext.scheduleKnown, true);

    const none = buildRuleDetail({ recurring_transaction: rule(1) }, "1");
    assert.equal(none.nextOccurrence, null);
    assert.equal(none.scheduleKnown, true);

    const unknown = buildRuleDetail({ recurring_transaction: rule(1, { schedule: undefined }) }, "1");
    assert.equal(unknown.scheduleKnown, false);

    // A next occurrence that belongs to another rule is dropped, never shown on this one.
    const foreign = buildRuleDetail({ recurring_transaction: rule(1, { schedule: { next_occurrence: occurrence(5, 9), open_occurrences_count: 1 } }) }, "1");
    assert.equal(foreign.nextOccurrence, null);
  });
});

describe("Debt summary on the Debts list", () => {
  it("shows each currency's own figures and the backend's net position, with no total across currencies", async () => {
    await openDebts("/m/planning/debts", { debts: [debt(1)], summary: SUMMARY() });

    const section = q("[data-sm-section='debt-summary']");
    const ils = q("[data-sm-currency='ILS']", section);
    const usd = q("[data-sm-currency='USD']", section);

    assert.match(text(q("[data-sm-side='payable']", ils)), /I owe.*2,000\.00ILS.*Paid so far.*500\.00ILS/);
    assert.match(text(q("[data-sm-side='receivable']", ils)), /Owed to me.*300\.00ILS/);
    assert.match(text(q("[data-sm-net]", ils)), /Net position.*−1,700\.00ILS.*You owe more than others owe you/);
    assert.equal(q("[data-sm-net]", ils).dataset.smNet, "negative");
    assert.match(text(q("[data-sm-net]", usd)), /90\.00USD.*Others owe you more than you owe/);
    assert.match(text(ils), /Open debts: 3/);
    assert.doesNotMatch(text(section), /1,790|2,090|2,300|2,390/, "nothing is added across currencies");
    assert.deepEqual(callsTo("/debts/summary").map((call) => Object.keys(call.query)), [[]], "no workspace is stored in this session, so none is sent");
  });

  it("links the overdue count to the overdue debts, and to the debts report", async () => {
    await openDebts("/m/planning/debts", { debts: [debt(1)], summary: SUMMARY() });

    assert.equal(q("[data-sm-overdue-link='ILS']").getAttribute("href"), "/m/planning/debts?status=overdue");
    assert.equal(q("[data-sm-overdue-link='USD']"), null, "no overdue debts in USD, no link");
    assert.equal(q("[data-sm-section='debt-summary'] a[href='/m/reports/debts']").textContent.trim(), "Debts report");
  });

  it("the summary does not follow the list's filters, and the list still filters", async () => {
    await openDebts("/m/planning/debts?direction=receivable", { debts: [debt(1), debt(2, { direction: "receivable" })], summary: SUMMARY() });

    assert.equal(callsTo("/debts/summary").length, 1);
    assert.deepEqual(callsTo("/debts/summary")[0].query, {});
    assert.deepEqual(qa("[data-sm-debt]").map((row) => row.dataset.smDebt), ["2"]);
    assert.equal(qa("[data-sm-currency]").length, 2);
  });

  it("says plainly when there are no open debts", async () => {
    await openDebts("/m/planning/debts", { debts: [], summary: [] });
    assert.match(text(q("[data-sm-section='debt-summary']")), /You have no open debts/);
    assert.equal(qa("[data-sm-currency]").length, 0);
  });

  it("a summary that cannot be trusted is an error in its own card; the list stays and the summary can be retried", async () => {
    let bad = true;
    const backend = moreBackend({ debts: [debt(1)], summary: SUMMARY() });
    await openDebts("/m/planning/debts", (call) => (call.path === "/debts/summary" && bad ? { body: { status: true, data: { summary: { by_currency: [summaryRow("ILS"), summaryRow("ILS")] } } } } : backend(call)));

    assert.equal(qa("[data-sm-currency]").length, 0);
    assert.ok(q("[data-sm-section='debt-summary'] .sm-error"));
    assert.equal(qa("[data-sm-debt]").length, 1);

    bad = false;
    await click(qa("button", q("[data-sm-section='debt-summary']")).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(qa("[data-sm-currency]").length, 2);
  });

  it("a failed summary read leaves the list standing", async () => {
    const backend = moreBackend({ debts: [debt(1)], summary: SUMMARY() });
    await openDebts("/m/planning/debts", (call) => (call.path === "/debts/summary" ? failure(500, "Server error") : backend(call)));

    assert.equal(qa("[data-sm-debt]").length, 1);
    assert.ok(q("[data-sm-section='debt-summary'] .sm-error"));
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    await openDebts("/m/planning/debts", { debts: [debt(1)], summary: SUMMARY() });

    const ils = q("[data-sm-currency='ILS']");
    assert.match(text(q("[data-sm-section='debt-summary']")), /أين تقف/);
    assert.match(text(q("[data-sm-side='payable']", ils)), /عليّ/);
    assert.match(text(q("[data-sm-net]", ils)), /ما تدين به أكبر مما يدين به الآخرون لك/);
    assert.match(text(ils), /2,000\.00/);
  });
});

describe("A debt's payments", () => {
  const history = () => Array.from({ length: 12 }, (_, index) => payment(index + 1, 1, { amount: `${(index + 1) * 10}.0000`, paid_at: `2026-09-${String(28 - index).padStart(2, "0")}` }));

  it("pages through the whole history with the backend's paginator, and says how many there are", async () => {
    await openDebts("/m/planning/debts/1?pp=2", { debts: [debt(1)], payments: { 1: history() } });

    const section = q("[data-sm-section='debt-payments']");
    assert.deepEqual(callsTo("/debts/1/payments").map((call) => call.query), [{ per_page: "10", page: "2" }]);
    assert.equal(qa("[data-sm-payment]", section).length, 2);
    assert.match(text(section), /12 in all/);
    assert.match(text(section), /Page 2 of 2/);
    assert.equal(q("[data-sm-page-link='payments:1']").getAttribute("href"), "/m/planning/debts/1");
    assert.equal(q("[data-sm-page-link='payments:3']"), null);
  });

  it("the first page asks for page 1 and offers Older, which keeps the rest of the address", async () => {
    await openDebts("/m/planning/debts/1", { debts: [debt(1)], payments: { 1: history() } });

    assert.deepEqual(callsTo("/debts/1/payments").map((call) => call.query), [{ per_page: "10", page: "1" }]);
    assert.equal(qa("[data-sm-payment]").length, 10);
    assert.equal(q("[data-sm-page-link='payments:2']").getAttribute("href"), "/m/planning/debts/1?pp=2");

    await click(q("[data-sm-page-link='payments:2']"));
    await settle();
    assert.equal(location(), "/m/planning/debts/1?pp=2");
    assert.equal(qa("[data-sm-payment]").length, 2);
  });

  it("a reversed payment stays, struck through, with when it was reversed, its note and a link to the reversal", async () => {
    const reversed = payment(2, 1, { status: "reversed", is_reversed: true, reversal_transaction_id: 77, reversed_at: "2026-09-16T21:30:00Z", notes: "Paid from the wrong account", account: { id: 3, name: "Bank Leumi", type: "bank", currency_code: "ILS" } });
    await openDebts("/m/planning/debts/1", { debts: [debt(1)], payments: { 1: [payment(1, 1), reversed] } });

    const row = q("[data-sm-payment='2']");
    assert.equal(row.dataset.smReversed, "true");
    assert.ok(row.querySelector(".sm-struck"));
    assert.match(text(row), /Reversed/);
    assert.match(text(row), /Reversed on Sep 1[67], 2026/);
    assert.match(text(row), /Paid from the wrong account/);
    assert.equal(row.querySelector("[data-sm-link='payment-reversal']").getAttribute("href"), "/m/activity/77");
    assert.equal(row.querySelector("[data-sm-link='payment-movement']").getAttribute("href"), "/m/activity/32");
    assert.equal(row.querySelector("a[href='/m/accounts/3']").textContent.trim(), "Bank Leumi");
    assert.equal(q("[data-sm-payment='1']").dataset.smReversed, undefined);
    assert.equal(q("[data-sm-payment='1'] [data-sm-link='payment-reversal']"), null);
    assert.equal(row.querySelector("[data-sm-action='debt-payment-reverse']"), null, "a reversed payment cannot be reversed again");
  });

  it("an address past the last page leads back instead of saying there are no payments", async () => {
    await openDebts("/m/planning/debts/1?pp=9", { debts: [debt(1)], payments: { 1: history() } });

    assert.equal(qa("[data-sm-payment]").length, 0);
    assert.equal(q("[data-sm-payments='past-end']").getAttribute("href"), "/m/planning/debts/1");
  });

  it("a page number that is not a number is page 1", async () => {
    await openDebts("/m/planning/debts/1?pp=abc", { debts: [debt(1)], payments: { 1: history() } });
    assert.deepEqual(callsTo("/debts/1/payments").map((call) => call.query.page), ["1"]);
  });

  it("says plainly when there are no payments", async () => {
    await openDebts("/m/planning/debts/1", { debts: [debt(1, { payments_count: 0 })], payments: { 1: [] } });
    assert.match(text(q("[data-sm-section='debt-payments']")), /No payments yet/);
  });

  it("the due date in words, from the backend's own day count", async () => {
    // The due date and its countdown sit in the summary, under the outstanding figure.
    const facts = () => text(q("[data-sm-screen='debt'] .sm-hero .sm-debt-when"));

    await openDebts("/m/planning/debts/1", { debts: [debt(1, { days_until_due: 34 })], payments: {} });
    assert.match(facts(), /Days until due\s*34/);
    await view.unmount();

    await openDebts("/m/planning/debts/1", { debts: [debt(1, { days_until_due: -5, is_overdue: true, effective_status: "overdue" })], payments: {} });
    assert.match(facts(), /Days overdue\s*5/);
    assert.equal(q("[data-sm-note='debt-overdue']").textContent.trim(), "This debt is past its due date.");
    await view.unmount();

    await openDebts("/m/planning/debts/1", { debts: [debt(1, { days_until_due: 0 })], payments: {} });
    assert.match(facts(), /Days until due\s*Due today/);
    await view.unmount();

    await openDebts("/m/planning/debts/1", { debts: [debt(1, { days_until_due: -9, status: "paid", effective_status: "paid", remaining_amount: "0.0000", paid_amount: "1500.0000" })], payments: {} });
    assert.doesNotMatch(facts(), /Days overdue|Days until due/, "a settled debt has no countdown");
    assert.equal(q("[data-sm-note='debt-paid']").textContent.trim(), "This debt is fully paid.");
  });

  it("shows who recorded the debt when the backend says so", async () => {
    await openDebts("/m/planning/debts/1", { debts: [debt(1, { owner: { id: 4, name: "Sam Example" } })], payments: {} });
    assert.match(text(q("#sm-debt-facts").closest("section")), /Recorded by\s*Sam Example/);
  });

  it("still offers no way to record or reverse a payment from here as a button", async () => {
    await openDebts("/m/planning/debts/1", { debts: [debt(1)], payments: { 1: [payment(1, 1)] } });
    assert.equal(qa("button, input, form", q("main")).length, 0);
    assert.deepEqual(api.calls.map((call) => call.path).sort(), ["/debts/1", "/debts/1/payments"]);
  });
});

describe("Recurring rules on the list", () => {
  const rules = () => [
    rule(1, { name: "Rent", schedule: { next_occurrence: occurrence(11, 1, { status: "due", is_overdue: true, due_date: "2026-10-28" }), open_occurrences_count: 2 } }),
    rule(2, { name: "Gym", schedule: { next_occurrence: occurrence(21, 2), open_occurrences_count: 1 } }),
    rule(3, { name: "Phone", schedule: { next_occurrence: occurrence(31, 3, { status: "failed", failure_reason: "Insufficient balance", attempts: 2 }), open_occurrences_count: 1 } }),
  ];

  it("marks a rule whose next occurrence is overdue, due or failed, by the backend's own flags, and says nothing for a scheduled one", async () => {
    await openRules("/m/planning/recurring", { rules: rules() });

    const overdue = q("[data-sm-rule='1']");
    assert.equal(overdue.dataset.smOverdue, "true");
    assert.match(text(overdue), /Overdue/);
    assert.equal(qa(".sm-chip", overdue).length, 1, "an overdue occurrence is not also labelled Due");

    const calm = q("[data-sm-rule='2']");
    assert.equal(calm.dataset.smOverdue, undefined);
    assert.equal(calm.querySelector(".sm-chip"), null);

    assert.match(text(q("[data-sm-rule='3']")), /Failed/);
    assert.deepEqual([...new Set(api.calls.map((call) => call.path))], ["/recurring-transactions"], "the list reads only the list: one request per page");
  });

  it("does not say a rule is overdue from its dates alone", async () => {
    await openRules("/m/planning/recurring", { rules: [rule(1, { next_due_date: "2020-01-01", schedule: { next_occurrence: null, open_occurrences_count: 0 } })] });
    assert.equal(q("[data-sm-rule='1']").dataset.smOverdue, undefined);
    assert.doesNotMatch(text(q("[data-sm-rule='1']")), /Overdue/);
  });
});

describe("A rule's next occurrence", () => {
  it("shows the backend's next occurrence: its date, status, overdue flag and amount", async () => {
    const next = occurrence(11, 1, { status: "due", is_overdue: true, due_date: "2026-10-28", amount: "135.5000" });
    await openRules("/m/planning/recurring/1", { rules: [rule(1, { schedule: { next_occurrence: next, open_occurrences_count: 2 } })], occurrences: { 1: [next] } });

    const card = q("[data-sm-section='rule-next']");
    assert.match(text(card), /Due date\s*Oct 28, 2026\s*Overdue/);
    assert.match(text(card), /Status\s*Due/);
    assert.match(text(card), /Amount\s*135\.50ILS/);
    assert.equal(q("[data-sm-screen='rule'] .sm-hero [data-sm-overdue-chip]").textContent.trim(), "Overdue");
  });

  it("shows a failed attempt's reason and count", async () => {
    const next = occurrence(11, 1, { status: "failed", failure_reason: "Insufficient balance", attempts: 3, is_overdue: false });
    await openRules("/m/planning/recurring/1", { rules: [rule(1, { schedule: { next_occurrence: next, open_occurrences_count: 1 } })], occurrences: { 1: [] } });

    const card = text(q("[data-sm-section='rule-next']"));
    assert.match(card, /Status\s*Failed/);
    assert.match(card, /Attempts\s*3/);
    assert.match(card, /Why it failed\s*Insufficient balance/);
  });

  it("says when no occurrence is waiting, and when the schedule is not available", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: [] } });
    assert.equal(q("[data-sm-next='none']").textContent.trim(), "No occurrence is waiting.");
    await view.unmount();

    await openRules("/m/planning/recurring/1", { rules: [rule(1, { schedule: undefined })], occurrences: { 1: [] } });
    assert.equal(q("[data-sm-next='unknown']").textContent.trim(), "The schedule isn't available right now.");
  });

  it("links the account and the category, and explains a paused rule", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1, { status: "paused" })], occurrences: { 1: [] } });

    const facts = q("#sm-rule-facts").closest("section");
    assert.equal(facts.querySelector("a[href='/m/accounts/1']").textContent.trim(), "Everyday wallet");
    assert.equal(facts.querySelector("a[href='/m/planning/categories/4']").textContent.trim(), "Rent");
    assert.match(q("[data-sm-note-status='paused']").textContent, /nothing is posted while it is paused/);
  });
});

describe("A rule's occurrences", () => {
  const history = () => [
    occurrence(5, 1, { due_date: "2026-11-01", status: "scheduled" }),
    occurrence(4, 1, { due_date: "2026-10-01", status: "posted", is_open: false, transaction_id: 301, processed_at: "2026-10-01T06:00:05Z", attempts: 1 }),
    occurrence(3, 1, { due_date: "2026-09-01", status: "failed", is_open: false, failure_reason: "Insufficient balance", attempts: 3 }),
    occurrence(2, 1, { due_date: "2026-08-01", status: "skipped", is_open: false, failure_reason: "On holiday" }),
    occurrence(1, 1, { due_date: "2026-07-01", status: "cancelled", is_open: false }),
  ];
  const section = () => q("[data-sm-section='rule-occurrences']");

  it("lists them as the backend ordered them, each with its status, amount and, when it posted, its transaction", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: history() } });

    assert.deepEqual(qa("[data-sm-occurrence]", section()).map((row) => row.dataset.smOccurrence), ["5", "4", "3", "2", "1"]);
    assert.deepEqual(callsTo("/recurring-transactions/1/occurrences").map((call) => call.query), [{ per_page: "10" }]);

    const posted = q("[data-sm-occurrence='4']");
    assert.equal(posted.dataset.smStatus, "posted");
    assert.match(text(posted), /Oct 1, 2026.*Posted.*Processed Oct 1, 2026.*120\.00ILS/);
    assert.equal(posted.querySelector("[data-sm-link='occurrence-movement']").getAttribute("href"), "/m/activity/301");
    assert.equal(q("[data-sm-occurrence='5'] a"), null, "an occurrence that has not posted has no transaction to open");
    assert.match(text(q("[data-sm-occurrence='3']")), /Failed.*Attempts: 3.*Why it failed: Insufficient balance/);
    assert.match(text(q("[data-sm-occurrence='2']")), /Skipped.*Reason: On holiday/);
    assert.match(text(section()), /Only posted ones moved money/);
  });

  it("marks an occurrence overdue only when the backend says so", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: [occurrence(7, 1, { due_date: "2020-01-01", status: "due", is_overdue: false }), occurrence(8, 1, { due_date: "2026-10-28", status: "due", is_overdue: true })] } });

    assert.equal(q("[data-sm-occurrence='7']").dataset.smOverdue, undefined);
    assert.equal(q("[data-sm-occurrence='8']").dataset.smOverdue, "true");
    assert.match(text(q("[data-sm-occurrence='8']")), /Overdue/);
  });

  it("the status is in the address and each tab asks the backend for that status", async () => {
    await openRules("/m/planning/recurring/1?occ=failed", { rules: [rule(1)], occurrences: { 1: history() } });

    assert.deepEqual(callsTo("/recurring-transactions/1/occurrences").map((call) => call.query), [{ per_page: "10", occurrence_status: "failed" }]);
    assert.deepEqual(qa("[data-sm-occurrence]").map((row) => row.dataset.smOccurrence), ["3"]);
    assert.equal(q("[data-sm-occurrences-tab='failed']").getAttribute("aria-current"), "true");
    assert.equal(qa("[data-sm-occurrences-tab]").length, 7);

    await click(q("[data-sm-occurrences-tab='posted']"));
    await settle();
    assert.equal(location(), "/m/planning/recurring/1?occ=posted");
    assert.deepEqual(qa("[data-sm-occurrence]").map((row) => row.dataset.smOccurrence), ["4"]);

    await click(q("[data-sm-occurrences-tab='all']"));
    await settle();
    assert.equal(location(), "/m/planning/recurring/1");
    assert.equal(qa("[data-sm-occurrence]").length, 5);
  });

  it("pages with the backend's paginator, and changing the status starts again from page 1", async () => {
    const many = Array.from({ length: 12 }, (_, index) => occurrence(100 - index, 1, { due_date: `2026-${String(12 - index).padStart(2, "0")}-01` }));
    await openRules("/m/planning/recurring/1?op=2", { rules: [rule(1)], occurrences: { 1: many } });

    assert.deepEqual(callsTo("/recurring-transactions/1/occurrences").map((call) => call.query), [{ per_page: "10", page: "2" }]);
    assert.equal(qa("[data-sm-occurrence]").length, 2);
    assert.match(text(section()), /Page 2 of 2/);
    assert.equal(q("[data-sm-page-link='occurrences:1']").getAttribute("href"), "/m/planning/recurring/1");
    assert.equal(q("[data-sm-occurrences-tab='scheduled']").getAttribute("href"), "/m/planning/recurring/1?occ=scheduled", "a tab drops the page");
  });

  it("an unknown status or page in the address is ignored", async () => {
    await openRules("/m/planning/recurring/1?occ=bogus&op=-3", { rules: [rule(1)], occurrences: { 1: history() } });
    assert.deepEqual(callsTo("/recurring-transactions/1/occurrences").map((call) => call.query), [{ per_page: "10" }]);
    assert.equal(q("[data-sm-occurrences-tab='all']").getAttribute("aria-current"), "true");
  });

  it("an address past the last page leads back", async () => {
    await openRules("/m/planning/recurring/1?op=9", { rules: [rule(1)], occurrences: { 1: history() } });
    assert.equal(q("[data-sm-occurrences='past-end']").getAttribute("href"), "/m/planning/recurring/1");
  });

  it("says plainly when there are none, and when none has the status", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: [] } });
    assert.match(text(section()), /This rule has no occurrences yet/);
    await view.unmount();

    await openRules("/m/planning/recurring/1?occ=failed", { rules: [rule(1)], occurrences: { 1: history().filter((row) => row.status !== "failed") } });
    assert.match(text(section()), /No occurrences with this status/);
  });

  it("refuses a page with another rule's occurrence or another currency, whole, and leaves the rest of the page", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: [occurrence(1, 1), occurrence(2, 9)] } });
    assert.equal(qa("[data-sm-occurrence]").length, 0);
    assert.ok(section().querySelector(".sm-error"));
    assert.match(text(q("[data-sm-screen='rule']")), /Amount per occurrence\s*120\.00ILS/);
    await view.unmount();

    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: [occurrence(1, 1, { currency_code: "USD" })] } });
    assert.equal(qa("[data-sm-occurrence]").length, 0);
  });

  it("a failed read can be retried", async () => {
    let fail = true;
    const backend = planningBackend({ rules: [rule(1)], occurrences: { 1: history() } });
    await openRules("/m/planning/recurring/1", (call) => (call.path === "/recurring-transactions/1/occurrences" && fail ? failure(500, "Server error") : backend(call)));

    assert.equal(qa("[data-sm-occurrence]").length, 0);
    fail = false;
    await click(qa("button", section()).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(qa("[data-sm-occurrence]").length, 5);
  });

  it("without a currency on the rule, nothing is asked for", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1, { currency_code: null })], occurrences: { 1: history() } });
    assert.equal(callsTo("/recurring-transactions/1/occurrences").length, 0);
    assert.match(text(section()), /Occurrences can't be shown for this rule/);
  });

  it("speaks Arabic and keeps the amounts and dates readable", async () => {
    await i18n.changeLanguage("ar");
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: history() } });

    assert.match(text(section()), /الاستحقاقات/);
    assert.match(text(q("[data-sm-occurrence='3']")), /فاشلة.*سبب الفشل: Insufficient balance/);
    assert.match(text(q("[data-sm-occurrence='4']")), /120\.00/);
    assert.equal(q("[data-sm-occurrences-tab='all']").textContent.trim(), "الكل");
  });

  it("is read-only: only GETs, and nothing is confirmed, skipped or retried", async () => {
    await openRules("/m/planning/recurring/1", { rules: [rule(1)], occurrences: { 1: history() } });

    assert.equal(qa("button, input, form", q("main")).length, 0);
    assert.equal(api.calls.every((call) => call.method === "GET"), true);
    assert.equal(api.calls.some((call) => /confirm|skip|pause|resume/.test(call.path)), false);
  });
});
