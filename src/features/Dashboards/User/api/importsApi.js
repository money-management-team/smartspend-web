import { apiRequest, pickQuery, toMoneyString } from "./apiClient";

const importPath = (importId) => `/imports/${encodeURIComponent(importId)}`;
const rowPath = (importId, rowId) => `${importPath(importId)}/rows/${encodeURIComponent(rowId)}`;
const UPLOAD_TIMEOUT_MS = 120_000;

const MAPPING_FIELDS = ["mapping", "account_id", "default_expense_category_id", "default_income_category_id"];
// Row fields a correction may change. `raw` (the original file cells),
// `status`, `errors` and `currency` are never sent: the backend keeps the
// original and revalidates the row itself.
const ROW_FIELDS = ["transaction_date", "transaction_type", "amount", "description", "category_id"];
const LIST_QUERY_KEYS = ["workspace_id", "account_id", "status", "per_page", "page"];

/*
 * Statement imports, the whole lifecycle: upload → mapping → validate →
 * preview → row corrections → confirm → (processing) → completed, plus
 * cancel before confirmation and reverse after it.
 *
 * Only `confirm` and `reverse` move money, and both carry an
 * `Idempotency-Key` supplied by the caller (see `createIdempotentAttempt` in
 * FinancialOperations/transactionHelpers.js) so a retry of the same logical
 * attempt can never post an import twice. Everything else is safe to repeat.
 *
 * Envelopes:
 * - upload → `data.import` + `data.suggested_mapping` ({ field: column index }).
 * - saveMapping / validate / confirm / reverse / cancel → `data.import`.
 * - get → `data.import` (+ `data.suggested_mapping` while still unmapped).
 * - list → `data.imports` (Laravel paginator, rows in `.data`).
 * - preview → `data.import` + `data.rows` (Laravel paginator, rows in `.data`).
 * - updateRow / ignoreRow → `data.row` + `data.import` (updated counts).
 */
export const importsApi = {
  // multipart/form-data: the FormData goes to fetch as is, so the browser
  // writes the Content-Type with its boundary. Booleans are sent as "1"/"0",
  // the values Laravel's `boolean` rule accepts.
  upload: ({ workspace_id, file, has_header = true, date_order = "auto", decimal_separator = "auto" }, options = {}) => {
    const formData = new FormData();

    formData.append("workspace_id", String(workspace_id));
    formData.append("file", file);
    formData.append("has_header", has_header ? "1" : "0");
    formData.append("date_order", date_order);
    formData.append("decimal_separator", decimal_separator);

    return apiRequest("/imports", {
      method: "POST",
      body: formData,
      signal: options.signal,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },

  // Payload: { mapping: { field: zero-based column index }, account_id,
  // default_expense_category_id, default_income_category_id }.
  saveMapping: (importId, payload) =>
    apiRequest(`${importPath(importId)}/mapping`, {
      method: "POST",
      body: pickQuery(payload, MAPPING_FIELDS),
    }),

  // No body. Rebuilds and classifies the rows (valid / invalid / duplicate).
  validate: (importId) =>
    apiRequest(`${importPath(importId)}/validate`, { method: "POST" }),

  // Query: per_page, page.
  preview: (importId, query = {}, options = {}) =>
    apiRequest(`${importPath(importId)}/preview`, {
      query: pickQuery(query, ["per_page", "page"]),
      signal: options.signal,
    }),

  // PATCH with only the edited fields; the backend revalidates the row.
  updateRow: (importId, rowId, changes) => {
    const body = pickQuery(changes, ROW_FIELDS);
    if (body.amount !== undefined) body.amount = toMoneyString(body.amount);

    return apiRequest(rowPath(importId, rowId), {
      method: "PATCH",
      body,
    });
  },

  // No body. The row stays in the import (and in its history) with
  // `status: "ignored"`; it is simply not posted when the import is confirmed.
  ignoreRow: (importId, rowId) =>
    apiRequest(`${rowPath(importId, rowId)}/ignore`, { method: "POST" }),

  /*
   * Posts the valid rows as real transactions. No body; the required
   * `Idempotency-Key` is the caller's, so a retry after a timeout reuses the
   * same key instead of importing twice.
   *
   * May answer 202: the import can still be `confirmed` / `processing` and
   * finish asynchronously. Poll `get` until it is final.
   */
  confirm: (importId, { idempotencyKey, signal } = {}) =>
    apiRequest(`${importPath(importId)}/confirm`, {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      signal,
    }),

  /*
   * Undoes a confirmed import by posting the opposing transactions. The
   * originals stay auditable and the import becomes `reversed`. `reason` is
   * required; the `Idempotency-Key` is the caller's, as for confirm.
   */
  reverse: (importId, { reason }, { idempotencyKey, signal } = {}) =>
    apiRequest(`${importPath(importId)}/reverse`, {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: { reason },
      signal,
    }),

  // Abandons an import that was never confirmed: the stored file is dropped
  // and it becomes `cancelled`. No transaction was created, so nothing to undo.
  cancel: (importId, options = {}) =>
    apiRequest(`${importPath(importId)}/cancel`, { method: "POST", signal: options.signal }),

  // Query: workspace_id, account_id, status, per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/imports", { query: pickQuery(query, LIST_QUERY_KEYS), signal: options.signal }),

  // The canonical way to read an import's state (resume after a reload, and
  // the status poll while it is processing). Safe to repeat.
  get: (importId, options = {}) =>
    apiRequest(importPath(importId), { signal: options.signal }),
};
