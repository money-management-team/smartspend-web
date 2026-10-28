/*
 * What a Mobile form may accept, before anything else looks at it. Pure: no
 * React, no requests, no storage. Every rule here mirrors a documented rule of
 * the full version (docs/transactions, docs/transfers, docs/accounts,
 * docs/budgets, docs/savings-goals, docs/recurring-transactions, docs/debts);
 * the backend still has the last word, and Mobile sends none of these forms yet.
 *
 * Amounts stay strings end to end. They are compared digit by digit, never
 * converted to a floating-point number.
 */

// Arabic-Indic and Extended Arabic-Indic digits, and the Arabic decimal separator, typed on an Arabic keyboard.
const DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٫": "." };

/** The amount as typed, in ASCII digits, trimmed. Thousands separators are not accepted (they are ambiguous across languages). */
export const normalizeAmount = (value) =>
  typeof value === "string" ? [...value.trim()].map((char) => DIGITS[char] ?? char).join("") : "";

/**
 * "required" | "format" | "decimals" | "positive" | null.
 * `zero: true` accepts 0 (an opening balance, a fee left empty is not this).
 */
export function amountError(value, { required = true, zero = false } = {}) {
  const amount = normalizeAmount(value);
  if (!amount) return required ? "required" : null;
  if (!/^\d{1,14}(\.\d+)?$/.test(amount)) return "format";
  if (/\.\d{5,}$/.test(amount)) return "decimals";
  if (!zero && !/[1-9]/.test(amount)) return "positive";
  return null;
}

/** Compares two non-negative decimal strings that passed amountError: -1, 0 or 1. */
export function compareAmounts(a, b) {
  const split = (value) => {
    const [whole, fraction = ""] = normalizeAmount(value).split(".");
    return [whole.replace(/^0+(?=\d)/, ""), fraction.padEnd(4, "0")];
  };
  const [aw, af] = split(a);
  const [bw, bf] = split(b);
  if (aw.length !== bw.length) return aw.length < bw.length ? -1 : 1;
  if (aw !== bw) return aw < bw ? -1 : 1;
  if (af !== bf) return af < bf ? -1 : 1;
  return 0;
}

/** "required" | "tooShort" | "tooLong" | null. Counted in characters after trimming, like the backend's limits. */
export function textError(value, { required = false, min = 0, max = 255 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return required ? "required" : null;
  const length = [...text].length;
  if (length < min) return "tooShort";
  return length > max ? "tooLong" : null;
}

/** A real calendar day as YYYY-MM-DD. */
export function isCalendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateError(value, { required = false } = {}) {
  if (!value) return required ? "required" : null;
  return isCalendarDay(value) ? null : "date";
}

/** "required" | "whole" | "range" | null, for a small whole number typed as text. */
export function integerError(value, { required = false, min = 1, max = 1000 } = {}) {
  const text = normalizeAmount(value);
  if (!text) return required ? "required" : null;
  if (!/^\d{1,6}$/.test(text)) return "whole";
  const number = parseInt(text, 10);
  return number < min || number > max ? "range" : null;
}

/** Today in the given time zone (the workspace's, when known), as YYYY-MM-DD. */
export function todayIn(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
