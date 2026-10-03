import { formatDate, formatDateTime } from "../../utils/formatters";
import { getAmountTone, getValueLabel, isCurrencyCode, isIsoDate } from "../reportHelpers";

/*
 * Display formatting for exported PDFs. Financial figures always use English
 * digits with thousands separators, whatever the document language; dates
 * use the document language with Latin digits. Nothing here changes a value:
 * it only turns the backend's value into text.
 */

const EMPTY = "—";
const MONEY = /^([+-]?)(\d+)(?:\.(\d+))?$/;

const hasValue = (value) => value != null && value !== "" && !(typeof value === "number" && Number.isNaN(value));

// Arabic month names with Latin digits; English otherwise.
export const getPdfLocale = (language) => (language?.startsWith("ar") ? "ar-u-nu-latn" : "en-US");

export const isRtlLanguage = (language) => Boolean(language?.startsWith("ar"));

const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/*
 * "12500.5000" → "12,500.50". Rounded half away from zero to 2 decimals on
 * the decimal string itself (BigInt), so no floating-point step can alter a
 * figure. Returns null for anything that isn't a plain decimal.
 */
export function formatPdfAmount(value) {
  if (!hasValue(value)) return null;

  const text = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(4) : "") : String(value).trim();
  const match = text.match(MONEY);
  if (!match) return null;

  const [, sign, integer, fraction = ""] = match;
  let cents = BigInt(`${integer}${fraction.padEnd(2, "0").slice(0, 2)}`);
  if ((fraction[2] ?? "0") >= "5") cents += 1n;

  const digits = cents.toString().padStart(3, "0");
  const negative = sign === "-" && cents !== 0n;

  return `${negative ? "-" : ""}${group(digits.slice(0, -2))}.${digits.slice(-2)}`;
}

// Amount and currency kept apart, for layouts that style them differently.
export function formatPdfMoneyParts(value, currency) {
  const amount = formatPdfAmount(value);

  return {
    amount: amount ?? (hasValue(value) ? String(value) : EMPTY),
    currency: amount != null && isCurrencyCode(currency) ? currency : null,
  };
}

// "12,500.50 ILS" — the code always follows the amount, in every language.
export function formatPdfMoney(value, currency) {
  const { amount, currency: code } = formatPdfMoneyParts(value, currency);
  return code ? `${amount} ${code}` : amount;
}

export function formatPdfNumber(value) {
  if (!hasValue(value)) return EMPTY;

  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)
    : String(value);
}

export function formatPdfPercentage(value) {
  if (!hasValue(value)) return EMPTY;

  const number = Number(value);
  return Number.isFinite(number)
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)}%`
    : String(value);
}

export const formatPdfDate = (value, locale) => (hasValue(value) ? formatDate(value, locale) : EMPTY);
export const formatPdfDateTime = (value, locale) => (hasValue(value) ? formatDateTime(value, locale) : EMPTY);

// A trend / period label: a date is formatted, anything else is shown as sent.
export function formatPdfLabel(value, locale) {
  if (!hasValue(value)) return EMPTY;
  return isIsoDate(String(value)) ? formatDate(value, locale) : String(value);
}

/*
 * Any report value by its display type (the types of reportDefinitions /
 * getValueType). Missing values are always "—", never "null", "undefined"
 * or "NaN".
 */
export function formatPdfValue(value, type, { currency, locale, t, i18n } = {}) {
  if (!hasValue(value)) return EMPTY;

  switch (type) {
    case "money":
      return formatPdfMoney(value, currency);
    case "count":
    case "decimal":
      return formatPdfNumber(value);
    case "percent":
      return formatPdfPercentage(value);
    case "date":
      return formatPdfDate(value, locale);
    case "datetime":
      return formatPdfDateTime(value, locale);
    case "boolean":
      return t(value ? "dashboard.reports.values.yes" : "dashboard.reports.values.no");
    case "enum":
    case "status":
      return getValueLabel(value, t, i18n);
    default:
      return typeof value === "object" ? EMPTY : String(value);
  }
}

/* ---------- Semantic colour ---------- */

// Money that is income by nature: shown in the success colour.
const INCOME_FIELDS = new Set([
  "income", "total_income", "inflow", "total_inflow", "expected_income", "recurring_expected_income",
  "collections", "period_contributions",
]);

// Signed results: green when positive, red when negative.
const SIGNED_FIELD = /(^|_)net(_|$)|net_change|net_position|^remaining$|^total_remaining$|^change$/;

/*
 * Tone of a money figure by what it means, not decoration: income is green,
 * a signed result follows its sign, everything else stays neutral.
 */
export function getMoneyTone(key, value) {
  const name = String(key ?? "").split(".").pop();

  if (SIGNED_FIELD.test(name)) {
    const sign = getAmountTone(value);
    return sign === "positive" ? "success" : sign === "negative" ? "danger" : "neutral";
  }

  return INCOME_FIELDS.has(name) ? "success" : "neutral";
}

export function getSignTone(value) {
  const sign = getAmountTone(value);
  return sign === "positive" ? "success" : sign === "negative" ? "danger" : "neutral";
}

const STATUS_TONES = {
  success: ["completed", "achieved", "safe", "paid", "posted", "income", "receivable"],
  warning: ["warning", "near_limit", "pending", "due", "scheduled", "paused", "partially_paid", "almost_there"],
  danger: ["exceeded", "overdue", "failed", "reversed"],
  primary: ["active", "in_progress"],
};

// Tone of a status / type badge. Unknown values stay neutral.
export function getStatusTone(value) {
  const key = String(value ?? "");
  return Object.keys(STATUS_TONES).find((tone) => STATUS_TONES[tone].includes(key)) ?? "neutral";
}

/* ---------- File name ---------- */

const slug = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/*
 * smart-spend-income-expense-report-2026-09.pdf for a period inside one
 * month, smart-spend-budgets-report-2026-07-01-to-2026-09-30.pdf otherwise.
 */
export function getPdfFileName(report, from, to) {
  const name = slug(report) || "financial";
  let period = "";

  if (isIsoDate(from) && isIsoDate(to)) {
    period = from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : `${from}-to-${to}`;
  } else if (isIsoDate(from) || isIsoDate(to)) {
    period = from || to;
  }

  return `smart-spend-${name}-report${period ? `-${slug(period)}` : ""}.pdf`;
}
