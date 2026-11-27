import { envelope, failure } from "./mobileApi.mjs";
import { paginator } from "./planningFixture.mjs";

/*
 * Fictional report exports and statement imports, and a fake backend that answers like GET /report-exports (and one
 * export and its download), GET /imports (and one import and its row preview): it filters by the documented
 * parameters and pages with a Laravel-shaped paginator.
 */

/** One export in the backend's ReportExportResource shape. */
export const exportRow = (id, over = {}) => ({
  id,
  report: "overview",
  format: "csv",
  status: "completed",
  filters: { from: "2026-10-01", to: "2026-10-20", currency: "ILS", timezone: "Asia/Hebron" },
  file_name: `overview-${id}.csv`,
  file_size: 2048,
  created_at: "2026-10-20T10:00:00Z",
  started_at: "2026-10-20T10:00:05Z",
  completed_at: "2026-10-20T10:00:30Z",
  expires_at: "2099-12-01T00:00:00Z",
  cancelled_at: null,
  download_available: true,
  ...over,
});

/** One import in the backend's ImportBatchResource shape. */
export const importBatch = (id, over = {}) => ({
  id,
  workspace_id: 1,
  account_id: 1,
  original_filename: `statement-${id}.csv`,
  file_type: "csv",
  file_size: 4096,
  file_available: true,
  status: "completed",
  is_editable: false,
  counts: { total: 10, valid: 9, invalid: 1, duplicate: 0, ignored: 1, imported: 9, failed: 0 },
  failure_reason: null,
  mapped_at: "2026-10-01T09:01:00Z",
  validated_at: "2026-10-01T09:02:00Z",
  confirmed_at: "2026-10-01T09:05:00Z",
  completed_at: "2026-10-01T09:06:00Z",
  cancelled_at: null,
  reversed_at: null,
  created_at: "2026-10-01T09:00:00Z",
  account: { id: 1, name: "Everyday wallet" },
  ...over,
});

/** One row of an import's preview in the backend's ImportRowResource shape. */
export const importRow = (id, batchId, over = {}) => ({
  id,
  import_batch_id: batchId,
  row_number: id,
  status: "valid",
  raw: { Date: "03/10/2026", Memo: "must never be shown" },
  transaction_date: "2026-10-03",
  transaction_type: "expense",
  amount: "42.5000",
  currency: "ILS",
  description: `Row ${id} description`,
  reference_number: null,
  category_id: 4,
  errors: [],
  duplicate_of_transaction_id: null,
  transaction_id: null,
  category: { id: 4, name: "Food" },
  ...over,
});

/**
 * @param {{ exports?: object[], imports?: object[], rows?: Record<string, object[]>, files?: Record<string, object> }} data
 * `rows` maps an import id to its rows (file order); `files` maps an export id to the answer of its download.
 */
export function exportsImportsBackend({ exports = [], imports = [], rows = {}, files = {} } = {}) {
  return (call) => {
    const q = call.query;
    const page = { page: Number(q.page ?? 1), perPage: Number(q.per_page ?? 20) };

    if (call.path === "/report-exports") return { body: envelope({ report_exports: paginator(exports.filter((row) => !q.status || row.status === q.status), page) }) };

    const download = /^\/report-exports\/(\d+)\/download$/.exec(call.path);
    if (download) return files[download[1]] ?? failure(404, "Not found");

    const oneExport = /^\/report-exports\/(\d+)$/.exec(call.path);
    if (oneExport) {
      const found = exports.find((row) => String(row.id) === oneExport[1]);
      return found ? { body: envelope(found) } : failure(404, "Not found");
    }

    if (call.path === "/imports") return { body: envelope({ imports: paginator(imports.filter((row) => !q.status || row.status === q.status), page) }) };

    const preview = /^\/imports\/(\d+)\/preview$/.exec(call.path);
    if (preview) {
      const batch = imports.find((row) => String(row.id) === preview[1]);
      if (!batch) return failure(404, "Not found");
      const list = (rows[preview[1]] ?? []).filter((row) => !q.status || row.status === q.status);
      return { body: envelope({ import: batch, rows: paginator(list, page) }) };
    }

    const oneImport = /^\/imports\/(\d+)$/.exec(call.path);
    if (oneImport) {
      const found = imports.find((row) => String(row.id) === oneImport[1]);
      return found ? { body: envelope({ import: found, suggested_mapping: null }) } : failure(404, "Not found");
    }

    return failure(404, "Not found");
  };
}
