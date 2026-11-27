import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { account, currencyRow, dashboard, movement, movementPage, multiCurrencyDashboard } from "./helpers/mobileApi.mjs";
import { buildAccountDetail, buildAccountList, normalizeAccount } from "../src/mobile/models/accounts.js";
import { buildAlertsModel, buildHomeModel, signedAmount } from "../src/mobile/models/home.js";
import { buildMovementPage } from "../src/mobile/models/movements.js";

/*
 * The models turn a backend response into what a screen may show, and refuse
 * what does not hold together. Each Home section ends up ready, empty or
 * unavailable on its own; none is filled with a made-up value.
 */

describe("Home: balances per currency", () => {
  it("reads one currency from summary_by_currency, with the backend's own digits", () => {
    const { balances } = buildHomeModel(dashboard());

    assert.equal(balances.state, "ready");
    assert.equal(balances.multi, false);
    assert.deepEqual(balances.rows, [{ currency: "ILS", balance: "1234.5000", income: "2000.0000", expense: "765.5000", net: "1234.5000", accountsCount: 1 }]);
  });

  it("keeps each currency apart, primary first, and has no combined figure anywhere", () => {
    const model = buildHomeModel(multiCurrencyDashboard());

    assert.equal(model.balances.multi, true);
    assert.deepEqual(model.balances.rows.map((row) => row.currency), ["ILS", "USD", "EUR"], "primary first, then the backend's order");
    assert.deepEqual(model.balances.rows.map((row) => row.balance), ["1234.5000", "500.2500", "-20.5000"]);
    assert.equal(JSON.stringify(model).includes("total"), false, "no summed total is produced");
    assert.equal(model.balances.rows.some((row) => row.balance === "1714.2500"), false, "1234.50 + 500.25 - 20.50 is never computed");
  });

  it("does not use totals.current_balance for a multi-currency user", () => {
    const data = multiCurrencyDashboard();
    const model = buildHomeModel({ ...data, summary_by_currency: undefined });

    assert.equal(model.balances.state, "unavailable");
  });

  it("uses totals only when the backend says single currency, and only in its own currency", () => {
    const data = dashboard({ summary_by_currency: undefined });
    const model = buildHomeModel(data);

    assert.equal(model.balances.state, "ready");
    assert.deepEqual(model.balances.rows.map((row) => [row.currency, row.balance]), [["ILS", "1234.5000"]]);

    assert.equal(buildHomeModel(dashboard({ summary_by_currency: undefined, scope: { is_multi_currency: false } })).balances.state, "ready");
    assert.equal(buildHomeModel(dashboard({ summary_by_currency: undefined, scope: {} })).balances.state, "unavailable", "scope silent about it");
    assert.equal(buildHomeModel(dashboard({ summary_by_currency: undefined, totals: { current_balance: "5.0000" } })).balances.state, "unavailable", "no currency on the totals");
  });

  it("renders unavailable, not a guess, when the backend contradicts itself", () => {
    const contradictions = {
      "the same currency listed twice": { summary_by_currency: [currencyRow("ILS"), currencyRow("ILS", { current_balance: "5.0000" })], scope: { is_multi_currency: true } },
      "two rows but the scope says one currency": { summary_by_currency: [currencyRow("ILS"), currencyRow("USD")], scope: { is_multi_currency: false } },
      "one row but the scope says several currencies": { summary_by_currency: [currencyRow("ILS")], scope: { is_multi_currency: true } },
      "the totals are in another currency than the only row": { summary_by_currency: [currencyRow("USD")], scope: { is_multi_currency: false }, totals: { currency_code: "ILS" } },
      "a row without a valid currency": { summary_by_currency: [currencyRow("ILS"), { ...currencyRow("USD"), currency_code: "usd" }], scope: { is_multi_currency: true } },
      "a row that is not an object": { summary_by_currency: [currencyRow("ILS"), "USD 5"], scope: { is_multi_currency: true } },
    };

    for (const [name, over] of Object.entries(contradictions)) {
      const section = buildHomeModel(dashboard(over)).balances;
      assert.equal(section.state, "unavailable", name);
      assert.deepEqual(section.rows, [], name);
    }
  });

  it("shows — (null) for one bad amount in a row, and keeps the rest of the row", () => {
    const data = dashboard({ summary_by_currency: [currencyRow("ILS", { current_balance: "abc", income: null, expense: 12.5, net: "-3.0000" })] });
    const [row] = buildHomeModel(data).balances.rows;

    assert.deepEqual([row.balance, row.income, row.expense, row.net], [null, null, null, "-3.0000"]);
  });

  it("says empty only when there are really no accounts", () => {
    assert.equal(buildHomeModel(dashboard({ summary_by_currency: [], accounts: [] })).balances.state, "empty");
    assert.equal(buildHomeModel(dashboard({ summary_by_currency: [], accounts: undefined, totals: { accounts_count: 0 } })).balances.state, "empty");
    assert.equal(buildHomeModel(dashboard({ summary_by_currency: [], accounts: [account()] })).balances.state, "unavailable", "accounts exist but no balances came with them");
  });

  it("is null for a response that is not an object", () => {
    for (const bad of [null, undefined, "x", 5, []]) assert.equal(buildHomeModel(bad), null);
  });
});

describe("Home: the other sections stand on their own", () => {
  it("a malformed accounts or recent section does not take the balances down", () => {
    const model = buildHomeModel(dashboard({ accounts: "nope", recent_transactions: { not: "a list" } }));

    assert.equal(model.balances.state, "ready");
    assert.equal(model.accounts.state, "unavailable");
    assert.equal(model.recent.state, "unavailable");
  });

  it("an empty list is empty; a missing list is unavailable (never silently empty)", () => {
    assert.equal(buildHomeModel(dashboard({ accounts: [] })).accounts.state, "empty");
    assert.equal(buildHomeModel(dashboard({ recent_transactions: [] })).recent.state, "empty");
    assert.equal(buildHomeModel(dashboard({ accounts: undefined })).accounts.state, "unavailable");
    assert.equal(buildHomeModel(dashboard({ recent_transactions: undefined })).recent.state, "unavailable");
  });

  it("reads recent transactions with the sign of their type and an unavailable amount for bad data", () => {
    const { recent } = buildHomeModel(dashboard({
      recent_transactions: [
        { id: 1, type: "expense", amount: "45.2500", currency_code: "ILS", description: "  Groceries ", occurred_at: "2026-10-20T10:00:00Z" },
        { id: 2, type: "income", amount: "300.0000", currency_code: "ILS", category: { name: "Pay" }, status: "reversed" },
        { id: 3, type: "transfer", amount: "10.0000", currency_code: "USD" },
        { id: 4, type: "expense", amount: "-7.0000", currency_code: "ILS" },
        { id: "bad id", type: "income", amount: "oops", currency_code: "ILS" },
        { id: 6, type: "income", amount: "5.0000", currency_code: "ils" },
      ],
    }));

    assert.deepEqual(recent.items.map((item) => item.amount), ["-45.2500", "300.0000", "10.0000", "-7.0000", null].slice(0, 5));
    assert.equal(recent.items[0].title, "Groceries");
    assert.equal(recent.items[1].title, "Pay");
    assert.equal(recent.items[1].reversed, true);
    assert.equal(recent.items[4].id, null);
    assert.equal(recent.items.length, 5, "only the first five");
  });

  it("signedAmount puts a sign in front of the text and never does arithmetic", () => {
    assert.equal(signedAmount("expense", "5.0000"), "-5.0000");
    assert.equal(signedAmount("fee", "5.0000"), "-5.0000");
    assert.equal(signedAmount("expense", "-5.0000"), "-5.0000");
    assert.equal(signedAmount("income", "5.0000"), "5.0000");
    assert.equal(signedAmount("transfer", "5.0000"), "5.0000");
    assert.equal(signedAmount("expense", null), null);
  });

  it("reads the period, and does not invent one", () => {
    assert.deepEqual(buildHomeModel(dashboard()).period, { preset: "month", from: "2026-10-01", to: "2026-10-31", timezone: "UTC" });
    assert.deepEqual(buildHomeModel(dashboard({ period: { preset: "week", date_from: "garbage" } })).period, { preset: "week", from: null, to: null, timezone: null });
    assert.deepEqual(buildHomeModel(dashboard({ period: undefined })).period, { preset: null, from: null, to: null, timezone: null });
  });
});

describe("Home: alerts", () => {
  it("counts alerts, keeps the first three, and shows an unknown severity as info", () => {
    const model = buildAlertsModel({ alerts: [1, 2, 3, 4].map((n) => ({ severity: n === 2 ? "weird" : "warning", message: `Budget ${n} is near its limit`, budget_id: n })) });

    assert.equal(model.count, 4);
    assert.equal(model.items.length, 3);
    assert.equal(model.items[1].severity, "info");
  });

  it("is null when the response has no alerts array, and empty when the list is empty", () => {
    assert.equal(buildAlertsModel({}), null);
    assert.equal(buildAlertsModel(null), null);
    assert.deepEqual(buildAlertsModel({ alerts: [] }), { count: 0, items: [] });
  });
});

describe("Accounts", () => {
  it("normalizes an account, and shows a balance only with a valid currency", () => {
    assert.equal(normalizeAccount(account()).balance, "1234.5000");
    assert.equal(normalizeAccount(account({ currency_code: "ils" })).balance, null);
    assert.equal(normalizeAccount(account({ current_balance: 12.5 })).balance, null);
    assert.equal(normalizeAccount(account({ id: "x" })).id, null);
    assert.equal(normalizeAccount(account({ name: "   " })).name, null);
    assert.equal(normalizeAccount(account({ status: "archived" })).archived, true);
    assert.equal(normalizeAccount("not an object"), null);
  });

  it("groups by currency in the backend's order, primary first, with no totals", () => {
    const list = buildAccountList({ accounts: [account({ id: 1, currency_code: "USD" }), account({ id: 2 }), account({ id: 3, currency_code: "USD" }), account({ id: 4, currency_code: "EUR" })] }, "ILS");

    assert.equal(list.count, 4);
    assert.deepEqual(list.groups.map((group) => [group.currency, group.items.map((item) => item.id)]), [["ILS", ["2"]], ["USD", ["1", "3"]], ["EUR", ["4"]]]);
    assert.equal(JSON.stringify(list).includes("total"), false);
  });

  it("puts an account with no usable currency in its own group, last", () => {
    const list = buildAccountList({ accounts: [account({ id: 1, currency_code: null }), account({ id: 2 })] }, null);
    assert.deepEqual(list.groups.map((group) => group.currency), ["ILS", null]);
  });

  it("is null for a response that is not a list of accounts", () => {
    assert.equal(buildAccountList({}), null);
    assert.equal(buildAccountList({ accounts: [account(), "x"] }), null);
    assert.equal(buildAccountList(null), null);
  });

  it("refuses an account response for a different id than the one asked for", () => {
    assert.ok(buildAccountDetail({ account: account({ id: 5 }) }, "5"));
    assert.equal(buildAccountDetail({ account: account({ id: 6 }) }, "5"), null);
    assert.equal(buildAccountDetail({ account: account({ id: undefined }) }, "5"), null);
    assert.equal(buildAccountDetail({}, "5"), null);
  });

  it("reads the read-only facts and drops values it cannot trust", () => {
    const detail = buildAccountDetail({ account: account({ id: 5, allow_negative_balance: true, low_balance_threshold: "50.0000", last_four_digits: "1234", is_default: 1, opening_balance: "bad" }) }, "5");

    assert.equal(detail.allowsNegative, true);
    assert.equal(detail.lowBalanceThreshold, "50.0000");
    assert.equal(detail.lastFour, "1234");
    assert.equal(detail.isDefault, true);
    assert.equal(detail.openingBalance, null);
    assert.equal(buildAccountDetail({ account: account({ id: 5, last_four_digits: "12ab" }) }, "5").lastFour, null);
  });
});

describe("Account movements", () => {
  const acct = { id: "1", workspaceId: "1", currency: "ILS" };
  const page1 = { page: 1, perPage: 20 };

  it("reads a page, with amounts and directions taken from this account's ledger lines", () => {
    const parsed = buildMovementPage({ status: true, data: movementPage([movement(1, 1, "-45.2500"), movement(2, 1, "300.0000"), movement(3, 1, "0.0001")]) }, acct, page1);

    assert.deepEqual(parsed.rows.map((row) => [row.id, row.amount, row.direction]), [["1", "-45.2500", "out"], ["2", "300.0000", "in"], ["3", "0.0001", "in"]]);
    assert.equal(parsed.total, 3);
    assert.equal(parsed.lastPage, 1);
  });

  it("is exact beyond what a double can hold", () => {
    const parsed = buildMovementPage({ status: true, data: movementPage([movement(1, 1, "9007199254740993.0001")]) }, acct, page1);
    assert.equal(parsed.rows[0].amount, "9007199254740993.0001");
  });

  it("nets two lines of the same transaction on this account and ignores the other account's line", () => {
    const transfer = movement(7, 1, "-10.0000", {
      type: "transfer",
      description: null,
      ledger_entries: [
        { id: 70, workspace_id: 1, transaction_id: 7, account_id: 1, currency_code: "ILS", signed_amount: "-10.0000", entry_role: "source", account: { id: 1, name: "Everyday wallet" } },
        { id: 71, workspace_id: 1, transaction_id: 7, account_id: 2, currency_code: "ILS", signed_amount: "10.0000", entry_role: "destination", account: { id: 2, name: "Savings jar" } },
      ],
    });
    const [row] = buildMovementPage({ status: true, data: movementPage([transfer]) }, acct, page1).rows;

    assert.equal(row.amount, "-10.0000");
    assert.equal(row.direction, "out");
    assert.equal(row.counterpart, "Savings jar");
  });

  it("refuses a page that does not hold together, whole", () => {
    const ok = movement(1, 1, "5.0000");
    const bad = {
      "a line in another currency": movement(1, 1, "5.0000", { ledger_entries: [{ ...ok.ledger_entries[0], currency_code: "USD" }] }),
      "a movement with no line for this account": movement(1, 9, "5.0000"),
      "an amount that is not a decimal": movement(1, 1, "five"),
      "a transaction of another workspace": movement(1, 1, "5.0000", { workspace_id: 2 }),
      "a line of another transaction": movement(1, 1, "5.0000", { ledger_entries: [{ ...ok.ledger_entries[0], transaction_id: 99 }] }),
      "no ledger lines at all": movement(1, 1, "5.0000", { ledger_entries: undefined }),
    };

    for (const [name, row] of Object.entries(bad)) {
      assert.throws(() => buildMovementPage({ status: true, data: movementPage([row]) }, acct, page1), { code: "MALFORMED_RESPONSE" }, name);
    }

    assert.throws(() => buildMovementPage({ status: true, data: movementPage([ok, ok]) }, acct, page1), { code: "MALFORMED_RESPONSE" }, "a repeated id");
  });

  it("refuses paginator numbers that disagree with each other or with the request", () => {
    const rows = [movement(1, 1, "5.0000")];
    const make = (over) => ({ status: true, data: { transactions: { ...movementPage(rows).transactions, ...over } } });

    for (const [name, over] of Object.entries({
      "another page than requested": { current_page: 2, from: 21, to: 21, last_page: 2, total: 21 },
      "another page size": { per_page: 50, last_page: 1 },
      "a last page that does not match the total": { last_page: 3 },
      "more rows than the page size": { per_page: 1, last_page: 1, total: 1, data: [movement(1, 1, "5.0000"), movement(2, 1, "5.0000")] },
      "a from/to that does not match": { from: 5, to: 5 },
      "a negative total": { total: -1 },
    })) {
      assert.throws(() => buildMovementPage(make(over), acct, page1), { code: "MALFORMED_RESPONSE" }, name);
    }

    assert.throws(() => buildMovementPage({ status: true, data: {} }, acct, page1), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildMovementPage(null, acct, page1), { code: "MALFORMED_RESPONSE" });
  });

  it("marks reversals and reversed movements", () => {
    const parsed = buildMovementPage({ status: true, data: movementPage([movement(1, 1, "5.0000", { status: "reversed" }), movement(2, 1, "-5.0000", { type: "reversal", reversal_of_id: 1 })]) }, acct, page1);

    assert.deepEqual(parsed.rows.map((row) => [row.reversed, row.isReversal]), [[true, false], [false, true]]);
  });
});
