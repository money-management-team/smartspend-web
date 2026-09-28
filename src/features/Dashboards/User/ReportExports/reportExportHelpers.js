import { getApiErrorMessage } from "../api/apiClient";
import { REPORT_NAMES } from "../Reports/reportHelpers";

export const EXPORT_STATUSES = ["queued", "processing", "completed", "failed", "expired", "cancelled"];
// Statuses that can still change on their own: only these are polled.
export const ACTIVE_EXPORT_STATUSES = ["queued", "processing"];
// The formats the backend builds, sent exactly as written. Word / DOCX is not
// one of them and must never be offered.
export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"];
export const DEFAULT_EXPORT_FORMAT = "csv";
export const EXPORTS_PER_PAGE = 20;

/* ---------- Polling ---------- */

// Delay before each status check: quick at first, then every 10 s. About
// 6 minutes of checks in total, after which the user checks again manually.
const POLL_DELAYS_MS = [2000, 3000, 4000, 5000, 5000, 8000];
const POLL_STEADY_MS = 10_000;
export const MAX_POLLS = 40;

export const getPollDelay = (count) => POLL_DELAYS_MS[count] ?? POLL_STEADY_MS;

// Errors after which polling stops: the export is gone, not ours, or the
// session ended. Network / timeout / 5xx / 429 are retried on the schedule.
export const FATAL_POLL_CODES = ["NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"];
// A single failed check is not shown: only this many failures in a row are.
export const POLL_ERROR_THRESHOLD = 2;

/* ---------- Entities ---------- */

export const isExportEntity = (value) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && value.id != null);

// The export in a create / get / cancel response: `data` itself (documented),
// or nested under `report_export` / `export`.
export function parseExport(response) {
  const data = response?.data;
  const candidate = data?.report_export ?? data?.export ?? data;
  return isExportEntity(candidate) ? candidate : null;
}

export const isActiveExport = (record) => ACTIVE_EXPORT_STATUSES.includes(record?.status);

// The backend's flag decides; the status alone never enables a download.
export const canDownloadExport = (record) => record?.download_available === true;

/*
 * What DELETE /report-exports/{id} would do for this export: cancel a job
 * that hasn't finished, or revoke a completed file (removed, becomes
 * `expired`). Null when there is nothing to cancel or revoke.
 */
export function getExportStopAction(record) {
  if (isActiveExport(record)) return "cancel";
  if (record?.status === "completed") return "revoke";
  return null;
}

export const isExportFormat = (format) => EXPORT_FORMATS.includes(format);

// "CSV", "XLSX", "PDF": the short name used in buttons, badges and titles.
// An unknown format is shown as the backend sent it.
export const getFormatName = (format) => String(format ?? "—").toUpperCase();

// The period the export was built for, from the filters it was created with.
export function getExportPeriod(record) {
  const from = record?.filters?.from ?? null;
  const to = record?.filters?.to ?? null;
  return from || to ? { from, to } : null;
}

export const getExportStatus = (record) =>
  EXPORT_STATUSES.includes(record?.status) ? record.status : "unknown";

// File name for the saved file: the Content-Disposition name, then the
// export's `file_name`, then one built from the export itself.
export function getExportFilename(record, headerFilename) {
  if (headerFilename) return headerFilename;
  if (record?.file_name) return record.file_name;

  const format = isExportFormat(record?.format) ? record.format : DEFAULT_EXPORT_FORMAT;
  return `smartspend-${record?.report || "report"}-${record?.id ?? "export"}.${format}`;
}

// "161 B", "1.4 KB", "2.1 MB" in the display locale; "—" when unknown.
export function formatFileSize(bytes, locale) {
  const size = Number(bytes);
  if (bytes == null || bytes === "" || !Number.isFinite(size) || size < 0) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value);
  return `${number} ${units[unit]}`;
}

// Translated report name, or the backend value when the report is unknown.
export function getReportName(report, t) {
  return REPORT_NAMES.includes(report) ? t(`dashboard.reports.names.${report}`) : String(report ?? "—");
}

/* ---------- Errors ---------- */

/*
 * Export wording for codes where the generic message would mislead.
 * `context`: "create" | "download" | "cancel" | "status" | "list".
 * 410 Gone (an expired file) reads like an expired export. A download that
 * fails for any other reason says the file exists but did not arrive.
 */
export function getExportErrorMessage(error, t, context = "status") {
  if (error?.code === "FORBIDDEN") return t("dashboard.reportExports.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.reportExports.errors.notFound");
  if (error?.status === 410) return t("dashboard.reportExports.errors.expired");
  if (error?.code === "CONFLICT") {
    if (context === "download") return t("dashboard.reportExports.errors.notReady");
    if (context === "cancel") return t("dashboard.reportExports.errors.cannotStop");
    return error.message || t("dashboard.reportExports.errors.conflict");
  }
  if (error?.code === "VALIDATION_ERROR" && context === "create") {
    return error.message || t("dashboard.reportExports.errors.invalid");
  }
  if (context === "download" && ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE"].includes(error?.code)) {
    return t("dashboard.reportExports.errors.downloadFailed");
  }

  return getApiErrorMessage(error, t);
}

/* ---------- History filters ↔ URL ---------- */

export function readExportFilters(searchParams) {
  const status = searchParams.get("status");
  const report = searchParams.get("report");
  const format = searchParams.get("format");
  const page = Number(searchParams.get("page"));

  return {
    status: EXPORT_STATUSES.includes(status) ? status : "",
    report: REPORT_NAMES.includes(report) ? report : "",
    format: EXPORT_FORMATS.includes(format) ? format : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function exportFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  ["status", "report", "format"].forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

export const exportFiltersToQuery = (filters) => ({
  status: filters.status || undefined,
  report: filters.report || undefined,
  format: filters.format || undefined,
  per_page: EXPORTS_PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

export const hasActiveExportFilters = (filters) =>
  Boolean(filters.status || filters.report || filters.format);
