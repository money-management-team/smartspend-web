import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { envelope, movementPage, tx } from "./helpers/mobileApi.mjs";
import {
  ACTIVITY_SORTS,
  buildActivityPage,
  buildTransactionDetail,
  dayKey,
  filterSignature,
  filtersToQuery,
  filtersToSearchParams,
  groupByDay,
  hasActiveFilters,
  isCalendarDate,
  mergePages,
  normalizeTransaction,
  readActivityFilters,
} from "../src/mobile/models/activity.js";
import { backPathFrom } from "../src/mobile/navigation.js";
import { formatDayHeading, formatMoment } from "../src/mobile/money/format.js";

/*
 * The Activity contract, from docs/transactions/*.md and the Desktop list and
 * details: filters, a row's meaning (the type decides income or expense, not the
 * sign of the amount), reversal and correction links, the day a transaction
 * belongs to, and what a page must satisfy before it is shown.
 */

describe("filters", () => {
  it("reads only documented values from the address and drops the rest", () => {
    const filters = readActivityFilters("?type=expense&status=posted&account_id=12&category_id=4&date_from=2026-10-01&date_to=2026-10-31&sort=occurred_at:asc&page=3&q=coffee&workspace_id=9");

    assert.deepEqual(filters, { type: "expense", status: "posted", account_id: "12", category_id: "4", date_from: "2026-10-01", date_to: "2026-10-31", sort: "occurred_at:asc" });
  });

  it("refuses anything the endpoint would not accept, instead of sending it", () => {
    const bad = readActivityFilters("?type=debt&status=done&account_id=abc&category_id=0&date_from=2026-02-30&date_to=tomorrow&sort=amount:desc");

    assert.deepEqual(bad, { type: "", status: "", account_id: "", category_id: "", date_from: "", date_to: "", sort: "occurred_at:desc" });
    assert.equal(readActivityFilters("?type=all").type, "", "'all' is the absence of a filter");
    assert.equal(readActivityFilters("?type=transfer").type, "transfer");
    for (const status of ["posted", "pending_review", "draft", "reversed", "failed"]) assert.equal(readActivityFilters(`?status=${status}`).status, status);
  });

  it("drops a date range that ends before it starts, as a whole", () => {
    const filters = readActivityFilters("?date_from=2026-10-31&date_to=2026-10-01");
    assert.equal(filters.date_from, "");
    assert.equal(filters.date_to, "");
    assert.equal(readActivityFilters("?date_from=2026-10-01&date_to=2026-10-01").date_to, "2026-10-01");
  });

  it("has no text search and no free-form parameter: nothing besides the documented names survives a round trip", () => {
    const params = filtersToSearchParams(readActivityFilters("?search=coffee&q=x&type=income&description=y"));
    assert.equal(params.toString(), "type=income");
  });

  it("builds the same signature for the same filters whatever order the address had", () => {
    assert.equal(filterSignature(readActivityFilters("?status=posted&type=income")), filterSignature(readActivityFilters("?type=income&status=posted")));
    assert.equal(filterSignature(readActivityFilters("")), "all");
    assert.notEqual(filterSignature(readActivityFilters("?type=income")), filterSignature(readActivityFilters("?type=expense")));
    assert.notEqual(filterSignature(readActivityFilters("")), filterSignature(readActivityFilters("?sort=occurred_at:asc")), "the order is part of which list this is");
  });

  it("builds the query the Desktop list sends: documented names, 20 per page, the page asked for", () => {
    const filters = readActivityFilters("?type=expense&account_id=12&date_from=2026-10-01&sort=occurred_at:asc");
    assert.deepEqual(filtersToQuery(filters, 2, 20), { type: "expense", status: undefined, account_id: "12", category_id: undefined, date_from: "2026-10-01", date_to: undefined, sort_by: "occurred_at", sort_dir: "asc", per_page: 20, page: 2 });
  });

  it("counts a filter as active for everything but the sort order", () => {
    assert.equal(hasActiveFilters(readActivityFilters("")), false);
    assert.equal(hasActiveFilters(readActivityFilters("?sort=occurred_at:asc")), false);
    assert.equal(hasActiveFilters(readActivityFilters("?status=draft")), true);
    assert.deepEqual(ACTIVITY_SORTS, ["occurred_at:desc", "occurred_at:asc"]);
  });

  it("recognises real calendar dates only", () => {
    for (const good of ["2026-10-31", "2028-02-29"]) assert.equal(isCalendarDate(good), true, good);
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-1", "20261001", "", null, 5]) assert.equal(isCalendarDate(bad), false, String(bad));
  });
});

describe("which day a transaction belongs to (never through the device's zone)", () => {
  const cases = [
    // [value, zone, expected, why]
    ["2026-10-31T23:30:00Z", "UTC", "2026-10-31", "UTC"],
    ["2026-10-31T23:30:00Z", "Asia/Hebron", "2026-11-01", "just before midnight UTC is already tomorrow in Palestine (UTC+2 once daylight time has ended)"],
    ["2026-10-31T23:30:00Z", "America/Los_Angeles", "2026-10-31", "and still today in Los Angeles"],
    ["2026-11-01T00:30:00Z", "America/Los_Angeles", "2026-10-31", "just after midnight UTC is still yesterday in Los Angeles"],
    ["2026-10-31T23:30:00+03:00", "UTC", "2026-10-31", "an offset is converted, not ignored (20:30 UTC)"],
    ["2026-10-31T22:30:00-05:00", "UTC", "2026-11-01", "(03:30 UTC next day)"],
    ["2026-12-31T23:59:59.999999Z", "Asia/Tokyo", "2027-01-01", "year boundary, microseconds"],
    ["2026-02-28T22:00:00Z", "Asia/Kolkata", "2026-03-01", "month boundary"],
    ["2028-02-29T12:00:00Z", "UTC", "2028-02-29", "leap day"],
    ["2026-10-31 23:30:00", "Pacific/Kiritimati", "2026-10-31", "no zone in the value: the day it says, never converted"],
    ["2026-10-31", "Pacific/Kiritimati", "2026-10-31", "a bare date is a day"],
    ["2026-10-31T23:30:00Z", undefined, "2026-10-31", "no user zone: the day as written"],
    ["2026-10-31T23:30:00Z", "Not/AZone", "2026-10-31", "an invalid zone name is ignored"],
    ["2026-10-31T23:30:00+0300", "UTC", "2026-10-31", "+0300 without a colon"],
  ];

  for (const [value, zone, expected, why] of cases) {
    it(`${value} in ${zone} -> ${expected} (${why})`, () => assert.equal(dayKey(value, zone), expected));
  }

  it("is null for something that is not a date, so it cannot be put under a made-up day", () => {
    for (const bad of [null, undefined, "", "junk", "2026-02-30", "2026-10-31T25:00:00Z", 5, {}]) assert.equal(dayKey(bad, "UTC"), null, String(bad));
  });

  it("shows a day heading with Latin digits that cannot shift, in both languages", () => {
    assert.equal(formatDayHeading("2026-10-31", "en"), "Saturday, October 31, 2026");
    assert.doesNotMatch(formatDayHeading("2026-10-31", "ar"), /[٠-٩]/);
    assert.match(formatDayHeading("2026-10-31", "ar"), /2026/);
    assert.equal(formatDayHeading("2026-1-1", "en"), null);
    assert.equal(formatDayHeading(null, "en"), null);
  });

  it("shows the time only when the value says which instant it is", () => {
    assert.match(formatMoment("2026-10-31T23:30:00Z", "en", "Asia/Hebron"), /Nov 1, 2026/);
    assert.match(formatMoment("2026-10-31T23:30:00Z", "en", "Asia/Hebron"), /1:30/);
    assert.equal(formatMoment("2026-10-31 23:30:00", "en", "Asia/Hebron"), "Oct 31, 2026", "no time and no conversion for a value with no zone");
    assert.equal(formatMoment("2026-10-31", "en"), "Oct 31, 2026");
    assert.equal(formatMoment("junk", "en"), null);
  });
});

describe("what a row means", () => {
  const row = (over) => normalizeTransaction(tx(1, over));

  it("takes income or expense from the type, and the digits from the amount, whatever the sign sent", () => {
    assert.deepEqual([row({ type: "income", amount: "300.0000" }).amount, row({ type: "income", amount: "-300.0000" }).amount], ["300.0000", "300.0000"]);
    assert.deepEqual([row({ type: "expense", amount: "45.2500" }).amount, row({ type: "expense", amount: "-45.2500" }).amount], ["-45.2500", "-45.2500"]);
    assert.equal(row({ type: "fee", amount: "5.0000" }).amount, "-5.0000", "a fee takes money away");
    assert.equal(row({ type: "income" }).direction, "income");
    assert.equal(row({ type: "expense" }).direction, "expense");
  });

  it("gives a transfer no direction and no sign, and does not guess one from the amount", () => {
    const transfer = row({ type: "transfer", amount: "400.0000", transfer_id: 9 });
    assert.deepEqual([transfer.amount, transfer.direction, transfer.isTransfer], ["400.0000", null, true]);
    assert.equal(row({ type: "transfer", amount: "-400.0000" }).amount, "400.0000");
  });

  it("gives a reversal entry no direction either, even if its type says income or expense", () => {
    assert.deepEqual([row({ type: "reversal", amount: "45.2500", reversal_of_id: 7 }).amount, row({ type: "reversal" }).direction], ["45.2500", null]);
    const reversing = row({ type: "expense", reversal_of_id: 7, amount: "45.2500" });
    assert.deepEqual([reversing.isReversal, reversing.direction, reversing.amount, reversing.reversalOfId], [true, null, "45.2500", "7"]);
  });

  it("shows an unknown type's amount exactly as sent, with no sign it cannot justify", () => {
    const refund = row({ type: "refund", amount: "-12.5000" });
    assert.deepEqual([refund.amount, refund.direction, refund.type], ["-12.5000", null, "refund"]);
    assert.equal(row({ type: "something_new", amount: "12.5000" }).amount, "12.5000");
    assert.equal(row({ type: null }).type, null);
  });

  it("never turns a bad amount into zero", () => {
    for (const amount of [null, undefined, "", "abc", 45.25, "45,25", "1.23456"]) assert.equal(row({ type: "expense", amount }).amount, null, String(amount));
    assert.equal(row({ type: "expense", currency_code: "ils" }).amount, null, "no valid currency, no amount");
    assert.equal(row({ type: "income", amount: "0.0000" }).amount, "0.0000");
  });

  it("keeps the exact digits of a large or four-decimal amount", () => {
    assert.equal(row({ type: "income", amount: "123456789012345.6789" }).amount, "123456789012345.6789");
    assert.equal(row({ type: "expense", amount: "0.0050" }).amount, "-0.0050");
  });

  it("keeps a status it does not know as sent, and says it is unknown", () => {
    const odd = row({ status: "settling" });
    assert.deepEqual([odd.status, odd.statusKnown], ["settling", false]);
    for (const status of ["posted", "pending_review", "draft", "reversed", "failed"]) assert.equal(row({ status }).statusKnown, true, status);
    assert.deepEqual([row({ status: null }).status, row({ status: null }).statusKnown], [null, false]);
    assert.equal(row({ status: "reversed" }).reversed, true);
  });

  it("reads reversal and correction relations as ids", () => {
    const replacement = row({ related_transaction_id: 7 });
    assert.deepEqual([replacement.relatedId, replacement.isReversal], ["7", false]);
    assert.equal(row({ related_transaction_id: "x" }).relatedId, null);
    assert.equal(row({ transfer_id: 3 }).transferId, "3");
  });

  it("finds the accounts from the ledger lines, and none when the list did not include them", () => {
    assert.deepEqual(row().accounts, [{ id: "1", name: "Everyday wallet" }]);
    assert.deepEqual(row({ ledger_entries: [] }).accounts, []);
    assert.equal(row({ ledger_entries: undefined }).account, null);
    const transfer = row({ type: "transfer", ledger_entries: [
      { id: 1, account_id: 1, entry_role: "source", signed_amount: "-5.0000", account: { id: 1, name: "A" } },
      { id: 2, account_id: 2, entry_role: "destination", signed_amount: "5.0000", account: { id: 2, name: "B" } },
    ] });
    assert.deepEqual(transfer.accounts.map((account) => account.name), ["A", "B"]);
  });

  it("uses the description, then the category, and nothing invented", () => {
    assert.equal(row({ description: "  Rent  " }).title, "Rent");
    assert.equal(row({ description: "", category: { name: "Food" } }).title, "Food");
    assert.equal(row({ description: null, category: null }).title, null);
  });

  it("is null for something that has no usable id", () => {
    for (const bad of [null, "x", 5, [], { type: "income" }, { id: "abc" }, { id: 0 }]) assert.equal(normalizeTransaction(bad), null, JSON.stringify(bad));
  });

  it("puts a row under the right day in the user's zone", () => {
    assert.equal(normalizeTransaction(tx(1, { occurred_at: "2026-10-31T23:30:00Z" }), { timeZone: "Asia/Hebron" }).day, "2026-11-01");
    assert.equal(normalizeTransaction(tx(1, { occurred_at: null })).day, null);
  });

  it("handles several currencies without mixing them", () => {
    const rows = [tx(1, { currency_code: "ILS" }), tx(2, { currency_code: "USD", amount: "10.0000" }), tx(3, { currency_code: "EUR", amount: "3.5000" })].map((item) => normalizeTransaction(item));
    assert.deepEqual(rows.map((item) => [item.currency, item.amount]), [["ILS", "-45.2500"], ["USD", "-10.0000"], ["EUR", "-3.5000"]]);
  });
});

describe("a page of the list", () => {
  const page = (rows, options) => ({ status: true, data: movementPage(rows, options) });
  const expected = { page: 1, perPage: 20 };

  it("reads a good page", () => {
    const parsed = buildActivityPage(page([tx(1), tx(2, { type: "income", amount: "300.0000" })], { total: 2 }), expected);
    assert.deepEqual(parsed.rows.map((item) => [item.id, item.amount]), [["1", "-45.2500"], ["2", "300.0000"]]);
    assert.deepEqual([parsed.total, parsed.page, parsed.lastPage], [2, 1, 1]);
  });

  it("accepts an empty page", () => {
    assert.deepEqual(buildActivityPage(page([], { total: 0 }), expected).rows, []);
  });

  it("refuses a page that does not hold together, whole", () => {
    const rows = [tx(1)];
    const make = (over) => ({ status: true, data: { transactions: { ...movementPage(rows, { total: 1 }).transactions, ...over } } });
    const refused = {
      "another page than asked": make({ current_page: 2, from: 21, to: 21, last_page: 2, total: 21 }),
      "another page size": make({ per_page: 50 }),
      "a last page that does not match": make({ last_page: 4 }),
      "a negative total": make({ total: -1 }),
      "a from/to that does not match": make({ from: 3, to: 3 }),
      "more rows than the page size": make({ per_page: 1, total: 2, last_page: 2, data: [tx(1), tx(2)] }),
      "a repeated id": page([tx(1), tx(1)], { total: 2 }),
      "a row without an id": page([tx(1), { type: "income" }], { total: 2 }),
      "a row that is not an object": page([tx(1), "x"], { total: 2 }),
      "no paginator": { status: true, data: {} },
      "status false": { status: false, data: movementPage(rows) },
      "nothing": null,
    };

    for (const [name, response] of Object.entries(refused)) assert.throws(() => buildActivityPage(response, expected), { code: "MALFORMED_RESPONSE" }, name);
  });

  it("merges pages in order and shows a transaction that appeared on two pages once", () => {
    const first = buildActivityPage(page([tx(1), tx(2)], { page: 1, perPage: 20, total: 22 }), expected);
    const second = buildActivityPage(page([tx(2), tx(3)], { page: 2, perPage: 20, total: 22 }), { page: 2, perPage: 20 });
    const merged = mergePages([first, second]);

    assert.deepEqual(merged.items.map((item) => item.id), ["1", "2", "3"]);
    assert.equal(merged.duplicates, 1);
    assert.deepEqual(mergePages([]).items, []);
  });

  it("groups consecutive rows by day, across a page boundary", () => {
    const day1 = "2026-10-20T10:00:00Z";
    const day2 = "2026-10-19T10:00:00Z";
    const first = buildActivityPage(page([tx(1, { occurred_at: day1 }), tx(2, { occurred_at: day1 })], { page: 1, perPage: 2, total: 4 }), { page: 1, perPage: 2 });
    const second = buildActivityPage(page([tx(3, { occurred_at: day1 }), tx(4, { occurred_at: day2 })], { page: 2, perPage: 2, total: 4 }), { page: 2, perPage: 2 });
    const groups = groupByDay(mergePages([first, second]).items);

    assert.deepEqual(groups.map((group) => [group.day, group.items.map((item) => item.id)]), [["2026-10-20", ["1", "2", "3"]], ["2026-10-19", ["4"]]]);
  });

  it("keeps a row without a date in its own group instead of under a made-up day", () => {
    const groups = groupByDay(["1", "2"].map((id, index) => normalizeTransaction(tx(Number(id), { occurred_at: index ? null : "2026-10-20T10:00:00Z" }))));
    assert.deepEqual(groups.map((group) => group.day), ["2026-10-20", null]);
  });
});

describe("one transaction", () => {
  it("reads every field the page shows, including the ledger lines", () => {
    const detail = buildTransactionDetail({ transaction: tx(5, { type: "income", amount: "300.0000", reference_number: "INV-7", source: "manual", reversed_at: null, ledger_entries: [{ id: 50, account_id: 1, currency_code: "ILS", signed_amount: "300.0000", entry_role: "income", account: { id: 1, name: "Everyday wallet" } }] }) }, "5");

    assert.deepEqual([detail.id, detail.amount, detail.referenceNumber, detail.source, detail.creatorName], ["5", "300.0000", "INV-7", "manual", "Alex Example"]);
    assert.deepEqual(detail.entries, [{ key: "50", accountId: "1", accountName: "Everyday wallet", role: "income", amount: "300.0000", currency: "ILS" }]);
  });

  it("refuses a response about another transaction, or about none", () => {
    assert.equal(buildTransactionDetail({ transaction: tx(6) }, "5"), null);
    assert.equal(buildTransactionDetail({ transaction: { type: "income" } }, "5"), null);
    assert.equal(buildTransactionDetail({}, "5"), null);
    assert.equal(buildTransactionDetail(null, "5"), null);
  });

  it("carries the reversed, reversal and replacement facts as the backend sent them", () => {
    const reversed = buildTransactionDetail({ transaction: tx(5, { status: "reversed", reversed_at: "2026-10-21T08:00:00Z", reversal_reason: "Duplicate entry" }) }, "5");
    assert.deepEqual([reversed.reversed, reversed.reversalReason, reversed.reversedAt], [true, "Duplicate entry", "2026-10-21T08:00:00Z"]);

    const reversal = buildTransactionDetail({ transaction: tx(8, { type: "reversal", reversal_of_id: 5 }) }, "8");
    assert.deepEqual([reversal.isReversal, reversal.reversalOfId], [true, "5"]);

    const replacement = buildTransactionDetail({ transaction: tx(9, { related_transaction_id: 5 }) }, "9");
    assert.deepEqual([replacement.relatedId, replacement.isReversal], ["5", false]);
  });

  it("shows a ledger amount only when it is a valid decimal, and in the line's own currency", () => {
    const detail = buildTransactionDetail({ transaction: tx(5, { ledger_entries: [
      { id: 1, account_id: 1, currency_code: "USD", signed_amount: "-1.5000", entry_role: "expense" },
      { id: 2, account_id: 2, signed_amount: "oops", entry_role: "income" },
      { id: 3, account_id: 3, signed_amount: 4.5 },
    ] }) }, "5");

    assert.deepEqual(detail.entries.map((entry) => [entry.amount, entry.currency]), [["-1.5000", "USD"], [null, "ILS"], [null, "ILS"]]);
  });

  it("drops a role or source that is not a plain word, rather than showing it", () => {
    const detail = buildTransactionDetail({ transaction: tx(5, { source: "<script>", ledger_entries: [{ id: 1, entry_role: "<b>x</b>", account_id: 1 }] }) }, "5");
    assert.equal(detail.source, null);
    assert.equal(detail.entries[0].role, null);
  });
});

describe("where Back goes", () => {
  it("returns to the Mobile list the person came from, filters included", () => {
    assert.equal(backPathFrom({ from: "/m/activity?type=expense&status=posted" }, "/m/activity"), "/m/activity?type=expense&status=posted");
    assert.equal(backPathFrom({ from: "/m/accounts/5" }, "/m/activity"), "/m/accounts/5");
    assert.equal(backPathFrom({ from: "/m" }, "/m/activity"), "/m");
  });

  it("ignores anything that is not a Mobile address", () => {
    for (const from of ["https://evil.example/m", "//evil.example", "/dashboard", "/mission", "/m\\evil", "/m\n/x", "javascript:alert(1)", "", null, undefined, 5, {}, `/m/${"a".repeat(700)}`]) {
      assert.equal(backPathFrom({ from }, "/m/activity"), "/m/activity", String(from).slice(0, 30));
    }
    assert.equal(backPathFrom(null, "/m/activity"), "/m/activity");
    assert.equal(backPathFrom(undefined, "/m/accounts"), "/m/accounts");
  });
});

describe("the fixtures themselves are a faithful envelope", () => {
  it("wraps data in the backend's envelope", () => assert.deepEqual(envelope({ a: 1 }), { status: true, message: "ok", data: { a: 1 } }));
});
