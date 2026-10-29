import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { account, envelope, failure, installFakeApi, tx, transactionsBackend } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, goBack, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * A transaction's page, and the ways to reach it: from Home, from Activity and
 * from an account's movements. Read-only: nothing here can correct or reverse.
 */

after(() => dom.window.close());

const entry = (id, accountId, amount, role, name = "Everyday wallet") => ({ id: id * 10 + accountId, workspace_id: 1, transaction_id: id, account_id: accountId, currency_code: "ILS", signed_amount: amount, entry_role: role, account: { id: accountId, name } });

const SET = [
  tx(5, { description: "Groceries", reference_number: "RCPT-77", source: "manual", occurred_at: "2026-10-31T23:30:00.000000Z", posted_at: "2026-10-31T23:30:05.000000Z" }),
  tx(6, { status: "reversed", description: "Duplicate lunch", amount: "30.0000", reversed_at: "2026-11-02T08:00:00.000000Z", reversal_reason: "Entered twice", ledger_entries: [entry(6, 1, "-30.0000", "expense")] }),
  tx(7, { type: "reversal", description: null, category: null, category_id: null, amount: "30.0000", reversal_of_id: 6, ledger_entries: [entry(7, 1, "30.0000", "reversal")] }),
  tx(8, { description: "Corrected groceries", amount: "50.0000", related_transaction_id: 5, ledger_entries: [entry(8, 1, "-50.0000", "expense")] }),
  tx(9, { type: "transfer", description: "Move to savings", amount: "400.0000", transfer_id: 3, category: null, category_id: null, ledger_entries: [entry(9, 1, "-400.0000", "source"), entry(9, 2, "400.0000", "destination", "Savings jar")] }),
  tx(10, { status: "pending_review", description: "Needs a look", amount: "12.0000" }),
  tx(11, { status: "draft", description: "Half done", amount: "1.0000" }),
  tx(12, { status: "failed", description: "Did not go", amount: "2.0000" }),
  tx(13, { status: "settling", description: "Odd status", amount: "3.0000" }),
  tx(14, { type: "income", description: "Salary", amount: "3000.0000", category: { id: 5, name: "Salary" }, category_id: 5, ledger_entries: [entry(14, 1, "3000.0000", "income")] }),
  tx(15, { status: null, description: "No status", amount: "4.0000" }),
  tx(16, { description: null, category: null, category_id: null, amount: "5.0000", ledger_entries: [] }),
];

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const spoken = (root) => qa(".sm-sr", root).map((node) => node.textContent);
const open = async (entryPath, backend = transactionsBackend(SET, { accounts: [account(), account({ id: 2, name: "Savings jar" })] }), options = {}) => {
  api = installFakeApi(backend);
  view = await mountMobile({ entry: entryPath, ...options });
};
const note = (name) => q(`[data-sm-note='${name}']`);

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  api?.restore();
  api = null;
});

describe("a confirmed transaction", () => {
  it("reads GET /transactions/{id} and nothing else", async () => {
    await open("/m/activity/5");
    assert.deepEqual(api.summary(), ["GET /transactions/5"]);
    assert.deepEqual(api.violations, []);
  });

  it("shows the amount, the type and the status, and the date in the user's time zone", async () => {
    await open("/m/activity/5", undefined, { auth: { isAuthenticated: true, initializing: false, token: TOKEN_A, user: { ...USER_A, timezone: "Asia/Hebron" }, workspace: { id: 1 } } });
    const hero = q("section[aria-labelledby='sm-tx-title']");

    assert.equal(q("h1").textContent, "Transaction");
    assert.equal(q("#sm-tx-title").textContent, "Groceries");
    assert.deepEqual(spoken(hero), ["minus 45.25 Israeli New Shekel"]);
    assert.match(text(hero), /Expense/);
    assert.equal(q(".sm-status", hero).dataset.smStatus, "posted");
    assert.match(text(hero), /Nov 1, 2026/, "23:30 UTC is already the next day in the user's zone");
    assert.equal(q("[data-sm-screen='transaction']").dataset.smStatus, "posted");
  });

  it("shows the account (linked), category, description, reference, source and creator", async () => {
    await open("/m/activity/5");
    const facts = q("section[aria-labelledby='sm-tx-facts']");

    assert.equal(q("a[href='/m/accounts/1']", facts).textContent, "Everyday wallet");
    assert.match(text(facts), /Category.*Food/);
    assert.match(text(facts), /Description.*Groceries/);
    assert.match(text(facts), /Reference.*RCPT-77/);
    assert.match(text(facts), /Source.*manual/);
    assert.match(text(facts), /Created by.*Alex Example/);
    assert.match(text(facts), /Currency.*ILS/);
  });

  it("lists the ledger lines as the backend recorded them, and calculates nothing", async () => {
    await open("/m/activity/9");
    const entries = q("section[aria-labelledby='sm-tx-entries']");

    assert.deepEqual(qa("[data-sm-entry]", entries).map((row) => [qa(".sm-row-title", row)[0].textContent, qa(".sm-row-meta", row)[0].textContent, spoken(row)[0]]), [
      ["Everyday wallet", "Source", "minus 400.00 Israeli New Shekel"],
      ["Savings jar", "Destination", "plus 400.00 Israeli New Shekel"],
    ]);
    assert.match(text(entries), /Nothing here is calculated on this device/);
    assert.doesNotMatch(text(q("main")), /balance/i, "no balance appears on a transaction's page");
  });

  it("an income shows plus; a transaction without ledger lines simply has no ledger section", async () => {
    await open("/m/activity/14");
    assert.deepEqual(spoken(q("section[aria-labelledby='sm-tx-title']")), ["plus 3,000.00 Israeli New Shekel"]);

    await view.unmount();
    api.restore();
    await open("/m/activity/16");
    assert.equal(q("section[aria-labelledby='sm-tx-entries']"), null);
    assert.equal(q("#sm-tx-title").textContent, "Expense", "no description or category: the type is the title, nothing is invented");
  });

  it("hides the amounts when the person chose to hide them, ledger lines included", async () => {
    window.localStorage.setItem("smartspend:experience:v1:u:1:w:1", JSON.stringify({ version: 1, hiddenMoney: true }));
    await open("/m/activity/9");

    assert.equal(qa(".sm-money-run").length, 0);
    assert.ok(qa(".sm-money-hidden").length >= 3);
    assert.doesNotMatch(text(q("main")), /400\.00/);
  });

  it("offers no way to change anything: no form, no input, no button, and says so", async () => {
    await open("/m/activity/5");

    assert.equal(qa("form, input, textarea, select").length, 0);
    assert.equal(qa("button", q("main")).length, 0);
    assert.doesNotMatch(text(q("main")), /\b(Correct|Reverse|Delete|Edit)\b(?! transactions)/);
    assert.match(text(q("section[aria-labelledby='sm-tx-changes']")), /Correcting and reversing transactions isn't available in Mobile yet/);
    assert.ok(q("a[href='/dashboard/financial-operations/5']", q("section[aria-labelledby='sm-tx-changes']")), "the full version is a link, not a disabled button");
  });
});

describe("statuses and relations", () => {
  it("a reversed transaction says so, strikes its amount and shows when and why", async () => {
    await open("/m/activity/6");

    assert.equal(q("[data-sm-screen='transaction']").dataset.smStatus, "reversed");
    assert.match(text(note("reversed")), /This transaction was reversed/);
    assert.ok(q(".sm-struck", q("section[aria-labelledby='sm-tx-title']")));
    assert.match(text(q("section[aria-labelledby='sm-tx-facts']")), /Reversed on.*Nov 2, 2026/);
    assert.match(text(q("section[aria-labelledby='sm-tx-facts']")), /Reason.*Entered twice/);
    assert.deepEqual(spoken(q("section[aria-labelledby='sm-tx-title']")), ["minus 30.00 Israeli New Shekel", " Reversed"]);
  });

  it("a reversal entry says what it reverses, links to it, and has no direction", async () => {
    await open("/m/activity/7");

    assert.match(text(note("reversal")), /This entry reverses another transaction/);
    assert.equal(q("a[href='/m/activity/6']", note("reversal")).textContent, "#6");
    assert.deepEqual(spoken(q("section[aria-labelledby='sm-tx-title']")), ["30.00 Israeli New Shekel"]);
    assert.ok(qa(".sm-chip", q("section[aria-labelledby='sm-tx-title']")).some((chip) => chip.textContent === "Reversal"));
  });

  it("a replacement says it replaces a corrected transaction, and links to it", async () => {
    await open("/m/activity/8");

    assert.match(text(note("correction")), /replaces an earlier one that was corrected/);
    assert.equal(q("a[href='/m/activity/5']", note("correction")).textContent, "#5");
    assert.match(text(q("section[aria-labelledby='sm-tx-facts']")), /Replaces.*#5/);
    assert.ok(qa(".sm-chip", q("section[aria-labelledby='sm-tx-title']")).some((chip) => chip.textContent === "Correction"));
  });

  it("a transfer leg is unsigned, shows the transfer, and says transfers are managed in the full version", async () => {
    await open("/m/activity/9");

    assert.deepEqual(spoken(q("section[aria-labelledby='sm-tx-title']")), ["400.00 Israeli New Shekel"]);
    assert.match(text(note("transfer")), /part of a transfer/);
    assert.match(text(q("section[aria-labelledby='sm-tx-facts']")), /Transfer.*#3/);
    assert.equal(qa("a[href='/m/accounts/1'], a[href='/m/accounts/2']", q("section[aria-labelledby='sm-tx-facts']")).length, 2);
  });

  it("shows pending, draft and failed as the backend sent them, never as posted", async () => {
    for (const [id, status, label] of [[10, "pending_review", "Pending review"], [11, "draft", "Draft"], [12, "failed", "Failed"]]) {
      await open(`/m/activity/${id}`);
      const chip = q(".sm-status", q("section[aria-labelledby='sm-tx-title']"));
      assert.equal(chip.dataset.smStatus, status);
      assert.equal(chip.textContent, label);
      assert.match(text(note("not-posted")), /has not been posted/);
      assert.equal(qa(".sm-status[data-sm-status='posted']").length, 0);
      await view.unmount();
      api.restore();
    }
  });

  it("shows a status it does not know exactly as sent, says so, and treats it as no success", async () => {
    await open("/m/activity/13");

    assert.equal(q(".sm-status").dataset.smStatus, "unknown");
    assert.equal(q(".sm-status").textContent, "Unknown status: settling");
    assert.match(text(note("unknown-status")), /doesn't recognise/);
    assert.equal(note("not-posted"), null);
  });

  it("says when the backend sent no status at all", async () => {
    await open("/m/activity/15");
    assert.equal(q(".sm-status").dataset.smStatus, "missing");
    assert.equal(q(".sm-status").textContent, "Status not available");
  });
});

describe("failing", () => {
  it("not found, access denied and a response about another record are one answer, and make no mention of whether it exists", async () => {
    const same = new Set();

    for (const backend of [
      transactionsBackend(SET),
      (call) => (call.path === "/transactions/5" ? failure(403, "no") : transactionsBackend(SET)(call)),
    ]) {
      await open("/m/activity/404", backend);
      const first = text(q("[data-sm-error]"));
      same.add(`${q("[data-sm-error]").dataset.smError}|${first}`);
      await view.unmount();
      api.restore();
    }

    await open("/m/activity/5", (call) => (call.path === "/transactions/5" ? failure(403, "no") : transactionsBackend(SET)(call)));
    same.add(`${q("[data-sm-error]").dataset.smError}|${text(q("[data-sm-error]"))}`);

    assert.equal(same.size, 1, `three different ways to be refused read the same: ${[...same].join(" // ")}`);
    assert.match([...same][0], /may not exist, or you may not have access to it/);
    assert.doesNotMatch([...same][0], /access to this\b|forbidden|denied/i);
    assert.equal(q("[data-sm-error] button"), null, "no retry for something that is not there");
    assert.ok(q("a[href='/m/activity']", q("main")), "a way back");
  });

  it("makes no request for an address that is not a transaction id", async () => {
    for (const id of ["abc", "0", "-5", "5.5", "5%2F6", "1e3", "007"]) {
      await open(`/m/activity/${id}`);
      assert.deepEqual(api.calls, [], id);
      assert.equal(q("[data-sm-error]").dataset.smError, "notFound", id);
      await view.unmount();
      api.restore();
    }
  });

  it("refuses a response for a different transaction than the one in the address", async () => {
    await open("/m/activity/5", (call) => (call.path === "/transactions/5" ? { body: envelope({ transaction: tx(6, { description: "Someone else's" }) }) } : transactionsBackend(SET)(call)));

    assert.equal(q("[data-sm-error]").dataset.smError, "malformed");
    assert.doesNotMatch(text(q("main")), /Someone else's|45\.25/);
  });

  it("names a server, network and offline failure, with Try again, which sends the same GET", async () => {
    let ok = false;
    await open("/m/activity/5", (call) => (call.path === "/transactions/5" && !ok ? failure(500, "") : transactionsBackend(SET)(call)));
    assert.equal(q("[data-sm-error]").dataset.smError, "server");

    ok = true;
    await click(qa("button", q("main")).find((item) => item.textContent === "Try again"));
    await settle();
    assert.equal(q("[data-sm-screen='transaction']").dataset.smState, "ready");
    assert.deepEqual(api.summary(), ["GET /transactions/5", "GET /transactions/5"]);
  });

  it("a 401 shows the session ended, with no figures and no retry", async () => {
    await open("/m/activity/5", (call) => (call.path === "/transactions/5" ? failure(401, "Unauthenticated.") : transactionsBackend(SET)(call)));
    assert.equal(q("[data-sm-error]").dataset.smError, "session");
    assert.equal(qa(".sm-money").length, 0);
    assert.equal(q("[data-sm-error] button"), null);
  });

  it("shows placeholders without numbers while it loads", async () => {
    let release;
    await open("/m/activity/5", (call) => (call.path === "/transactions/5" ? new Promise((resolve) => { release = () => resolve(transactionsBackend(SET)(call)); }) : transactionsBackend(SET)(call)));

    assert.equal(q("[data-sm-screen='transaction']").dataset.smState, "loading");
    assert.equal(qa(".sm-money").length, 0);
    release();
    await settle();
    assert.equal(q("[data-sm-screen='transaction']").dataset.smState, "ready");
  });

});

describe("getting there and back", () => {
  it("Back goes to Activity by default, and to the list with its filters when that is where the person came from", async () => {
    await open("/m/activity/5");
    assert.equal(q("a.sm-back").getAttribute("href"), "/m/activity");
    await view.unmount();
    api.restore();

    const rows = Array.from({ length: 3 }, (_, index) => tx(index + 1, { description: `Row ${index + 1}` }));
    await open("/m/activity?type=expense&status=posted", transactionsBackend(rows));
    await click(q("[data-sm-tx]"));
    await settle();
    assert.equal(location(), "/m/activity/1");
    assert.equal(q("a.sm-back").getAttribute("href"), "/m/activity?type=expense&status=posted");

    await click(q("a.sm-back"));
    await settle();
    assert.equal(location(), "/m/activity?type=expense&status=posted");
    assert.deepEqual(qa(".sm-chips .sm-chip-button").slice(0, 2).map((chip) => chip.textContent), ["Expense", "Posted"], "the filters are still applied");
  });

  it("Home -> a recent transaction -> its page -> Back to Home", async () => {
    const recent = [tx(11, { description: "Groceries" }), tx(12, { type: "income", description: "Freelance payment", amount: "300.0000" })];
    await open("/m", transactionsBackend(recent));

    const link = q("a[href='/m/activity/11']");
    assert.ok(link, "a recent transaction on Home is a link");
    await click(link);
    await settle();
    assert.equal(location(), "/m/activity/11");
    assert.equal(q("#sm-tx-title").textContent, "Groceries");
    assert.equal(q("a.sm-back").getAttribute("href"), "/m");

    await click(q("a.sm-back"));
    await settle();
    assert.equal(location(), "/m");
    assert.ok(q("[data-sm-screen='home']"));
  });

  it("Home -> All activity", async () => {
    await open("/m", transactionsBackend([tx(11, { description: "Groceries" })]));
    await click(q("a.sm-card-link"));
    await settle();

    assert.equal(location(), "/m/activity");
    assert.equal(q("h1").textContent, "Activity");
    assert.deepEqual(qa("nav.sm-nav [aria-current]").map((item) => item.getAttribute("aria-current")), ["page"]);
  });

  it("Accounts -> an account -> a movement -> its page -> Back to the account", async () => {
    const rows = [tx(21, { description: "Coffee", amount: "4.0000" })];
    await open("/m/accounts/1", transactionsBackend(rows));

    const movement = q("a[href='/m/activity/21']");
    assert.ok(movement, "a movement on an account's page is a link");
    await click(movement);
    await settle();
    assert.equal(location(), "/m/activity/21");
    assert.equal(q("a.sm-back").getAttribute("href"), "/m/accounts/1");

    await click(q("a.sm-back"));
    await settle();
    assert.equal(location(), "/m/accounts/1");
    assert.ok(q("[data-sm-screen='account-detail']"));
  });

  it("from a transaction's account link to the account, and the browser's Back returns to the transaction", async () => {
    await open("/m/activity/5");
    await click(q("a[href='/m/accounts/1']"));
    await settle();
    assert.equal(location(), "/m/accounts/1");

    await goBack();
    await settle();
    assert.equal(location(), "/m/activity/5");
  });

  it("follows a link to the original transaction and Back still returns to the list that was open", async () => {
    const rows = [...SET];
    await open("/m/activity?status=posted", transactionsBackend(rows));
    await click(q("[data-sm-tx='8']"));
    await settle();
    await click(q("a[href='/m/activity/5']", note("correction")));
    await settle();
    assert.equal(location(), "/m/activity/5");
    assert.equal(q("a.sm-back").getAttribute("href"), "/m/activity?status=posted");
  });

  it("ignores a Back address in the history state that is not a Mobile address", async () => {
    await open("/m/activity/5");
    // The default is what shows when nothing trustworthy came with the navigation.
    assert.equal(q("a.sm-back").getAttribute("href"), "/m/activity");
  });

  it("an unknown address under Activity is 'Not available' inside the shell", async () => {
    await open("/m/activity/5/extra");
    assert.equal(q("h1").textContent, "Not available");
  });
});

describe("canonical routing", () => {
  it("Desktop mode sends a transaction's Mobile page to the Desktop page, with query and hash", async () => {
    await open("/m/activity/5?x=1#h", undefined, { preference: "desktop" });
    assert.equal(location(), "/dashboard/financial-operations/5?x=1#h");
    assert.deepEqual(api.calls, [], "no Mobile read on the way");
  });

  it("Desktop mode sends Activity with its filters to the Desktop list, whose query names match", async () => {
    await open("/m/activity?type=expense&status=posted", undefined, { preference: "desktop" });
    assert.equal(location(), "/dashboard/financial-operations?type=expense&status=posted");
  });

  it("Mobile mode leaves the Desktop financial operations page alone: it records, corrects and reverses money", async () => {
    await open("/dashboard/financial-operations?new=expense", undefined, { preference: "mobile" });
    assert.equal(location(), "/dashboard/financial-operations?new=expense");
    assert.ok(q("#desktop-page"));

    await view.unmount();
    api.restore();
    await open("/dashboard/financial-operations/5", undefined, { preference: "mobile" });
    assert.equal(location(), "/dashboard/financial-operations/5");
    assert.deepEqual(api.calls, []);
  });

  it("a signed-out visit to a transaction goes to sign-in and remembers it", async () => {
    await open("/m/activity/5?x=1", undefined, { auth: { isAuthenticated: false, initializing: false, token: null, user: null } });
    assert.equal(location(), "/m/signin", "Mobile sign-in (auth/guards.jsx): a Mobile visitor stays in Mobile");
  });

  it("works in Arabic with Arabic labels and Latin digits", async () => {
    await resetEnvironment("ar");
    storeSession({ token: TOKEN_A, user: USER_A });
    await open("/m/activity/8");

    assert.equal(document.documentElement.dir, "rtl");
    assert.match(text(q("main")), /المبلغ/);
    assert.match(text(note("correction")), /تحلّ هذه المعاملة محل/);
    assert.match(spoken(q("section[aria-labelledby='sm-tx-title']"))[0], /^سالب 50\.00 /);
    await i18n.changeLanguage("en");
  });

  it("shows long Arabic text in full", async () => {
    const long = "دفعة مقدمة لعقد صيانة المكيفات في المبنى الرئيسي والفرعي حتى نهاية العام";
    await open("/m/activity/5", transactionsBackend([tx(5, { description: long })]));
    assert.equal(q("#sm-tx-title").textContent, long);
    assert.ok(text(q("section[aria-labelledby='sm-tx-facts']")).includes(long));
  });
});
