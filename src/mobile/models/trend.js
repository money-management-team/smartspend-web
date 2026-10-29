import { isCurrencyCode, parseDecimal } from "../money/decimal.js";
import { isRecord } from "./values.js";

/*
 * A report's `analytics.trend_by_currency` (docs/reports/api.md: buckets of
 * `group_by` = day, week or month), one trend per currency. Pure.
 *
 * The contract does not fix the shape of a trend point, so this reads the same
 * shapes the full version reads (Reports/reportHelpers.js parseTrend): rows of
 * `{ currency_code, points | series | data | … }`, flat points that each carry
 * their currency, or an object keyed by currency. A series is a field whose
 * values are the backend's money strings; counts and percentages are not
 * series. Nothing is added up, interpolated or filled in: a bucket without a
 * value for a series is a gap, shown as "no figure". Points are put in date
 * order only when every label is a date; otherwise the backend's order is kept.
 * Currencies are never combined.
 */

const POINT_LIST_KEYS = ["points", "series", "data", "trend", "items", "buckets", "periods", "values"];
const LABEL_KEYS = ["label", "period", "bucket", "period_label", "group", "key", "date", "period_start", "date_from", "start_date", "starts_at"];
const NOT_SERIES = new Set([...LABEL_KEYS, "currency_code", "period_end", "date_to", "end_date", "ends_at"]);
export const MAX_SERIES = 3;
const DATE_LABEL = /^\d{4}-\d{2}(-\d{2})?/;

const flatten = (point) => {
  const flat = {};
  for (const [key, value] of Object.entries(point)) {
    if (isRecord(value)) {
      for (const [inner, innerValue] of Object.entries(value)) if (!isRecord(innerValue) && !Array.isArray(innerValue)) flat[`${key}.${inner}`] = innerValue;
    } else if (!Array.isArray(value)) flat[key] = value;
  }
  return flat;
};

const isSeriesKey = (key) => {
  const name = key.split(".").pop();
  return !NOT_SERIES.has(key) && !/(^|_)count$/.test(name) && !/(percentage|percent|rate)$/.test(name);
};

function groupsOf(value) {
  if (Array.isArray(value)) {
    const rows = value.filter(isRecord);
    if (rows.some((row) => POINT_LIST_KEYS.some((key) => Array.isArray(row[key])))) return rows.map((row) => ({ currency: row.currency_code, points: POINT_LIST_KEYS.map((key) => row[key]).find(Array.isArray) ?? [] }));
    const byCurrency = new Map();
    for (const point of rows) {
      if (!byCurrency.has(point.currency_code)) byCurrency.set(point.currency_code, []);
      byCurrency.get(point.currency_code).push(point);
    }
    return [...byCurrency].map(([currency, points]) => ({ currency, points }));
  }
  if (isRecord(value)) return Object.entries(value).map(([currency, row]) => ({ currency, points: Array.isArray(row) ? row : POINT_LIST_KEYS.map((key) => row?.[key]).find(Array.isArray) ?? [] }));
  return [];
}

/** [{ currency, series: [name], points: [{ label, values: { [series]: decimal string | null } }] }], currencies without a code left out. */
export function buildTrend(value) {
  return groupsOf(value).flatMap(({ currency, points: raw }) => {
    if (!isCurrencyCode(currency)) return [];
    const points = raw.filter(isRecord).map(flatten);
    const labelKey = LABEL_KEYS.find((key) => points.some((point) => typeof point[key] === "string" || typeof point[key] === "number"));
    const series = [];
    for (const point of points) for (const [key, item] of Object.entries(point)) if (!series.includes(key) && isSeriesKey(key) && parseDecimal(item)) series.push(key);
    if (!points.length || !series.length) return [];
    let rows = points.map((point) => ({ label: labelKey && point[labelKey] != null ? String(point[labelKey]).slice(0, 40) : null, values: Object.fromEntries(series.map((key) => [key, parseDecimal(point[key]) ? String(point[key]) : null])) }));
    if (rows.every((row) => row.label && DATE_LABEL.test(row.label))) rows = [...rows].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    return [{ currency, series: series.slice(0, MAX_SERIES), points: rows }];
  });
}
