import { buildPlanningPage, readState } from "./planning.js";
import { countOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

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
export const EXPORT_FILTER_STATUSES = ["queued", "processing", "completed", "failed"];
export const IMPORT_STATUSES = ["uploaded", "mapping_required", "validating", "ready_for_review", "partially_valid", "confirmed", "processing", "completed", "failed", "cancelled", "reversed"];
export const IMPORT_FILTER_STATUSES = ["ready_for_review", "processing", "completed", "failed", "reversed"];
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
  };
}

export const buildExportsPage = (response, expected) => buildPlanningPage(response, expected, "report_exports", normalizeExport);

const COUNT_KEYS = ["total", "valid", "invalid", "duplicate", "ignored", "imported"];

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
  };
}

export const buildImportsPage = (response, expected) => buildPlanningPage(response, expected, "imports", normalizeImport);

export function buildImportDetail(data, expectedId) {
  const item = normalizeImport(data?.import);
  return item && item.id === String(expectedId) ? item : null;
}
