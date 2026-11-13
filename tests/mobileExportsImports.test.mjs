import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";

/*
 * Phase 6UI.5C6: export history and statement imports in detail. An export says where it stands (waiting, being built,
 * ready, failed, expired, cancelled) and offers its file only when the backend's own flag says there is one; an import
 * shows its stage, timeline, counts and, once checked, its rows. Fictional data only; every request is checked to be a GET.
 * The object-URL API is stubbed before Mobile loads, because jsdom has none.
 */

const saved = [];
URL.createObjectURL = () => "blob:smartspend-test";
URL.revokeObjectURL = () => {};

const { click } = await import("./helpers/dom.mjs");
const { failure, installFakeApi } = await import("./helpers/mobileApi.mjs");
const { TOKEN_A, USER_A, dom, i18n, location, mountMobile, q, qa, resetEnvironment, settle, storeSession } = await import("./helpers/mobileHarness.mjs");
const { exportRow, exportsImportsBackend, importBatch, importRow } = await import("./helpers/exportsImportsFixture.mjs");
const { buildExportDetail, buildImportRowsPage, exportHint, normalizeExport, normalizeImport, normalizeImportRow } = await import("../src/mobile/models/exportsImports.js");
const { paginator } = await import("./helpers/planningFixture.mjs");

dom.window.HTMLAnchorElement.prototype.click = function captureDownload() {
  if (this.download) saved.push(this.download);
};

after(() => dom.window.close());

let api;
let view;
const text = (root = document) => root.textContent.replace(/\s+/g, " ");
const open = async (entry, data) => {
  api?.restore();
  api = installFakeApi(typeof data === "function" ? data : exportsImportsBackend(data));
  view = await mountMobile({ entry });
};
const callsTo = (path) => api.calls.filter((call) => call.path === path);
const pdf = (name) => ({ status: 200, body: "%PDF-1.7 fictional", headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });

beforeEach(async () => {
  await resetEnvironment();
  saved.length = 0;
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
  it("an export's stage comes from its status and its own download flag only", () => {
    const stage = (over) => normalizeExport(exportRow(1, over)).stage;

    assert.equal(stage({ status: "queued", download_available: false }), "pending");
    assert.equal(stage({ status: "processing", download_available: false }), "processing");
    assert.equal(stage({ status: "completed" }), "ready");
    assert.equal(stage({ status: "completed", download_available: false }), "unavailable", "completed without the flag is not a file");
    assert.equal(stage({ status: "completed", download_available: "yes" }), "unavailable", "only a real true counts");
    assert.equal(stage({ status: "failed", download_available: false }), "failed");
    assert.equal(stage({ status: "expired", download_available: false }), "ended");
    assert.equal(stage({ status: "teleporting" }), null, "an unknown status has no stage");
    assert.equal(exportHint(normalizeExport(exportRow(1, { status: "completed", download_available: false }))), "unavailable");
    assert.equal(exportHint(normalizeExport(exportRow(1, { status: "queued", download_available: false }))), "queued");
    assert.equal(exportHint(normalizeExport(exportRow(1, { status: "teleporting" }))), null);
  });

  it("a failed export carries the backend's message and code; the file facts are read as sent", () => {
    const failed = normalizeExport(exportRow(3, { status: "failed", download_available: false, error: { code: "export_failed", message: "The report could not be built." }, file_name: undefined, file_size: undefined }));
    assert.equal(failed.errorMessage, "The report could not be built.");
    assert.equal(failed.errorCode, "export_failed");
    assert.equal(failed.fileSize, null);

    const ready = normalizeExport(exportRow(1));
    assert.equal(ready.fileSize, 2048);
    assert.equal(ready.currency, "ILS");
    assert.equal(normalizeExport(exportRow(1, { filters: { currency: "shekel" } })).currency, null);
  });

  it("an export page for another export is refused", () => {
    assert.equal(buildExportDetail(exportRow(1), "1").id, "1");
    assert.equal(buildExportDetail(exportRow(1), "2"), null);
    assert.equal(buildExportDetail(null, "1"), null);
  });

  it("an import's stage: pending is the person's turn, processing is SmartSpend's, done is only completed", () => {
    const stage = (status) => normalizeImport(importBatch(1, { status })).stage;

    assert.deepEqual(["uploaded", "mapping_required", "ready_for_review", "partially_valid"].map(stage), ["pending", "pending", "pending", "pending"]);
    assert.deepEqual(["validating", "confirmed", "processing"].map(stage), ["processing", "processing", "processing"]);
    assert.equal(stage("completed"), "done");
    assert.equal(stage("failed"), "failed");
    assert.deepEqual(["cancelled", "reversed"].map(stage), ["ended", "ended"]);
    assert.equal(stage("mystery"), null);
    assert.equal(normalizeImport(importBatch(1)).counts.failed, 0);
    assert.equal(normalizeImport(importBatch(1, { file_type: "pdf" })).fileType, null);
  });

  it("a row keeps its own amount and currency, the backend's messages, and never the statement's raw cells", () => {
    const row = normalizeImportRow(importRow(2, "5", { status: "invalid", amount: null, errors: [{ field: "amount", code: "amount_missing", message: "An amount is required." }, "plain text"] }), "5");

    assert.equal(row.amount, null);
    assert.deepEqual(row.errors, ["An amount is required.", "plain text"]);
    assert.equal(JSON.stringify(row).includes("must never be shown"), false);
    assert.equal(normalizeImportRow(importRow(2, "6"), "5"), null, "another import's row");
    assert.equal(normalizeImportRow({ ...importRow(2, "5"), row_number: 0 }, "5"), null);
    assert.equal(normalizeImportRow(importRow(2, "5", { amount: "4,2" }), "5").amount, null);
    assert.equal(normalizeImportRow(importRow(2, "5", { currency: "x" }), "5").amount, null, "no valid currency, no amount");
  });

  it("a rows page is refused whole for another import, a repeated row or another status than asked for", () => {
    const response = (rows, batch = { id: 5 }) => ({ status: true, data: { import: batch, rows: paginator(rows, { perPage: 10 }) } });
    const asked = { status: "", page: 1 };

    assert.equal(buildImportRowsPage(response([importRow(1, 5), importRow(2, 5)]), { id: "5" }, asked).rows.length, 2);
    assert.throws(() => buildImportRowsPage(response([importRow(1, 5)], { id: 9 }), { id: "5" }, asked), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildImportRowsPage(response([importRow(1, 6)]), { id: "5" }, asked), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildImportRowsPage(response([importRow(1, 5), importRow(1, 5)]), { id: "5" }, asked), { code: "MALFORMED_RESPONSE" });
    assert.throws(() => buildImportRowsPage(response([importRow(1, 5, { status: "valid" })]), { id: "5" }, { status: "invalid", page: 1 }), { code: "MALFORMED_RESPONSE" });
  });
});

describe("Export history", () => {
  const history = () => [
    exportRow(1),
    exportRow(2, { status: "queued", download_available: false, file_name: undefined, file_size: undefined, started_at: null, completed_at: null, expires_at: null }),
    exportRow(3, { status: "processing", download_available: false, file_name: undefined, file_size: undefined, completed_at: null, expires_at: null }),
    exportRow(4, { status: "completed", download_available: false }),
    exportRow(5, { status: "failed", download_available: false, file_name: undefined, file_size: undefined, error: { code: "export_failed", message: "The report could not be built." } }),
    exportRow(6, { status: "expired", download_available: false }),
    exportRow(7, { status: "cancelled", download_available: false, cancelled_at: "2026-10-20T10:01:00Z" }),
  ];

  it("says where each export stands, and gives the backend's reason for a failed one", async () => {
    await open("/m/exports", { exports: history() });

    const stage = (id) => q(`[data-sm-export='${id}']`).dataset.smStage;
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(stage), ["ready", "pending", "processing", "unavailable", "failed", "ended", "ended"]);
    assert.match(text(q("[data-sm-export='1']")), /Ready to download/);
    assert.match(text(q("[data-sm-export='2']")), /Waiting to start.*There is no file yet/);
    assert.match(text(q("[data-sm-export='3']")), /Being built.*There is no file yet/);
    assert.match(text(q("[data-sm-export='4']")), /File no longer available/);
    assert.match(text(q("[data-sm-export='5']")), /Failed.*Why it failed: The report could not be built\./);
    assert.match(text(q("[data-sm-export='6']")), /Expired/);
    assert.match(text(q("[data-sm-export='7']")), /Cancelled/);
  });

  it("offers Download only for the export the backend says has a file, with its size and how long it is available", async () => {
    await open("/m/exports", { exports: history() });

    assert.deepEqual(qa("[data-sm-export]").filter((row) => qa("button", row).length > 0).map((row) => row.dataset.smExport), ["1"]);
    assert.match(text(q("[data-sm-export='1'] [data-sm-export-file]")), /2 KB · Available until .*2099/);
    assert.equal(qa("[data-sm-export-file]").length, 1, "no file facts for an export without a file");
  });

  it("the status tabs cover all six statuses and ask the backend for the one chosen", async () => {
    await open("/m/exports", { exports: history() });
    for (const label of ["Waiting to start", "Being built", "Ready", "Failed", "Expired", "Cancelled"]) assert.ok(qa("button").some((item) => item.textContent.trim() === label), label);

    await click(qa("button").find((item) => item.textContent.trim() === "Expired"));
    await settle();
    assert.equal(location(), "/m/exports?status=expired");
    assert.deepEqual(qa("[data-sm-export]").map((row) => row.dataset.smExport), ["6"]);
    assert.equal(callsTo("/report-exports").at(-1).query.status, "expired");
  });

  it("an unknown status is shown as sent, with no stage and no download", async () => {
    await open("/m/exports", { exports: [exportRow(9, { status: "teleporting", download_available: true })] });
    const row = q("[data-sm-export='9']");

    assert.equal(row.dataset.smStage, "unknown");
    assert.match(text(row), /teleporting/);
    assert.equal(row.querySelector("[data-sm-hint]"), null, "no sentence is invented for it");
  });

  it("an export opens its own page", async () => {
    await open("/m/exports", { exports: history() });
    assert.equal(q("[data-sm-export='5'] [data-sm-link='export-details']").getAttribute("href"), "/m/exports/5");
  });

  it("says plainly when there are none, and when the read fails, and can retry", async () => {
    await open("/m/exports", { exports: [] });
    assert.equal(q("[data-sm-screen='exports']").dataset.smState, "empty");
    assert.match(text(q("main")), /No exports yet/);
    await view.unmount();

    let fail = true;
    const backend = exportsImportsBackend({ exports: history() });
    await open("/m/exports", (call) => (fail ? failure(500, "Server error") : backend(call)));
    assert.equal(q("[data-sm-screen='exports']").dataset.smState, "error");
    fail = false;
    await click(qa("button", q("main")).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(qa("[data-sm-export]").length, 7);
  });
});

describe("An export's page", () => {
  it("shows the file, the period, the currency, the times and the expiry, and downloads it under a safe name", async () => {
    await open("/m/exports/1", { exports: [exportRow(1)], files: { 1: pdf("..\\..\\reports/<evil>:report?.pdf") } });

    const screen = q("[data-sm-screen='export-detail']");
    assert.equal(screen.dataset.smRecord, "1");
    assert.equal(q(".sm-bar-title").textContent, "Export", "the app bar names the page");
    assert.match(text(screen), /Overview · CSV/);
    assert.match(text(screen), /Period\s*2026-10-01 – 2026-10-20/);
    assert.match(text(screen), /Currency\s*ILS/);
    assert.match(text(screen), /Size\s*2 KB/);
    assert.match(text(screen), /File\s*overview-1\.csv/);
    assert.match(text(screen), /Available until\s*Dec 1, 2099/);
    assert.match(text(screen), /Started.*Finished/);

    await click(q("[data-sm-action='download-export']"));
    await settle();
    assert.deepEqual(saved, ["evilreport.pdf"]);
    assert.match(text(q("[data-sm-screen='export-detail']")), /Downloaded/);
    assert.deepEqual(api.calls.map((call) => `${call.method} ${call.path}`), ["GET /report-exports/1", "GET /report-exports/1/download"]);
  });

  it("a download that is refused, gone or fails says so", async () => {
    for (const [status, word] of [[403, "denied"], [410, "gone"], [500, "failed"]]) {
      await open("/m/exports/1", { exports: [exportRow(1)], files: { 1: failure(status, "no") } });
      await click(q("[data-sm-action='download-export']"));
      await settle();
      assert.equal(q("[data-sm-download-error]").dataset.smDownloadError, word);
      await view.unmount();
      view = null;
    }
  });

  it("offers no download unless the backend's flag says there is a file", async () => {
    for (const over of [{ status: "queued", download_available: false }, { status: "completed", download_available: false }, { status: "expired", download_available: false }, { status: "failed", download_available: false }]) {
      await open("/m/exports/1", { exports: [exportRow(1, over)] });
      assert.equal(q("[data-sm-action='download-export']"), null, over.status);
      await view.unmount();
      view = null;
    }
  });

  it("a failed export shows the backend's reason and its reference", async () => {
    await open("/m/exports/5", { exports: [exportRow(5, { status: "failed", download_available: false, error: { code: "export_failed", message: "The report could not be built." } })] });

    const card = q("[data-sm-section='export-failure']");
    assert.match(text(card), /The report could not be built\./);
    assert.match(text(card), /Reference: export_failed/);
    assert.match(text(q("[data-sm-screen='export-detail']")), /SmartSpend couldn't build this file/);
  });

  it("a waiting or building export can be checked again, which re-reads it and nothing else", async () => {
    let status = "processing";
    const backend = (call) => exportsImportsBackend({ exports: [exportRow(3, { status, download_available: status === "completed" })] })(call);
    await open("/m/exports/3", backend);

    assert.match(text(q("[data-sm-screen='export-detail']")), /Being built/);
    assert.equal(q("[data-sm-action='download-export']"), null);
    status = "completed";
    await click(q("[data-sm-action='check-again']"));
    await settle();

    assert.equal(callsTo("/report-exports/3").length, 2);
    assert.match(text(q("[data-sm-screen='export-detail']")), /Ready to download/);
    assert.ok(q("[data-sm-action='download-export']"));
    assert.equal(q("[data-sm-action='check-again']"), null, "nothing left to wait for");
  });

  it("an answer about another export is refused, and an id that is not a number is not asked for", async () => {
    await open("/m/exports/1", () => ({ body: { status: true, data: exportRow(9) } }));
    assert.equal(q("[data-sm-screen='export-detail']").dataset.smState, "error");
    await view.unmount();
    view = null;

    await open("/m/exports/abc", { exports: [exportRow(1)] });
    assert.equal(q("[data-sm-screen='export-detail']").dataset.smState, "error");
    assert.deepEqual(api.calls, []);
  });

  it("keeps creating, cancelling and removing closed", async () => {
    await open("/m/exports/1", { exports: [exportRow(1)] });
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "export.create");
    assert.deepEqual(qa("button", q("main")).map((item) => item.textContent.trim()), [qa("button", q("main"))[0].textContent.trim()], "only the download button");
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    await open("/m/exports/5", { exports: [exportRow(5, { status: "failed", download_available: false, error: { code: "export_failed", message: "The report could not be built." } })] });

    assert.match(text(q("[data-sm-screen='export-detail']")), /فشل/);
    assert.match(text(q("[data-sm-screen='export-detail']")), /تعذّر على SmartSpend إنشاء هذا الملف/);
    assert.match(text(q("[data-sm-section='export-failure']")), /سبب الفشل/);
  });
});

describe("Imports", () => {
  const all = () => [
    importBatch(1),
    importBatch(2, { status: "mapping_required", is_editable: true, counts: { total: 0, valid: 0, invalid: 0, duplicate: 0, ignored: 0, imported: 0, failed: 0 }, mapped_at: null, validated_at: null, confirmed_at: null, completed_at: null }),
    importBatch(3, { status: "processing", completed_at: null }),
    importBatch(4, { status: "failed", failure_reason: "The file could not be read.", completed_at: null, counts: { total: 10, valid: 8, invalid: 1, duplicate: 0, ignored: 0, imported: 5, failed: 3 } }),
  ];

  it("the list says who is to move: waiting for the person, or SmartSpend working", async () => {
    await open("/m/imports", { imports: all() });

    assert.match(text(q("[data-sm-import='2']")), /Needs column mapping.*Waiting for you/);
    assert.match(text(q("[data-sm-import='3']")), /Posting.*SmartSpend is working/);
    assert.doesNotMatch(text(q("[data-sm-import='1']")), /Waiting for you|SmartSpend is working/);
    assert.match(text(q("[data-sm-import='1']")), /Rows 10 · Imported 9/);
  });

  it("the status tabs cover all eleven statuses", async () => {
    await open("/m/imports", { imports: all() });
    for (const label of ["Uploaded", "Needs column mapping", "Checking rows", "Ready for review", "Some rows need attention", "Confirmed, posting", "Posting", "Completed", "Failed", "Cancelled", "Reversed"]) {
      assert.ok(qa("button").some((item) => item.textContent.trim() === label), label);
    }

    await click(qa("button").find((item) => item.textContent.trim() === "Failed"));
    await settle();
    assert.deepEqual(qa("[data-sm-import]").map((row) => row.dataset.smImport), ["4"]);
    assert.equal(callsTo("/imports").at(-1).query.status, "failed");
  });

  it("says plainly when there are none, and when the read fails", async () => {
    await open("/m/imports", { imports: [] });
    assert.equal(q("[data-sm-screen='imports']").dataset.smState, "empty");
    await view.unmount();

    await open("/m/imports", () => failure(500, "Server error"));
    assert.equal(q("[data-sm-screen='imports']").dataset.smState, "error");
  });

  it("an import's page: stage, hint, the backend's counts including failed rows, file facts and the timeline in order", async () => {
    await open("/m/imports/4", { imports: all(), rows: { 4: [] } });

    const screen = q("[data-sm-screen='import-detail']");
    assert.match(text(q(".sm-hero", screen)), /Failed.*This import failed\..*The file could not be read\./);
    assert.match(text(screen), /Rows\s*10/);
    assert.match(text(screen), /Imported\s*5/);
    assert.match(text(screen), /Failed\s*3/);
    assert.match(text(screen), /File type\s*CSV/);
    assert.match(text(screen), /File size\s*4 KB/);
    assert.match(text(screen), /Original file\s*Kept by SmartSpend/);
    const labels = qa("dt", q("[data-sm-section='import-timeline']")).map((item) => item.textContent.trim());
    assert.deepEqual(labels, ["Uploaded", "Columns mapped", "Rows checked", "Confirmed"]);
  });

  it("each status has its own plain sentence, and a processing import is never called finished", async () => {
    for (const [status, pattern] of [["mapping_required", /Do this in the full version/], ["ready_for_review", /Confirm in the full version/], ["partially_valid", /Fix them in the full version/], ["processing", /isn't finished until it says Completed/], ["completed", /SmartSpend says this import is completed/], ["reversed", /Opposing transactions were posted/], ["cancelled", /was cancelled/]]) {
      await open("/m/imports/1", { imports: [importBatch(1, { status })] });
      assert.match(text(q(".sm-hero")), pattern, status);
      await view.unmount();
      view = null;
    }
  });

  it("a processing import can be checked again; a waiting or finished one cannot", async () => {
    let status = "processing";
    await open("/m/imports/3", (call) => exportsImportsBackend({ imports: [importBatch(3, { status })] })(call));
    status = "completed";
    await click(q("[data-sm-action='check-again']"));
    await settle();

    assert.equal(callsTo("/imports/3").length, 2);
    assert.match(text(q(".sm-hero")), /Completed/);
    assert.equal(q("[data-sm-action='check-again']"), null);
    await view.unmount();
    view = null;

    await open("/m/imports/2", { imports: all() });
    assert.equal(q("[data-sm-action='check-again']"), null, "waiting for the person is not something to re-read");
  });

  it("asks for no rows before the statement has been checked", async () => {
    await open("/m/imports/2", { imports: all() });

    assert.equal(q("[data-sm-rows='not-yet']").textContent.trim(), "Rows appear once SmartSpend has checked the statement.");
    assert.equal(callsTo("/imports/2/preview").length, 0);
    assert.equal(qa("[data-sm-rows-tab]").length, 0);
  });
});

describe("An import's rows", () => {
  const rows = () => [
    importRow(1, 1, { status: "imported", transaction_id: 501, description: "Supermarket", amount: "312.4000" }),
    importRow(2, 1, { status: "invalid", amount: null, transaction_date: null, description: null, errors: [{ field: "amount", code: "amount_missing", message: "An amount is required." }, { field: "transaction_date", code: "date_missing", message: "A date is required." }] }),
    importRow(3, 1, { status: "duplicate", duplicate_of_transaction_id: 77, transaction_type: "income", amount: "1500.0000", currency: "USD", description: "Salary" }),
    importRow(4, 1, { status: "ignored", description: "Transfer to savings" }),
  ];
  const section = () => q("[data-sm-section='import-rows']");

  it("lists them in file order with their own status, amount and currency, and the backend's messages", async () => {
    await open("/m/imports/1", { imports: [importBatch(1)], rows: { 1: rows() } });

    assert.deepEqual(qa("[data-sm-import-row]", section()).map((row) => row.dataset.smImportRow), ["1", "2", "3", "4"]);
    assert.deepEqual(callsTo("/imports/1/preview").map((call) => call.query), [{ per_page: "10" }]);
    assert.match(text(q("[data-sm-import-row='1']")), /Row 1.*Oct 3, 2026.*Supermarket.*Expense.*Food.*Imported.*312\.40ILS/);
    assert.match(text(q("[data-sm-import-row='2']")), /Invalid.*An amount is required\..*A date is required\./);
    assert.equal(q("[data-sm-import-row='2']").dataset.smRowStatus, "invalid");
    assert.match(text(q("[data-sm-import-row='2']")), /—/, "an amount the backend could not read is unavailable, never 0.00");
    assert.match(text(q("[data-sm-import-row='3']")), /Possible duplicate.*\+1,500\.00USD/, "a row keeps its own currency");
    assert.doesNotMatch(text(section()), /must never be shown/, "the statement's raw cells are not shown");
    assert.doesNotMatch(text(section()), /1,812|2,\d{3}\.\d\d/, "nothing is added across rows or currencies");
  });

  it("links an imported row to its movement and a duplicate to the movement it may repeat", async () => {
    await open("/m/imports/1", { imports: [importBatch(1)], rows: { 1: rows() } });

    assert.equal(q("[data-sm-import-row='1'] [data-sm-link='row-movement']").getAttribute("href"), "/m/activity/501");
    assert.equal(q("[data-sm-import-row='3'] [data-sm-link='row-duplicate']").getAttribute("href"), "/m/activity/77");
    assert.equal(q("[data-sm-import-row='4'] a"), null);
  });

  it("the row status is in the address, and each tab asks the backend for that status", async () => {
    await open("/m/imports/1?rows=invalid", { imports: [importBatch(1)], rows: { 1: rows() } });

    assert.deepEqual(callsTo("/imports/1/preview").map((call) => call.query), [{ per_page: "10", status: "invalid" }]);
    assert.deepEqual(qa("[data-sm-import-row]").map((row) => row.dataset.smImportRow), ["2"]);
    assert.equal(q("[data-sm-rows-tab='invalid']").getAttribute("aria-current"), "true");
    assert.equal(qa("[data-sm-rows-tab]").length, 9);

    await click(q("[data-sm-rows-tab='duplicate']"));
    await settle();
    assert.equal(location(), "/m/imports/1?rows=duplicate");
    assert.deepEqual(qa("[data-sm-import-row]").map((row) => row.dataset.smImportRow), ["3"]);

    await click(q("[data-sm-rows-tab='all']"));
    await settle();
    assert.equal(location(), "/m/imports/1");
    assert.equal(qa("[data-sm-import-row]").length, 4);
  });

  it("pages with the backend's paginator, and a tab starts again from page 1", async () => {
    const many = Array.from({ length: 12 }, (_, index) => importRow(index + 1, 1));
    await open("/m/imports/1?rp=2", { imports: [importBatch(1)], rows: { 1: many } });

    assert.deepEqual(callsTo("/imports/1/preview").map((call) => call.query), [{ per_page: "10", page: "2" }]);
    assert.equal(qa("[data-sm-import-row]").length, 2);
    assert.match(text(section()), /Page 2 of 2/);
    assert.equal(q("[data-sm-page-link='rows:1']").getAttribute("href"), "/m/imports/1");
    assert.equal(q("[data-sm-rows-tab='valid']").getAttribute("href"), "/m/imports/1?rows=valid");
  });

  it("an address past the last page leads back; an unknown tab or page is ignored", async () => {
    await open("/m/imports/1?rp=9", { imports: [importBatch(1)], rows: { 1: rows() } });
    assert.equal(q("[data-sm-rows='past-end']").getAttribute("href"), "/m/imports/1");
    await view.unmount();
    view = null;

    await open("/m/imports/1?rows=bogus&rp=-3", { imports: [importBatch(1)], rows: { 1: rows() } });
    assert.deepEqual(callsTo("/imports/1/preview").map((call) => call.query), [{ per_page: "10" }]);
  });

  it("says plainly when there are no rows, or none with the status", async () => {
    await open("/m/imports/1", { imports: [importBatch(1)], rows: { 1: [] } });
    assert.match(text(section()), /This import has no rows/);
    await view.unmount();
    view = null;

    await open("/m/imports/1?rows=failed", { imports: [importBatch(1)], rows: { 1: rows() } });
    assert.match(text(section()), /No rows with this status/);
  });

  it("refuses a page about another import or with another import's rows, whole, and leaves the rest of the page", async () => {
    const backend = exportsImportsBackend({ imports: [importBatch(1)], rows: { 1: [importRow(1, 1), importRow(2, 9)] } });
    await open("/m/imports/1", backend);
    assert.equal(qa("[data-sm-import-row]").length, 0);
    assert.ok(section().querySelector(".sm-error"));
    assert.match(text(q("[data-sm-screen='import-detail']")), /Rows\s*10/);
  });

  it("a failed read of the rows can be retried and leaves the import standing", async () => {
    let fail = true;
    const backend = exportsImportsBackend({ imports: [importBatch(1)], rows: { 1: rows() } });
    await open("/m/imports/1", (call) => (call.path === "/imports/1/preview" && fail ? failure(500, "Server error") : backend(call)));

    assert.equal(qa("[data-sm-import-row]").length, 0);
    assert.match(text(q(".sm-hero")), /Completed/);
    fail = false;
    await click(qa("button", section()).find((item) => /retry|try again/i.test(item.textContent)));
    await settle();
    assert.equal(qa("[data-sm-import-row]").length, 4);
  });

  it("is read-only: only GETs, nothing to fix, ignore, confirm, cancel or reverse", async () => {
    await open("/m/imports/1", { imports: [importBatch(1)], rows: { 1: rows() } });

    assert.equal(qa("button, input, form", q("main")).length, 0);
    assert.equal(q("[data-sm-note='write-closed']").dataset.smWrite, "import.confirm");
    assert.equal(api.calls.every((call) => call.method === "GET"), true);
    assert.equal(api.calls.some((call) => /confirm|cancel|reverse|mapping|validate|ignore|upload/.test(call.path)), false);
  });

  it("speaks Arabic", async () => {
    await i18n.changeLanguage("ar");
    await open("/m/imports/1", { imports: [importBatch(1)], rows: { 1: rows() } });

    assert.match(text(q(".sm-hero")), /يقول SmartSpend إن هذا الاستيراد مكتمل/);
    assert.match(text(section()), /الصفوف/);
    assert.match(text(q("[data-sm-import-row='3']")), /مكرر محتمل/);
    assert.match(text(q("[data-sm-import-row='2']")), /An amount is required\./, "the backend's own message stays as sent");
    assert.equal(q("[data-sm-rows-tab='all']").textContent.trim(), "الكل");
  });
});
