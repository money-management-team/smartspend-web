import assert from "node:assert/strict";
import { act } from "react";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { envelope, failure, installFakeApi, movementPage, tx, transactionsBackend } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, goBack, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { change, click } from "./helpers/dom.mjs";

/*
 * Mobile Activity (the list, its filters, paging) against a fake backend that
 * filters, sorts and pages like GET /transactions. Fictional data only.
 */

after(() => dom.window.close());

const iso = (day, hour = 10) => `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000000Z`;
const entry = (id, accountId, amount, role, name = "Everyday wallet") => ({ id: id * 10 + accountId, workspace_id: 1, transaction_id: id, account_id: accountId, currency_code: "ILS", signed_amount: amount, entry_role: role, account: { id: accountId, name } });

// Three named days, then plain expenses on earlier days until there are 45 transactions (three pages).
function fixture() {
  const rows = [
    tx(1, { description: "Groceries", amount: "45.2500", occurred_at: iso(20, 12) }),
    tx(2, { type: "income", description: "Salary", amount: "3000.0000", occurred_at: iso(20, 9), category: { id: 5, name: "Salary" }, category_id: 5, ledger_entries: [entry(2, 1, "3000.0000", "income")] }),
    tx(3, { type: "transfer", description: "Move to savings", amount: "400.0000", occurred_at: iso(19, 15), transfer_id: 9, category: null, category_id: null, ledger_entries: [entry(3, 1, "-400.0000", "source"), entry(3, 2, "400.0000", "destination", "Savings jar")] }),
    tx(4, { description: "Duplicate lunch", status: "reversed", amount: "30.0000", occurred_at: iso(19, 12), reversal_reason: "Entered twice" }),
    tx(5, { type: "reversal", description: null, category: null, category_id: null, amount: "30.0000", reversal_of_id: 4, occurred_at: iso(19, 11) }),
    tx(6, { description: "Awaiting review", status: "pending_review", amount: "12.0000", occurred_at: iso(18, 12) }),
    tx(7, { description: "Odd one", status: "settling", amount: "7.0000", occurred_at: iso(18, 11) }),
  ];
  for (let id = 8; id <= 45; id += 1) rows.push(tx(id, { description: `Filler ${id}`, amount: "1.0000", occurred_at: iso(17 - (id % 15), 10) }));
  return rows;
}

let api;
let view;

const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const spoken = (root) => qa(".sm-sr", root).map((node) => node.textContent);
const titles = () => qa("[data-sm-tx] .sm-row-title").map((node) => node.textContent);
const button = (label, root = q("main")) => qa("button", root).find((item) => item.textContent.trim() === label);
const transactionCalls = () => api.calls.filter((call) => call.path === "/transactions");
const openActivity = async (search = "", options = {}) => {
  view = await mountMobile({ entry: `/m/activity${search}`, ...options });
  return view;
};
const sheet = () => q("[role='dialog']");

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
  api = installFakeApi(transactionsBackend(fixture()));
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api.restore();
});

describe("Activity: what it reads", () => {
  it("reads page 1 of GET /transactions with the documented query, and nothing else", async () => {
    await openActivity();

    assert.deepEqual(api.summary(), ["GET /transactions"]);
    assert.deepEqual(api.calls[0].query, { sort_by: "occurred_at", sort_dir: "desc", per_page: "20", page: "1" });
    assert.deepEqual(api.violations, []);
    assert.ok(api.calls.every((call) => call.auth === `Bearer ${TOKEN_A}`));
  });

  it("does not ask for accounts or categories until the filters are used", async () => {
    await openActivity();
    assert.equal(api.calls.some((call) => call.path === "/accounts" || call.path === "/categories"), false);
  });

  it("has no loop: the number of requests does not grow once the list is on screen", async () => {
    await openActivity();
    const before = api.calls.length;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
    await settle();
    assert.equal(api.calls.length, before);
  });
});

describe("Activity: the list", () => {
  it("shows placeholders without numbers while the first page loads", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Promise((resolve) => { release = () => resolve(transactionsBackend(fixture())(call)); }) : transactionsBackend(fixture())(call)));
    await openActivity();

    const page = q("[data-sm-screen='activity']");
    assert.equal(page.dataset.smState, "loading");
    assert.equal(page.getAttribute("aria-busy"), "true");
    assert.doesNotMatch(text(page), /\d{2}/);
    assert.equal(qa(".sm-money").length, 0);

    release();
    await settle();
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "ready");
  });

  it("groups transactions under day headings and shows the server's count", async () => {
    await openActivity();

    assert.deepEqual(qa(".sm-day-title").slice(0, 3).map((node) => node.textContent), ["Tuesday, October 20, 2026", "Monday, October 19, 2026", "Sunday, October 18, 2026"]);
    assert.deepEqual(qa("[data-sm-day='2026-10-20'] [data-sm-tx]").map((row) => row.dataset.smTx), ["1", "2"]);
    assert.equal(q("[data-sm-count]").dataset.smCount, "20");
    assert.match(text(q("main")), /Showing 20 of 45/);
    assert.equal(qa("h1").length, 1);
    assert.equal(qa("h3, h4, h5, h6").length, 0);
  });

  it("shows the type's sign, never colours an amount green, and leaves a transfer unsigned", async () => {
    await openActivity();
    const row = (id) => q(`[data-sm-tx='${id}']`);

    assert.deepEqual(spoken(row(1)), ["minus 45.25 Israeli New Shekel"]);
    assert.deepEqual(spoken(row(2)), ["plus 3,000.00 Israeli New Shekel"]);
    assert.deepEqual(spoken(row(3)), ["400.00 Israeli New Shekel"]);
    assert.equal(qa(".sm-money-negative", q("main")).length, 0, "no tinted amounts in the ledger");
    assert.equal(qa("[class*='green'], [data-sm-tone='positive']").length, 0);
    assert.match(row(3).textContent, /Transfer/);
    assert.match(row(3).textContent, /Everyday wallet · Savings jar/);
  });

  it("marks reversed, reversal, pending and unknown statuses in words", async () => {
    await openActivity("?sort=occurred_at:desc");
    await click(button("Load more"));
    await settle();
    const row = (id) => q(`[data-sm-tx='${id}']`);

    assert.match(row(4).textContent, /Reversed/);
    assert.equal(row(4).dataset.smReversed, "true");
    assert.ok(q(".sm-struck", row(4)));
    assert.deepEqual(spoken(row(4)), ["minus 30.00 Israeli New Shekel", " Reversed"].map((value) => value), "the amount says it was reversed");
    assert.match(row(5).textContent, /Reversal/);
    assert.deepEqual(spoken(row(5)), ["30.00 Israeli New Shekel"], "a reversal entry has no direction");
    assert.match(row(6).textContent, /Pending review/);
    assert.match(row(7).textContent, /Unknown status: settling/);
    assert.equal(q(".sm-status[data-sm-status='unknown']", row(7)) !== null, true);
  });

  it("does not use a status chip for posted rows (posted is the normal case)", async () => {
    await openActivity();
    assert.equal(qa(".sm-status", q("[data-sm-tx='1']")).length, 0);
  });

  it("links each row to its transaction, remembering where it came from", async () => {
    await openActivity("?type=expense");
    const link = q("[data-sm-tx='1']");

    assert.equal(link.getAttribute("href"), "/m/activity/1");
    await click(link);
    await settle();
    assert.equal(location(), "/m/activity/1");
  });

  it("puts a row on the day it has in the user's time zone, not the device's or UTC's", async () => {
    api.restore();
    const late = [tx(1, { description: "Late night", occurred_at: "2026-10-31T23:30:00.000000Z" })];
    api = installFakeApi(transactionsBackend(late));
    await openActivity("", { auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: { ...USER_A, timezone: "Asia/Hebron" }, workspace: { id: 1 } } });
    assert.equal(q(".sm-day-title").textContent, "Sunday, November 1, 2026");

    await view.unmount();
    api.restore();
    api = installFakeApi(transactionsBackend(late));
    await openActivity("", { auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: { ...USER_A, timezone: "UTC" }, workspace: { id: 1 } } });
    assert.equal(q(".sm-day-title").textContent, "Saturday, October 31, 2026");
  });

  it("shows Arabic day headings with Latin digits, right to left", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await openActivity();

    assert.equal(document.documentElement.dir, "rtl");
    assert.doesNotMatch(q(".sm-day-title").textContent, /[٠-٩]/);
    assert.match(q(".sm-day-title").textContent, /2026/);
    for (const run of qa(".sm-money-run")) assert.equal(run.getAttribute("dir"), "ltr");
    assert.match(text(q("main")), /عرض 20 من 45/);
    await i18n.changeLanguage("en");
  });

  it("hides every amount when the person chose to hide amounts", async () => {
    window.localStorage.setItem("smartspend:experience:v1:u:1:w:1", JSON.stringify({ version: 1, hiddenMoney: true }));
    await openActivity();

    assert.ok(qa(".sm-money-hidden").length >= 20);
    assert.equal(qa(".sm-money-run").length, 0);
    assert.doesNotMatch(text(q("main")), /45\.25|3,000|400\.00/);
    assert.deepEqual(spoken(q("[data-sm-tx='1']")), ["Amount hidden"]);
  });

  it("shows a missing or invalid amount as unavailable, never as zero", async () => {
    api.restore();
    api = installFakeApi(transactionsBackend([tx(1, { amount: null }), tx(2, { amount: "oops" }), tx(3, { currency_code: "x" })]));
    await openActivity();

    assert.equal(qa(".sm-money-na").length, 3);
    assert.doesNotMatch(text(q("main")), /(^|[^\d.,])0\.00/);
  });

  it("keeps several currencies apart, each in its own", async () => {
    api.restore();
    api = installFakeApi(transactionsBackend([tx(1, { currency_code: "USD", amount: "10.5000" }), tx(2, { currency_code: "EUR", amount: "3.0000" }), tx(3, { currency_code: "ILS", amount: "100.0000" })]));
    await openActivity();

    assert.deepEqual(qa("[data-sm-tx]").map((row) => spoken(row)[0]), ["minus 10.50 US Dollar", "minus 3.00 Euro", "minus 100.00 Israeli New Shekel"]);
  });

  it("shows a very large amount whole", async () => {
    api.restore();
    api = installFakeApi(transactionsBackend([tx(1, { type: "income", amount: "123456789012345.6789" })]));
    await openActivity();
    assert.deepEqual(spoken(q("[data-sm-tx]")), ["plus 123,456,789,012,345.6789 Israeli New Shekel"]);
  });

  it("shows long Arabic and Latin text without cutting it", async () => {
    const long = "فاتورة الكهرباء الشهرية لمنزل العائلة في الطابق الثالث مع رسوم الصيانة السنوية و electricity bill for the third floor";
    api.restore();
    api = installFakeApi(transactionsBackend([tx(1, { description: long })]));
    await openActivity();
    assert.equal(q(".sm-row-title").textContent, long);
  });
});

describe("Activity: empty and failing", () => {
  it("says there are no transactions yet, and where they are recorded", async () => {
    api.restore();
    api = installFakeApi(transactionsBackend([]));
    await openActivity();

    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "empty");
    assert.match(text(q("main")), /No transactions yet/);
    assert.ok(q("a[href='/dashboard/financial-operations']", q("main")));
    assert.equal(qa(".sm-money").length, 0);
  });

  it("says no transaction matches the filters, and offers to reset them", async () => {
    await openActivity("?status=failed");

    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "empty-filtered");
    assert.match(text(q("main")), /No transactions match these filters/);
    await click(button("Reset all filters", q("[data-sm-screen='activity']")));
    await settle();
    assert.equal(location(), "/m/activity");
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "ready");
  });

  it("a failed first page offers Try again, which sends the same request", async () => {
    let ok = false;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" && !ok ? failure(500, "") : transactionsBackend(fixture())(call)));
    await openActivity();

    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "error");
    assert.equal(q("[data-sm-error]").dataset.smError, "server");
    assert.equal(qa("[data-sm-tx]").length, 0);

    ok = true;
    await click(button("Try again"));
    await settle();
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "ready");
    assert.deepEqual(transactionCalls().map((call) => call.query.page), ["1", "1"]);
  });

  it("names offline separately", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Error("offline") : transactionsBackend(fixture())(call)));
    await openActivity();

    assert.equal(q("[data-sm-error]").dataset.smError, "offline");
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("a 401 shows the session ended, with no rows and no retry", async () => {
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? failure(401, "Unauthenticated.") : transactionsBackend(fixture())(call)));
    await openActivity();

    assert.equal(q("[data-sm-error]").dataset.smError, "session");
    assert.equal(qa("[data-sm-tx]").length, 0);
    assert.equal(q("[data-sm-error] button"), null);
  });

  it("refuses a page whose paginator does not hold together, instead of showing part of it", async () => {
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? { body: envelope({ transactions: { ...movementPage([tx(1), tx(2)], { total: 2 }).transactions, last_page: 9 } }) } : transactionsBackend(fixture())(call)));
    await openActivity();

    assert.equal(q("[data-sm-error]").dataset.smError, "malformed");
    assert.equal(qa("[data-sm-tx]").length, 0);
  });

  it("keeps the rows and says they are old when a refresh fails", async () => {
    await openActivity();
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? failure(503, "") : transactionsBackend(fixture())(call)));

    await click(button("Refresh"));
    await settle();

    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "stale");
    assert.match(text(q(".sm-stale")), /Showing what was loaded at/);
    assert.equal(qa("[data-sm-tx]").length, 20);
  });

  it("refreshing keeps the rows on screen and marks the button busy", async () => {
    await openActivity();
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Promise((resolve) => { release = () => resolve(transactionsBackend(fixture())(call)); }) : transactionsBackend(fixture())(call)));

    await click(button("Refresh"));
    assert.equal(button("Refreshing…").disabled, true);
    assert.equal(qa("[data-sm-tx]").length, 20);
    release();
    await settle();
    assert.ok(button("Refresh"));
  });
});

describe("Activity: Load more", () => {
  it("asks for the next server page only when asked, and appends it with no duplicates and no gap", async () => {
    await openActivity();
    assert.equal(transactionCalls().length, 1);

    await click(button("Load more"));
    await settle();

    assert.deepEqual(transactionCalls().map((call) => call.query.page), ["1", "2"]);
    const ids = qa("[data-sm-tx]").map((row) => row.dataset.smTx);
    assert.equal(ids.length, 40);
    assert.equal(new Set(ids).size, 40, "no row twice");
    assert.match(text(q("main")), /Showing 40 of 45/);

    await click(button("Load more"));
    await settle();
    assert.equal(qa("[data-sm-tx]").length, 45);
    assert.equal(button("Load more"), undefined);
    assert.match(text(q("main")), /That's everything that matches/);
    assert.deepEqual(new Set(qa("[data-sm-tx]").map((row) => row.dataset.smTx)).size, 45);
  });

  it("merges a day that continues onto the next page into one group", async () => {
    await openActivity();
    await click(button("Load more"));
    await settle();

    const days = qa("[data-sm-day]").map((group) => group.dataset.smDay);
    assert.equal(new Set(days).size, days.length, "no day heading is repeated");
  });

  it("a failing next page keeps the rows, says so, and retries just that page", async () => {
    let ok = false;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" && call.query.page === "2" && !ok ? failure(500, "") : transactionsBackend(fixture())(call)));
    await openActivity();

    await click(button("Load more"));
    await settle();

    assert.equal(qa("[data-sm-tx]").length, 20, "page 1 is still there");
    assert.match(text(q("[data-sm-error='more']")), /More transactions couldn't be loaded/);

    ok = true;
    await click(button("Try again", q("[data-sm-error='more']")));
    await settle();
    assert.equal(qa("[data-sm-tx]").length, 40);
    assert.equal(q("[data-sm-error='more']"), null);
  });

  it("a duplicate that appears on two pages (the list moved while paging) is shown once", async () => {
    api.restore();
    const rows = fixture();
    api = installFakeApi((call) => {
      const response = transactionsBackend(rows)(call);
      if (call.path === "/transactions" && call.query.page === "2") {
        const body = response.body.data.transactions;
        body.data = [rows[0], ...body.data.slice(1)]; // page 2 starts with transaction 1 again
      }
      return response;
    });
    await openActivity();
    await click(button("Load more"));
    await settle();

    const ids = qa("[data-sm-tx]").map((row) => row.dataset.smTx);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.filter((id) => id === "1").length, 1);
  });

  it("brings back as many pages as were open when returning from a transaction", async () => {
    await openActivity("?status=posted");
    await click(button("Load more"));
    await settle();
    await click(q("[data-sm-tx]"));
    await settle();
    assert.equal(location(), "/m/activity/1");

    await click(q("a.sm-back"));
    await settle();

    assert.equal(location(), "/m/activity?status=posted");
    assert.equal(qa("[data-sm-tx]").length, 40);
  });

  it("goes back to the page the person was scrolled to", async () => {
    await openActivity();
    const main = q("#sm-main");
    main.scrollTop = 420;
    await click(q("[data-sm-tx]"));
    await settle();

    await click(q("a.sm-back"));
    await settle();
    assert.equal(q("#sm-main").scrollTop, 420);
  });

  it("Refresh goes back to the first page and forgets the later ones", async () => {
    await openActivity();
    await click(button("Load more"));
    await settle();
    assert.equal(qa("[data-sm-tx]").length, 40);

    await click(button("Refresh"));
    await settle();
    assert.equal(qa("[data-sm-tx]").length, 20);
    assert.equal(q("[data-sm-more]").dataset.smMore, "2");
  });
});

describe("Activity: the filter sheet", () => {
  const openSheet = async () => {
    const opener = q(".sm-toolbar button");
    opener.focus();
    await click(opener);
    await settle();
    return opener;
  };

  it("opens as a labelled modal, makes the page behind inert, traps Tab and Escape closes it with focus back on the button", async () => {
    await openActivity();
    const opener = await openSheet();

    assert.equal(sheet().getAttribute("aria-modal"), "true");
    assert.equal(q(`#${sheet().getAttribute("aria-labelledby")}`).textContent, "Filters");
    for (const behind of ["header", "main", ".sm-nav-wrap"]) assert.equal(q(behind).hasAttribute("inert"), true, behind);
    assert.ok(sheet().contains(document.activeElement));

    const focusable = qa("button, select, input", sheet());
    focusable.at(-1).focus();
    document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert.equal(document.activeElement, focusable[0], "Tab wraps to the first control");

    await act(async () => { document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    assert.equal(sheet(), null);
    assert.equal(q("main").hasAttribute("inert"), false);
    assert.equal(document.activeElement, opener);
  });

  it("offers exactly what the endpoint supports: type, status, account, category, two dates, the date order. No text search", async () => {
    await openActivity();
    await openSheet();

    assert.deepEqual(qa("legend, .sm-label", sheet()).map((node) => node.textContent), ["Type", "Status", "Account", "Category", "From date", "To date", "Order"]);
    assert.equal(qa("input:not([type='date'])", sheet()).length, 0, "no text box of any kind");
    assert.equal(qa("input[type='search']", document).length, 0);
    assert.deepEqual(qa("button", sheet()).map((item) => item.textContent).slice(-3), ["Apply", "Reset", "Cancel"]);
    assert.deepEqual(qa("label", sheet()).map((node) => node.querySelector("select, input") !== null).filter(Boolean).length, 6, "every field has a label around its control");
  });

  it("loads the account and category choices only now, from the two read-only lists", async () => {
    await openActivity();
    assert.equal(api.calls.some((call) => call.path === "/categories"), false);
    await openSheet();

    assert.ok(api.calls.some((call) => call.path === "/categories" && call.method === "GET"));
    assert.ok(api.calls.some((call) => call.path === "/accounts"));
    assert.deepEqual(qa("select option", sheet()).map((option) => option.textContent).filter((label) => /Everyday|Food|Salary/.test(label)), ["Everyday wallet (ILS)", "Food", "Salary"]);
  });

  it("applies a draft: the address carries it, the list is asked for it from page 1, and a chip shows it", async () => {
    await openActivity();
    await openSheet();

    await click(qa("button", sheet()).find((item) => item.textContent === "Expense"));
    await change(qa("select", sheet())[0], "posted");
    await change(sheet().querySelectorAll("input[type='date']")[0], "2026-10-18");
    await click(button("Apply", sheet()));
    await settle();

    assert.equal(location(), "/m/activity?type=expense&status=posted&date_from=2026-10-18");
    assert.equal(sheet(), null);
    const last = transactionCalls().at(-1);
    assert.deepEqual([last.query.type, last.query.status, last.query.date_from, last.query.page], ["expense", "posted", "2026-10-18", "1"]);
    assert.deepEqual(qa(".sm-chips .sm-chip-button").slice(0, 3).map((chip) => chip.textContent), ["Expense", "Posted", "From Oct 18, 2026"]);
    assert.match(button("Filters (3)", q("main")).textContent, /Filters \(3\)/);
    assert.ok(qa("[data-sm-tx]").every((row) => !/Salary/.test(row.textContent)), "the server filtered; nothing is filtered in the browser");
  });

  it("filters by account and category with the ids, and the chips use their names", async () => {
    await openActivity();
    await openSheet();
    await change(qa("select", sheet())[1], "1");
    await change(qa("select", sheet())[2], "5");
    await click(button("Apply", sheet()));
    await settle();

    assert.equal(location(), "/m/activity?account_id=1&category_id=5");
    assert.deepEqual(qa(".sm-chips .sm-chip-button").slice(0, 2).map((chip) => chip.textContent), ["Account: Everyday wallet", "Category: Salary"]);
    assert.deepEqual(titles(), ["Salary"]);
  });

  it("Cancel and Escape change nothing; Reset clears the draft but only Apply commits it", async () => {
    await openActivity("?type=income");
    await openSheet();

    await click(button("Reset", sheet()));
    assert.equal(location(), "/m/activity?type=income", "Reset alone does not touch the address");
    await click(button("Cancel", sheet()));
    assert.equal(sheet(), null);
    assert.equal(location(), "/m/activity?type=income");

    await openSheet();
    await click(button("Reset", sheet()));
    await click(button("Apply", sheet()));
    await settle();
    assert.equal(location(), "/m/activity");
    assert.equal(qa(".sm-chips").length, 0);
  });

  it("will not apply an end date before the start date, and says why", async () => {
    await openActivity();
    await openSheet();
    await change(sheet().querySelectorAll("input[type='date']")[0], "2026-10-20");
    await change(sheet().querySelectorAll("input[type='date']")[1], "2026-10-10");
    const before = transactionCalls().length;
    await click(button("Apply", sheet()));

    assert.match(q("[role='alert']", sheet()).textContent, /start date must not be after the end date/);
    assert.ok(sheet());
    assert.equal(location(), "/m/activity");
    assert.equal(transactionCalls().length, before);
  });

  it("removes one filter with its chip, or all of them, and each asks the server again", async () => {
    await openActivity("?type=expense&status=posted");

    await click(qa(".sm-chips .sm-chip-button").find((chip) => chip.textContent === "Posted"));
    await settle();
    assert.equal(location(), "/m/activity?type=expense");
    assert.equal(transactionCalls().at(-1).query.status, undefined);

    await click(button("Reset all filters"));
    await settle();
    assert.equal(location(), "/m/activity");
    assert.equal(transactionCalls().at(-1).query.type, undefined);
  });

  it("gives each chip a name that says it removes a filter", async () => {
    await openActivity("?type=expense");
    assert.equal(q(".sm-chips .sm-chip-button").getAttribute("aria-label"), "Remove filter: Expense");
  });

  it("sorts oldest first when asked, and says so", async () => {
    await openActivity();
    await openSheet();
    await change(qa("select", sheet()).at(-1), "occurred_at:asc");
    await click(button("Apply", sheet()));
    await settle();

    assert.equal(location(), "/m/activity?sort=occurred_at%3Aasc");
    assert.equal(transactionCalls().at(-1).query.sort_dir, "asc");
    assert.equal(q("[data-sm-screen='activity']").dataset.smSort, "oldest");
    assert.ok(qa(".sm-toolbar .sm-chip").some((chip) => chip.textContent === "Oldest first"));
  });

  it("a deep link with a filter the endpoint does not know drops it and still loads", async () => {
    await openActivity("?type=debt&q=coffee&status=posted");
    assert.equal(transactionCalls()[0].query.type, undefined);
    assert.equal(transactionCalls()[0].query.q, undefined);
    assert.equal(transactionCalls()[0].query.status, "posted");
  });

  it("works in Arabic: right-to-left sheet with Arabic labels", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await openActivity();
    await openSheet();

    assert.equal(document.documentElement.dir, "rtl");
    assert.deepEqual(qa("legend, .sm-label", sheet()).map((node) => node.textContent).slice(0, 4), ["النوع", "الحالة", "الحساب", "التصنيف"]);
    await i18n.changeLanguage("en");
  });
});

describe("Activity: a slow answer to old filters never lands on new ones", () => {
  it("shows only the answer to the filters on screen, however late the old one arrives", async () => {
    const held = [];
    api.restore();
    api = installFakeApi((call) => {
      if (call.path === "/transactions" && call.query.type === "expense") return new Promise((resolve) => held.push(() => resolve(transactionsBackend(fixture())(call))));
      return transactionsBackend(fixture())(call);
    });
    await openActivity("?type=expense");
    assert.equal(q("[data-sm-screen='activity']").dataset.smState, "loading");

    // The person switches to income while the expense request is still out.
    await click(q(".sm-toolbar button"));
    await settle();
    await click(qa("button", sheet()).find((item) => item.textContent === "Income"));
    await click(button("Apply", sheet()));
    await settle();

    assert.equal(location(), "/m/activity?type=income");
    assert.deepEqual(titles(), ["Salary"]);

    held.forEach((release) => release());
    await settle();
    assert.deepEqual(titles(), ["Salary"], "the late expense answer changed nothing");
    assert.equal(qa("[data-sm-tx]").length, 1);
  });

  it("cancels the request of the filters the person left", async () => {
    const signals = [];
    api.restore();
    api = installFakeApi((call) => {
      if (call.path === "/transactions" && call.query.type === "expense") {
        signals.push(call.signal);
        return new Promise(() => {});
      }
      return transactionsBackend(fixture())(call);
    });
    await openActivity("?type=expense");
    await click(q(".sm-toolbar button"));
    await settle();
    await click(qa("button", sheet()).find((item) => item.textContent === "All"));
    await click(button("Apply", sheet()));
    await settle();

    assert.equal(signals.length, 1);
    assert.equal(signals[0].aborted, true);
  });
});

describe("Activity: read-only", () => {
  it("never sends anything but a GET, in any state, and touches no read-marking or side-effect endpoint", async () => {
    await openActivity();
    await click(button("Load more"));
    await settle();
    await click(q(".sm-toolbar button"));
    await settle();
    await click(button("Apply", sheet()));
    await settle();
    await click(q("[data-sm-tx]"));
    await settle();

    assert.deepEqual(api.violations, []);
    const allowed = new Set(["/transactions", "/accounts", "/categories"]);
    for (const call of api.calls) {
      assert.equal(call.method, "GET");
      assert.equal(call.hasBody, false);
      assert.ok(allowed.has(call.path) || /^\/transactions\/\d+$/.test(call.path), call.path);
    }
    assert.equal(api.calls.some((call) => /notification|read|seen|ack|confirm|review|mark/.test(call.path)), false);
  });

  it("the Add sheet and the whole screen offer no form that records money", async () => {
    await openActivity();
    assert.equal(qa("form", q("main")).length, 0);
    assert.equal(qa("textarea, input[type='number'], input[type='text'], input[type='tel']", q("main")).length, 0);
  });
});

describe("Activity: after the person goes", () => {
  it("a response that arrives after the screen was left changes nothing and sends nothing more", async () => {
    let release;
    api.restore();
    api = installFakeApi((call) => (call.path === "/transactions" ? new Promise((resolve) => { release = () => resolve(transactionsBackend(fixture())(call)); }) : transactionsBackend(fixture())(call)));
    await openActivity();

    await click(qa("nav.sm-nav a").find((link) => link.textContent.trim() === "More"));
    await settle();
    const calls = api.calls.length;
    release();
    await settle();

    assert.equal(location(), "/m/more");
    assert.equal(qa("[data-sm-tx]").length, 0);
    assert.equal(api.calls.length, calls);
  });

  it("uses Back to return to Activity with its filters", async () => {
    await openActivity("?type=expense");
    await click(q("[data-sm-tx]"));
    await settle();
    await goBack();
    await settle();
    assert.equal(location(), "/m/activity?type=expense");
    assert.equal(qa(".sm-chips .sm-chip-button").length > 0, true);
  });
});

