import { createElement } from "react";
import {
  LuArrowDownRight,
  LuArrowRightLeft,
  LuArrowUpRight,
  LuUndo2,
} from "react-icons/lu";

import { createIdempotencyKey, getApiErrorMessage } from "../api/apiClient";
import { parseDateValue } from "../utils/formatters";

export const TYPE_FILTERS = ["all", "expense", "income", "transfer"];
export const TRANSACTION_STATUSES = [
  "posted",
  "pending_review",
  "draft",
  "reversed",
  "failed",
];
// `sort_by:sort_dir` pairs the backend accepts.
export const SORT_OPTIONS = [
  "occurred_at:desc",
  "occurred_at:asc",
  "amount:desc",
  "amount:asc",
  "created_at:desc",
];
export const DEFAULT_SORT = "occurred_at:desc";
export const PER_PAGE = 20;
export const REASON_MIN = 3;
export const REASON_MAX = 500;

/* ---------- Entities ---------- */

export const isTransactionEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

export const sameId = (left, right) =>
  left != null && right != null && String(left) === String(right);

// Transfer legs (and their fees) belong to a transfer and are managed as a
// whole; single legs are never corrected or reversed from here.
export const isTransferTransaction = (transaction) =>
  transaction?.transfer_id != null ||
  ["transfer", "fee"].includes(transaction?.type);

export const isReversalRecord = (transaction) =>
  transaction?.reversal_of_id != null || transaction?.type === "reversal";

// Only a posted income/expense that is not itself a reversal can be corrected
// or reversed. Reversed transactions stay visible but read-only.
export const canChangeTransaction = (transaction) =>
  transaction?.status === "posted" &&
  ["income", "expense"].includes(transaction?.type) &&
  !isTransferTransaction(transaction) &&
  !isReversalRecord(transaction);

const getEntryAccount = (entry) =>
  entry?.account ?? (entry?.account_id != null ? { id: entry.account_id } : null);

// Accounts touched by the transaction, from its ledger entries.
export function getTransactionAccounts(transaction) {
  const accounts = new Map();

  if (transaction?.account?.id != null) {
    accounts.set(String(transaction.account.id), transaction.account);
  }

  (transaction?.ledger_entries ?? []).forEach((entry) => {
    const account = getEntryAccount(entry);
    if (account?.id != null && !accounts.has(String(account.id))) {
      accounts.set(String(account.id), account);
    }
  });

  return [...accounts.values()];
}

// The account an income/expense was booked on: its entry with the same role,
// otherwise the first account involved.
export function getPrimaryAccount(transaction) {
  const entry = (transaction?.ledger_entries ?? []).find(
    (item) => item?.entry_role === transaction?.type,
  );

  return getEntryAccount(entry) ?? getTransactionAccounts(transaction)[0] ?? null;
}

const TYPE_ICONS = {
  income: LuArrowUpRight,
  expense: LuArrowDownRight,
  fee: LuArrowDownRight,
  transfer: LuArrowRightLeft,
  reversal: LuUndo2,
};

export const renderTransactionIcon = (transaction) =>
  createElement(
    isReversalRecord(transaction)
      ? LuUndo2
      : TYPE_ICONS[transaction?.type] ?? LuArrowRightLeft,
  );

// "income" / "expense" / "neutral": drives color and the +/− sign. The sign
// comes from the type, never from float math.
export function getAmountTone(transaction) {
  if (isReversalRecord(transaction)) return "neutral";
  if (transaction?.type === "income") return "income";
  if (["expense", "fee"].includes(transaction?.type)) return "expense";
  return "neutral";
}

export const getAmountSign = (transaction) =>
  ({ income: "+", expense: "−" })[getAmountTone(transaction)] ?? "";

/* ---------- Enum labels ---------- */

const humanize = (value) => String(value ?? "").replace(/_/g, " ");

// Translates a backend enum value when a key exists; otherwise shows the raw
// value (i18n warns about missing keys in dev, even with a defaultValue).
export function translateEnum(t, i18n, prefix, value) {
  if (value == null || value === "") return "";
  const key = `${prefix}.${value}`;
  return i18n.exists(key) ? t(key) : humanize(value);
}

export function getTransactionTitle(transaction, t, i18n) {
  return (
    transaction?.description ||
    transaction?.category?.name ||
    translateEnum(t, i18n, "dashboard.transactions.types", transaction?.type) ||
    `#${transaction?.id}`
  );
}

/* ---------- Pagination ---------- */

// `data.transactions` is a Laravel paginator; the rows are in its `data`.
// A plain array (unpaginated backend) is treated as a single page.
export function parseTransactionPage(response) {
  const payload = response?.data?.transactions;

  if (Array.isArray(payload)) {
    return {
      items: payload,
      page: 1,
      lastPage: 1,
      perPage: payload.length,
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
    return Number.isFinite(number) ? number : fallback;
  };
  const page = toInt(payload.current_page, 1);
  const perPage = toInt(payload.per_page, payload.data.length);
  const total = toInt(payload.total, payload.data.length);
  const from = toInt(payload.from, payload.data.length ? (page - 1) * perPage + 1 : 0);

  return {
    items: payload.data,
    page,
    lastPage: Math.max(1, toInt(payload.last_page, 1)),
    perPage,
    total,
    from,
    to: toInt(payload.to, from + payload.data.length - 1),
  };
}

/* ---------- Filters (kept in the URL) ---------- */

const ID = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reads and sanitizes the list filters from the URL search params.
export function readFilters(searchParams) {
  const pick = (name, test) => {
    const value = searchParams.get(name) ?? "";
    return test(value) ? value : "";
  };
  const page = Number(searchParams.get("page"));

  return {
    type: pick("type", (value) => TYPE_FILTERS.includes(value) && value !== "all"),
    account_id: pick("account_id", (value) => ID.test(value)),
    category_id: pick("category_id", (value) => ID.test(value)),
    status: pick("status", (value) => TRANSACTION_STATUSES.includes(value)),
    date_from: pick("date_from", (value) => DATE.test(value)),
    date_to: pick("date_to", (value) => DATE.test(value)),
    sort: pick("sort", (value) => SORT_OPTIONS.includes(value)) || DEFAULT_SORT,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// URL params for a filter state (defaults are omitted to keep URLs short).
export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "sort" && value === DEFAULT_SORT) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

export function filtersToQuery(filters) {
  const [sortBy, sortDir] = filters.sort.split(":");

  return {
    type: filters.type || undefined,
    account_id: filters.account_id || undefined,
    category_id: filters.category_id || undefined,
    status: filters.status || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    per_page: PER_PAGE,
    page: filters.page,
  };
}

export const hasActiveFilters = (filters) =>
  Boolean(
    filters.type ||
      filters.account_id ||
      filters.category_id ||
      filters.status ||
      filters.date_from ||
      filters.date_to,
  );

/* ---------- Form values ---------- */

const AMOUNT = /^\d+(?:\.\d{1,4})?$/;

// Validation key for an amount input (a string, never parsed into a float).
export function getAmountError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "amountRequired";
  if (!AMOUNT.test(text)) {
    return /^\d+\.\d{5,}$/.test(text) ? "amountDecimals" : "amountInvalid";
  }
  if (!/[1-9]/.test(text)) return "amountPositive";
  return null;
}

// "4000.0000" → "4000", "12.5000" → "12.5" for editing; exact otherwise.
export function toAmountInput(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

// "YYYY-MM-DD" of a backend date in the given time zone (for date inputs).
export function toDateInputValue(value, timeZone) {
  const date = parseDateValue(value);

  if (!date) {
    const match = String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function getTodayInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Date inputs carry no time; the backend gets midday so the day never shifts.
export const toOccurredAt = (dateInput) =>
  dateInput ? `${dateInput} 12:00:00` : undefined;

/* ---------- Idempotency ---------- */

// Codes after which the operation certainly did NOT happen, so the next
// attempt may use a fresh key. Anything else (network error, timeout, 5xx,
// 409 still processing, 429) leaves the outcome unknown: the key is kept so a
// retry of the same payload can't move money twice.
const DEFINITIVE_REJECTIONS = [
  "VALIDATION_ERROR",
  "FORBIDDEN",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "REQUEST_FAILED",
];

/*
 * One Idempotency-Key per logical operation. `keyFor(payload)` returns the
 * current key while the payload is unchanged (double click, retry after a
 * timeout) and a new key once the payload changes. `settle(error)` ends the
 * operation after success (no error) or a definitive rejection.
 */
export function createIdempotentAttempt(prefix) {
  let attempt = null;

  return {
    keyFor(payload) {
      const fingerprint = JSON.stringify(payload);

      if (attempt?.fingerprint !== fingerprint) {
        attempt = { fingerprint, key: createIdempotencyKey(prefix) };
      }

      return attempt.key;
    },
    settle(error) {
      if (!error || DEFINITIVE_REJECTIONS.includes(error?.code)) attempt = null;
    },
    reset() {
      attempt = null;
    },
  };
}

/* ---------- Errors ---------- */

const collectErrorText = (error) =>
  [error?.message, ...Object.values(error?.errors ?? {}).flat()]
    .filter((item) => typeof item === "string")
    .join(" ");

// 422 domain rejection because the account can't go (further) negative.
export const isInsufficientBalanceError = (error) =>
  error?.code === "VALIDATION_ERROR" &&
  /insufficient|negative balance|not enough|balance/i.test(collectErrorText(error));

export const isAlreadyReversedError = (error) =>
  error?.code === "CONFLICT" && /revers/i.test(collectErrorText(error));

/*
 * Transaction wording for codes where the generic message would mislead.
 * 422 keeps the backend's own message: it is the financial/domain reason.
 * `context` is "create", "correct" or "reverse" (409 means different things).
 */
export function getTransactionErrorMessage(error, t, context = "create") {
  if (error?.code === "FORBIDDEN") return t("dashboard.transactions.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.transactions.errors.notFound");

  if (error?.code === "CONFLICT") {
    if (context !== "create" && (isAlreadyReversedError(error) || context === "reverse")) {
      return t("dashboard.transactions.errors.alreadyReversed");
    }
    return t("dashboard.transactions.errors.idempotencyConflict");
  }

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.transactions.errors.validation");
  }

  return getApiErrorMessage(error, t);
}
