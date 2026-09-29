import { apiDownload, apiRequest, pickQuery } from "./apiClient";

const exportPath = (exportId) => `/report-exports/${encodeURIComponent(exportId)}`;

// Filters an export may carry: the report filters the user applied plus the
// workspace and time zone. `per_page` / `page` never belong to an export.
const EXPORT_FILTER_KEYS = ["workspace_id", "from", "to", "currency", "group_by", "timezone"];
const LIST_QUERY_KEYS = ["status", "report", "format", "per_page", "page"];

/*
 * Report exports are asynchronous: POST /report-exports only queues a job
 * (`status: "queued"`). The file exists once GET /report-exports/{id} says
 * `download_available: true`; only then is /download called.
 *
 * Envelopes:
 * - create / get / cancel → `data` is the export itself
 *   ({ id, report, format, status, filters, file_name, file_size,
 *   created_at, started_at, completed_at, expires_at, cancelled_at,
 *   download_available }).
 * - list → `data.report_exports` (Laravel paginator, rows in `.data`).
 * - download → the binary file (not the JSON envelope).
 */
export const reportExportsApi = {
  // Payload: { report, format, filters: { workspace_id, from, to, currency,
  // group_by, timezone } }. Empty filters (e.g. "all currencies") are dropped.
  create: ({ report, format, filters = {} }) =>
    apiRequest("/report-exports", {
      method: "POST",
      body: {
        report,
        format,
        filters: Object.fromEntries(
          Object.entries(pickQuery(filters, EXPORT_FILTER_KEYS)).filter(
            ([, value]) => value !== null && value !== "",
          ),
        ),
      },
    }),

  // Query: status, report, format, per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/report-exports", { query: pickQuery(query, LIST_QUERY_KEYS), signal: options.signal }),

  // Safe to poll: only reads the export's status.
  get: (exportId, options = {}) =>
    apiRequest(exportPath(exportId), { signal: options.signal }),

  // Binary file: resolves to { blob, filename, contentType }.
  download: (exportId, options = {}) =>
    apiDownload(`${exportPath(exportId)}/download`, { signal: options.signal }),

  // Cancels a queued / processing export, or revokes a completed one (its
  // private file is removed and it becomes `expired`). Returns the export.
  cancel: (exportId) =>
    apiRequest(exportPath(exportId), { method: "DELETE" }),
};
