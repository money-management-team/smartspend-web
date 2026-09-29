import { getApiErrorMessage } from "../api/apiClient";
import { ACCOUNT_CURRENCIES } from "../Accounts/accountHelpers";
import { getAmountError } from "../FinancialOperations/transactionHelpers";

export const BUDGET_SCOPES = ["general", "category"];
// Lifecycle status of the budget itself (not its progress).
export const BUDGET_STATUSES = ["active", "archived"];
// `progress.status` values the backend sends; unknown values are shown raw.
export const BUDGET_PROGRESS_STATUSES = ["safe", "warning", "near_limit", "exceeded"];
export const BUDGETS_PER_PAGE = 20;
export const BUDGET_CURRENCIES = ACCOUNT_CURRENCIES;
export const NAME_MAX = 150;
export const NOTES_MAX = 1000;

/* ---------- Entities ---------- */

export const isBudgetEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// `category` is an object or null (never a bare id); `scope` is the backend's
// own word, with the category as a fallback when it is missing.
export const getBudgetScope = (budget) =>
  BUDGET_SCOPES.includes(budget?.scope)
    ? budget.scope
    : budget?.category
      ? "category"
      : "general";

export const isArchivedBudget = (budget) =>
  budget?.status === "archived" ||
  Boolean(budget?.archived_at) ||
  isTrue(budget?.progress?.is_archived);

// Archived budgets are read-only: no edit, no second archive.
export const canManageBudget = (budget) => Boolean(budget) && !isArchivedBudget(budget);

/*
 * The budget's progress as the backend calculated it, or null when absent.
 * Money stays in the backend's decimal strings; nothing is recalculated.
 *
 * Canonical fields (the only ones the UI reads): `amount_limit`, `spent`,
 * `remaining` (negative once exceeded, never clamped), `percentage_used`,
 * `status`, `expenses_count`, `currency_code`. Compatibility aliases the
 * backend may also send (`limit_amount`, `amount_spent`, `remaining_amount`,
 * `percentage`, `expense_count`, `currency`) are ignored. `amount_limit` and
 * `currency_code` fall back to the budget's own values, because the
 * progress-only endpoint may omit them.
 */
export function getBudgetProgress(budget) {
  const progress = budget?.progress;
  if (!progress || typeof progress !== "object") return null;

  return {
    ...progress,
    amount_limit: progress.amount_limit ?? budget.amount_limit,
    currency_code: progress.currency_code ?? budget.currency_code,
  };
}

// Merges a fresh GET /budgets/{id}/progress result into the budget. Fields the
// response doesn't carry keep their previous values.
export const withFreshProgress = (budget, progress) => ({
  ...budget,
  progress: { ...(budget?.progress ?? {}), ...progress },
});

// Merges a write response into the displayed budget. An archive response has
// no `progress`, so the last calculated one is kept (flagged as archived).
export function mergeBudget(current, next) {
  const merged = { ...current, ...next };

  if (!next?.progress && current?.progress) {
    merged.progress = {
      ...current.progress,
      ...(isArchivedBudget(next) ? { is_archived: true } : {}),
    };
  }

  return merged;
}

/* ---------- Progress display ---------- */

export const getProgressStatus = (progress) =>
  BUDGET_PROGRESS_STATUSES.includes(progress?.status) ? progress.status : "unknown";

// Width of the bar only: the bar can't go past 0–100 %, but the real
// percentage (which can exceed 100) is always shown as text.
export function getProgressBarWidth(percentage) {
  const value = Number(percentage);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function formatPercentage(value, locale) {
  const number = Number(value);
  if (value == null || value === "" || !Number.isFinite(number)) return "—";

  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(number / 100);
}

// "upcoming", "ended" or "current", from the backend's own flags; null when
// the progress doesn't say.
export function getPeriodState(progress) {
  if (!progress) return null;
  if (isTrue(progress.has_ended)) return "ended";
  if (progress.has_started != null && !isTrue(progress.has_started)) return "upcoming";
  if (progress.has_started != null) return "current";
  return null;
}

/* ---------- List ---------- */

/*
 * `data.budgets` is a Laravel paginator: the rows are in `data.budgets.data`.
 * A plain array is accepted defensively (one page). Anything else is treated
 * as a malformed response instead of being guessed at.
 */
export function parseBudgetPage(response) {
  const payload = response?.data?.budgets;

  if (Array.isArray(payload)) {
    return {
      items: payload,
      page: 1,
      lastPage: 1,
      total: payload.length,
      from: payload.length ? 1 : 0,
      to: payload.length,
    };
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    return null;
  }

  const toInt = (value, fallback) => {
    const number = Number(value);
    return value != null && Number.isFinite(number) ? number : fallback;
  };
  const page = toInt(payload.current_page, 1);
  const perPage = toInt(payload.per_page, payload.data.length);
  const total = toInt(payload.total, payload.data.length);
  const from = toInt(payload.from, payload.data.length ? (page - 1) * perPage + 1 : 0);

  return {
    items: payload.data,
    page,
    lastPage: Math.max(1, toInt(payload.last_page, 1)),
    total,
    from,
    to: toInt(payload.to, from + payload.data.length - 1),
  };
}

/* ---------- Filters (kept in the URL) ---------- */

const ID = /^\d+$/;
const CURRENCY = /^[A-Z]{3}$/;

/*
 * Reads and sanitizes the list filters and page from the URL. A category only
 * exists on category budgets, so it is dropped with the "general" scope, and
 * an inverted period range drops its end. `date_from` / `date_to` are kept
 * even when only one is set, so the user can finish the range; they are sent
 * only as a pair (see `budgetFiltersToQuery`).
 */
export function readBudgetFilters(searchParams) {
  const pick = (name, test) => {
    const value = searchParams.get(name) ?? "";
    return test(value) ? value : "";
  };
  const isDate = (value) => DATE.test(value);
  const scope = pick("scope", (value) => BUDGET_SCOPES.includes(value));
  const dateFrom = pick("date_from", isDate);
  const dateTo = pick("date_to", isDate);
  const page = Number(searchParams.get("page"));

  return {
    scope,
    category_id: scope === "general" ? "" : pick("category_id", (value) => ID.test(value)),
    owner: pick("owner", (value) => value === "mine"),
    currency_code: pick("currency_code", (value) => CURRENCY.test(value)),
    status: pick("status", (value) => BUDGET_STATUSES.includes(value)),
    progress_status: pick("progress_status", (value) => BUDGET_PROGRESS_STATUSES.includes(value)),
    date_from: dateFrom,
    date_to: dateFrom && dateTo && dateTo < dateFrom ? "" : dateTo,
    active_on: pick("active_on", isDate),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// URL params for a filter state (empty values and page 1 are omitted).
export function budgetFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

// The period filter needs both ends; with only one, neither is sent.
export const hasCompleteDateRange = (filters) => Boolean(filters.date_from && filters.date_to);

/*
 * GET /budgets query. Every filter is applied by the backend (progress status
 * included: it is never filtered on the client). `workspaceId` is the session
 * workspace; when it is unknown, it is omitted and the backend lists every
 * workspace the user can see.
 */
export function budgetFiltersToQuery(filters, workspaceId) {
  const withRange = hasCompleteDateRange(filters);

  return {
    workspace_id: workspaceId ?? undefined,
    scope: filters.scope || undefined,
    category_id: filters.category_id || undefined,
    owner: filters.owner || undefined,
    currency_code: filters.currency_code || undefined,
    status: filters.status || undefined,
    progress_status: filters.progress_status || undefined,
    date_from: withRange ? filters.date_from : undefined,
    date_to: withRange ? filters.date_to : undefined,
    active_on: filters.active_on || undefined,
    per_page: BUDGETS_PER_PAGE,
    page: filters.page,
  };
}

export const hasActiveBudgetFilters = (filters) =>
  Boolean(
    filters.scope ||
      filters.category_id ||
      filters.owner ||
      filters.currency_code ||
      filters.status ||
      filters.progress_status ||
      filters.date_from ||
      filters.date_to ||
      filters.active_on,
  );

/* ---------- Form values ---------- */

const toDateInput = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

// "YYYY-MM-DD" part of a period date ("2026-08-01" or an ISO datetime), so a
// time zone can never shift the day.
export const toPeriodDate = (value) =>
  String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

// The current calendar month, the most common budget period.
export function getDefaultPeriod() {
  const now = new Date();

  return {
    period_start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    period_end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

// Currencies offered by the form: the usual list plus the workspace's base
// currency and the budget's own, so an existing value is never lost.
export const getCurrencyOptions = (...extra) =>
  [...new Set([...BUDGET_CURRENCIES, ...extra].filter(Boolean))];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Returns `{ field: [message] }` for the values the form is about to send.
export function validateBudgetForm(form, { isEditing, t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.budgets.validation.${key}`, options)];
  };
  const name = form.name.trim();

  if (!name) add("name", "nameRequired");
  else if (name.length > NAME_MAX) add("name", "nameTooLong", { max: NAME_MAX });

  if (!isEditing) {
    if (form.scope === "category" && !form.category_id) add("category_id", "categoryRequired");
    if (!/^[A-Z]{3}$/.test(form.currency_code)) add("currency_code", "currencyRequired");
  }

  const amountError = getAmountError(form.amount_limit);
  if (amountError) {
    errors.amount_limit = [t(`dashboard.transactions.validation.${amountError}`)];
  }

  if (!DATE.test(form.period_start)) add("period_start", "startRequired");
  if (!DATE.test(form.period_end)) add("period_end", "endRequired");
  // ISO dates compare correctly as strings.
  else if (DATE.test(form.period_start) && form.period_end < form.period_start) {
    add("period_end", "endBeforeStart");
  }

  if (form.notes.trim().length > NOTES_MAX) add("notes", "notesTooLong", { max: NOTES_MAX });

  return errors;
}

/* ---------- Errors ---------- */

/*
 * Budget wording for codes where the generic message would mislead.
 * - 403: the workspace isn't owned/managed by this user.
 * - 404: never says whether the budget doesn't exist or isn't the user's.
 * - 409: an archived budget can't be changed (`save`) or archived again
 *   (`archive`).
 * A 422 keeps the backend's own message; the field errors go under the inputs.
 */
export function getBudgetErrorMessage(error, t, context = "load") {
  if (error?.code === "FORBIDDEN") return t("dashboard.budgets.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.budgets.errors.notFound");

  if (error?.code === "CONFLICT") {
    return t(
      context === "archive"
        ? "dashboard.budgets.errors.alreadyArchived"
        : "dashboard.budgets.errors.archivedLocked",
    );
  }

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.budgets.errors.validation");
  }

  return getApiErrorMessage(error, t);
}
