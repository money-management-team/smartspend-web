import { getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";
import { ACCOUNT_CURRENCIES } from "../Accounts/accountHelpers";
import {
  getAmountError,
  isInsufficientBalanceError,
  sameId,
} from "../FinancialOperations/transactionHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";

// Lifecycle (`goal.status`) and progress (`progress.status`) are two separate
// backend values: a goal can be "paused" while its progress is "almost_there".
export const GOAL_STATUSES = ["active", "paused", "achieved", "archived"];
export const GOAL_PROGRESS_STATUSES = ["not_started", "in_progress", "almost_there", "achieved"];
// History tabs: all movements, contributions only, withdrawals only.
export const HISTORY_TABS = ["all", "contribution", "withdrawal"];
export const GOAL_CURRENCIES = ACCOUNT_CURRENCIES;
export const NAME_MAX = 150;
export const NOTES_MAX = 1000;
export const DESCRIPTION_MAX = 500;
export const PER_PAGE = 12;
export const HISTORY_PER_PAGE = 10;

/* ---------- Entities ---------- */

export const isGoalEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// The backend's lifecycle status; "unknown" when it sends something else.
export function getGoalStatus(goal) {
  if (GOAL_STATUSES.includes(goal?.status)) return goal.status;
  if (goal?.archived_at || isTrue(goal?.progress?.is_archived)) return "archived";
  return "unknown";
}

export const isArchivedGoal = (goal) => getGoalStatus(goal) === "archived";

// Sign check on the backend's decimal string, without converting to a float.
export function isPositiveMoney(value) {
  const text = String(value ?? "").trim();
  return !text.startsWith("-") && /[1-9]/.test(text);
}

/*
 * The goal's progress as the backend calculated it, or null when absent.
 * Money stays in the backend's decimal strings. `target_amount`,
 * `currency_code` and `target_date` fall back to the goal's own values,
 * because the list/details progress may omit them.
 */
export function getGoalProgress(goal) {
  const progress = goal?.progress;
  if (!progress || typeof progress !== "object") return null;

  return {
    ...progress,
    target_amount: progress.target_amount ?? goal.target_amount,
    currency_code: progress.currency_code ?? goal.currency_code,
    target_date: progress.target_date ?? goal.target_date,
  };
}

export const getGoalCurrency = (goal) =>
  goal?.currency_code || goal?.progress?.currency_code || goal?.account?.currency_code || "";

// Merges a fresh GET /savings-goals/{id}/progress result into the goal.
export const withFreshProgress = (goal, progress) => ({
  ...goal,
  progress: { ...(goal?.progress ?? {}), ...progress },
});

// Merges a write response into the displayed goal. A response without
// `progress` or `account` keeps the last known ones (an archive response is
// flagged as archived).
export function mergeGoal(current, next) {
  const merged = { ...current, ...next };

  if (!next?.progress && current?.progress) {
    merged.progress = {
      ...current.progress,
      ...(isArchivedGoal(next) ? { is_archived: true } : {}),
    };
  }
  if (!next?.account && current?.account) merged.account = current.account;

  return merged;
}

/*
 * What the UI offers for each lifecycle status. The backend has the final
 * say: every action still handles its rejection.
 * - active / achieved: edit, contribute (overfunding is allowed), withdraw
 *   while the goal holds money, pause.
 * - paused: edit, withdraw, resume. No contributions.
 * - archived: read-only.
 * Archive is offered to every non-archived goal, but can only be confirmed
 * once the goal's balance is zero (`mustWithdrawFirst`).
 */
export function getGoalActions(goal) {
  const status = getGoalStatus(goal);
  const saved = getGoalProgress(goal)?.saved_amount;
  const hasBalance = isPositiveMoney(saved);

  if (status === "archived") {
    return {
      canEdit: false,
      canContribute: false,
      canWithdraw: false,
      canPause: false,
      canResume: false,
      canArchive: false,
      mustWithdrawFirst: false,
    };
  }

  return {
    canEdit: true,
    canContribute: status !== "paused",
    // Unknown balance (no progress): let the backend decide.
    canWithdraw: hasBalance || saved == null,
    canPause: status !== "paused",
    canResume: status === "paused",
    canArchive: true,
    mustWithdrawFirst: hasBalance,
  };
}

/* ---------- Pagination ---------- */

/*
 * `data[key]` is a Laravel paginator (rows in `.data`): `savings_goals` for
 * the list, `contributions` for GET …/contributions and `activity` for
 * GET …/activity. A plain array is accepted as a single page; anything else is
 * treated as a malformed response instead of being guessed at.
 */
export function parsePage(response, key) {
  const payload = response?.data?.[key];

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

/* ---------- List filters (kept in the URL) ---------- */

const CURRENCY = /^[A-Z]{3}$/;

export function readGoalFilters(searchParams) {
  const pick = (name, test) => {
    const value = searchParams.get(name) ?? "";
    return test(value) ? value : "";
  };
  const page = Number(searchParams.get("page"));

  return {
    status: pick("status", (value) => GOAL_STATUSES.includes(value)),
    progress_status: pick("progress_status", (value) => GOAL_PROGRESS_STATUSES.includes(value)),
    currency_code: pick("currency_code", (value) => CURRENCY.test(value)),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function goalFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

// The session workspace, like the Accounts page; without one, the backend
// lists every workspace the user can access.
export const goalFiltersToQuery = (filters) => ({
  workspace_id: getStoredWorkspace()?.id,
  status: filters.status || undefined,
  progress_status: filters.progress_status || undefined,
  currency_code: filters.currency_code || undefined,
  per_page: PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

export const hasActiveGoalFilters = (filters) =>
  Boolean(filters.status || filters.progress_status || filters.currency_code);

// Currencies offered by the form and the filter: the usual list plus the
// workspace's base currency and any extra value, so none is ever lost.
export const getCurrencyOptions = (...extra) =>
  [...new Set([...GOAL_CURRENCIES, getStoredWorkspace()?.base_currency_code, ...extra].filter(Boolean))];

/* ---------- Goal form ---------- */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" part of a backend date, so a time zone never shifts the day.
export const toDateOnly = (value) => String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

// Returns `{ field: [message] }` for the values the form is about to send.
// `today` is "YYYY-MM-DD"; a new goal's target date can't be in the past.
export function validateGoalForm(form, { isEditing, today, t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.savingsGoals.validation.${key}`, options)];
  };
  const name = form.name.trim();

  if (!name) add("name", "nameRequired");
  else if (name.length > NAME_MAX) add("name", "nameTooLong", { max: NAME_MAX });

  const amountError = getAmountError(form.target_amount);
  if (amountError) {
    errors.target_amount = [t(`dashboard.transactions.validation.${amountError}`)];
  }

  if (!isEditing && !CURRENCY.test(form.currency_code)) add("currency_code", "currencyRequired");

  if (form.target_date && !DATE.test(form.target_date)) add("target_date", "dateInvalid");
  // ISO dates compare correctly as strings.
  else if (!isEditing && form.target_date && form.target_date < today) add("target_date", "dateInPast");

  if (form.notes.trim().length > NOTES_MAX) add("notes", "notesTooLong", { max: NOTES_MAX });

  return errors;
}

/* ---------- Contribution / withdrawal form ---------- */

// The account on the other side of the movement: the source of a
// contribution, the destination of a withdrawal.
export const ACCOUNT_FIELD = {
  contribution: "from_account_id",
  withdrawal: "to_account_id",
};

const isGoalContainer = (account) =>
  account?.savings_goal != null || account?.savings_goal_id != null;

/*
 * Accounts that can be on the other side of a contribution or withdrawal:
 * active, in the goal's currency, and never a savings-goal container (this
 * goal's own account `goalAccountId`, which would be a circular movement, or
 * another goal's, which only moves through that goal's own flow).
 */
export function getEligibleAccounts(accounts, { currency, goalAccountId }) {
  return accounts.filter(
    (account) =>
      account?.id != null &&
      account.status !== "archived" &&
      !isGoalContainer(account) &&
      !sameId(account.id, goalAccountId) &&
      (!currency || account.currency_code === currency),
  );
}

export function validateMovementForm(form, { type, t }) {
  const errors = {};
  const accountField = ACCOUNT_FIELD[type];

  if (!form[accountField]) {
    errors[accountField] = [
      t(
        type === "contribution"
          ? "dashboard.savingsGoals.validation.sourceRequired"
          : "dashboard.savingsGoals.validation.destinationRequired",
      ),
    ];
  }

  const amountError = getAmountError(form.amount);
  if (amountError) {
    errors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
  }

  if (form.description.trim().length > DESCRIPTION_MAX) {
    errors.description = [
      t("dashboard.savingsGoals.validation.descriptionTooLong", { max: DESCRIPTION_MAX }),
    ];
  }

  return errors;
}

/* ---------- History ---------- */

// Which endpoint each history tab reads, and the envelope key of its rows.
export const HISTORY_SOURCES = {
  all: { list: "listActivity", key: "activity", query: {} },
  contribution: { list: "listContributions", key: "contributions", query: {} },
  withdrawal: { list: "listActivity", key: "activity", query: { type: "withdrawal" } },
};

export const getMovementType = (movement) =>
  ["contribution", "withdrawal"].includes(movement?.type) ? movement.type : "unknown";

// Reversed movements stay in the history, marked as reversed.
export const isReversedMovement = (movement) =>
  isTrue(movement?.is_reversed) || movement?.transfer_status === "reversed";

/* ---------- Errors ---------- */

const collectErrorText = (error) =>
  [error?.message, ...Object.values(error?.errors ?? {}).flat()]
    .filter((item) => typeof item === "string")
    .join(" ");

const MOVEMENT_CONTEXTS = ["contribution", "withdrawal"];

// 409 on archive: the goal still holds money (the usual case) or it is
// already archived.
const isBalanceConflict = (error) =>
  /balance|empty|withdraw|money|fund|remaining|zero/i.test(collectErrorText(error));
const isAlreadyArchivedConflict = (error) => /already|archived/i.test(collectErrorText(error));

/*
 * Savings-goal wording for codes where the generic message would mislead.
 * `context`: "load", "save", "archive", "contribution", "withdrawal",
 * "pause" or "resume" (409 means something different in each).
 * A 422 keeps the backend's own message: it is the financial/domain reason
 * (insufficient balance, currency mismatch, paused or archived goal, invalid
 * target date…).
 */
export function getGoalErrorMessage(error, t, context = "load") {
  const isMovement = MOVEMENT_CONTEXTS.includes(context);

  if (error?.code === "FORBIDDEN") {
    return t(
      isMovement
        ? "dashboard.savingsGoals.errors.forbiddenMovement"
        : "dashboard.savingsGoals.errors.forbidden",
    );
  }

  if (error?.code === "NOT_FOUND") {
    return t(
      isMovement
        ? "dashboard.savingsGoals.errors.movementNotFound"
        : "dashboard.savingsGoals.errors.notFound",
    );
  }

  if (error?.code === "CONFLICT") {
    if (isMovement) return t("dashboard.savingsGoals.errors.idempotencyConflict");
    if (context === "pause") return t("dashboard.savingsGoals.errors.pauseConflict");
    if (context === "resume") return t("dashboard.savingsGoals.errors.resumeConflict");
    if (context === "save") return t("dashboard.savingsGoals.errors.archivedLocked");

    if (context === "archive") {
      if (isBalanceConflict(error)) return t("dashboard.savingsGoals.errors.hasBalance");
      if (isAlreadyArchivedConflict(error)) return t("dashboard.savingsGoals.errors.alreadyArchived");
      // A message in another language can't be matched: it is still the
      // backend's specific reason.
      return error.message || t("dashboard.savingsGoals.errors.hasBalance");
    }
  }

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.savingsGoals.errors.validation");
  }

  return getApiErrorMessage(error, t);
}

// Extra line under a contribution/withdrawal error: what it means for the
// money. Empty when there is nothing to add.
export function getMovementErrorHint(error, t, type) {
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) {
    return t("dashboard.savingsGoals.errors.unknownOutcome");
  }

  if (error?.code !== "VALIDATION_ERROR") return "";

  const text = collectErrorText(error);

  if (isInsufficientBalanceError(error)) {
    return t(
      type === "contribution"
        ? "dashboard.savingsGoals.errors.insufficientSourceHint"
        : "dashboard.savingsGoals.errors.insufficientGoalHint",
    );
  }
  if (/currenc/i.test(text)) return t("dashboard.savingsGoals.errors.currencyHint");
  if (/paus/i.test(text)) return t("dashboard.savingsGoals.errors.pausedHint");
  if (/archiv/i.test(text)) return t("dashboard.savingsGoals.errors.archivedHint");

  return t("dashboard.savingsGoals.errors.notMovedHint");
}
