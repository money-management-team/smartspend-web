import { getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";

// "range" is the page's custom date window; the backend's `view` is only
// month | week.
export const CALENDAR_VIEWS = ["month", "week", "range"];
// Backend event sources (`types[]`), in display order.
export const CALENDAR_EVENT_TYPES = [
  "recurring_occurrence",
  "debt_due",
  "budget_period_end",
  "savings_goal_target",
];
export const CALENDAR_SEVERITIES = ["info", "warning", "critical"];
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
// Longest from → to window the backend accepts, in days (both ends included).
export const MAX_RANGE_DAYS = 366;
// Events shown in one month-grid cell before "+N more".
export const MONTH_CELL_LIMIT = 3;
// Beyond this, a period is listed in the agenda only (no grid).
const GRID_MAX_DAYS = 62;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Status values come from the backend (`summary.by_status`); the URL only
// needs to keep them well-formed.
const STATUS = /^[a-z0-9_]{1,50}$/;
const DAY_MS = 86_400_000;

const toCount = (value) => {
  const number = Number(value);
  return value != null && value !== "" && Number.isFinite(number) ? number : null;
};

/* ---------- Dates (calendar days, no time zone shifts) ---------- */

export const toDateOnly = (value) => String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

// "YYYY-MM-DD" → Date at 00:00 UTC; null when not a real day.
export function parseIsoDate(value) {
  if (!DATE.test(value ?? "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export const isIsoDate = (value) => parseIsoDate(value) != null;

const toIsoDate = (date) => date.toISOString().slice(0, 10);

export function addDays(iso, days) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

// Days from `from` to `to`, both included.
export const countDays = (from, to) => Math.round((parseIsoDate(to) - parseIsoDate(from)) / DAY_MS) + 1;

const pad = (value) => String(value).padStart(2, "0");

export const monthStart = (year, month) => `${year}-${pad(month)}-01`;

export const monthEnd = (year, month) =>
  toIsoDate(new Date(Date.UTC(year, month, 0)));

// Today as a calendar day in the workspace's time zone when known (the one
// the backend dates its records in), otherwise the browser's.
export function getTodayIso(timeZone) {
  const read = (zone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  };

  try {
    if (timeZone) return read(timeZone);
  } catch {
    // Unknown time zone name: fall back to the browser's.
  }

  return read(undefined);
}

// First day of the week: Saturday in Arabic, Sunday in English.
export const getWeekStart = (language) => (language?.startsWith("ar") ? 6 : 0);

export function startOfWeek(iso, weekStart) {
  const offset = (parseIsoDate(iso).getUTCDay() - weekStart + 7) % 7;
  return addDays(iso, -offset);
}

// Short weekday names in grid order.
export function getWeekdayNames(locale, weekStart) {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(2023, 0, 1 + ((weekStart + index) % 7)))),
  );
}

/* ---------- Filters (kept in the URL) ---------- */

const toInt = (value) => {
  const number = Number(value);
  return value != null && value !== "" && Number.isInteger(number) ? number : null;
};

const unique = (values) => Array.from(new Set(values));

/*
 * The page's URL → filters. A missing or invalid period falls back to the
 * current month/week, and an invalid custom range to the month view, so a bad
 * URL never reaches the backend.
 * `{ view, month, year, from, to, types, statuses, owner }`; `from`/`to` are
 * set for the week and range views.
 */
export function readCalendarFilters(searchParams, { today, weekStart }) {
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const month = toInt(searchParams.get("month"));
  const year = toInt(searchParams.get("year"));
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  let view = CALENDAR_VIEWS.includes(searchParams.get("view")) ? searchParams.get("view") : "month";

  if (view === "range" && getRangeError(from, to)) view = "month";

  const common = {
    types: unique(searchParams.getAll("type")).filter((type) => CALENDAR_EVENT_TYPES.includes(type)),
    statuses: unique(searchParams.getAll("status")).filter((status) => STATUS.test(status)),
    owner: searchParams.get("owner") === "mine" ? "mine" : "",
  };

  if (view === "week") {
    const weekFrom = startOfWeek(isIsoDate(from) ? from : today, weekStart);
    return { ...common, view, month: null, year: null, from: weekFrom, to: addDays(weekFrom, 6) };
  }

  if (view === "range") return { ...common, view, month: null, year: null, from, to };

  const validMonth = month >= 1 && month <= 12 && year >= MIN_YEAR && year <= MAX_YEAR;

  return {
    ...common,
    view: "month",
    month: validMonth ? month : todayMonth,
    year: validMonth ? year : Math.min(MAX_YEAR, Math.max(MIN_YEAR, todayYear)),
    from: "",
    to: "",
  };
}

export function calendarFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.view === "month") {
    params.set("month", String(filters.month));
    params.set("year", String(filters.year));
  } else {
    params.set("view", filters.view);
    params.set("from", filters.from);
    if (filters.view === "range") params.set("to", filters.to);
  }

  filters.types.forEach((type) => params.append("type", type));
  filters.statuses.forEach((status) => params.append("status", status));
  if (filters.owner) params.set("owner", filters.owner);

  return params;
}

/*
 * GET /calendar query. Month view: month + year; week view: from + to +
 * view=week; custom range: from + to. Array filters go under `types[]` and
 * `statuses[]`. `workspace_id` is the session workspace when one is stored.
 */
export function calendarFiltersToQuery(filters) {
  const query = {
    workspace_id: getStoredWorkspace()?.id,
    "types[]": filters.types.length ? filters.types : undefined,
    "statuses[]": filters.statuses.length ? filters.statuses : undefined,
    owner: filters.owner || undefined,
  };

  if (filters.view === "month") return { ...query, month: filters.month, year: filters.year, view: "month" };
  if (filters.view === "week") return { ...query, from: filters.from, to: filters.to, view: "week" };
  return { ...query, from: filters.from, to: filters.to };
}

export const hasActiveCalendarFilters = (filters) =>
  filters.types.length > 0 || filters.statuses.length > 0 || Boolean(filters.owner);

// The days the request covers: the whole month, the week, or the range.
export const getRequestedRange = (filters) =>
  filters.view === "month"
    ? { from: monthStart(filters.year, filters.month), to: monthEnd(filters.year, filters.month) }
    : { from: filters.from, to: filters.to };

// Month view one month back/forward; null past the backend's year limits.
export function shiftMonth({ month, year }, delta) {
  const index = year * 12 + (month - 1) + delta;
  const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  return next.year >= MIN_YEAR && next.year <= MAX_YEAR ? next : null;
}

// Error key under `dashboard.calendar.range.errors`, or "" when valid.
export function getRangeError(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to)) return "required";
  if (to < from) return "order";
  if (countDays(from, to) > MAX_RANGE_DAYS) return "tooLong";
  return "";
}

/* ---------- Response ---------- */

// `{ key: count }` → `[[key, count]]`, keeping only numeric counts.
const readCounts = (counts) =>
  counts && typeof counts === "object" && !Array.isArray(counts)
    ? Object.entries(counts)
        .map(([key, value]) => [key, toCount(value)])
        .filter(([, count]) => count != null)
    : [];

/*
 * `data.period`, `data.events[]` and `data.summary`, read defensively: events
 * of different types don't share every optional field (amount, currency,
 * direction…). Null when there is no `events` array (malformed).
 */
export function parseCalendarResponse(response) {
  const data = response?.data;
  if (!data || typeof data !== "object" || !Array.isArray(data.events)) return null;

  const period = data.period && typeof data.period === "object" ? data.period : {};
  const summary = data.summary && typeof data.summary === "object" ? data.summary : null;

  return {
    period: {
      from: toDateOnly(period.from),
      to: toDateOnly(period.to),
      view: period.view ?? null,
    },
    events: data.events.filter((event) => event && typeof event === "object"),
    summary: summary && {
      total: toCount(summary.total),
      byType: readCounts(summary.by_type),
      byStatus: readCounts(summary.by_status),
      bySeverity: readCounts(summary.by_severity),
    },
  };
}

export const getEventDate = (event) => toDateOnly(event?.date);

export const getEventTypeClass = (event) =>
  CALENDAR_EVENT_TYPES.includes(event?.type) ? event.type : "other";

export const getEventSeverity = (event) =>
  CALENDAR_SEVERITIES.includes(event?.severity) ? event.severity : "info";

export const getEventKey = (event, index) => String(event?.id ?? `${event?.type}-${event?.date}-${index}`);

// Events grouped by day, days in date order, events in the backend's order.
export function groupEventsByDate(events) {
  const groups = new Map();

  events.forEach((event) => {
    const date = getEventDate(event);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(event);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => (left === right ? 0 : left === "" ? 1 : right === "" ? -1 : left < right ? -1 : 1))
    .map(([date, items]) => ({ date, events: items }));
}

/*
 * The event's `actions`, as action names. The calendar never performs them:
 * each one opens the subject's own page, where the resource's existing flow
 * (confirm/skip a recurring occurrence, record a debt payment…) runs.
 */
export function getEventActions(event) {
  if (!Array.isArray(event?.actions)) return [];

  return unique(
    event.actions
      .map((action) =>
        typeof action === "string"
          ? action
          : action && typeof action === "object"
            ? (action.key ?? action.type ?? action.name ?? action.action)
            : null,
      )
      .filter((name) => typeof name === "string" && name !== ""),
  );
}

/*
 * The grid's days for a month or week period: from the start of the first
 * week to the end of the last one, flagging the days outside the period.
 * Empty when the period is unknown or too long for a grid.
 */
export function buildCalendarDays(range, weekStart) {
  if (!isIsoDate(range?.from) || !isIsoDate(range?.to) || range.to < range.from) return [];
  if (countDays(range.from, range.to) > GRID_MAX_DAYS) return [];

  const first = startOfWeek(range.from, weekStart);
  const last = addDays(startOfWeek(range.to, weekStart), 6);
  const days = [];

  for (let date = first; date <= last; date = addDays(date, 1)) {
    days.push({ date, inPeriod: date >= range.from && date <= range.to });
  }

  return days;
}

/* ---------- Errors ---------- */

/*
 * Calendar wording where the generic message would mislead. 403: the
 * workspace is outside the user's permissions. 422 (invalid filters, a
 * from/to window that is reversed or too long, an unsupported type or
 * status) keeps the backend's own message.
 */
export function getCalendarErrorMessage(error, t) {
  if (error?.code === "FORBIDDEN") return t("dashboard.calendar.errors.forbidden");

  if (error?.code === "VALIDATION_ERROR" && !error.message) {
    const [first] = Object.values(error.errors ?? {}).flat();
    return typeof first === "string" ? first : t("dashboard.calendar.errors.invalidFilters");
  }

  return getApiErrorMessage(error, t);
}
