/*
 * Money for Mobile, as text.
 *
 * The backend sends amounts as decimal strings ("1234.5000"). A JavaScript
 * number cannot hold every one of them exactly, and Number("abc") quietly
 * turns bad data into NaN, which a formatter then prints as 0.00. So nothing
 * here converts an amount to a number: a value is checked against the
 * backend's decimal shape, its digits are kept as they are, and only the
 * integer part goes through Intl (as a BigInt, which is exact) for grouping.
 *
 * Anything that is not a valid amount in a valid currency is "unavailable"
 * (null) and is shown as "—". It is never shown as zero.
 *
 * The shared formatMoney helper (features/Dashboards/User/utils/formatters.js)
 * is deliberately not used and not changed.
 */

// Optional minus, 1-40 integer digits, optional 1-4 decimals. No plus sign, no
// spaces, no exponent, no thousands separators, and more than four decimals is
// refused rather than rounded.
const DECIMAL = /^(-?)(\d{1,40})(?:\.(\d{1,4}))?$/;
const CURRENCY = /^[A-Z]{3}$/;

export const MINUS = "−";

/** @returns {{ negative: boolean, integer: string, fraction: string } | null} */
export function parseDecimal(value) {
  if (typeof value !== "string") return null;

  const match = DECIMAL.exec(value);
  if (!match) return null;

  const integer = match[2].replace(/^0+(?=\d)/, "");
  const fraction = match[3] ?? "";
  const isZero = /^0$/.test(integer) && /^0*$/.test(fraction);

  // "-0.0000" is zero, and zero has no sign.
  return { negative: match[1] === "-" && !isZero, integer, fraction };
}

export const isCurrencyCode = (value) => typeof value === "string" && CURRENCY.test(value);

export const isNegativeAmount = (value) => parseDecimal(value)?.negative === true;

const formatters = new Map();

function numberFormats(locale) {
  if (!formatters.has(locale)) {
    const grouping = new Intl.NumberFormat(locale, { numberingSystem: "latn", useGrouping: true, maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(locale, { numberingSystem: "latn", minimumFractionDigits: 1 })
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";

    formatters.set(locale, { grouping, decimal });
  }

  return formatters.get(locale);
}

/**
 * The parts of an amount, ready to display.
 *
 * Digits are Latin in every language (the provisional Mobile policy), grouping
 * and the decimal mark follow the locale. At least two decimals are shown, and
 * up to four when the amount has them: 0.0050 is "0.005", 1.0049 stays
 * "1.0049", -125.5000 is "-125.50". Trailing zeros are the only digits dropped.
 *
 * @returns {{ negative: boolean, zero: boolean, number: string, currency: string } | null}
 */
export function formatMoneyParts(value, currency, locale = "en") {
  const parsed = parseDecimal(value);
  if (!parsed || !isCurrencyCode(currency)) return null;

  const { grouping, decimal } = numberFormats(locale);
  const fraction = parsed.fraction.replace(/0+$/, "").padEnd(2, "0");

  return {
    negative: parsed.negative,
    zero: /^0$/.test(parsed.integer) && /^0*$/.test(parsed.fraction),
    number: `${grouping.format(BigInt(parsed.integer))}${decimal}${fraction}`,
    currency,
  };
}

/** "−1,234.50 ILS" (or "+1,234.50 ILS" with `plus`), or null when the amount is unavailable. */
export function formatMoneyText(value, currency, locale = "en", { plus = false } = {}) {
  const parts = formatMoneyParts(value, currency, locale);
  if (!parts) return null;

  const sign = parts.negative ? MINUS : plus && !parts.zero ? "+" : "";

  return `${sign}${parts.number} ${parts.currency}`;
}

const displayNames = new Map();

/** The currency's name in the language ("Israeli New Shekel"), or its code when the platform has none. */
export function currencyName(code, locale = "en") {
  if (!isCurrencyCode(code)) return "";

  try {
    if (!displayNames.has(locale)) displayNames.set(locale, new Intl.DisplayNames([locale], { type: "currency" }));
    return displayNames.get(locale).of(code) ?? code;
  } catch {
    return code;
  }
}
