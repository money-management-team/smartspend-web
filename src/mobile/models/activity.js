import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { amountIn, idText, isRecord, textOrNull } from "./values.js";

/*
 * Transactions as Mobile Activity shows them: the filters, a page of the list,
 * one transaction.
 *
 * What the backend contract gives (docs/transactions/api.md, and the Desktop
 * list and details that already read it; nothing here is invented):
 *
 * - GET /transactions takes type (income | expense | transfer), account_id,
 *   category_id, status (posted | pending_review | draft | reversed | failed),
 *   date_from, date_to (YYYY-MM-DD), sort_by + sort_dir, per_page, page, and
 *   answers with a Laravel paginator. There is no search parameter and no
 *   cursor, so Mobile has neither.
 * - A row's `amount` is a positive decimal string; income or expense is the
 *   row's `type`, not the sign of the amount. A transfer and a reversal entry
 *   have no direction of their own, and a fee is an expense. Any other type
 *   shows its amount as sent, without a sign it cannot justify.
 * - A reversed transaction keeps `status: "reversed"` (with reversed_at and
 *   reversal_reason). Its reversal entry has reversal_of_id. A correction's
 *   replacement has related_transaction_id (the original's id).
 * - occurred_at is an ISO timestamp with an offset or Z (the Desktop tests use
 *   both). The day a transaction belongs to is the day in the user's time zone.
 */

export const ACTIVITY_TYPES = ["income", "expense", "transfer"];
export const ACTIVITY_STATUSES = ["posted", "pending_review", "draft", "reversed", "failed"];
export const ACTIVITY_SORTS = ["occurred_at:desc", "occurred_at:asc"];
export const DEFAULT_SORT = "occurred_at:desc";

/* ---------- Dates ---------- */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOMENT = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/i;

export function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;

  // A day that does not exist (02-30) comes back as another day.
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;

  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar day ("YYYY-MM-DD") a backend date belongs to, or null when it
 * is not a date. Never goes through the device's local zone:
 *
 * - a bare date, or a time with no zone, is the day it says (nothing is
 *   converted, because nothing says which zone it is in);
 * - a time with an offset or Z is converted to the user's time zone when that
 *   is a valid zone; without one, the day as written is kept (UTC for Z).
 */
export function dayKey(value, timeZone) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (DATE_ONLY.test(text)) return isCalendarDate(text) ? text : null;

  const match = MOMENT.exec(text);
  if (!match || !isCalendarDate(match[1])) return null;
  // 25:00 is not a time: a value that cannot be placed on a day is not put on one.
  if (match[2].slice(0, 2) > "23" || match[2].slice(3, 5) > "59") return null;
  if (!match[3] || !isValidTimeZone(timeZone)) return match[1];

  const instant = new Date(`${match[1]}T${match[2]}${match[3].toUpperCase() === "Z" ? "Z" : match[3].includes(":") ? match[3] : `${match[3].slice(0, 3)}:${match[3].slice(3)}`}`);
  if (Number.isNaN(instant.getTime())) return match[1];

  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", numberingSystem: "latn" }).formatToParts(instant);
  const pick = (type) => parts.find((part) => part.type === type)?.value;

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/* ---------- Filters ---------- */

const ID = /^[1-9]\d{0,14}$/;

/**
 * The filters in a URL, sanitised: anything that is not a documented value is
 * dropped, never sent. The names are the Desktop list's, so a Mobile address
 * and its Desktop counterpart carry the same query.
 */
export function readActivityFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const pick = (name, test) => {
    const value = params.get(name) ?? "";
    return test(value) ? value : "";
  };
  const dateFrom = pick("date_from", isCalendarDate);
  const dateTo = pick("date_to", isCalendarDate);
  // A range that ends before it starts is dropped as a whole, not guessed at.
  const ordered = !dateFrom || !dateTo || dateFrom <= dateTo;

  return {
    type: pick("type", (value) => ACTIVITY_TYPES.includes(value)),
    status: pick("status", (value) => ACTIVITY_STATUSES.includes(value)),
    account_id: pick("account_id", (value) => ID.test(value)),
    category_id: pick("category_id", (value) => ID.test(value)),
    date_from: ordered ? dateFrom : "",
    date_to: ordered ? dateTo : "",
    sort: pick("sort", (value) => ACTIVITY_SORTS.includes(value)) || DEFAULT_SORT,
  };
}

// Defaults are left out to keep addresses short; the order is fixed, so equal filters give equal text.
export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();

  for (const key of ["type", "status", "account_id", "category_id", "date_from", "date_to", "sort"]) {
    const value = filters[key];
    if (!value || (key === "sort" && value === DEFAULT_SORT)) continue;
    params.set(key, value);
  }

  return params;
}

export const filterSignature = (filters) => filtersToSearchParams(filters).toString() || "all";

// What counts as "filtered": everything except the sort order.
export const activeFilterKeys = (filters) => ["type", "status", "account_id", "category_id", "date_from", "date_to"].filter((key) => filters[key]);

export const hasActiveFilters = (filters) => activeFilterKeys(filters).length > 0;

export function filtersToQuery(filters, page, perPage) {
  const [sortBy, sortDir] = filters.sort.split(":");

  return {
    type: filters.type || undefined,
    status: filters.status || undefined,
    account_id: filters.account_id || undefined,
    category_id: filters.category_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    per_page: perPage,
    page,
  };
}

/* ---------- One transaction ---------- */

const SIGN_BY_TYPE = { income: "income", expense: "expense", fee: "expense" };
// Types whose direction is not the amount's sign: shown unsigned.
const NEUTRAL_TYPES = ["transfer", "reversal"];

function ledgerAccounts(raw) {
  const accounts = new Map();
  const add = (account, id) => {
    const key = idText(account?.id ?? id);
    if (key && !accounts.has(key)) accounts.set(key, { id: key, name: textOrNull(account?.name, 80) });
  };

  if (isRecord(raw.account)) add(raw.account);
  for (const entry of Array.isArray(raw.ledger_entries) ? raw.ledger_entries : []) {
    if (isRecord(entry)) add(entry.account, entry.account_id);
  }

  return [...accounts.values()];
}

/**
 * One row of the list, or null when it is not an object with a usable id.
 * `amount` is what the row shows: for income and expense the amount's digits
 * with the sign the type gives it, for a transfer and a reversal the digits
 * alone, for any other type the amount exactly as sent.
 */
export function normalizeTransaction(raw, { timeZone } = {}) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;

  const type = typeof raw.type === "string" && raw.type ? raw.type : null;
  const status = typeof raw.status === "string" && raw.status ? raw.status : null;
  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const isReversal = raw.reversal_of_id != null || type === "reversal";
  const direction = isReversal ? null : SIGN_BY_TYPE[type] ?? null;
  const sent = amountIn(raw.amount, currency);
  const digits = sent && sent.startsWith("-") ? sent.slice(1) : sent;
  const entries = Array.isArray(raw.ledger_entries) ? raw.ledger_entries.filter(isRecord) : [];
  const accounts = ledgerAccounts(raw);
  const own = entries.find((entry) => entry.entry_role === type);
  const primary = own ? accounts.find((account) => account.id === idText(own.account?.id ?? own.account_id)) : accounts[0];

  let amount = sent;
  if (direction === "income") amount = digits;
  else if (direction === "expense") amount = digits ? `-${digits}` : null;
  else if (isReversal || NEUTRAL_TYPES.includes(type)) amount = digits;

  return {
    id,
    type,
    status,
    statusKnown: ACTIVITY_STATUSES.includes(status),
    currency,
    amount,
    direction,
    isReversal,
    isTransfer: raw.transfer_id != null || type === "transfer" || type === "fee",
    reversed: status === "reversed",
    title: textOrNull(raw.description) ?? textOrNull(raw.category?.name),
    categoryName: textOrNull(raw.category?.name, 80),
    categoryId: idText(raw.category?.id ?? raw.category_id),
    accounts,
    account: primary ?? null,
    occurredAt: typeof raw.occurred_at === "string" ? raw.occurred_at : null,
    day: dayKey(raw.occurred_at, timeZone),
    reversalOfId: idText(raw.reversal_of_id),
    relatedId: idText(raw.related_transaction_id),
    transferId: idText(raw.transfer_id),
  };
}

/* ---------- A page of the list ---------- */

const invalid = () => Object.assign(new Error("Transactions could not be validated."), { code: "MALFORMED_RESPONSE" });

/**
 * One page of GET /transactions, refused whole when it does not hold together:
 * paginator numbers that disagree with each other or with the request, a row
 * that is not an object with an id, an id twice on the page.
 */
export function buildActivityPage(response, expected, { timeZone } = {}) {
  const page = response?.data?.transactions;
  const integer = (value, min) => Number.isSafeInteger(value) && value >= min;

  if (
    response?.status !== true ||
    !isRecord(page) ||
    !Array.isArray(page.data) ||
    !integer(page.total, 0) ||
    !integer(page.current_page, 1) ||
    !integer(page.last_page, 1) ||
    !integer(page.per_page, 1) ||
    page.per_page > 100 ||
    page.data.length > page.per_page ||
    page.current_page !== expected.page ||
    page.per_page !== expected.perPage ||
    page.last_page !== Math.max(1, Math.ceil(page.total / page.per_page))
  ) {
    throw invalid();
  }

  const rows = page.data.map((raw) => normalizeTransaction(raw, { timeZone }));
  if (rows.some((row) => row === null)) throw invalid();
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw invalid();

  const from = rows.length ? (page.current_page - 1) * page.per_page + 1 : null;
  const to = rows.length ? from + rows.length - 1 : null;
  if ((to != null && to > page.total) || (page.from ?? null) !== from || (page.to ?? null) !== to) throw invalid();

  return { rows, total: page.total, page: page.current_page, lastPage: page.last_page };
}

/** Pages in order, one list: a transaction that shows up on two pages (the list shifted while paging) appears once, in its first place. */
export function mergePages(pages) {
  const seen = new Set();
  const items = [];
  let duplicates = 0;

  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) duplicates += 1;
      else {
        seen.add(row.id);
        items.push(row);
      }
    }
  }

  return { items, duplicates };
}

/** Consecutive rows of the same day, in order. Only meaningful when the list is sorted by date (it is: the sort choices are the two date orders). */
export function groupByDay(items) {
  const groups = [];

  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }

  return groups;
}

/* ---------- One transaction's page ---------- */

/**
 * GET /transactions/{id}. The transaction must be the one asked for: a
 * response about another id is refused, so figures never appear under the
 * wrong record.
 */
export function buildTransactionDetail(data, requestedId, { timeZone } = {}) {
  const raw = isRecord(data) ? data.transaction : null;
  const base = normalizeTransaction(raw, { timeZone });

  if (!base || base.id !== String(requestedId)) return null;

  const entries = (Array.isArray(raw.ledger_entries) ? raw.ledger_entries : []).filter(isRecord).map((entry, index) => {
    const currency = isCurrencyCode(entry.currency_code) ? entry.currency_code : base.currency;

    return {
      key: idText(entry.id) ?? `entry-${index}`,
      accountId: idText(entry.account?.id ?? entry.account_id),
      accountName: textOrNull(entry.account?.name, 80),
      role: typeof entry.entry_role === "string" && /^[a-z_]{1,40}$/.test(entry.entry_role) ? entry.entry_role : null,
      amount: parseDecimal(entry.signed_amount) ? entry.signed_amount : null,
      currency,
    };
  });

  return {
    ...base,
    referenceNumber: textOrNull(raw.reference_number, 120),
    description: textOrNull(raw.description, 500),
    postedAt: typeof raw.posted_at === "string" ? raw.posted_at : null,
    reversedAt: typeof raw.reversed_at === "string" ? raw.reversed_at : null,
    reversalReason: textOrNull(raw.reversal_reason, 500),
    source: typeof raw.source === "string" && /^[a-z_]{1,40}$/.test(raw.source) ? raw.source : null,
    creatorName: textOrNull(raw.creator?.name, 80),
    entries,
  };
}
