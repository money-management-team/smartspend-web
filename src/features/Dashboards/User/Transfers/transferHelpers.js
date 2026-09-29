import { getApiErrorMessage } from "../api/apiClient";
import {
  isAlreadyReversedError,
  isInsufficientBalanceError,
} from "../FinancialOperations/transactionHelpers";

export const PER_PAGE = 20;

// Codes after which the outcome of a write is unknown (it may have been
// applied): the user is told to check before trying again.
export const UNKNOWN_OUTCOME_CODES = [
  "NETWORK_ERROR",
  "TIMEOUT",
  "SERVER_ERROR",
  "MALFORMED_RESPONSE",
];

/* ---------- Entities ---------- */

export const isTransferEntity = (value, expectedId) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.id != null &&
      (expectedId == null || String(value.id) === String(expectedId)),
  );

// A transfer carries a fee only when `fee_amount` is a non-zero decimal
// string; the string is never parsed into a float.
export const hasTransferFee = (transfer) =>
  /[1-9]/.test(String(transfer?.fee_amount ?? ""));

// Only a posted transfer can be reversed, and only once.
export const canReverseTransfer = (transfer) => transfer?.status === "posted";

export const getTransferTransactions = (transfer) =>
  Array.isArray(transfer?.transactions) ? transfer.transactions.filter(Boolean) : [];

// The transfer can carry more than one transaction (movement + fee), so they
// are always looked up by type instead of by position.
export const getTransactionOfType = (transfer, type) =>
  getTransferTransactions(transfer).find((item) => item?.type === type) ?? null;

export const getAccountLabel = (account, fallbackId) =>
  account?.name ?? (fallbackId != null ? `#${fallbackId}` : "—");

export const getFromAccount = (transfer) =>
  transfer?.from_account ?? (transfer?.from_account_id != null ? { id: transfer.from_account_id } : null);

export const getToAccount = (transfer) =>
  transfer?.to_account ?? (transfer?.to_account_id != null ? { id: transfer.to_account_id } : null);

/*
 * How the transfer moved money, for display only: the source loses the
 * amount, the destination gains it, and a fee is a further expense on the
 * source. Amounts are the backend's own strings; nothing is recalculated.
 */
export function getTransferMovements(transfer) {
  const amount = String(transfer?.amount ?? "").replace(/^[+-]/, "");
  const fee = String(transfer?.fee_amount ?? "").replace(/^[+-]/, "");

  const movements = [
    {
      key: "out",
      account: getFromAccount(transfer),
      accountId: transfer?.from_account_id,
      amount,
      direction: "out",
    },
    {
      key: "in",
      account: getToAccount(transfer),
      accountId: transfer?.to_account_id,
      amount,
      direction: "in",
    },
  ];

  // A fee is a further expense on the source account.
  if (hasTransferFee(transfer)) {
    movements.push({
      key: "fee",
      account: getFromAccount(transfer),
      accountId: transfer?.from_account_id,
      amount: fee,
      direction: "out",
    });
  }

  return movements;
}

/* ---------- Pagination ---------- */

/*
 * `data.transfers` is a Laravel paginator: the rows are in
 * `data.transfers.data`. It is read defensively: a plain array or a paginator
 * sent as `data` itself is accepted too. Anything else is treated as a
 * malformed response instead of being guessed at.
 */
export function parseTransferPage(response) {
  const payload = response?.data?.transfers ?? response?.data;

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

// Statuses a transfer is stored with. `posted` is the canonical value of a
// completed transfer and is what the UI shows and sends.
export const TRANSFER_STATUSES = ["pending", "posted", "reversed", "failed"];

// `confirmed` is an input alias the backend maps to `posted`; an old link
// using it is read as `posted` instead of as a separate state.
const STATUS_ALIASES = { confirmed: "posted" };

const ID = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

// Reads and sanitizes the list filters and page from the URL search params.
export function readTransferFilters(searchParams) {
  const pick = (name, pattern) => {
    const value = searchParams.get(name) ?? "";
    return pattern.test(value) ? value : "";
  };
  const rawStatus = searchParams.get("status") ?? "";
  const status = STATUS_ALIASES[rawStatus] ?? rawStatus;
  const dateFrom = pick("date_from", DATE);
  const dateTo = pick("date_to", DATE);
  const page = Number(searchParams.get("page"));

  return {
    from_account_id: pick("from_account_id", ID),
    to_account_id: pick("to_account_id", ID),
    status: TRANSFER_STATUSES.includes(status) ? status : "",
    currency_code: pick("currency_code", CURRENCY),
    date_from: dateFrom,
    // The backend requires date_to ≥ date_from; an inverted range (typed into
    // the URL) drops its end instead of failing the whole list.
    date_to: dateFrom && dateTo && dateTo < dateFrom ? "" : dateTo,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// URL params for a filter state (empty values and page 1 are omitted).
export function transferFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    if (key === "page" && Number(value) <= 1) return;
    params.set(key, String(value));
  });

  return params;
}

// GET /transfers query. The backend orders by occurred_at DESC, then id; the
// list keeps that order. There is no workspace_id filter on this endpoint.
export const transferFiltersToQuery = (filters) => ({
  from_account_id: filters.from_account_id || undefined,
  to_account_id: filters.to_account_id || undefined,
  status: filters.status || undefined,
  currency_code: filters.currency_code || undefined,
  date_from: filters.date_from || undefined,
  date_to: filters.date_to || undefined,
  per_page: PER_PAGE,
  page: filters.page,
});

export const hasActiveTransferFilters = (filters) =>
  Boolean(
    filters.from_account_id ||
      filters.to_account_id ||
      filters.status ||
      filters.currency_code ||
      filters.date_from ||
      filters.date_to,
  );

/* ---------- Form values ---------- */

const FEE = /^\d+(?:\.\d{1,4})?$/;

// Validation key for the optional fee: empty and zero are both "no fee".
export function getFeeError(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!FEE.test(text)) {
    return /^\d+\.\d{5,}$/.test(text) ? "amountDecimals" : "amountInvalid";
  }
  return null;
}

/* ---------- Errors ---------- */

/*
 * Transfer wording for codes where the generic message would mislead. A 422
 * keeps the backend's own message: it is the financial/domain reason (same
 * account, currency mismatch, insufficient balance, archived account, a
 * reversal that would make a balance negative…).
 * `context` is "create" or "reverse" (409 means different things).
 */
export function getTransferErrorMessage(error, t, context = "create") {
  if (error?.code === "FORBIDDEN") return t("dashboard.transfers.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.transfers.errors.notFound");

  if (error?.code === "CONFLICT") {
    if (context === "reverse" || isAlreadyReversedError(error)) {
      return t("dashboard.transfers.errors.alreadyReversed");
    }
    return t("dashboard.transfers.errors.idempotencyConflict");
  }

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.transfers.errors.validation");
  }

  return getApiErrorMessage(error, t);
}

// Extra line under the error: what it means for the money.
export function getTransferErrorHint(error, t, context = "create") {
  if (isInsufficientBalanceError(error)) {
    return t(
      context === "reverse"
        ? "dashboard.transfers.errors.reverseBalanceHint"
        : "dashboard.transfers.errors.insufficientBalanceHint",
    );
  }

  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) {
    return t(
      context === "reverse"
        ? "dashboard.transfers.errors.unknownReverseOutcome"
        : "dashboard.transfers.errors.unknownOutcome",
    );
  }

  return "";
}
