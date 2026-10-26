/*
 * Dates for Mobile. Latin digits like the amounts, the user's time zone when
 * it is a valid one, and null (never "Invalid Date") when the value is not a
 * date.
 */

// ISO strings, "YYYY-MM-DD" (a day, shown as that day in every time zone) and
// the backend's "YYYY-MM-DD HH:mm:ss".
export function parseDate(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T12:00:00Z`
    : /^\d{4}-\d{2}-\d{2} \d/.test(text)
      ? text.replace(" ", "T")
      : text;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value, locale, timeZone, options) {
  const date = parseDate(value);
  if (!date) return null;

  const base = { ...options, numberingSystem: "latn" };
  // A bare calendar date ("2026-10-20") names a day, not a moment: it is shown as that day in every zone.
  const zone = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) ? "UTC" : timeZone;

  try {
    return new Intl.DateTimeFormat(locale, zone ? { ...base, timeZone: zone } : base).format(date);
  } catch {
    // An unknown time zone name: show the date in the device's zone instead.
    return new Intl.DateTimeFormat(locale, base).format(date);
  }
}

export const formatDay = (value, locale = "en", timeZone) =>
  format(value, locale, timeZone, { year: "numeric", month: "short", day: "numeric" });

export const formatDayMonth = (value, locale = "en", timeZone) =>
  format(value, locale, timeZone, { month: "short", day: "numeric" });

export const formatClock = (timestamp, locale = "en") =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", numberingSystem: "latn" }).format(new Date(timestamp));
