import { getApiErrorMessage } from "../api/apiClient.js";
import { WHATSAPP_DRAFT_STATUSES, classifyWhatsAppError } from "../FinancialOperations/whatsappContract.js";

/*
 * Pure helpers for the WhatsApp draft inbox: filters <-> URL <-> API query,
 * and exact display of money, dates and readiness issues. No floats, no
 * storage, no network.
 */

/* The backend lists `ready_for_review` when no status is sent. There is no "all". */
export const DEFAULT_DRAFT_STATUS = "ready_for_review";
export const DRAFT_STATUS_ORDER = ["ready_for_review", "collecting", "confirmed", "discarded", "expired"];
export const DRAFT_PER_PAGE_OPTIONS = [10, 20, 50];
export const DEFAULT_DRAFT_PER_PAGE = 20;

const KNOWN_ISSUE_CODES = [
  "account_required", "category_required", "amount_required", "amount_invalid",
  "account_unavailable", "account_not_usable", "category_unavailable", "category_not_usable",
  "currency_mismatch", "date_required", "time_unresolvable",
];

function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

const positiveInteger = (value) => (/^[1-9]\d{0,9}$/.test(String(value ?? "")) ? Number(value) : null);

/**
 * Filters from the URL. Anything invalid falls back to its default instead of
 * being sent or retried, so a hand-edited URL can never cause a request loop.
 */
export function readDraftFilters(searchParams) {
  const status = searchParams.get("status");
  const perPage = positiveInteger(searchParams.get("per_page"));
  const date = searchParams.get("date");

  return {
    status: WHATSAPP_DRAFT_STATUSES.includes(status) ? status : DEFAULT_DRAFT_STATUS,
    date: isCalendarDate(date) ? date : "",
    account: positiveInteger(searchParams.get("account")) ?? "",
    per_page: DRAFT_PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_DRAFT_PER_PAGE,
    page: positiveInteger(searchParams.get("page")) ?? 1,
  };
}

/** Defaults are left out so the URL stays short and canonical. */
export function draftFiltersToSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.status !== DEFAULT_DRAFT_STATUS) params.set("status", filters.status);
  if (filters.date) params.set("date", filters.date);
  if (filters.account) params.set("account", String(filters.account));
  if (filters.per_page !== DEFAULT_DRAFT_PER_PAGE) params.set("per_page", String(filters.per_page));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/** The query for `whatsappApi.listDrafts`; only the five documented parameters. */
export function draftFiltersToQuery(filters) {
  const query = { status: filters.status, per_page: filters.per_page, page: filters.page };
  if (filters.date) query.date = filters.date;
  if (filters.account) query.account = filters.account;
  return query;
}

/** Whether any filter other than paging differs from the defaults. */
export const hasActiveDraftFilters = (filters) =>
  filters.status !== DEFAULT_DRAFT_STATUS || Boolean(filters.date) || Boolean(filters.account);

/* --------------------------------------------------------------- money */

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/**
 * Exact display of a decimal string: Intl formats the string itself (no
 * Number), at least 2 and at most 4 decimals, so 25.2500 reads 25.25 and
 * 25.2575 keeps all its digits. Returns null for a missing or malformed
 * amount, which callers show as "not set", never as 0.
 */
export function formatDraftAmount(amount, currency, locale) {
  if (typeof amount !== "string" || !DECIMAL.test(amount.trim())) return null;
  const value = amount.trim();
  const options = { minimumFractionDigits: 2, maximumFractionDigits: 4 };

  if (typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(locale, { ...options, style: "currency", currency: currency.toUpperCase() }).format(value);
    } catch {
      // Unknown currency code: fall through to the plain number plus the code.
    }
    return `${new Intl.NumberFormat(locale, options).format(value)} ${currency.toUpperCase()}`;
  }

  return new Intl.NumberFormat(locale, options).format(value);
}

/* --------------------------------------------------------------- dates */

/** A calendar date ("2026-10-06") shown as that same day, with no timezone shift. */
export function formatDraftDate(date, locale) {
  if (!isCalendarDate(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

/** "12:30:00" -> "12:30" (the wall-clock time the user gave; no conversion). */
export function formatDraftTime(time) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time ?? "");
  return match ? `${match[1]}:${match[2]}` : null;
}

function validTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** A server timestamp shown in the draft's workspace timezone when it is known. */
export function formatDraftInstant(iso, locale, timeZone) {
  const date = new Date(iso);
  if (typeof iso !== "string" || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: validTimeZone(timeZone),
  }).format(date);
}

/* ------------------------------------------------------------- display */

export const isKnownIssueCode = (code) => KNOWN_ISSUE_CODES.includes(code);

/** A short title for a draft row; never invents content. */
export function draftTitle(draft) {
  const description = draft.review_values?.description;
  return typeof description === "string" && description.trim() ? description.trim() : null;
}

/** Reviewable means the backend still accepts review actions on it (TASK 07). */
export const isReviewable = (draft) => draft.status === "ready_for_review";

/**
 * How complete a reviewable draft looks. `ready` is the backend's flag, not
 * a promise: balance and permissions are re-checked at confirmation.
 */
export function readinessOf(draft) {
  if (!isReviewable(draft)) return "none";
  if (draft.confirmation.issues.length > 0) return "incomplete";
  return draft.confirmation.ready ? "complete" : "none";
}

/* -------------------------------------------------------------- errors */

/**
 * User-facing text for a failed draft read. Backend text is never shown for
 * the cases the UI can explain; everything else uses the shared messages.
 */
export function getDraftsErrorMessage(error, t) {
  const key = "dashboard.whatsappDrafts.errors";

  switch (classifyWhatsAppError(error)) {
    case "forbidden": return t(`${key}.forbidden`);
    case "not_found": return t(`${key}.notFound`);
    case "validation": return t(`${key}.validation`);
    case "unauthenticated": return t(`${key}.unauthenticated`);
    default: return getApiErrorMessage(error, t);
  }
}
