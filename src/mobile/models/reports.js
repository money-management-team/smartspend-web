import { buildTrend } from "./trend.js";
import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { idText, isRecord, textOrNull } from "./values.js";

/*
 * The ten reports, read-only (docs/reports/api.md). Each is GET /reports/{type}
 * with from, to, and for the list reports per_page and page; no workspace (the
 * backend scopes by the token). What Mobile shows of an answer:
 *
 * - summary_by_currency: one row per currency, each figure the backend's own.
 *   The fields per report are the ones the full version shows (its
 *   reportDefinitions.js); a field missing from the answer is "not available",
 *   never zero. Currencies are never added together.
 * - items, for the five reports whose item fields are documented (accounts,
 *   budgets, savings-goals, debts, recurring): the first page, with a name and
 *   one figure per row. The pagination numbers are the backend's.
 *
 * The bar comparison is a picture of the numbers already in the table beside
 * it (the table is its text alternative). Bar lengths are worked out with
 * integers on the decimal strings, never with floating point.
 */

export const REPORT_TYPES = ["overview", "income-expense", "cash-flow", "accounts", "categories", "transfers", "budgets", "savings-goals", "debts", "recurring"];

const COUNT_FIELD = /(_count|_templates|_occurrences)$/;
export const isCountField = (field) => COUNT_FIELD.test(field);

/* Summary groups per report: the full version's own lists. */
export const REPORT_SUMMARY = Object.freeze({
  overview: [["total_income", "total_expense", "net_income"], ["total_inflow", "total_outflow", "net_cash_flow"], ["transfer_in", "transfer_out", "net_internal_transfer_effect"], ["current_account_balance"], ["budgets_total", "budgets_spent"], ["savings_target", "savings_saved"], ["payable_outstanding", "receivable_outstanding"], ["recurring_expected_income", "recurring_expected_expense"]],
  "income-expense": [["total_income", "total_expense", "net_income", "transaction_count"]],
  "cash-flow": [["total_inflow", "total_outflow", "net_cash_flow"]],
  accounts: [["total_current_balance", "total_net_change", "total_inflow", "total_outflow", "total_opening_balance", "accounts_count"]],
  categories: [["total_income", "total_expense", "net_income", "categories_count"]],
  transfers: [["transfers_count", "total_principal", "total_fees", "transfer_in", "transfer_out", "net_internal_transfer_effect"]],
  budgets: [["total_budget", "total_spent", "total_remaining", "budgets_count"]],
  "savings-goals": [["total_target", "total_saved", "total_remaining", "goals_count"], ["period_contributions", "period_withdrawals", "period_net_movement"]],
  debts: [["payable_original", "payable_outstanding"], ["receivable_original", "receivable_outstanding"], ["debt_received", "debt_given", "payments", "collections"], ["debts_count"]],
  recurring: [["active_templates", "paused_templates", "completed_templates", "archived_templates"], ["expected_income", "expected_expense"], ["posted_occurrences", "skipped_occurrences", "failed_occurrences", "upcoming_occurrences"]],
});

/* The documented items: which field names a row, which figure it shows, which id it has. */
export const REPORT_ITEMS = Object.freeze({
  accounts: { id: "account_id", name: "name", figure: "current_balance" },
  budgets: { id: "budget_id", name: "name", figure: "spent", of: "amount_limit" },
  "savings-goals": { id: "savings_goal_id", name: "name", figure: "saved_amount", of: "target_amount" },
  debts: { id: "debt_id", name: "counterparty_name", figure: "outstanding_amount" },
  recurring: { id: "recurring_transaction_id", name: "name", figure: "amount" },
});

export const REPORT_PER_PAGE = 10;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value) => String(value).padStart(2, "0");
const isRealDate = (text) => {
  if (!DATE.test(text)) return false;
  const [year, month, day] = text.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** The range in the address, or this month so far. A range that ends before it starts is not used. */
export function readReportRange(search, today = new Date()) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (isRealDate(from) && isRealDate(to) && from <= to) return { from, to, custom: true };

  const first = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const now = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return { from: first, to: now, custom: false };
}

/** Whether a range typed in the form may be sent: two real dates, the first not after the second. */
export const validReportRange = (from, to) => isRealDate(from) && isRealDate(to) && from <= to;

// The trend's bucket size (docs/reports/api.md `group_by`); the backend's default is month, so month is not sent.
export const REPORT_GROUPS = Object.freeze(["day", "week", "month"]);
export const readReportGroup = (search) => {
  const value = new URLSearchParams(search ?? "").get("group_by");
  return REPORT_GROUPS.includes(value) ? value : "month";
};

export const reportQuery = (type, range, page = 1, group = "month") => ({ from: range.from, to: range.to, ...(group !== "month" && REPORT_GROUPS.includes(group) ? { group_by: group } : {}), ...(REPORT_ITEMS[type] ? { per_page: REPORT_PER_PAGE, page: page > 1 ? page : undefined } : {}) });

const invalid = () => Object.assign(new Error("Report data could not be validated."), { code: "MALFORMED_RESPONSE" });

const figure = (value, field) => {
  if (isCountField(field)) return Number.isSafeInteger(value) && value >= 0 ? { kind: "count", value } : null;
  return parseDecimal(value) ? { kind: "money", value } : null;
};

function readSummary(raw, type) {
  // summary_by_currency is rows; an object keyed by currency is accepted too (as the full version does).
  const rows = Array.isArray(raw) ? raw : isRecord(raw) ? Object.entries(raw).map(([code, row]) => (isRecord(row) ? { currency_code: code, ...row } : null)) : null;
  if (!rows) throw invalid();

  const seen = new Set();
  return rows
    .filter((row) => isRecord(row) && isCurrencyCode(row.currency_code))
    .filter((row) => (seen.has(row.currency_code) ? false : seen.add(row.currency_code)))
    .map((row) => ({
      currency: row.currency_code,
      groups: REPORT_SUMMARY[type].map((fields) => fields.map((field) => ({ field, figure: figure(row[field], field) }))),
    }));
}

function readItems(raw, type) {
  const spec = REPORT_ITEMS[type];
  if (!spec || !Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row, index) => {
      const currency = isCurrencyCode(row.currency_code) ? row.currency_code : null;
      return {
        key: idText(row[spec.id]) ?? `row-${index}`,
        id: idText(row[spec.id]),
        name: textOrNull(row[spec.name]),
        currency,
        figure: currency && parseDecimal(row[spec.figure]) ? row[spec.figure] : null,
        of: spec.of && currency && parseDecimal(row[spec.of]) ? row[spec.of] : null,
        status: textOrNull(row.effective_status ?? row.progress_status ?? row.status, 40),
      };
    });
}

function readPagination(raw) {
  if (!isRecord(raw)) return null;
  const int = (value, min) => (Number.isSafeInteger(value) && value >= min ? value : null);
  const total = int(raw.total, 0);
  const page = int(raw.current_page, 1);
  const lastPage = int(raw.last_page, 1);
  if (total === null || page === null || lastPage === null) return null;
  return { total, page, lastPage };
}

/** A report answer, refused when it is about another report or has no usable summary. */
export function buildReport(data, type) {
  if (!isRecord(data) || (data.report != null && data.report !== type)) throw invalid();
  const period = isRecord(data.period) ? { from: textOrNull(data.period.date_from, 10), to: textOrNull(data.period.date_to, 10), timezone: textOrNull(data.period.timezone, 64) } : null;

  return {
    type,
    period,
    currencies: readSummary(data.summary_by_currency ?? [], type),
    items: readItems(data.items, type),
    pagination: REPORT_ITEMS[type] ? readPagination(data.pagination) : null,
    trend: buildTrend(isRecord(data.analytics) ? data.analytics.trend_by_currency : null),
  };
}

/*
 * The length of each bar in a group, as a whole percent of the largest absolute
 * value in that group, from the decimal strings with BigInt (no floats, no
 * rounding of the figures themselves: only the drawing is approximate).
 */
export function barLengths(values) {
  const scaled = values.map((value) => {
    const parts = parseDecimal(value);
    if (!parts) return null;
    return BigInt(`${parts.integer}${parts.fraction.padEnd(4, "0")}`);
  });
  const largest = scaled.reduce((max, item) => (item !== null && item > max ? item : max), 0n);
  return scaled.map((item) => (item === null ? null : largest === 0n ? 0 : Number.parseInt(String((item * 100n) / largest), 10)));
}
