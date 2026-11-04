import { buildCalendarMonth } from "./calendar.js";

/*
 * What is coming up, for the Attention screen: the calendar's own events
 * (models/calendar.js validates them) that are not settled, overdue within
 * the months read, or due within the next `days` days. Nothing is computed
 * about money here: an event's amount is shown exactly as the backend sent it.
 *
 * The settled words are the full version's (Experience/experienceData.js
 * attentionEvents), restated rather than imported (Mobile does not import
 * Desktop feature code for a list of words).
 */
const SETTLED = new Set(["completed", "confirmed", "posted", "paid", "skipped", "cancelled", "closed", "achieved", "archived"]);

/** A calendar day (YYYY-MM-DD) moved by `step` days, or null for a malformed day. */
export function addDays(day, step) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + step);
  return date.toISOString().slice(0, 10);
}

/** { year, month } of a calendar day. */
export const monthOf = (day) => ({ year: Number.parseInt(day.slice(0, 4), 10), month: Number.parseInt(day.slice(5, 7), 10) });

/**
 * @param {{ data: unknown, month: { year: number, month: number } }[]} months the calendar responses read, one per month
 * @returns {{ overdue: object[], soon: object[] }} each in date order; a month whose response does not validate throws
 */
export function comingUp(months, today, days = 14) {
  const until = addDays(today, days);
  const events = months.flatMap(({ data, month }) => buildCalendarMonth(data, month).days.flatMap((day) => day.events));
  const open = events.filter((event) => !SETTLED.has(event.status ?? ""));
  const byDate = (a, b) => a.date.localeCompare(b.date);

  return {
    overdue: open.filter((event) => event.date < today).sort(byDate),
    soon: open.filter((event) => event.date >= today && until !== null && event.date <= until).sort(byDate),
  };
}
