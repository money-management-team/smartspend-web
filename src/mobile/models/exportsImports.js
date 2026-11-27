import { isCurrencyCode } from "../money/decimal.js";
import { IMPORT_ROWS_PER_PAGE, IMPORT_ROW_STATUSES } from "./importRowTabs.js";
import { buildPlanningPage, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Report exports and statement imports, read-only.
 *
 * Exports (docs/report-exports/): GET /report-exports?status=&per_page=&page=,
 * a paginator at data.report_exports. An export is asynchronous: "queued" or
 * "processing" is not a file. Only `download_available: true` (the backend's
 * flag) means a file can be fetched; "completed" alone does not (it may have
 * expired or been revoked).
 *
 * Imports (docs/imports/integration.md): GET /imports?status=&per_page=&page=,
 * a paginator at data.imports; GET /imports/{id} → data.import with status,
 * counts and failure_reason. "confirmed" and "processing" mean the server is
 * still posting: an import is finished only when it says "completed".
 */

export const EXPORT_STATUSES = ["queued", "processing", "completed", "failed", "expired", "cancelled"];
// Every status the backend's list accepts (ReportExportIndexRequest).
export const EXPORT_FILTER_STATUSES = ["queued", "processing", "completed", "failed", "expired", "cancelled"];
export const IMPORT_STATUSES = ["uploaded", "mapping_required", "validating", "ready_for_review", "partially_valid", "confirmed", "processing", "completed", "failed", "cancelled", "reversed"];
// Every status the backend's list accepts (ImportIndexRequest), in the order a statement moves through them.
export const IMPORT_FILTER_STATUSES = ["uploaded", "mapping_required", "validating", "ready_for_review", "partially_valid", "confirmed", "processing", "completed", "failed", "cancelled", "reversed"];
export const IMPORT_IN_PROGRESS = ["confirmed", "processing", "validating"];
const FORMATS = ["pdf", "csv", "xlsx"];

const statusFilter = (allowed) => (search) => {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const status = params.get("status") ?? "";
  return { status: allowed.includes(status) ? status : "" };
};
const statusParams = (filters) => {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  return params;
};

export const readExportFilters = statusFilter(EXPORT_FILTER_STATUSES);
export const readImportFilters = statusFilter(IMPORT_FILTER_STATUSES);
export const statusFiltersToSearchParams = statusParams;
export const statusFilterSignature = (filters) => statusParams(filters).toString() || "default";
export const hasStatusFilter = (filters) => Boolean(filters.status);
export const exportFiltersToQuery = (filters, page, perPage) => ({ status: filters.status || undefined, per_page: perPage, page });
export const importFiltersToQuery = (filters, page, perPage, workspaceId) => ({ workspace_id: workspaceId, status: filters.status || undefined, per_page: perPage, page });

/*
 * Where an export stands, in the words the screens use. It comes from the backend's status and its own
 * `download_available` flag, nothing else: "completed" without the flag is not a file (it was removed or has
 * expired), so it is its own stage rather than "ready".
 */
const EXPORT_STAGE = { queued: "pending", processing: "processing", completed: "ready", failed: "failed", expired: "ended", cancelled: "ended" };

export function normalizeExport(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;
  const state = readState(raw.status, EXPORT_STATUSES);

  return {
    id,
    report: textOrNull(raw.report, 40),
    format: FORMATS.includes(raw.format) ? raw.format : null,
    status: state.word,
    statusKnown: state.known,
    fileName: textOrNull(raw.file_name, 255),
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
    completedAt: typeof raw.completed_at === "string" ? raw.completed_at : null,
    expiresAt: typeof raw.expires_at === "string" ? raw.expires_at : null,
    // Only the backend's own flag says a file can be fetched.
    downloadable: flagOrNull(raw.download_available) === true,
    from: textOrNull(raw.filters?.from, 10),
    to: textOrNull(raw.filters?.to, 10),
    currency: isCurrencyCode(raw.filters?.currency) ? raw.filters.currency : null,
    fileSize: countOrNull(raw.file_size),
    startedAt: typeof raw.started_at === "string" ? raw.started_at : null,
    cancelledAt: typeof raw.cancelled_at === "string" ? raw.cancelled_at : null,
    // A failed export's own explanation (error.message is the backend's "safe" text; the code is its machine word).
    errorMessage: textOrNull(isRecord(raw.error) ? raw.error.message : null, 500),
    errorCode: textOrNull(isRecord(raw.error) ? raw.error.code : null, 60),
    stage: !state.known ? null : state.word === "completed" && flagOrNull(raw.download_available) !== true ? "unavailable" : EXPORT_STAGE[state.word],
  };
}

/** The key of the sentence that explains an export: its stage when that is "ready" or "unavailable", else its status. Null for a status Mobile does not know. */
export function exportHint(item) {
  if (!item.statusKnown) return null;
  return item.stage === "ready" || item.stage === "unavailable" ? item.stage : item.status;
}

/** GET /report-exports/{id}: the export, only if it is the one asked for. */
export function buildExportDetail(data, expectedId) {
  const item = normalizeExport(data);
  return item && item.id === String(expectedId) ? item : null;
}

export const buildExportsPage = (response, expected) => buildPlanningPage(response, expected, "report_exports", normalizeExport);

const COUNT_KEYS = ["total", "valid", "invalid", "duplicate", "ignored", "imported", "failed"];
const FILE_TYPES = ["csv", "xlsx"];

/*
 * Where an import stands, from the backend's status alone. "pending" is waiting for the person (to map columns, review
 * rows or confirm), which is done in the full version; "processing" is SmartSpend working; "done" is only `completed`.
 */
const IMPORT_STAGE = { uploaded: "pending", mapping_required: "pending", validating: "processing", ready_for_review: "pending", partially_valid: "pending", confirmed: "processing", processing: "processing", completed: "done", failed: "failed", cancelled: "ended", reversed: "ended" };

const stamp = (value) => (typeof value === "string" && value ? value : null);

export function normalizeImport(raw) {
  if (!isRecord(raw)) return null;
  const id = idText(raw.id);
  if (!id) return null;
  const state = readState(raw.status, IMPORT_STATUSES);
  const counts = isRecord(raw.counts) ? Object.fromEntries(COUNT_KEYS.map((key) => [key, countOrNull(raw.counts[key])])) : null;

  return {
    id,
    fileName: textOrNull(raw.original_filename, 255),
    status: state.word,
    statusKnown: state.known,
    inProgress: IMPORT_IN_PROGRESS.includes(state.word),
    counts,
    failureReason: textOrNull(raw.failure_reason, 1000),
    accountId: idText(raw.account_id),
    accountName: isRecord(raw.account) ? textOrNull(raw.account.name) : null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
    completedAt: typeof raw.completed_at === "string" ? raw.completed_at : null,
    stage: state.known ? IMPORT_STAGE[state.word] : null,
    fileType: FILE_TYPES.includes(raw.file_type) ? raw.file_type : null,
    fileSize: countOrNull(raw.file_size),
    fileAvailable: flagOrNull(raw.file_available),
    editable: flagOrNull(raw.is_editable),
    mappedAt: stamp(raw.mapped_at),
    validatedAt: stamp(raw.validated_at),
    confirmedAt: stamp(raw.confirmed_at),
    cancelledAt: stamp(raw.cancelled_at),
    reversedAt: stamp(raw.reversed_at),
  };
}

export const buildImportsPage = (response, expected) => buildPlanningPage(response, expected, "imports", normalizeImport);

export function buildImportDetail(data, expectedId) {
  const item = normalizeImport(data?.import);
  return item && item.id === String(expectedId) ? item : null;
}

/* ---------- The rows of an import (GET /imports/{id}/preview) ---------- */

const ROW_TYPES = ["income", "expense"];

/**
 * One row of an import preview, or null when it is not usable: no id, a row of another import, or no row number. The
 * amount is the row's own, in the row's own currency (a statement can carry rows the backend could not read an
 * amount from, which show as unavailable, never as zero). Validation errors are the backend's `{ field, message }`
 * entries, kept as sent. `raw` (the statement's own cells) is deliberately not read.
 */
export function normalizeImportRow(raw, importId) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  const rowNumber = Number.isSafeInteger(raw.row_number) && raw.row_number >= 1 ? raw.row_number : null;
  if (!id || rowNumber === null) return null;
  if (raw.import_batch_id != null && idText(raw.import_batch_id) !== importId) return null;

  const status = readState(raw.status, IMPORT_ROW_STATUSES);
  const type = readState(raw.transaction_type, ROW_TYPES);
  const currency = isCurrencyCode(raw.currency) ? raw.currency : null;
  const errors = (Array.isArray(raw.errors) ? raw.errors : [])
    .slice(0, 8)
    .map((entry) => (typeof entry === "string" ? textOrNull(entry, 300) : isRecord(entry) ? textOrNull(entry.message, 300) : null))
    .filter(Boolean);

  return {
    id,
    rowNumber,
    status: status.word,
    statusKnown: status.known,
    date: dateOnlyOrNull(raw.transaction_date),
    type: type.word,
    typeKnown: type.known,
    amount: amountIn(raw.amount, currency),
    currency,
    description: textOrNull(raw.description, 300),
    categoryName: textOrNull(isRecord(raw.category) ? raw.category.name : null, 80),
    errors,
    duplicateOfTransactionId: idText(raw.duplicate_of_transaction_id),
    transactionId: idText(raw.transaction_id),
  };
}

/**
 * One page of the rows of an import. Refused whole when the answer is about another import, a row belongs to another or
 * repeats, or (with a status asked for) a row has another status.
 *
 * @param {object} response the whole envelope (`data.import`, `data.rows`)
 * @param {{ id: string }} batch
 * @param {{ status: string, page: number }} asked `status` is "" for all of them
 */
export function buildImportRowsPage(response, batch, { status, page }) {
  const fail = () => Object.assign(new Error("Import rows could not be validated."), { code: "MALFORMED_RESPONSE" });
  const claimed = response?.data?.import;
  if (isRecord(claimed) && idText(claimed.id) !== batch.id) throw fail();

  const built = buildPlanningPage(response, { page, perPage: IMPORT_ROWS_PER_PAGE }, "rows", (raw) => normalizeImportRow(raw, batch.id));
  if (status && built.rows.some((row) => row.status !== status)) throw fail();

  return built;
}
