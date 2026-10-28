import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { envelope, failure, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } from "./helpers/mobileHarness.mjs";
import { paginator } from "./helpers/planningFixture.mjs";
import { click } from "./helpers/dom.mjs";

const { barLengths, buildReport, readReportRange } = await import("../src/mobile/models/reports.js");

/* Reports, the export history and imports on Mobile: fictional data, GET only, the backend's figures per currency. */

after(() => dom.window.close());

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, handler) => {
  api?.restore();
  api = installFakeApi(handler);
  view = await mountMobile({ entry });
};

beforeEach(async () => {
  await resetEnvironment();
  storeSession({ token: TOKEN_A, user: USER_A });
});
afterEach(async () => {
  await view?.unmount();
  view = null;
  assert.deepEqual(api?.violations ?? [], []);
  api?.restore();
  api = null;
});

const incomeExpense = { report: "income-expense", period: { date_from: "2026-10-01", date_to: "2026-10-28" }, summary_by_currency: [{ currency_code: "ILS", total_income: "5000.0000", total_expense: "1250.5000", net_income: "3749.5000", transaction_count: 12 }, { currency_code: "USD", total_income: "100.0000", total_expense: "40.0000" }], analytics: {}, items: [], pagination: { current_page: 1, per_page: 10, total: 0, last_page: 1 } };

describe("Reports", () => {
  it("the hub lists the ten reports and the export history", async () => {
    await open("/m/reports", () => ({ body: envelope({}) }));
    assert.equal(qa("[data-sm-report]").length, 10);
    assert.equal(qa("a[href='/m/exports']").length, 1);
    assert.deepEqual(api.calls, []);
  });

  it("a report asks for the range in the address and shows each currency on its own, never a total across them", async () => {
    await open("/m/reports/income-expense?from=2026-10-01&to=2026-10-28", () => ({ body: envelope(incomeExpense) }));
    assert.deepEqual(api.calls[0].query, { from: "2026-10-01", to: "2026-10-28" });
    assert.equal(api.calls[0].path, "/reports/income-expense");
    assert.deepEqual(qa("[data-sm-currency]").map((node) => node.dataset.smCurrency), ["ILS", "USD"]);
    assert.match(text(q("[data-sm-currency='ILS']")), /5,000\.00.*1,250\.50.*3,749\.50.*12/);
    assert.match(text(q("[data-sm-currency='USD'] [data-sm-field='net_income']")), /Not available/, "a missing figure is not zero");
    assert.doesNotMatch(text(q("main")), /5,100/);
  });

  it("a reversed range in the address is not sent: this month is used instead", async () => {
    await open("/m/reports/cash-flow?from=2026-10-09&to=2026-10-01", () => ({ body: envelope({ report: "cash-flow", summary_by_currency: [] }) }));
    assert.match(api.calls[0].query.from, /^\d{4}-\d{2}-01$/);
    assert.ok(q("[data-sm-report-state='empty']"));
  });

  it("list reports show the first page of items and page through the backend's pagination", async () => {
    const accounts = (page) => ({ report: "accounts", summary_by_currency: [{ currency_code: "ILS", total_current_balance: "900.0000", accounts_count: 2 }], items: [{ account_id: page, name: `Account ${page}`, currency_code: "ILS", current_balance: "450.0000" }], pagination: { current_page: page, per_page: 10, total: 11, last_page: 2 } });
    await open("/m/reports/accounts?from=2026-10-01&to=2026-10-28", (call) => ({ body: envelope(accounts(Number(call.query.page ?? 1))) }));
    assert.deepEqual(api.calls[0].query, { from: "2026-10-01", to: "2026-10-28", per_page: "10" });
    assert.equal(qa("[data-sm-item]").length, 1);
    await click(qa("button", q("main")).find((node) => node.textContent === "Next page"));
    await settle();
    assert.match(location(), /page=2/);
    assert.equal(api.calls.at(-1).query.page, "2");
  });

  it("an answer for another report, or an unknown report type, is an error", async () => {
    await open("/m/reports/debts", () => ({ body: envelope({ ...incomeExpense }) }));
    assert.equal(q("[data-sm-screen='report']").dataset.smState, "error");
    await view.unmount();
    view = null;
    await open("/m/reports/nonsense", () => ({ body: envelope({}) }));
    assert.equal(q("[data-sm-screen='report']").dataset.smState, "error");
    assert.deepEqual(api.calls, []);
  });

  it("bars are integer percentages of the largest absolute figure, with no floats", () => {
    assert.deepEqual(barLengths(["5000.0000", "-1250.5000", "0.0000", "x"]), [100, 25, 0, null]);
    assert.deepEqual(barLengths(["0", "0"]), [0, 0]);
    assert.equal(buildReport({ report: "overview", summary_by_currency: { EUR: { total_income: "1.0000" } } }, "overview").currencies[0].currency, "EUR");
    assert.deepEqual(readReportRange("from=2026-02-30&to=2026-03-01", new Date(2026, 9, 28)), { from: "2026-10-01", to: "2026-10-28", custom: false });
  });
});

describe("Export history", () => {
  const exp = (id, over = {}) => ({ id, report: "overview", format: "csv", status: "completed", download_available: true, file_name: "overview.csv", created_at: "2026-10-20T10:00:00Z", filters: { from: "2026-10-01", to: "2026-10-20" }, ...over });

  it("offers Download only when the backend says the file is available; a queued export is never a file", async () => {
    await open("/m/exports", () => ({ body: envelope({ report_exports: paginator([exp(1), exp(2, { status: "queued", download_available: false }), exp(3, { download_available: false })]) }) }));
    assert.equal(q("[data-sm-export='1']").dataset.smDownloadable, "true");
    assert.equal(qa("button", q("[data-sm-export='2']")).length, 0);
    assert.match(text(q("[data-sm-export='2']")), /Not ready yet/);
    assert.equal(qa("button", q("[data-sm-export='3']")).length, 0, "completed without the flag: no download");
  });

  it("a failed download says so and sends nothing else", async () => {
    await open("/m/exports", (call) => (call.path.endsWith("/download") ? failure(500, "boom") : { body: envelope({ report_exports: paginator([exp(1)]) }) }));
    await click(qa("button", q("[data-sm-export='1']"))[0]);
    await settle();
    assert.match(text(q("[data-sm-export='1']")), /couldn't be downloaded/);
    assert.deepEqual(api.calls.map((call) => `${call.method} ${call.path}`), ["GET /report-exports", "GET /report-exports/1/download"]);
  });
});

describe("Imports", () => {
  const imp = (id, over = {}) => ({ id, original_filename: `statement-${id}.csv`, status: "completed", counts: { total: 10, valid: 9, invalid: 1, duplicate: 0, ignored: 1, imported: 9 }, created_at: "2026-10-01T09:00:00Z", ...over });

  it("lists imports and opens one with the backend's counts; processing is never called finished", async () => {
    await open("/m/imports", () => ({ body: envelope({ imports: paginator([imp(1), imp(2, { status: "processing" })]) }) }));
    assert.equal(qa("[data-sm-import]").length, 2);
    await view.unmount();
    view = null;
    await open("/m/imports/2", () => ({ body: envelope({ import: imp(2, { status: "processing" }) }) }));
    assert.ok(q("[data-sm-import-progress='true']"));
    assert.doesNotMatch(text(q(".sm-hero")), /says this import is completed/);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "import.confirm");
  });

  it("an answer about another import is refused", async () => {
    await open("/m/imports/2", () => ({ body: envelope({ import: imp(5) }) }));
    assert.equal(q("[data-sm-screen='import-detail']").dataset.smState, "error");
  });
});
