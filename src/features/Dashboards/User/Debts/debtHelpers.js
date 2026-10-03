import { getApiErrorMessage, getStoredWorkspace, toMoneyString } from "../api/apiClient";
import { isNegativeMoney } from "../Accounts/accountHelpers";
import {
  createIdempotentAttempt,
  getAmountError,
  isInsufficientBalanceError,
  toAmountInput,
} from "../FinancialOperations/transactionHelpers";
import {
  getCurrencyOptions,
  isPositiveMoney,
  parsePage,
  toDateOnly,
} from "../SavingsGoals/savingsGoalHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import { subtractMoney } from "../utils/formatters";

export { getCurrencyOptions, isPositiveMoney, parsePage, toDateOnly };

// payable: money the user owes; receivable: money owed to the user.
export const DEBT_DIRECTIONS = ["payable", "receivable"];
// Values of the `status` filter. `overdue` is not a stored lifecycle status:
// the backend derives it from the due date (see `effective_status`).
export const DEBT_STATUSES = ["active", "partially_paid", "paid", "archived", "overdue"];
// Stored lifecycle statuses (`debt.status`).
const LIFECYCLE_STATUSES = ["active", "partially_paid", "paid", "archived"];
export const COUNTERPARTY_MAX = 150;
export const NOTES_MAX = 1000;
export const PER_PAGE = 20;
export const PAYMENTS_PER_PAGE = 10;

const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

const toCount = (value) => {
  const number = Number(value);
  return value != null && value !== "" && Number.isFinite(number) ? number : null;
};

/* ---------- Entities ---------- */

export const isDebtEntity = (value) =>
  Boolean(value && typeof value === "object" && value.id != null);

export const getDebtDirection = (debt) =>
  DEBT_DIRECTIONS.includes(debt?.direction) ? debt.direction : "unknown";

/*
 * The state to show: the backend's `effective_status`, which is `overdue`
 * when the due date has passed (the stored `status` stays e.g. `active`).
 * `status` is used only when a response doesn't carry `effective_status`, and
 * `is_overdue` only to keep that fallback from hiding an overdue debt.
 */
export function getDebtStatus(debt) {
  if (debt?.effective_status) return debt.effective_status;
  if (isTrue(debt?.is_overdue)) return "overdue";
  return debt?.status || "unknown";
}

export const isOverdueDebt = (debt) =>
  isTrue(debt?.is_overdue) || debt?.effective_status === "overdue";

// A paid or archived debt has nothing left to fall due.
const isSettledStatus = (status) => status === "paid" || status === "archived";

/*
 * `days_until_due` as the backend calculated it: positive before the due
 * date, 0 on it, negative after it, null without a due date. Returns null
 * when there is nothing useful to say (no due date, or a settled debt).
 */
export function getDueCountdown(debt) {
  const days = toCount(debt?.days_until_due);

  if (days == null || isSettledStatus(getDebtStatus(debt))) return null;
  if (days === 0) return { key: "dueToday", days: 0 };
  if (days > 0) return { key: days === 1 ? "dueInOne" : "dueIn", days };
  return { key: days === -1 ? "overdueByOne" : "overdueBy", days: -days };
}

// Whether an opening movement was posted, as the backend reported it; null
// when the response doesn't say.
export function hasOpeningMovement(debt) {
  if (debt?.has_movement != null) return isTrue(debt.has_movement);
  if (debt?.opening_transaction_id != null) return true;
  if (debt && "opening_transaction_id" in debt) return false;
  return null;
}

// The stored lifecycle status (active / partially_paid / paid / archived).
// `effective_status` is only used when `status` is missing, and "overdue" then
// says nothing about the lifecycle ("unknown").
export function getDebtLifecycle(debt) {
  if (LIFECYCLE_STATUSES.includes(debt?.status)) return debt.status;
  if (debt?.archived_at) return "archived";
  if (LIFECYCLE_STATUSES.includes(debt?.effective_status)) return debt.effective_status;
  return "unknown";
}

// `payments_count` as the backend reported it; null when absent.
export const getPaymentsCount = (debt) => toCount(debt?.payments_count);

/*
 * What the UI offers, from the backend's lifecycle status. The backend has
 * the final say: every action still handles its rejection.
 * - active / partially_paid (overdue included: it is an effective status,
 *   not a lifecycle one): edit, record a payment, reverse a payment, archive.
 * - paid: edit (the amount is locked by its payments), reverse a payment,
 *   archive.
 * - archived: read-only.
 * `mustSettleFirst`: an open debt that already has payments can't be
 * archived until it is settled; the archive dialog explains it and disables
 * its confirm button.
 * `amountLocked`: `original_amount` can only change before the first
 * payment. Without `payments_count`, a positive `paid_amount` locks it too.
 */
export function getDebtActions(debt) {
  const lifecycle = getDebtLifecycle(debt);
  const paymentsCount = getPaymentsCount(debt);
  const hasPaid = isPositiveMoney(debt?.paid_amount);
  const remaining = debt?.remaining_amount;

  if (lifecycle === "archived") {
    return {
      canEdit: false,
      canRecordPayment: false,
      canReversePayments: false,
      canArchive: false,
      mustSettleFirst: false,
      amountLocked: true,
    };
  }

  const isPaid = lifecycle === "paid";

  return {
    canEdit: true,
    // Unknown remaining amount: let the backend decide.
    canRecordPayment: !isPaid && (remaining == null || isPositiveMoney(remaining)),
    canReversePayments: true,
    canArchive: true,
    mustSettleFirst: !isPaid && hasPaid,
    amountLocked: paymentsCount != null ? paymentsCount > 0 : hasPaid,
  };
}

// Merges a write response into the displayed debt; fields the response
// leaves out (e.g. `owner`) keep their last known value.
export const mergeDebt = (current, next) => ({ ...current, ...next });

/* ---------- Summary ---------- */

const EMPTY_SIDE = {
  original_amount: null,
  paid_amount: null,
  remaining_amount: null,
  debts_count: null,
  overdue_count: null,
};

const readSide = (side) => ({
  ...EMPTY_SIDE,
  ...(side && typeof side === "object" ? side : {}),
  debts_count: toCount(side?.debts_count),
  overdue_count: toCount(side?.overdue_count),
});

/*
 * `data.summary.by_currency`: one entry per currency, each in its own
 * currency. Nothing is converted or added across currencies. Null when the
 * response doesn't have that shape.
 */
export function parseSummary(response) {
  const rows = response?.data?.summary?.by_currency;
  if (!Array.isArray(rows)) return null;

  return rows
    .filter((row) => row && typeof row === "object" && row.currency_code)
    .map((row) => ({
      currency_code: String(row.currency_code),
      payable: readSide(row.payable),
      receivable: readSide(row.receivable),
      active_debts_count: toCount(row.active_debts_count),
      overdue_debts_count: toCount(row.overdue_debts_count),
      net_position: row.net_position ?? null,
    }));
}

/* ---------- List filters (kept in the URL) ---------- */

export const EMPTY_FILTERS = {
  direction: "",
  status: "",
  currency_code: "",
  counterparty: "",
  due_from: "",
  due_to: "",
  page: 1,
};

export function readDebtFilters(searchParams) {
  const pick = (name, test) => {
    const value = searchParams.get(name) ?? "";
    return test(value) ? value : "";
  };
  const page = Number(searchParams.get("page"));
  const dueFrom = pick("due_from", (value) => DATE.test(value));

  return {
    direction: pick("direction", (value) => DEBT_DIRECTIONS.includes(value)),
    status: pick("status", (value) => DEBT_STATUSES.includes(value)),
    currency_code: pick("currency_code", (value) => CURRENCY.test(value)),
    counterparty: (searchParams.get("counterparty") ?? "").trim().slice(0, COUNTERPARTY_MAX),
    due_from: dueFrom,
    due_to: pick("due_to", (value) => DATE.test(value) && (!dueFrom || value >= dueFrom)),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function debtFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

// The session workspace when known; without it the backend lists every
// workspace the user can access. `owner` is left to the backend's default so
// the list and the summary always describe the same debts.
export const debtFiltersToQuery = (filters) => ({
  workspace_id: getStoredWorkspace()?.id,
  direction: filters.direction || undefined,
  status: filters.status || undefined,
  currency_code: filters.currency_code || undefined,
  counterparty: filters.counterparty || undefined,
  due_from: filters.due_from || undefined,
  due_to: filters.due_to || undefined,
  per_page: PER_PAGE,
  page: filters.page > 1 ? filters.page : undefined,
});

export const summaryQuery = () => ({ workspace_id: getStoredWorkspace()?.id });

export const hasActiveDebtFilters = (filters) =>
  Object.entries(filters).some(([key, value]) => key !== "page" && value !== "");

/* ---------- Create form ---------- */

// Accounts that can carry the opening movement: active, in the debt's
// currency, and never a savings-goal container (a goal's money only moves
// through the goal's own flow).
export const getEligibleAccounts = (accounts, currency) =>
  accounts.filter(
    (account) =>
      account?.id != null &&
      account.status !== "archived" &&
      account.savings_goal == null &&
      account.savings_goal_id == null &&
      account.currency_code === currency,
  );

// Returns `{ field: [message] }` for the values the form is about to send.
export function validateDebtForm(form, { t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.debts.validation.${key}`, options)];
  };
  const counterparty = form.counterparty_name.trim();

  if (!DEBT_DIRECTIONS.includes(form.direction)) add("direction", "directionRequired");

  if (!counterparty) add("counterparty_name", "counterpartyRequired");
  else if (counterparty.length > COUNTERPARTY_MAX) {
    add("counterparty_name", "counterpartyTooLong", { max: COUNTERPARTY_MAX });
  }

  const amountError = getAmountError(form.original_amount);
  if (amountError) {
    errors.original_amount = [t(`dashboard.transactions.validation.${amountError}`)];
  }

  if (!CURRENCY.test(form.currency_code)) add("currency_code", "currencyRequired");

  if (form.issued_at && !DATE.test(form.issued_at)) add("issued_at", "dateInvalid");

  if (form.due_date) {
    if (!DATE.test(form.due_date)) add("due_date", "dateInvalid");
    // ISO dates compare correctly as strings.
    else if (DATE.test(form.issued_at) && form.due_date < form.issued_at) {
      add("due_date", "dueBeforeIssued");
    }
  }

  if (form.with_movement && !form.account_id) add("account_id", "accountRequired");

  if (form.notes.trim().length > NOTES_MAX) add("notes", "notesTooLong", { max: NOTES_MAX });

  return errors;
}

const toId = (value) => (/^\d+$/.test(String(value)) ? Number(value) : value);

/*
 * POST body without `workspace_id` (the page adds it). `account_id` is sent
 * only when the user explicitly chose to record the opening movement; empty
 * optional fields are left out.
 */
export function buildCreatePayload(form) {
  const notes = form.notes.trim();

  return {
    direction: form.direction,
    counterparty_name: form.counterparty_name.trim(),
    original_amount: form.original_amount.trim(),
    currency_code: form.currency_code,
    ...(form.issued_at ? { issued_at: form.issued_at } : {}),
    ...(form.due_date ? { due_date: form.due_date } : {}),
    ...(form.with_movement && form.account_id ? { account_id: toId(form.account_id) } : {}),
    ...(notes ? { notes } : {}),
  };
}

/* ---------- Edit form ---------- */

export function toEditValues(debt) {
  return {
    counterparty_name: debt?.counterparty_name ?? "",
    original_amount: toAmountInput(debt?.original_amount),
    issued_at: toDateOnly(debt?.issued_at),
    due_date: toDateOnly(debt?.due_date),
    notes: debt?.notes ?? "",
  };
}

// Returns `{ field: [message] }`. The amount is only checked while editable.
export function validateEditForm(form, { amountLocked, t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.debts.validation.${key}`, options)];
  };
  const counterparty = form.counterparty_name.trim();

  if (!counterparty) add("counterparty_name", "counterpartyRequired");
  else if (counterparty.length > COUNTERPARTY_MAX) {
    add("counterparty_name", "counterpartyTooLong", { max: COUNTERPARTY_MAX });
  }

  if (!amountLocked) {
    const amountError = getAmountError(form.original_amount);
    if (amountError) {
      errors.original_amount = [t(`dashboard.transactions.validation.${amountError}`)];
    }
  }

  if (form.issued_at && !DATE.test(form.issued_at)) add("issued_at", "dateInvalid");

  if (form.due_date) {
    if (!DATE.test(form.due_date)) add("due_date", "dateInvalid");
    else if (DATE.test(form.issued_at) && form.due_date < form.issued_at) {
      add("due_date", "dueBeforeIssued");
    }
  }

  if (form.notes.trim().length > NOTES_MAX) add("notes", "notesTooLong", { max: NOTES_MAX });

  return errors;
}

/*
 * PATCH body: only the editable fields that changed. `original_amount` is
 * left out while locked (a payment exists); `remaining_amount` is never sent,
 * the backend recalculates it. Clearing a date or the notes sends `null`.
 */
export function buildUpdatePayload(form, debt, { amountLocked }) {
  const original = toEditValues(debt);
  const payload = {};
  const counterparty = form.counterparty_name.trim();
  const notes = form.notes.trim();

  if (counterparty !== original.counterparty_name.trim()) payload.counterparty_name = counterparty;
  if (!amountLocked && toMoneyString(form.original_amount.trim()) !== toMoneyString(debt?.original_amount)) {
    payload.original_amount = form.original_amount.trim();
  }
  if (form.issued_at !== original.issued_at) payload.issued_at = form.issued_at || null;
  if (form.due_date !== original.due_date) payload.due_date = form.due_date || null;
  if (notes !== original.notes.trim()) payload.notes = notes || null;

  return payload;
}

/* ---------- Payments ---------- */

export const isReversedPayment = (payment) =>
  isTrue(payment?.is_reversed) || payment?.status === "reversed";

// Only a posted payment that isn't reversed yet, on a debt that isn't
// archived, can be reversed.
export const canReversePayment = (payment, debt) =>
  payment?.id != null &&
  payment.status === "posted" &&
  !isReversedPayment(payment) &&
  getDebtActions(debt).canReversePayments;

/*
 * Whether the account can take the payment's side of the movement:
 * receivable → money comes in, any eligible account can receive it;
 * payable → money goes out, so the account needs a positive balance unless it
 * allows a negative one. The amount check itself is the backend's.
 */
export const canAccountPay = (account, direction) =>
  direction !== "payable" ||
  account?.allow_negative_balance === true ||
  isPositiveMoney(account?.current_balance);

// Whether `amount` (a valid amount string) is above `limit`, compared on the
// decimal strings, never as floats.
export const isAboveAmount = (amount, limit) =>
  limit != null && limit !== "" && isNegativeMoney(subtractMoney(limit, amount));

export function validatePaymentForm(form, { remaining, t }) {
  const errors = {};
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.debts.validation.${key}`, options)];
  };

  if (!form.account_id) add("account_id", "paymentAccountRequired");

  const amount = form.amount.trim();
  const amountError = getAmountError(amount);

  if (amountError) errors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
  else if (isAboveAmount(amount, remaining)) add("amount", "exceedsRemaining");

  if (form.paid_at && !DATE.test(form.paid_at)) add("paid_at", "dateInvalid");

  if (form.notes.trim().length > NOTES_MAX) add("notes", "notesTooLong", { max: NOTES_MAX });

  return errors;
}

/*
 * POST body. Today is left to the backend (it records "now"); another day is
 * sent as `YYYY-MM-DD`. Empty notes are left out.
 */
export function buildPaymentPayload(form, { today }) {
  const notes = form.notes.trim();

  return {
    account_id: toId(form.account_id),
    amount: form.amount.trim(),
    ...(form.paid_at && form.paid_at !== today ? { paid_at: form.paid_at } : {}),
    ...(notes ? { notes } : {}),
  };
}

/*
 * One Idempotency-Key per payment intent (one opening of the payment form).
 * Unlike a per-payload key, it is NOT renewed when the details change: after
 * an unknown outcome (timeout, network, 5xx) or a 409, the next submission
 * reuses it, so the backend either replays the first result, records the
 * payment once if the first never arrived, or rejects a different payload
 * with 409 — never a second payment. It is renewed only after a success or a
 * definitive rejection (422, 403, 404), when nothing was recorded.
 */
export function createPaymentAttempt(debtId) {
  const attempt = createIdempotentAttempt("debt-payment");

  return {
    key: () => attempt.keyFor({ debtId: String(debtId) }),
    settle: (error) => attempt.settle(error),
  };
}

/* ---------- Errors ---------- */

const collectErrorText = (error) =>
  [error?.message, ...Object.values(error?.errors ?? {}).flat()]
    .filter((item) => typeof item === "string")
    .join(" ");

const matches = (error, pattern) => pattern.test(collectErrorText(error));

// Wording for a 409, per context. A message that can't be matched (e.g. in
// another language) is still the backend's specific reason, so it is kept.
function getConflictMessage(error, t, context) {
  if (context === "save") {
    if (matches(error, /archiv/i)) return t("dashboard.debts.errors.archivedLocked");
    if (matches(error, /payment|paid|original/i)) return t("dashboard.debts.errors.amountLocked");
    return error.message || t("dashboard.debts.errors.archivedLocked");
  }

  if (context === "archive") {
    if (matches(error, /already/i)) return t("dashboard.debts.errors.alreadyArchived");
    if (matches(error, /payment|settle|paid|open/i)) return t("dashboard.debts.errors.hasPayments");
    return error.message || t("dashboard.debts.errors.hasPayments");
  }

  if (context === "payment") {
    if (matches(error, /process/i)) return t("dashboard.debts.errors.paymentProcessing");
    if (matches(error, /archiv/i)) return t("dashboard.debts.errors.debtArchived");
    return t("dashboard.debts.errors.idempotencyConflict");
  }

  if (context === "reverse") {
    if (matches(error, /archiv/i)) return t("dashboard.debts.errors.debtArchived");
    return t("dashboard.debts.errors.alreadyReversed");
  }

  return getApiErrorMessage(error, t);
}

const NOT_FOUND_KEYS = {
  create: "accountNotFound",
  payment: "paymentTargetNotFound",
  reverse: "paymentNotFound",
};

/*
 * Debt wording for codes where the generic message would mislead.
 * `context`: "load", "create", "save", "archive", "payment" or "reverse"
 * (403, 404 and 409 mean different things in each). A 422 keeps the backend's
 * own message: it is the financial/domain reason (insufficient balance,
 * payment above the remaining amount, debt already paid or archived…).
 */
export function getDebtErrorMessage(error, t, context = "load") {
  if (error?.code === "FORBIDDEN") {
    return t(context === "payment" ? "dashboard.debts.errors.forbiddenPayment" : "dashboard.debts.errors.forbidden");
  }

  if (error?.code === "NOT_FOUND") {
    return t(`dashboard.debts.errors.${NOT_FOUND_KEYS[context] ?? "notFound"}`);
  }

  if (error?.code === "CONFLICT") return getConflictMessage(error, t, context);

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    if (isInsufficientBalanceError(error)) return t("dashboard.debts.errors.insufficientBalance");
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.debts.errors.validation");
  }

  return getApiErrorMessage(error, t);
}

// Extra line under a payment error: what happened to the money. Empty when
// there is nothing to add.
export function getPaymentErrorHint(error, t) {
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) return t("dashboard.debts.errors.paymentUnknownOutcome");
  if (error?.code === "CONFLICT") return t("dashboard.debts.errors.paymentConflictHint");

  if (error?.code === "VALIDATION_ERROR") {
    // Checked before the balance: "remaining balance" would match both.
    if (matches(error, /remaining|exceed|greater than|more than/i)) {
      return t("dashboard.debts.errors.exceedsRemainingHint");
    }
    if (matches(error, /already paid|fully paid|settled/i)) return t("dashboard.debts.errors.debtPaidHint");
    if (matches(error, /archiv/i)) return t("dashboard.debts.errors.debtArchivedHint");
    if (isInsufficientBalanceError(error)) return t("dashboard.debts.errors.insufficientPaymentHint");
    if (matches(error, /idempotency/i)) return t("dashboard.debts.errors.idempotencyKeyHint");
  }

  if (["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND"].includes(error?.code)) {
    return t("dashboard.debts.errors.paymentNotRecordedHint");
  }

  return "";
}

// Extra line under a reverse error.
export function getReverseErrorHint(error, t) {
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) return t("dashboard.debts.errors.reverseUnknownOutcome");
  if (error?.code === "CONFLICT") return t("dashboard.debts.errors.reverseConflictHint");
  if (isInsufficientBalanceError(error)) return t("dashboard.debts.errors.reverseBalanceHint");
  if (error?.code === "VALIDATION_ERROR") return t("dashboard.debts.errors.notReversedHint");
  return "";
}

// Extra line under a create error: what happened to the debt and the money.
// POST /debts has no Idempotency-Key, so after an unknown outcome a retry
// could record the debt (and its movement) twice.
export function getCreateErrorHint(error, t, { withMovement }) {
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) return t("dashboard.debts.errors.unknownOutcome");

  if (error?.code === "VALIDATION_ERROR" && withMovement && isInsufficientBalanceError(error)) {
    return t("dashboard.debts.errors.insufficientBalanceHint");
  }

  if (["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND"].includes(error?.code)) {
    return t(withMovement ? "dashboard.debts.errors.notRecordedMovementHint" : "dashboard.debts.errors.notRecordedHint");
  }

  return "";
}

export const isUnknownOutcome = (error) => UNKNOWN_OUTCOME_CODES.includes(error?.code);
