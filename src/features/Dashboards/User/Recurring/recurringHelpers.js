import { getApiErrorMessage, getStoredWorkspace, toMoneyString } from "../api/apiClient";
import {
  getAmountError,
  getTodayInputValue,
  isInsufficientBalanceError,
  toAmountInput,
} from "../FinancialOperations/transactionHelpers";
import { parsePage } from "../SavingsGoals/savingsGoalHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";

export { parsePage };

export const RECURRING_TYPES = ["expense", "income"];
export const RECURRING_STATUSES = ["active", "paused", "completed", "archived"];
export const FREQUENCIES = ["weekly", "monthly", "yearly"];
export const PROCESSING_MODES = ["manual", "automatic"];
export const OCCURRENCE_STATUSES = ["scheduled", "due", "posted", "skipped", "failed", "cancelled"];
export const NAME_MAX = 150;
export const INTERVAL_MIN = 1;
export const INTERVAL_MAX = 60;
export const MAX_OCCURRENCES_MIN = 1;
export const MAX_OCCURRENCES_MAX = 1000;
export const REASON_MAX = 500;
export const PER_PAGE = 15;
export const OCCURRENCES_PER_PAGE = 10;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER = /^\d+$/;

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// "YYYY-MM-DD" part of a backend date, so a time zone never shifts the day.
export const toDateOnly = (value) => String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/* ---------- Entities ---------- */

export const isRuleEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

// The backend's status; "unknown" when it sends something else.
export const getRuleStatus = (rule) =>
  RECURRING_STATUSES.includes(rule?.status) ? rule.status : "unknown";

export const getRuleType = (rule) =>
  RECURRING_TYPES.includes(rule?.type) ? rule.type : "unknown";

export const getRuleCurrency = (rule) =>
  rule?.currency_code || rule?.account?.currency_code || "";

const toCount = (value) => {
  const number = Number(value);
  return value != null && value !== "" && Number.isFinite(number) ? number : null;
};

/*
 * `rule.schedule` (details, and possibly list rows): the next open occurrence
 * and how many are open. Either can be null; `known` is false when the
 * response didn't include a schedule at all.
 */
export function getSchedule(rule) {
  const schedule = rule?.schedule;

  if (!schedule || typeof schedule !== "object") {
    return { known: false, next: null, openCount: null };
  }

  const next = schedule.next_occurrence;

  return {
    known: true,
    next: next && typeof next === "object" ? next : null,
    openCount: toCount(schedule.open_occurrences_count),
  };
}

export const isOverdueOccurrence = (occurrence) => isTrue(occurrence?.is_overdue);
export const isOpenOccurrence = (occurrence) => isTrue(occurrence?.is_open);

/*
 * What the UI offers for each status. The backend has the final say: every
 * action still handles its rejection (422 / 409).
 * - active: edit, pause, archive; confirm / skip while an occurrence is open
 *   (or when the response didn't say, so the backend decides).
 * - paused: edit, resume, archive. Nothing is confirmed or skipped while
 *   paused.
 * - completed: read-only apart from archiving it.
 * - archived (or unknown): read-only.
 */
export function getRuleActions(rule) {
  const status = getRuleStatus(rule);
  const { known, openCount, next } = getSchedule(rule);
  const hasOpenOccurrence = !known || (openCount == null ? next != null : openCount > 0);

  return {
    canEdit: status === "active" || status === "paused",
    canPause: status === "active",
    canResume: status === "paused",
    canConfirm: status === "active" && hasOpenOccurrence,
    canSkip: status === "active" && hasOpenOccurrence,
    canArchive: status === "active" || status === "paused" || status === "completed",
  };
}

// Merges a write response into the displayed rule; relations the response
// doesn't carry keep their last known value.
export function mergeRule(current, next) {
  if (!isRuleEntity(next)) return current;

  const merged = { ...current, ...next };
  ["account", "category", "owner", "schedule"].forEach((key) => {
    if (next[key] === undefined && current?.[key] !== undefined) merged[key] = current[key];
  });

  return merged;
}

/* ---------- List filters (kept in the URL) ---------- */

export const EMPTY_FILTERS = {
  type: "",
  status: "",
  frequency: "",
  processing_mode: "",
  account_id: "",
  due_from: "",
  due_to: "",
  page: 1,
};

export function readRecurringFilters(searchParams) {
  const pick = (name, test) => {
    const value = searchParams.get(name) ?? "";
    return test(value) ? value : "";
  };
  const page = Number(searchParams.get("page"));
  const dueFrom = pick("due_from", (value) => DATE.test(value));
  const dueTo = pick("due_to", (value) => DATE.test(value) && (!dueFrom || value >= dueFrom));

  return {
    type: pick("type", (value) => RECURRING_TYPES.includes(value)),
    status: pick("status", (value) => RECURRING_STATUSES.includes(value)),
    frequency: pick("frequency", (value) => FREQUENCIES.includes(value)),
    processing_mode: pick("processing_mode", (value) => PROCESSING_MODES.includes(value)),
    account_id: pick("account_id", (value) => INTEGER.test(value)),
    due_from: dueFrom,
    due_to: dueTo,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function recurringFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

// The session workspace when known; without it the backend lists every
// workspace the user can access.
export const recurringFiltersToQuery = (filters) => ({
  workspace_id: getStoredWorkspace()?.id,
  type: filters.type || undefined,
  status: filters.status || undefined,
  frequency: filters.frequency || undefined,
  processing_mode: filters.processing_mode || undefined,
  account_id: filters.account_id || undefined,
  due_from: filters.due_from || undefined,
  due_to: filters.due_to || undefined,
  per_page: PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

export const hasActiveRecurringFilters = (filters) =>
  Object.entries(filters).some(([key, value]) => key !== "page" && value !== "");

/* ---------- Form ---------- */

const text = (value) => (value == null ? "" : String(value));

export function toFormValues(rule, presetType) {
  if (rule) {
    return {
      type: getRuleType(rule),
      account_id: text(rule.account_id ?? rule.account?.id),
      category_id: text(rule.category_id ?? rule.category?.id),
      name: rule.name ?? "",
      amount: toAmountInput(rule.amount),
      frequency: rule.frequency ?? "",
      interval: text(rule.interval ?? 1),
      start_date: toDateOnly(rule.start_date),
      end_date: toDateOnly(rule.end_date),
      max_occurrences: text(rule.max_occurrences),
      processing_mode: PROCESSING_MODES.includes(rule.processing_mode) ? rule.processing_mode : "manual",
      description: rule.description ?? "",
      notes: rule.notes ?? "",
    };
  }

  return {
    type: RECURRING_TYPES.includes(presetType) ? presetType : "expense",
    account_id: "",
    category_id: "",
    name: "",
    amount: "",
    frequency: "monthly",
    interval: "1",
    start_date: getTodayInputValue(),
    end_date: "",
    max_occurrences: "",
    processing_mode: "manual",
    description: "",
    notes: "",
  };
}

const inRange = (value, min, max) =>
  INTEGER.test(value) && Number(value) >= min && Number(value) <= max;

// Returns `{ field: [message] }` for the values the form is about to send.
export function validateRuleForm(form, { isEditing, t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.recurring.validation.${key}`, options)];
  };
  const name = form.name.trim();

  if (!isEditing) {
    if (!RECURRING_TYPES.includes(form.type)) add("type", "typeRequired");
    if (!form.account_id) add("account_id", "accountRequired");
    // Required for income and expense rules alike.
    if (!form.category_id) add("category_id", "categoryRequired");
    if (!FREQUENCIES.includes(form.frequency)) add("frequency", "frequencyRequired");
    if (!DATE.test(form.start_date)) add("start_date", "startDateRequired");
  }

  if (!name) add("name", "nameRequired");
  else if (name.length > NAME_MAX) add("name", "nameTooLong", { max: NAME_MAX });

  const amountError = getAmountError(form.amount);
  if (amountError) errors.amount = [t(`dashboard.transactions.validation.${amountError}`)];

  if (!inRange(String(form.interval).trim(), INTERVAL_MIN, INTERVAL_MAX)) {
    add("interval", "intervalRange", { min: INTERVAL_MIN, max: INTERVAL_MAX });
  }

  const maxOccurrences = String(form.max_occurrences).trim();
  if (maxOccurrences && !inRange(maxOccurrences, MAX_OCCURRENCES_MIN, MAX_OCCURRENCES_MAX)) {
    add("max_occurrences", "maxOccurrencesRange", { min: MAX_OCCURRENCES_MIN, max: MAX_OCCURRENCES_MAX });
  }

  if (form.end_date) {
    if (!DATE.test(form.end_date)) add("end_date", "dateInvalid");
    // ISO dates compare correctly as strings.
    else if (DATE.test(form.start_date) && form.end_date < form.start_date) add("end_date", "endBeforeStart");
  }

  if (!PROCESSING_MODES.includes(form.processing_mode)) add("processing_mode", "processingModeRequired");

  return errors;
}

const toId = (value) => (INTEGER.test(String(value)) ? Number(value) : value);

/*
 * POST body. `currency_code` is left out: the backend takes the account's
 * currency. `user_id`, `status`, `next_due_date` and `last_processed_at` are
 * never sent.
 */
export function buildCreatePayload(form) {
  const description = form.description.trim();
  const notes = form.notes.trim();
  const maxOccurrences = String(form.max_occurrences).trim();

  return {
    account_id: toId(form.account_id),
    category_id: toId(form.category_id),
    name: form.name.trim(),
    type: form.type,
    amount: form.amount.trim(),
    frequency: form.frequency,
    interval: Number(form.interval),
    start_date: form.start_date,
    ...(form.end_date ? { end_date: form.end_date } : {}),
    ...(maxOccurrences ? { max_occurrences: Number(maxOccurrences) } : {}),
    processing_mode: form.processing_mode,
    ...(description ? { description } : {}),
    ...(notes ? { notes } : {}),
  };
}

// PATCH body: only the editable fields that changed; a cleared optional field
// is sent as null.
export function buildUpdatePayload(form, rule) {
  const original = toFormValues(rule);
  const payload = {};
  const maxOccurrences = String(form.max_occurrences).trim();

  if (form.name.trim() !== original.name.trim()) payload.name = form.name.trim();
  if (toMoneyString(form.amount.trim()) !== toMoneyString(rule.amount)) payload.amount = form.amount.trim();
  if (String(form.interval).trim() !== original.interval) payload.interval = Number(form.interval);
  if (form.end_date !== original.end_date) payload.end_date = form.end_date || null;
  if (maxOccurrences !== original.max_occurrences) {
    payload.max_occurrences = maxOccurrences ? Number(maxOccurrences) : null;
  }
  if (form.processing_mode !== original.processing_mode) payload.processing_mode = form.processing_mode;
  if (form.description.trim() !== original.description.trim()) {
    payload.description = form.description.trim() || null;
  }
  if (form.notes.trim() !== original.notes.trim()) payload.notes = form.notes.trim() || null;

  return payload;
}

// Accounts a rule can use: active and not a savings-goal container (a goal's
// money only moves through the goal's own flow).
export const getEligibleAccounts = (accounts) =>
  accounts.filter(
    (account) =>
      account?.id != null &&
      account.status !== "archived" &&
      account.savings_goal == null &&
      account.savings_goal_id == null,
  );

/* ---------- Occurrences (details page, kept in the URL) ---------- */

export function readOccurrenceFilters(searchParams) {
  const status = searchParams.get("occurrence_status") ?? "";
  const page = Number(searchParams.get("occurrences_page"));

  return {
    occurrence_status: OCCURRENCE_STATUSES.includes(status) ? status : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function occurrenceFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.occurrence_status) params.set("occurrence_status", filters.occurrence_status);
  if (filters.page > 1) params.set("occurrences_page", String(filters.page));
  return params;
}

export const occurrenceFiltersToQuery = (filters) => ({
  occurrence_status: filters.occurrence_status || undefined,
  per_page: OCCURRENCES_PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

/* ---------- Errors ---------- */

const collectErrorText = (error) =>
  [error?.message, ...Object.values(error?.errors ?? {}).flat()]
    .filter((item) => typeof item === "string")
    .join(" ");

/*
 * The occurrence a failed confirm-next reports (422 with `data.occurrence`,
 * status "failed" and `failure_reason`), or null. A 422 from this endpoint
 * does not always carry field errors.
 */
export function getFailedOccurrence(error) {
  const occurrence = error?.payload?.data?.occurrence;
  return error?.code === "VALIDATION_ERROR" && occurrence && typeof occurrence === "object"
    ? occurrence
    : null;
}

// 422 from confirm/skip because there is nothing open to act on.
export const isNoOpenOccurrenceError = (error) =>
  error?.code === "VALIDATION_ERROR" &&
  !getFailedOccurrence(error) &&
  /no (open|pending|due)|nothing to|not found|no occurrence/i.test(collectErrorText(error));

/*
 * Recurring wording for codes where the generic message would mislead.
 * `context`: "load", "save", "archive", "pause", "resume", "confirm" or
 * "skip". A 422 keeps the backend's message: it is the domain reason (rule
 * paused or archived, nothing open, insufficient balance…).
 */
export function getRecurringErrorMessage(error, t, context = "load") {
  if (error?.code === "FORBIDDEN") return t("dashboard.recurring.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.recurring.errors.notFound");

  if (error?.code === "CONFLICT") {
    if (context === "archive") return t("dashboard.recurring.errors.alreadyArchived");
    if (context === "save") return t("dashboard.recurring.errors.archivedLocked");
    return error.message || t("dashboard.recurring.errors.conflict");
  }

  if (error?.code === "VALIDATION_ERROR") {
    const failed = getFailedOccurrence(error);
    if (failed?.failure_reason) return String(failed.failure_reason);
    if (isInsufficientBalanceError(error) && !error.message) {
      return t("dashboard.recurring.errors.insufficientBalance");
    }
    if (error.message) return error.message;
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.recurring.errors.validation");
  }

  return getApiErrorMessage(error, t);
}

// Extra line under a confirm-next error: what happened to the money.
export function getConfirmErrorHint(error, t) {
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) return t("dashboard.recurring.errors.unknownOutcome");
  if (getFailedOccurrence(error)) return t("dashboard.recurring.errors.failedOccurrenceHint");
  if (isNoOpenOccurrenceError(error)) return t("dashboard.recurring.errors.noOpenOccurrenceHint");
  if (error?.code === "VALIDATION_ERROR" && isInsufficientBalanceError(error)) {
    return t("dashboard.recurring.errors.insufficientBalanceHint");
  }
  if (error?.code === "VALIDATION_ERROR") return t("dashboard.recurring.errors.notPostedHint");
  return "";
}

export const isUnknownOutcome = (error) => UNKNOWN_OUTCOME_CODES.includes(error?.code);
