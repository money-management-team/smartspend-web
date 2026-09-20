import { getApiErrorMessage, toMoneyString } from "../api/apiClient";
import { getAmountError, toAmountInput } from "../FinancialOperations/transactionHelpers";
import { isIsoDate } from "../Reports/reportHelpers";
import { parsePage } from "../SavingsGoals/savingsGoalHelpers";

/*
 * Helpers of the statement import wizard (upload → map → validate → review).
 * The backend parses the file, classifies rows and owns every status and
 * count; nothing here parses a file or decides whether a row is valid.
 */

// The documented upload formats. The extension check is a convenience only:
// the backend inspects the file and has the final word.
export const IMPORT_FILE_TYPES = ["csv", "xlsx"];
export const IMPORT_ACCEPT = ".csv,.xlsx";
export const AUTO_OPTION = "auto";

/*
 * Parsing hints sent with the upload. `auto` (let the backend detect) is the
 * only value the API contract confirms, so it is the only one offered: a
 * guessed enum would be rejected as a 422, or worse, parse the statement
 * wrongly. The selects appear by themselves once a list holds more than one
 * confirmed value — adding one here is all that is needed.
 */
export const DATE_ORDER_OPTIONS = [AUTO_OPTION];
export const DECIMAL_SEPARATOR_OPTIONS = [AUTO_OPTION];

export const PREVIEW_PER_PAGE_OPTIONS = [10, 25, 50];
export const DEFAULT_PREVIEW_PER_PAGE = 10;
export const IMPORTS_PER_PAGE = 20;

export const IMPORT_STEPS = ["upload", "map", "validate", "review", "confirm"];
export const COUNT_KEYS = ["total", "valid", "invalid", "duplicate", "ignored", "imported", "failed"];
export const TRANSACTION_TYPES = ["expense", "income"];

// Every import status the backend documents, in lifecycle order.
export const IMPORT_STATUSES = [
  "uploaded",
  "mapping_required",
  "validating",
  "ready_for_review",
  "partially_valid",
  "confirmed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "reversed",
];

// Confirmation has started; money may already have moved.
const POSTED_STATUSES = ["confirmed", "processing", "completed", "reversed"];
// Still being worked on by the backend: these are polled.
const IN_FLIGHT_STATUSES = ["validating", "confirmed", "processing"];
// Nothing will change on its own any more.
const FINAL_STATUSES = ["completed", "failed", "cancelled", "reversed"];

/*
 * Mapping fields (zero-based column indexes). `date`, `description`,
 * `amount` and `type` are in the documented examples; `debit` / `credit` are
 * the documented alternative to a single signed amount. Any other field the
 * backend suggests or already saved is shown as well.
 */
export const MAPPING_FIELDS = ["date", "description", "amount", "type", "debit", "credit"];

// Mapping field(s) whose column holds the original value of a row field.
const ROW_FIELD_COLUMNS = {
  transaction_date: ["date"],
  transaction_type: ["type"],
  amount: ["amount", "debit", "credit"],
  description: ["description"],
};

const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

/* ---------- Files ---------- */

export const getFileExtension = (name) => {
  const match = String(name ?? "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
};

// Translation key under dashboard.importPage.upload.errors, or null.
export function validateImportFile(file) {
  if (!file) return "required";
  if (!IMPORT_FILE_TYPES.includes(getFileExtension(file.name))) return "type";
  if (file.size === 0) return "empty";
  return null;
}

/* ---------- Entities and responses ---------- */

export const isImportEntity = (value) => isObject(value) && value.id != null;

// Mapping as { field: column index }, dropping anything that isn't an index.
export function normalizeMapping(mapping) {
  if (!isObject(mapping)) return {};

  return Object.fromEntries(
    Object.entries(mapping)
      .map(([field, index]) => [field, Number(index)])
      .filter(([, index]) => Number.isInteger(index) && index >= 0),
  );
}

// POST /imports → { import, suggestedMapping }.
export function parseUploadResponse(response) {
  const record = response?.data?.import;
  if (!isImportEntity(record)) return null;

  return { import: record, suggestedMapping: normalizeMapping(response?.data?.suggested_mapping) };
}

// mapping / validate → data.import.
export function parseImportResponse(response) {
  const record = response?.data?.import;
  return isImportEntity(record) ? record : null;
}

// GET /imports/{id}/preview → { import, page } (`data.rows` is a paginator,
// its rows are in `data.rows.data`).
export function parsePreviewResponse(response) {
  const record = response?.data?.import;
  const page = parsePage(response, "rows");

  if (!page) return null;
  return { import: isImportEntity(record) ? record : null, page };
}

/*
 * GET /imports/{id} → the import, plus the suggested mapping while the file
 * is still unmapped. This is what a reload resumes from: `preview` is for
 * rows, this is for the import's own state.
 */
export function parseImportDetailsResponse(response) {
  const record = response?.data?.import;
  if (!isImportEntity(record)) return null;

  return { import: record, suggestedMapping: normalizeMapping(response?.data?.suggested_mapping) };
}

// GET /imports → `data.imports` (Laravel paginator, rows in `.data`).
export const parseImportsPage = (response) => parsePage(response, "imports");

// PATCH row → { row, import } (import carries the updated counts).
export function parseRowUpdateResponse(response) {
  const row = response?.data?.row;
  const record = response?.data?.import;

  if (!isObject(row) || row.id == null) return null;
  return { row, import: isImportEntity(record) ? record : null };
}

/* ---------- Lifecycle ---------- */

/*
 * Everything the UI is allowed to decide about an import lives here, so no
 * component compares status strings on its own. All of it is derived from the
 * backend's record; the frontend never advances a status itself.
 */

export const getImportStatus = (record) => record?.status ?? null;

// Confirmation has begun, so transactions exist (or are being created).
export const isImportPosted = (record) => POSTED_STATUSES.includes(record?.status);

// The backend is still working: poll GET /imports/{id}.
export const isImportInFlight = (record) => IN_FLIGHT_STATUSES.includes(record?.status);

export const isImportFinal = (record) => FINAL_STATUSES.includes(record?.status);

/*
 * Rows and mapping may still be changed. The backend's `is_editable` decides
 * whenever it sends one; otherwise anything already posted or finished is
 * read-only.
 */
export function canEditImport(record) {
  if (!record) return false;
  if (typeof record.is_editable === "boolean") return record.is_editable;
  return !isImportPosted(record) && !isImportFinal(record);
}

// Kept as the previous name so existing callers keep working.
export const isImportEditable = canEditImport;

/*
 * Confirm is offered only once the rows have been validated and at least one
 * is actually importable; `partially_valid` counts, the invalid rows are
 * simply left out. Never after confirmation has begun.
 */
export function canConfirmImport(record) {
  if (!record || isImportPosted(record) || isImportFinal(record)) return false;
  if (!["ready_for_review", "partially_valid"].includes(record.status)) return false;
  return getImportableCount(record) > 0;
}

// Cancel abandons an import that never posted anything. Once money has moved
// the only way back is Reverse.
export function canCancelImport(record) {
  if (!record || isImportPosted(record) || isImportFinal(record)) return false;
  return IMPORT_STATUSES.includes(record.status);
}

// Reverse undoes a completed import by posting opposing transactions.
export const canReverseImport = (record) => record?.status === "completed";

/*
 * The one action that moves this import forward, for the history list and the
 * wizard header. Null when the import is read-only.
 */
export function getImportNextAction(record) {
  if (!record) return null;
  if (isImportInFlight(record)) return "viewStatus";
  if (canConfirmImport(record)) return "review";

  const step = getImportStep(record);
  if (step === "map") return "continue";
  if (step === "validate") return "validate";
  if (step === "review") return "review";
  if (canReverseImport(record)) return "reverse";
  return "view";
}

// Rows that confirmation would actually post: valid ones, minus nothing else.
// Taken from the backend's counts; never recounted from a page of rows.
export function getImportableCount(record) {
  const counts = record?.counts ?? {};
  const valid = Number(counts.valid);
  return Number.isFinite(valid) ? valid : 0;
}

const toTime = (value) => {
  const time = Date.parse(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(time) ? null : time;
};

/*
 * Wizard step from the backend's fields, never from a local status:
 * - anything posted or finished → confirm (the outcome screen);
 * - `mapping_required` or no mapping → map;
 * - mapped but not validated since the mapping was saved → validate;
 * - validated → review.
 */
export function getImportStep(record) {
  if (!record) return "upload";
  if (isImportPosted(record) || isImportFinal(record)) return "confirm";
  if (record.status === "mapping_required" || Object.keys(normalizeMapping(record.mapping)).length === 0) return "map";

  const mappedAt = toTime(record.mapped_at);
  const validatedAt = toTime(record.validated_at);

  if (!record.validated_at || (mappedAt != null && validatedAt != null && mappedAt > validatedAt)) return "validate";
  return "review";
}

/* ---------- Mapping form ---------- */

export function getMappingFields(...mappings) {
  const extra = mappings
    .flatMap((mapping) => Object.keys(normalizeMapping(mapping)))
    .filter((field) => !MAPPING_FIELDS.includes(field));

  return [...MAPPING_FIELDS, ...new Set(extra)];
}

// Select values are strings ("" = not mapped).
export const toMappingForm = (mapping) =>
  Object.fromEntries(Object.entries(normalizeMapping(mapping)).map(([field, index]) => [field, String(index)]));

export const mappingFormToPayload = (form) =>
  Object.fromEntries(
    Object.entries(form)
      .filter(([, value]) => value !== "" && value != null)
      .map(([field, value]) => [field, Number(value)]),
  );

/*
 * Convenience checks before saving (the backend validates the mapping):
 * a date column, an amount source (one amount column or debit / credit),
 * and an account. Returns { key: translation key }.
 */
export function validateMappingForm(form, accountId) {
  const errors = {};
  const has = (field) => form[field] !== undefined && form[field] !== "";

  if (!has("date")) errors.date = "dateRequired";
  if (!has("amount") && !has("debit") && !has("credit")) errors.amount = "amountRequired";
  if (!accountId) errors.account_id = "accountRequired";

  return errors;
}

// 422 field messages of POST /imports/{id}/mapping, by form field:
// "mapping.date" → date, "account_id" → account_id; the rest → general.
export function splitMappingErrors(error) {
  const byField = {};
  const general = [];

  Object.entries(error?.errors ?? {}).forEach(([key, messages]) => {
    const list = (Array.isArray(messages) ? messages : [messages]).filter((message) => typeof message === "string");
    const field = key.startsWith("mapping.") ? key.slice("mapping.".length) : key === "mapping" ? null : key;

    if (field) byField[field] = list;
    else general.push(...list);
  });

  return { byField, general };
}

/* ---------- Rows ---------- */

// The original file cell of a row field, through the saved mapping.
export function getRawValue(row, mapping, rowField) {
  const cells = row?.raw?.cells;
  if (!Array.isArray(cells)) return null;

  const columns = normalizeMapping(mapping);
  const values = (ROW_FIELD_COLUMNS[rowField] ?? [])
    .map((field) => columns[field])
    .filter((index) => index != null)
    .map((index) => cells[index])
    .filter((value) => value != null && value !== "");

  return values.length > 0 ? values.join(" / ") : null;
}

export const toRowForm = (row) => ({
  transaction_date: String(row?.transaction_date ?? "").slice(0, 10),
  transaction_type: TRANSACTION_TYPES.includes(row?.transaction_type) ? row.transaction_type : "",
  amount: toAmountInput(row?.amount ?? ""),
  description: row?.description ?? "",
  category_id: row?.category_id != null ? String(row.category_id) : "",
});

/*
 * Only the fields the user changed. `raw`, `status`, `errors` and `currency`
 * are never sent: the backend keeps the original cells and revalidates.
 */
export function getRowChanges(row, form, categories = []) {
  const initial = toRowForm(row);
  const changes = {};

  if (form.transaction_date !== initial.transaction_date) changes.transaction_date = form.transaction_date || null;
  if (form.transaction_type !== initial.transaction_type) changes.transaction_type = form.transaction_type || null;
  if (form.description.trim() !== initial.description.trim()) changes.description = form.description.trim() || null;
  if (toMoneyString(form.amount) !== toMoneyString(initial.amount)) changes.amount = form.amount.trim();
  if (form.category_id !== initial.category_id) {
    const category = categories.find((item) => String(item.id) === form.category_id);
    changes.category_id = form.category_id ? (category?.id ?? Number(form.category_id)) : null;
  }

  return changes;
}

// Translation keys (under dashboard.importPage.rowEditor.errors) by field.
export function validateRowChanges(changes) {
  const errors = {};

  if ("transaction_date" in changes && changes.transaction_date && !isIsoDate(changes.transaction_date)) {
    errors.transaction_date = "dateInvalid";
  }
  if ("amount" in changes) {
    const amountError = getAmountError(changes.amount);
    if (amountError) errors.amount = amountError;
  }

  return errors;
}

// Row errors as [{ field, code, message }], tolerating plain strings.
export function getRowErrors(row) {
  const errors = row?.errors;
  const list = Array.isArray(errors) ? errors : isObject(errors) ? Object.entries(errors).map(([field, value]) => ({ field, message: value })) : [];

  return list
    .map((item) =>
      typeof item === "string"
        ? { field: null, code: null, message: item }
        : {
          field: item?.field ?? null,
          code: item?.code ?? null,
          message: Array.isArray(item?.message) ? item.message.join(" ") : (item?.message ?? null),
        },
    )
    .filter((item) => item.code || item.message);
}

/* ---------- Errors ---------- */

/*
 * Import wording for codes where the generic message would mislead.
 * `context`: "upload" | "mapping" | "validate" | "preview" | "row" | "ignore"
 * | "confirm" | "reverse" | "cancel" | "resume" | "list".
 * 413 / 415 come from the web server before the backend's validation.
 *
 * A 409 is a lifecycle answer, not a failure to retry: the import was already
 * confirmed or already reversed. Its own wording says so, and the caller
 * reloads the import instead of sending the operation again.
 */
export function getImportErrorMessage(error, t, context) {
  if (error?.status === 413) return t("dashboard.importPage.errors.tooLarge");
  if (error?.status === 415) return t("dashboard.importPage.errors.unsupported");
  if (error?.code === "FORBIDDEN") return t("dashboard.importPage.errors.forbidden");
  // The backend answers 404 (not 403) for another user's import, on purpose.
  if (error?.code === "NOT_FOUND") return t("dashboard.importPage.errors.notFound");
  if (error?.code === "CONFLICT") {
    if (context === "confirm") return error.message || t("dashboard.importPage.errors.alreadyConfirmed");
    if (context === "reverse") return error.message || t("dashboard.importPage.errors.alreadyReversed");
    return error.message || t("dashboard.importPage.errors.conflict");
  }
  if (error?.code === "VALIDATION_ERROR") {
    return error.message || t(`dashboard.importPage.errors.invalid.${context === "upload" ? "file" : "data"}`);
  }

  return getApiErrorMessage(error, t);
}

/* ---------- Confirm / reverse ---------- */

// A 409 means the backend already did it: reload rather than send again.
export const isImportLifecycleConflict = (error) => error?.code === "CONFLICT";

export const REVERSE_REASON_MAX = 500;

// The reason is required so the reversal stays auditable.
export function validateReverseReason(reason) {
  const value = String(reason ?? "").trim();

  if (!value) return "required";
  if (value.length > REVERSE_REASON_MAX) return "tooLong";
  return null;
}

/* ---------- Status polling ---------- */

// Delay before each status check while an import is confirmed / processing.
const POLL_DELAYS_MS = [1500, 2000, 3000, 4000, 5000, 8000];
const POLL_STEADY_MS = 10_000;
export const MAX_IMPORT_POLLS = 40;

export const getImportPollDelay = (count) => POLL_DELAYS_MS[count] ?? POLL_STEADY_MS;

// Codes where polling again cannot help.
export const FATAL_POLL_CODES = ["NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"];

// 422 field messages, flattened and without the headline message.
export function getFieldMessages(error) {
  if (error?.code !== "VALIDATION_ERROR" || !isObject(error.errors)) return [];

  return [
    ...new Set(
      Object.values(error.errors)
        .flat()
        .filter((message) => typeof message === "string" && message !== error.message),
    ),
  ];
}
