import { getSubjectPath, PATH } from "../../../../routes/Path";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { formatDate, formatMoney } from "../utils/formatters";

/*
 * Display helpers for AI Copilot values. The backend decides every amount,
 * date and source; these only format what it sent. A missing value shows
 * "—" (formatMoney alone would print 0), and an amount without a valid ISO
 * currency is shown as a plain number instead of assuming one.
 */

const CURRENCY = /^[A-Z]{3}$/;

export const aiLocale = (i18n) => getDisplayLocale(i18n?.resolvedLanguage || i18n?.language);

export function formatAiMoney(value, currency, locale) {
  if (value == null || value === "") return "—";
  if (!Number.isFinite(Number(value))) return String(value);

  const code = String(currency ?? "").toUpperCase();
  if (CURRENCY.test(code)) return formatMoney(value, code, locale);

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
}

export function formatAiDate(value, locale) {
  if (!value) return "—";
  return formatDate(value, locale);
}

// Assistant sources link only to known in-app record types and reports.
export const sourcePath = (source) =>
  source?.type === "report" ? PATH.USER.REPORTS : source?.id ? getSubjectPath(source.type, source.id) : null;
