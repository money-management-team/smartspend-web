import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { debt, event, moreBackend, notification, payment, transfer } from "./helpers/moreFixture.mjs";
import { click } from "./helpers/dom.mjs";

/*
 * Debts, transfers, notifications and the calendar on Mobile, against a fake
 * backend with fictional data. Every request must be a GET (installFakeApi
 * refuses anything else), and every figure must be the backend's own.
 */

after(() => dom.window.close());

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, data) => {
  api?.restore();
  api = installFakeApi(typeof data === "function" ? data : moreBackend(data));
  view = await mountMobile({ entry });
};
const button = (label, root = q("main")) => qa("button", root).find((item) => item.textContent.trim() === label);

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

describe("Debts", () => {
  const debts = () => [
    debt(1),
    debt(2, { direction: "receivable", counterparty_name: "Sam", status: "active", effective_status: "overdue", is_overdue: true, original_amount: "300.0000", paid_amount: "0.0000", remaining_amount: "300.0000", currency_code: "USD" }),
    debt(3, { status: "paid", effective_status: "paid", paid_amount: "1500.0000", remaining_amount: "0.0000" }),
  ];

  it("lists the backend's debts and figures, per currency, with nothing added up", async () => {
    await open("/m/planning/debts", { debts: debts() });
    assert.equal(qa("[data-sm-debt]").length, 3);
    const call = api.calls.find((item) => item.path === "/debts");
    assert.deepEqual(call.query, { per_page: "20", page: "1" }, "no workspace stored in this session, so none is sent");
    const overdue = q("[data-sm-debt='2']");
    assert.equal(overdue.dataset.smStatus, "overdue");
    assert.match(text(overdue), /Owed to me/);
    assert.match(text(overdue), /300\.00/);
    assert.match(text(overdue), /USD|\$/);
    assert.doesNotMatch(text(q("main")), /1,300|1300/, "no total across debts or currencies");
  });

  it("filters by direction and status in the address, sending only documented filters", async () => {
    await open("/m/planning/debts", { debts: debts() });
    await click(button("Owed to me"));
    await settle();
    assert.equal(location(), "/m/planning/debts?direction=receivable");
    assert.equal(qa("[data-sm-debt]").length, 1);
    const last = api.calls.filter((item) => item.path === "/debts").at(-1);
    assert.deepEqual(Object.keys(last.query).sort(), ["direction", "page", "per_page"]);
  });

  it("a debt's page: the backend's remaining, original and paid, the latest payments, reversed ones marked, and no payment button", async () => {
    await open("/m/planning/debts/1", { debts: debts(), payments: { 1: [payment(1, 1), payment(2, 1, { status: "reversed", is_reversed: true })] } });
    assert.equal(q("[data-sm-screen='debt']").dataset.smRecord, "1");
    const main = text(q("main"));
    assert.match(main, /1,000\.00/);
    assert.match(main, /1,500\.00/);
    assert.match(main, /500\.00/);
    assert.equal(qa("[data-sm-payment]").length, 2);
    assert.equal(q("[data-sm-payment='2']").dataset.smStatus, "reversed");
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "debt.payment");
    assert.equal(qa("button", q("main")).filter((item) => /payment|collection/i.test(item.textContent)).length, 0);
    assert.deepEqual(api.calls.map((call) => call.path).sort(), ["/debts/1", "/debts/1/payments"]);
    assert.deepEqual(api.calls.find((call) => call.path === "/debts/1/payments").query, { per_page: "10", page: "1" });
  });

  it("a payment in another currency than its debt makes the history unavailable, never mixed in", async () => {
    await open("/m/planning/debts/1", { debts: debts(), payments: { 1: [payment(1, 1, { currency_code: "USD" })] } });
    assert.equal(qa("[data-sm-payment]").length, 0);
    assert.ok(q("[aria-labelledby='sm-debt-payments'] .sm-error"));
  });

  it("an answer about another debt is refused; an id that is not a number is not even asked for", async () => {
    await open("/m/planning/debts/1", () => ({ body: { status: true, data: { debt: debt(9) } } }));
    assert.equal(q("[data-sm-screen='debt']").dataset.smState, "error");
    await view.unmount();
    view = null;
    await open("/m/planning/debts/abc", { debts: debts() });
    assert.equal(q("[data-sm-screen='debt']").dataset.smState, "error");
    assert.deepEqual(api.calls, []);
  });

  it("an amount that is not a decimal string is shown as unavailable, not as zero", async () => {
    await open("/m/planning/debts/1", { debts: [debt(1, { remaining_amount: 1000 })] });
    assert.ok(q(".sm-hero .sm-money-na"));
  });
});

describe("Transfers", () => {
  it("lists transfers newest first as sent, with a fee only when it is not zero", async () => {
    await open("/m/transfers", { transfers: [transfer(2, { fee_amount: "5.0000" }), transfer(1)] });
    assert.deepEqual(qa("[data-sm-transfer]").map((row) => row.dataset.smTransfer), ["2", "1"]);
    assert.match(text(q("[data-sm-transfer='2']")), /Fee/);
    assert.doesNotMatch(text(q("[data-sm-transfer='1']")), /Fee/);
    assert.deepEqual(Object.keys(api.calls[0].query).sort(), ["page", "per_page"], "no invented workspace filter");
  });

  it("reads an old 'confirmed' link as posted and sends posted", async () => {
    await open("/m/transfers?status=confirmed", { transfers: [transfer(1)] });
    assert.equal(api.calls[0].query.status, "posted");
  });

  it("a transfer's page shows what was recorded for each account, and no reverse button", async () => {
    const detail = transfer(4, { transactions: [{ id: 6, type: "transfer", status: "posted", ledger_entries: [{ account_id: 2, signed_amount: "-400.0000", entry_role: "transfer_out" }, { account_id: 1, signed_amount: "400.0000", entry_role: "transfer_in" }] }] });
    await open("/m/transfers/4", { transfers: [detail] });
    assert.equal(q("[data-sm-screen='transfer']").dataset.smState, "ready");
    assert.match(text(q("[data-sm-tx='6']")), /Bank.*−400\.00.*Cash.*\+400\.00/);
    assert.ok(qa("a", q("[data-sm-tx='6']")).some((link) => link.getAttribute("href") === "/m/activity/6"));
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "transfer.reverse");
  });
});

describe("Notifications", () => {
  it("shows the inbox without marking anything read, and links only to pages Mobile has", async () => {
    await open("/m/notifications", { notifications: [notification(1), notification(2, { is_read: true, subject_type: "mystery", subject_id: 5 })] });
    assert.equal(qa("[data-sm-notification]").length, 2);
    assert.equal(q("[data-sm-notification='1']").dataset.smRead, "false");
    assert.ok(qa("a", q("[data-sm-notification='1']")).some((link) => link.getAttribute("href") === "/m/planning/recurring/3"));
    assert.equal(qa("a", q("[data-sm-notification='2']")).length, 0, "an unknown subject has no link");
    assert.deepEqual(api.summary(), ["GET /notifications"], "listing is the only request: no mark-read");
    assert.equal(api.calls[0].query.workspace_id, undefined);
  });

  it("filters unread through the address", async () => {
    await open("/m/notifications", { notifications: [notification(1), notification(2, { is_read: true })] });
    await click(button("Unread"));
    await settle();
    assert.equal(location(), "/m/notifications?status=unread");
    assert.equal(qa("[data-sm-notification]").length, 1);
  });

  it("an empty inbox says so; a failed read offers Retry", async () => {
    await open("/m/notifications", { notifications: [] });
    assert.equal(q("[data-sm-screen='notifications']").dataset.smState, "empty");
    await view.unmount();
    view = null;
    await open("/m/notifications", () => failure(500, "boom"));
    assert.equal(q("[data-sm-screen='notifications']").dataset.smState, "error");
    assert.ok(button("Try again") ?? qa("button", q("main")).length);
  });
});

describe("Calendar", () => {
  it("asks for the month in the address and lists its events by day", async () => {
    await open("/m/planning/calendar?month=2026-11", { events: [event(1, "2026-11-20"), event(2, "2026-11-03"), event(3, "2026-11-20", { type: "budget_period_end", amount: undefined, currency_code: undefined, subject_type: "budget", subject_id: 7 })] });
    assert.deepEqual(api.calls[0].query, { month: "11", year: "2026", view: "month" });
    assert.equal(q("[data-sm-screen='calendar']").dataset.smMonth, "2026-11");
    assert.deepEqual(qa("[data-sm-event]").map((row) => row.dataset.smEvent), ["debt_due:2", "debt_due:1", "debt_due:3"]);
    assert.ok(qa("a[href='/m/planning/budgets/7']").length === 1);
  });

  it("moves to the next month and back with the buttons, and refuses months the backend does not accept", async () => {
    await open("/m/planning/calendar?month=2026-12", { events: [] });
    await click(q("button[aria-label='Next month']"));
    await settle();
    assert.equal(location(), "/m/planning/calendar?month=2027-01");
    assert.equal(api.calls.at(-1).query.year, "2027");
    await view.unmount();
    view = null;
    await open("/m/planning/calendar?month=2100-12", { events: [] });
    assert.equal(q("button[aria-label='Next month']").disabled, true);
  });

  it("an amount without a currency is shown as sent, never in a guessed currency", async () => {
    await open("/m/planning/calendar?month=2026-11", { events: [event(1, "2026-11-20", { currency_code: null, amount: "55.5000" })] });
    const row = text(q("[data-sm-event='debt_due:1']"));
    assert.match(row, /55\.5000/);
    assert.doesNotMatch(row, /ILS|₪/);
  });

  it("a period for another month is refused", async () => {
    await open("/m/planning/calendar?month=2026-11", () => ({ body: { status: true, data: { period: { from: "2026-10-01" }, events: [] } } }));
    assert.equal(q("[data-sm-screen='calendar']").dataset.smState, "error");
  });
});

describe("Ways in", () => {
  it("Planning links to the Mobile debts and calendar; More to transfers and notifications", async () => {
    await open("/m/planning", () => ({ body: { status: true, data: { alerts: [], budgets: { data: [], total: 0, current_page: 1, last_page: 1, per_page: 20, from: null, to: null } } } }));
    assert.equal(qa("a[href='/m/planning/debts']").length, 1);
    assert.equal(qa("a[href='/m/planning/calendar']").length, 1);
    await view.unmount();
    view = null;
    await open("/m/more", () => ({ body: { status: true, data: {} } }));
    assert.equal(qa("a[href='/m/transfers']").length, 1);
    assert.equal(qa("a[href='/m/notifications']").length, 1);
  });

  it("the app bar names each page", async () => {
    for (const [entry, title] of [["/m/planning/debts", "Debts"], ["/m/transfers", "Transfers"], ["/m/notifications", "Notifications"], ["/m/planning/calendar", "Calendar"]]) {
      await open(entry, {});
      assert.equal(q(".sm-bar-title").textContent, title, entry);
      await view.unmount();
      view = null;
    }
  });
});
