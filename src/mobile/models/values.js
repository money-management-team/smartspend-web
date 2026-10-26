import { isCurrencyCode, parseDecimal } from "../money/decimal.js";

/*
 * Small, strict readers for backend values. Each returns the value only when
 * it is exactly what the backend documents, and null otherwise, so a screen
 * can show "—" for a field that is missing or wrong instead of guessing.
 */

export const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** A positive integer id as text (ids may arrive as numbers or strings). */
export function idText(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;

  const text = String(value ?? "");
  return /^[1-9]\d{0,18}$/.test(text) ? text : null;
}

export const textOrNull = (value, max = 255) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** The amount text itself, when it is a valid backend decimal. */
export const amountOrNull = (value) => (parseDecimal(value) ? value : null);

/** An amount that can be shown only with a valid currency. */
export const amountIn = (value, currency) => (isCurrencyCode(currency) ? amountOrNull(value) : null);

export const countOrNull = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/** true | false | null for a backend flag (true/false, 1/0, "1"/"0", "true"/"false"). */
export function flagOrNull(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return null;
}

export const dateOnlyOrNull = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);
