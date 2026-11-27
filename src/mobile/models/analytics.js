import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { TONES } from "../planning/tones.js";
import { parsePercent } from "./planning.js";
import { buildTrend } from "./trend.js";
import { idText, isRecord, textOrNull } from "./values.js";

/*
 * The Reports screen's analytics, read-only, from two documented reads
 * (docs/reports/api.md) that the report pages already make:
 *
 *   GET /reports/overview?from=&to=[&group_by=]   summary_by_currency (total_income, total_expense, net_income,
 *                                                 budgets_total, budgets_spent), analytics.trend_by_currency,
 *                                                 analytics.comparison_by_currency, analytics.top_expense_categories
 *   GET /reports/budgets?from=&to=&per_page=      items (name, spent, amount_limit, progress_percentage,
 *                                                 progress_status) and summary_by_currency (total_budget, total_spent)
 *
 * Nothing here is worked out: every figure is the backend's own decimal string, per currency, and currencies are
 * never added. A figure the answer does not carry is `null` ("not available"), never zero. Pure, so the mapping
 * is tested without a browser.
 */

const MALFORMED = () => Object.assign(new Error("Analytics data could not be validated."), { code: "MALFORMED_RESPONSE" });

/* ---------- The period ---------- */

export const HUB_PRESETS = Object.freeze(["month", "last-month", "3-months", "6-months", "year"]);
export const DEFAULT_HUB_PRESET = "6-months";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value) => String(value).padStart(2, "0");
const day = (year, month, date) => `${year}-${pad(month)}-${pad(date)}`;
const isRealDate = (text) => {
  if (!DATE.test(text)) return false;
  const [year, month, date] = text.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
};

/** The range a preset stands for, as of `today` (a local Date). Months are whole calendar months, ending today. */
export function presetRange(preset, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const now = day(year, month + 1, today.getDate());
  const startOf = (back) => {
    const first = new Date(year, month - back, 1);
    return day(first.getFullYear(), first.getMonth() + 1, 1);
  };

  switch (preset) {
    case "month":
      return { from: startOf(0), to: now };
    case "last-month": {
      const last = new Date(year, month, 0);
      return { from: startOf(1), to: day(last.getFullYear(), last.getMonth() + 1, last.getDate()) };
    }
    case "3-months":
      return { from: startOf(2), to: now };
    case "year":
      return { from: day(year, 1, 1), to: now };
    default:
      return { from: startOf(5), to: now };
  }
}

/** The range in the address (two real dates in order), else the default preset; `preset` names the preset it equals, or "custom". */
export function readHubRange(search, today = new Date()) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const valid = isRealDate(from) && isRealDate(to) && from <= to;
  const range = valid ? { from, to } : presetRange(DEFAULT_HUB_PRESET, today);
  const preset = HUB_PRESETS.find((id) => {
    const candidate = presetRange(id, today);
    return candidate.from === range.from && candidate.to === range.to;
  });
  return { ...range, preset: preset ?? "custom" };
}

const dayNumber = (text) => {
  const [year, month, date] = text.split("-").map((part) => Number.parseInt(part, 10));
  // UTC midnights are whole multiples of a day, so this is an exact integer.
  return Date.UTC(year, month - 1, date) / 86_400_000;
};

/** The trend's natural bucket for a range: days for about a month, weeks for a few months, months beyond. */
export function defaultGroup(from, to) {
  const days = dayNumber(to) - dayNumber(from) + 1;
  return days <= 35 ? "day" : days <= 100 ? "week" : "month";
}

/* ---------- The overview ---------- */

const money = (value) => (parseDecimal(value) ? String(value) : null);

function rowsOf(raw) {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) return Object.entries(raw).flatMap(([code, row]) => (isRecord(row) ? [{ currency_code: code, ...row }] : []));
  return [];
}

const byCurrency = (raw) => new Map(rowsOf(raw).filter((row) => isCurrencyCode(row.currency_code)).map((row) => [row.currency_code, row]));

/* A change in percent as the backend sent it ("12.50", "-3.00", or null when there was nothing to compare): shown as text, never recomputed. */
function change(entry) {
  const value = isRecord(entry) ? entry.change_percentage : null;
  const percent = parsePercent(typeof value === "string" ? value : null);
  if (!percent) return null;
  return { text: percent.text, negative: percent.text.startsWith("−"), zero: /^[−-]?0$/.test(percent.text) };
}

const seriesNamed = (trend, word) => trend.series.find((name) => name === word || name === `total_${word}` || name.endsWith(`.${word}`) || name.endsWith(`.total_${word}`)) ?? null;

/* Income and expense buckets for the chart, in the backend's own order, from the trend of one currency; null when either series is missing. */
function chartOf(trend) {
  if (!trend) return null;
  const income = seriesNamed(trend, "income");
  const expense = seriesNamed(trend, "expense");
  if (!income || !expense || trend.points.length === 0) return null;
  const net = seriesNamed(trend, "net") ?? seriesNamed(trend, "net_income");
  return { points: trend.points.map((point) => ({ label: point.label, income: point.values[income], expense: point.values[expense], net: net ? point.values[net] : null })) };
}

function categoriesOf(entry) {
  const list = isRecord(entry) && Array.isArray(entry.categories) ? entry.categories : [];
  return list
    .filter(isRecord)
    .map((row, index) => ({
      key: idText(row.category_id) ?? `row-${index}`,
      id: idText(row.category_id),
      name: textOrNull(row.name),
      total: money(row.total),
      percent: parsePercent(typeof row.percentage === "string" ? row.percentage : null),
    }))
    .filter((row) => row.total !== null);
}

/**
 * The overview, per currency: { period, currencies: [{ currency, income, expense, net, budgets, change, chart, categories }] }.
 * Refused when it is about another report or has no usable summary.
 */
export function buildAnalytics(data) {
  if (!isRecord(data) || (data.report != null && data.report !== "overview")) throw MALFORMED();
  if (!Array.isArray(data.summary_by_currency) && !isRecord(data.summary_by_currency)) throw MALFORMED();

  const analytics = isRecord(data.analytics) ? data.analytics : {};
  const trends = new Map(buildTrend(analytics.trend_by_currency).map((trend) => [trend.currency, trend]));
  const comparison = byCurrency(analytics.comparison_by_currency);
  const categories = byCurrency(analytics.top_expense_categories);
  const seen = new Set();

  const currencies = rowsOf(data.summary_by_currency)
    .filter((row) => isCurrencyCode(row.currency_code) && !seen.has(row.currency_code) && seen.add(row.currency_code))
    .map((row) => {
      const compared = comparison.get(row.currency_code);
      const budgetsTotal = money(row.budgets_total);
      const budgetsSpent = money(row.budgets_spent);
      return {
        currency: row.currency_code,
        income: money(row.total_income),
        expense: money(row.total_expense),
        net: money(row.net_income),
        budgets: budgetsTotal && budgetsSpent ? { total: budgetsTotal, spent: budgetsSpent } : null,
        change: compared ? { income: change(compared.total_income), expense: change(compared.total_expense), net: change(compared.net_income) } : null,
        chart: chartOf(trends.get(row.currency_code)),
        categories: categoriesOf(categories.get(row.currency_code)),
      };
    });

  return {
    period: isRecord(data.period) ? { from: textOrNull(data.period.date_from, 10), to: textOrNull(data.period.date_to, 10) } : null,
    currencies,
  };
}

/** Whether a currency's overview has anything to show: any income or expense that is not zero. */
export const hasActivity = (row) => [row.income, row.expense].some((value) => value !== null && !/^-?0+(\.0+)?$/.test(value));

/* ---------- Budget performance ---------- */

const BUDGET_PREVIEW = 5;

/**
 * The budgets report, per currency: totals and the first rows exactly as the backend ordered them, each with the
 * backend's own percentage and state word. { currencies: [{ currency, total, spent, budgets: [...] }], more }.
 */
export function buildBudgetPerformance(data) {
  if (!isRecord(data) || (data.report != null && data.report !== "budgets")) throw MALFORMED();
  const summary = byCurrency(data.summary_by_currency);
  const utilization = byCurrency(isRecord(data.analytics) ? data.analytics.utilization_by_currency : null);
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  const groups = new Map();

  items.forEach((row, index) => {
    if (!isCurrencyCode(row.currency_code)) return;
    const status = textOrNull(row.progress_status, 40);
    if (!groups.has(row.currency_code)) groups.set(row.currency_code, []);
    groups.get(row.currency_code).push({
      key: idText(row.budget_id) ?? `row-${index}`,
      id: idText(row.budget_id),
      name: textOrNull(row.name),
      spent: money(row.spent),
      limit: money(row.amount_limit),
      percent: parsePercent(typeof row.progress_percentage === "string" ? row.progress_percentage : null),
      status,
      known: status !== null && Object.hasOwn(TONES, status),
    });
  });

  const codes = [...new Set([...summary.keys(), ...groups.keys()])].sort();
  return {
    currencies: codes.map((currency) => {
      const row = summary.get(currency);
      const used = utilization.get(currency)?.percentage_used;
      return { currency, total: money(row?.total_budget), spent: money(row?.total_spent), utilization: parsePercent(typeof used === "string" ? used : null), budgets: (groups.get(currency) ?? []).slice(0, BUDGET_PREVIEW) };
    }),
    more: [...groups.values()].some((list) => list.length > BUDGET_PREVIEW) || (Number.isSafeInteger(data.pagination?.total) && data.pagination.total > items.length),
  };
}
