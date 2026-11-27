import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { dateOnlyOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * The financial calendar, a month at a time, read-only (docs/calendar/api.md).
 *
 * GET /calendar?month=&year=&view=month answers with data.period { from, to },
 * data.events[] and data.summary (the backend's counts). Event types are
 * recurring_occurrence, debt_due, budget_period_end and savings_goal_target; not
 * every type carries an amount, a currency or a direction, and those are shown
 * only when present. An amount without a currency is shown as sent, never as ILS.
 *
 * The month comes from the address (?month=YYYY-MM); anything else is the
 * current month. Years outside 2000..2100 are not asked for (the backend refuses them).
 */

export const EVENT_TYPES = ["recurring_occurrence", "debt_due", "budget_period_end", "savings_goal_target"];

const pad = (value) => String(value).padStart(2, "0");

/** The month in the address, or today's. */
export function readCalendarMonth(search, today = new Date()) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const match = /^(\d{4})-(\d{2})$/.exec(params.get("month") ?? "");
  if (match) {
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export const monthParam = ({ year, month }) => `${year}-${pad(month)}`;

/** The month before or after; null outside the range the backend accepts. */
export function shiftMonth({ year, month }, step) {
  let nextYear = year;
  let nextMonth = month + step;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return nextYear >= 2000 && nextYear <= 2100 ? { year: nextYear, month: nextMonth } : null;
}

function normalizeEvent(raw) {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" || typeof raw.id === "number" ? String(raw.id).slice(0, 80) : null;
  const date = dateOnlyOrNull(raw.date);
  if (!id || !date) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const amount = parseDecimal(raw.amount) ? raw.amount : null;

  return {
    id,
    type: EVENT_TYPES.includes(raw.type) ? raw.type : null,
    rawType: textOrNull(raw.type, 60),
    title: textOrNull(raw.title, 255),
    date,
    status: textOrNull(raw.status, 40),
    severity: ["info", "warning", "critical"].includes(raw.severity) ? raw.severity : "info",
    amount,
    currency,
    direction: raw.direction === "income" || raw.direction === "expense" ? raw.direction : null,
    subjectType: textOrNull(raw.subject_type, 60),
    subjectId: idText(raw.subject_id),
  };
}

const invalid = () => Object.assign(new Error("Calendar data could not be validated."), { code: "MALFORMED_RESPONSE" });

/**
 * The month's events in date order (the backend's order within a day), grouped
 * by day, and the backend's total. Refused when the events are not a list or
 * the period is not the month that was asked for.
 */
export function buildCalendarMonth(data, { year, month }) {
  if (!isRecord(data) || !Array.isArray(data.events)) throw invalid();

  const from = dateOnlyOrNull(data.period?.from);
  const expectedFrom = `${year}-${pad(month)}-01`;
  if (from !== null && from !== expectedFrom) throw invalid();

  const prefix = `${year}-${pad(month)}-`;
  const events = data.events.map(normalizeEvent).filter((event) => event && event.date.startsWith(prefix));
  const days = [];
  for (const event of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = days.at(-1);
    if (last?.date === event.date) last.events.push(event);
    else days.push({ date: event.date, events: [event] });
  }

  const total = Number.isSafeInteger(data.summary?.total) && data.summary.total >= 0 ? data.summary.total : null;

  return { days, count: events.length, total };
}
