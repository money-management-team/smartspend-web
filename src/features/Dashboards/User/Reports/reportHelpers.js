import { getApiErrorMessage, getStoredWorkspace } from "../api/apiClient";
import { REPORT_ENDPOINTS } from "../api/reportsApi";
import { ACCOUNT_CURRENCIES, isNegativeMoney } from "../Accounts/accountHelpers";
import { formatDate, formatDateTime, formatMoney } from "../utils/formatters";

/*
 * Shared helpers of the Reports page: the filters kept in the URL, and
 * tolerant readers for the report payloads. The readers only reshape what the
 * backend sent (pick a list, group rows by their own `currency_code`): they
 * never add, subtract or convert an amount, and never merge two currencies.
 */

export const REPORT_NAMES = Object.keys(REPORT_ENDPOINTS);
export const DEFAULT_REPORT = "overview";
export const GROUP_BY_OPTIONS = ["day", "week", "month"];
export const DEFAULT_GROUP_BY = "month";
export const PER_PAGE_OPTIONS = [10, 20, 50];
export const DEFAULT_PER_PAGE = 10;
export const DATE_PRESETS = ["thisMonth", "lastMonth", "lastThreeMonths", "thisYear"];
const DEFAULT_PRESET = "thisMonth";

// Overview is dashboard analytics: `items: []` and `pagination: []`.
export const reportHasItems = (report) => report !== "overview";

const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^[+-]?\d+\.\d+$/;
const INTEGER = /^[+-]?\d+$/;

export const isObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

const hasValue = (value) => value != null && value !== "";

export const isCurrencyCode = (value) => CURRENCY.test(String(value ?? ""));

export const isMoneyString = (value) =>
  typeof value === "string" && MONEY.test(value.trim());

// First present value among `keys` (dot paths allowed, e.g. "account.name").
export function pickValue(source, keys) {
  for (const key of keys) {
    const value = String(key)
      .split(".")
      .reduce((current, part) => (current == null ? undefined : current[part]), source);

    if (hasValue(value)) return value;
  }

  return null;
}

// True when a value holds nothing to show: null, "", [] or {} (recursively).
export function isEmptyValue(value) {
  if (!hasValue(value)) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.values(value).every(isEmptyValue);
  return false;
}

/* ---------- Dates and presets ---------- */

export function isIsoDate(value) {
  if (!DATE.test(value ?? "")) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (value) => String(value).padStart(2, "0");

// Today's calendar day in the workspace time zone (browser zone as fallback).
function getToday(timeZone) {
  const now = new Date();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now);
    const get = (type) => Number(parts.find((part) => part.type === type)?.value);

    if (get("year") && get("month") && get("day")) {
      return { year: get("year"), month: get("month") };
    }
  } catch {
    // Unknown time zone: fall back to the browser's.
  }

  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// `month` may be out of 1..12 (e.g. 0 is December of the previous year).
function monthBounds(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const iso = (date) =>
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

  return { from: iso(first), to: iso(last) };
}

// A convenience range the user picks; the backend's `period` stays the truth.
export function getPresetRange(preset, timeZone) {
  const { year, month } = getToday(timeZone);

  if (preset === "lastMonth") return monthBounds(year, month - 1);
  if (preset === "lastThreeMonths") {
    return { from: monthBounds(year, month - 2).from, to: monthBounds(year, month).to };
  }
  if (preset === "thisYear") return { from: `${year}-01-01`, to: `${year}-12-31` };

  return monthBounds(year, month);
}

export function getActivePreset(from, to, timeZone) {
  return (
    DATE_PRESETS.find((preset) => {
      const range = getPresetRange(preset, timeZone);
      return range.from === from && range.to === to;
    }) ?? null
  );
}

// Translation key (under dashboard.reports.filters.errors) or null.
export function validateDateRange(from, to) {
  if (!from) return "fromRequired";
  if (!to) return "toRequired";
  if (!isIsoDate(from) || !isIsoDate(to)) return "invalidDate";
  // ISO dates compare correctly as strings.
  if (from > to) return "fromAfterTo";
  return null;
}

/* ---------- Filters ↔ URL ↔ query ---------- */

export const getWorkspaceTimezone = () => getStoredWorkspace()?.timezone ?? null;

// Filters from the URL; anything invalid falls back to its default, so an
// incomplete or reversed range is never sent.
export function readReportFilters(searchParams, timeZone) {
  const report = searchParams.get("report");
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const range = validateDateRange(from, to) ? getPresetRange(DEFAULT_PRESET, timeZone) : { from, to };
  const currency = searchParams.get("currency") ?? "";
  const groupBy = searchParams.get("group_by");
  const perPage = Number(searchParams.get("per_page"));
  const page = Number(searchParams.get("page"));

  return {
    report: REPORT_NAMES.includes(report) ? report : DEFAULT_REPORT,
    from: range.from,
    to: range.to,
    currency: isCurrencyCode(currency) ? currency : "",
    group_by: GROUP_BY_OPTIONS.includes(groupBy) ? groupBy : DEFAULT_GROUP_BY,
    per_page: PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_PER_PAGE,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function reportFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  params.set("report", filters.report);
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.currency) params.set("currency", filters.currency);
  params.set("group_by", filters.group_by);
  if (reportHasItems(filters.report)) {
    params.set("per_page", String(filters.per_page));
    if (filters.page > 1) params.set("page", String(filters.page));
  }

  return params;
}

// Only the documented query keys. No currency means "all currencies": each
// one still comes back separately in `summary_by_currency`.
export function reportFiltersToQuery(filters) {
  const hasItems = reportHasItems(filters.report);

  return {
    from: filters.from,
    to: filters.to,
    currency: filters.currency || undefined,
    group_by: filters.group_by,
    per_page: hasItems ? filters.per_page : undefined,
    page: hasItems && filters.page > 1 ? filters.page : undefined,
  };
}

export const getCurrencyOptions = (...extra) =>
  [...new Set([...ACCOUNT_CURRENCIES, getStoredWorkspace()?.base_currency_code, ...extra].filter(isCurrencyCode))];

/* ---------- Envelope ---------- */

/*
 * `summary_by_currency` (and the other `*_by_currency` analytics) as an array
 * of rows that each carry their `currency_code`. Accepts an array of rows, a
 * single row, or an object keyed by currency code.
 */
export function toCurrencyRows(value) {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return [];
  if (hasValue(value.currency_code)) return [value];

  const entries = Object.entries(value);

  if (entries.length > 0 && entries.every(([key, entry]) => isCurrencyCode(key) && (isObject(entry) || Array.isArray(entry)))) {
    return entries.map(([currency, entry]) =>
      isObject(entry) ? { currency_code: currency, ...entry } : { currency_code: currency, points: entry },
    );
  }

  return [];
}

const toInt = (value, fallback) => {
  const number = Number(value);
  return hasValue(value) && Number.isFinite(number) ? number : fallback;
};

// Real pagination object → normalized; `[]` (overview) or anything else → null.
export function parsePagination(pagination) {
  if (!isObject(pagination) || !hasValue(pagination.current_page)) return null;

  const page = toInt(pagination.current_page, 1);
  const perPage = toInt(pagination.per_page, DEFAULT_PER_PAGE);
  const total = toInt(pagination.total, 0);
  const lastPage = Math.max(1, toInt(pagination.last_page, 1));

  return {
    page,
    perPage,
    total,
    lastPage,
    from: toInt(pagination.from, total > 0 ? (page - 1) * perPage + 1 : 0),
    to: toInt(pagination.to, Math.min(page * perPage, total)),
    hasMore: typeof pagination.has_more_pages === "boolean" ? pagination.has_more_pages : page < lastPage,
  };
}

// The report as the page uses it; null when `data` isn't an object.
export function parseReport(response) {
  const data = response?.data;
  if (!isObject(data)) return null;

  return {
    report: typeof data.report === "string" ? data.report : null,
    period: isObject(data.period) ? data.period : null,
    filters: isObject(data.filters) ? data.filters : null,
    summary: toCurrencyRows(data.summary_by_currency),
    analytics: isObject(data.analytics) ? data.analytics : {},
    items: Array.isArray(data.items) ? data.items.filter(isObject) : [],
    pagination: parsePagination(data.pagination),
  };
}

/* ---------- Errors ---------- */

export function getReportErrorMessage(error, t) {
  if (error?.code === "FORBIDDEN") return t("dashboard.reports.errors.forbidden");
  if (error?.code === "NOT_FOUND") return t("dashboard.reports.errors.notFound");
  if (error?.code === "VALIDATION_ERROR") {
    return error.message || t("dashboard.reports.errors.invalidFilters");
  }

  return getApiErrorMessage(error, t);
}

// 422 field messages (e.g. `to` before `from`), already localized by the backend.
export function getReportFieldErrors(error) {
  if (error?.code !== "VALIDATION_ERROR" || !isObject(error.errors)) return [];

  return [
    ...new Set(
      Object.values(error.errors)
        .flat()
        .filter((message) => typeof message === "string" && message !== error.message),
    ),
  ];
}

/* ---------- Labels and values ---------- */

export const humanizeKey = (key) => {
  const text = String(key ?? "").replace(/[_.-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Label of a backend field. Undocumented fields fall back to their key made
// readable, without logging a missing translation.
export function getFieldLabel(key, t, i18n) {
  const path = `dashboard.reports.fields.${key}`;
  return i18n.exists(path) ? t(path) : humanizeKey(key);
}

// Label of an enumerated backend value (status, type, direction, …).
export function getValueLabel(value, t, i18n) {
  if (!hasValue(value)) return "—";

  const path = `dashboard.reports.values.${value}`;
  return i18n.exists(path) ? t(path) : humanizeKey(value);
}

const MONEY_KEYS = new Set([
  "amount", "amount_limit", "amount_paid_or_collected", "budgets_spent", "budgets_total",
  "collections", "current_account_balance", "current_amount", "current_balance", "debt_given",
  "debt_received", "expected_expense", "expected_income", "expense", "fee", "fee_amount",
  "income", "inflow", "net", "net_cash_flow", "net_change", "net_income",
  "net_internal_transfer_effect", "net_position", "opening_balance", "original_principal",
  "outflow", "outstanding_amount", "payable", "payable_original", "payable_outstanding",
  "payments", "period_contributions", "period_movement_total", "period_net_movement",
  "period_withdrawals", "principal", "principal_amount", "receivable", "receivable_original",
  "receivable_outstanding", "recurring_expected_expense", "recurring_expected_income",
  "remaining", "remaining_amount", "saved_amount", "savings_saved", "savings_target", "spent",
  "target_amount", "total", "total_budget", "total_current_balance", "total_expense",
  "total_fees", "total_income", "total_inflow", "total_net_change", "total_opening_balance",
  "total_outflow", "total_principal", "total_remaining", "total_saved", "total_spent",
  "total_target", "transfer_in", "transfer_out",
]);

/*
 * Display type of a field: explicit for documented money fields (they may come
 * as numbers), otherwise read from the key and the value's shape. Money is a
 * decimal string ("620.0000"); counts are integers.
 */
export function getValueType(key, value) {
  const name = String(key ?? "").split(".").pop();

  if (MONEY_KEYS.has(name)) return "money";
  if (typeof value === "boolean") return "boolean";
  if (/(^|_)(percentage|percent|rate)$|^utilization$/.test(name)) return "percent";
  if (/_at$/.test(name)) return "datetime";
  if (/(^date|_date|^period_start|^period_end|^date_from|^date_to)$/.test(name)) return "date";
  if (typeof value === "number") return Number.isInteger(value) ? "count" : "decimal";
  if (isMoneyString(value)) return "money";
  if (typeof value === "string" && INTEGER.test(value.trim())) return "count";
  return "text";
}

/*
 * Formats one backend value for display. Money keeps the backend's string up
 * to the formatter and uses its own currency; without a known currency it is
 * shown as a plain number instead of assuming one.
 */
export function formatReportValue(value, type, { currency, locale, t, i18n } = {}) {
  if (!hasValue(value)) return "—";

  switch (type) {
    case "money":
      if (isCurrencyCode(currency)) return formatMoney(value, currency, locale);
      return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(value) || 0,
      );
    case "count":
    case "decimal": {
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number)
        : String(value);
    }
    case "percent": {
      const number = Number(value);
      return Number.isFinite(number)
        ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(number / 100)
        : String(value);
    }
    case "date":
      return formatDate(value, locale);
    case "datetime":
      return formatDateTime(value, locale);
    case "boolean":
      return t ? t(value ? "dashboard.reports.values.yes" : "dashboard.reports.values.no") : String(value);
    case "enum":
      return t && i18n ? getValueLabel(value, t, i18n) : String(value);
    default:
      return typeof value === "object" ? "—" : String(value);
  }
}

// Sign of a decimal string or number, read without float arithmetic.
export function getAmountTone(value) {
  if (!hasValue(value)) return "zero";
  if (typeof value === "number") return value < 0 ? "negative" : value > 0 ? "positive" : "zero";
  if (isNegativeMoney(value)) return "negative";
  return /[1-9]/.test(String(value)) ? "positive" : "zero";
}

// Width (0–100) of a progress bar for a backend percentage. Only the bar is
// clamped; the label shows the real value (e.g. 130% when exceeded).
export function toBarWidth(percent) {
  const number = Number(percent);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

/* ---------- Field lists ---------- */

// Scalar fields of `row` not listed in `exclude`, in the backend's order.
export function getExtraScalarKeys(row, exclude) {
  return Object.entries(row ?? {})
    .filter(([key, value]) => !exclude.has(key) && hasValue(value) && typeof value !== "object")
    .map(([key]) => key);
}

// Nested objects of `row` (e.g. cash-flow buckets) as { key, value } groups.
export function getNestedGroups(row, exclude) {
  return Object.entries(row ?? {})
    .filter(([key, value]) => !exclude.has(key) && isObject(value) && !isEmptyValue(value))
    .map(([key, value]) => ({ key, value }));
}

/* ---------- Trend ---------- */

const POINT_LIST_KEYS = ["points", "series", "data", "trend", "items", "buckets", "periods", "values"];
const LABEL_KEYS = ["label", "period", "bucket", "period_label", "group", "key", "date", "period_start", "date_from", "start_date", "starts_at"];
const NON_SERIES_KEYS = new Set([...LABEL_KEYS, "currency_code", "period_end", "date_to", "end_date", "ends_at"]);
const MAX_SERIES = 6;

function flattenPoint(point) {
  const flat = {};

  Object.entries(point).forEach(([key, value]) => {
    if (isObject(value)) {
      Object.entries(value).forEach(([childKey, childValue]) => {
        if (!isObject(childValue) && !Array.isArray(childValue)) flat[`${key}.${childKey}`] = childValue;
      });
    } else if (!Array.isArray(value)) {
      flat[key] = value;
    }
  });

  return flat;
}

const isSeriesKey = (key) => {
  const name = key.split(".").pop();
  return !NON_SERIES_KEYS.has(key) && !/(^|_)count$/.test(name) && !/(percentage|percent|rate)$/.test(name);
};

const isSeriesValue = (value) =>
  isMoneyString(value) || (typeof value === "number" && Number.isFinite(value));

function buildTrendGroup(currency, rawPoints) {
  const points = rawPoints.filter(isObject).map(flattenPoint);
  const labelKey = LABEL_KEYS.find((key) => points.some((point) => hasValue(point[key])));
  const series = [];

  points.forEach((point) => {
    Object.entries(point).forEach(([key, value]) => {
      if (!series.includes(key) && isSeriesKey(key) && isSeriesValue(value)) series.push(key);
    });
  });

  return {
    currency,
    series: series.slice(0, MAX_SERIES),
    points: points.map((point) => ({ label: labelKey ? point[labelKey] : null, values: point })),
  };
}

/*
 * `trend_by_currency` as one chart per currency: { currency, series, points }.
 * Accepts rows with a list of points, flat points that each carry their
 * currency, or an object keyed by currency. Series are the money fields of the
 * points, as sent (one level of nesting is flattened to "bucket.field").
 */
export function parseTrend(value) {
  const rows = toCurrencyRows(value);
  let groups = [];

  if (rows.some((row) => POINT_LIST_KEYS.some((key) => Array.isArray(row[key])))) {
    groups = rows.map((row) => ({
      currency: row.currency_code ?? "",
      points: POINT_LIST_KEYS.map((key) => row[key]).find(Array.isArray) ?? [],
    }));
  } else if (Array.isArray(value)) {
    const byCurrency = new Map();

    value.filter(isObject).forEach((point) => {
      const currency = point.currency_code ?? "";
      if (!byCurrency.has(currency)) byCurrency.set(currency, []);
      byCurrency.get(currency).push(point);
    });
    groups = [...byCurrency].map(([currency, points]) => ({ currency, points }));
  }

  return groups
    .map(({ currency, points }) => buildTrendGroup(currency, points))
    .filter((group) => group.points.length > 0 && group.series.length > 0);
}

/* ---------- Comparison ---------- */

const CURRENT_KEYS = ["current", "current_value", "current_amount", "current_period", "value"];
const PREVIOUS_KEYS = ["previous", "previous_value", "previous_amount", "previous_period"];
const CHANGE_KEYS = ["change", "difference", "delta", "change_amount", "amount_change", "diff"];
const PERCENT_KEYS = ["change_percentage", "percentage_change", "percent_change", "change_percent", "percentage", "change_rate"];
const TREND_KEYS = ["direction", "trend"];

/*
 * Current vs previous period per currency, from `comparison_by_currency`
 * (and `previous_summary_by_currency` / the summary for the side values).
 * A change figure is only shown when the backend sent one: without
 * `comparison_by_currency` the two periods are shown side by side.
 */
export function parseComparison({ comparison, previousSummary, summary, order }) {
  const comparisonRows = toCurrencyRows(comparison);
  const previousRows = toCurrencyRows(previousSummary);

  if (comparisonRows.length === 0 && previousRows.length === 0) return [];

  const currencies = [
    ...new Set([...comparisonRows, ...previousRows].map((row) => row.currency_code ?? "")),
  ];
  const findRow = (rows, currency) => rows.find((row) => (row.currency_code ?? "") === currency);
  const orderIndex = (key) => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };

  return currencies
    .map((currency) => {
      const comparisonRow = findRow(comparisonRows, currency);
      const current = findRow(summary, currency);
      const previous = findRow(previousRows, currency);
      const metrics = new Map();
      const ensure = (key) => {
        if (!metrics.has(key)) {
          metrics.set(key, { key, current: null, previous: null, change: null, percent: null, trend: null });
        }
        return metrics.get(key);
      };

      if (comparisonRow) {
        const source = isObject(comparisonRow.metrics)
          ? comparisonRow.metrics
          : isObject(comparisonRow.changes)
            ? comparisonRow.changes
            : comparisonRow;

        Object.entries(source).forEach(([key, value]) => {
          if (key === "currency_code" || Array.isArray(value)) return;

          if (isObject(value)) {
            const metric = ensure(key);
            metric.current = pickValue(value, CURRENT_KEYS);
            metric.previous = pickValue(value, PREVIOUS_KEYS);
            metric.change = pickValue(value, CHANGE_KEYS);
            metric.percent = pickValue(value, PERCENT_KEYS);
            metric.trend = pickValue(value, TREND_KEYS);
            return;
          }

          const percentMatch = key.match(/^(.+?)_(?:change_)?(?:percentage|percent)(?:_change)?$/);
          if (percentMatch) {
            ensure(percentMatch[1]).percent = value;
            return;
          }

          const changeMatch = key.match(/^(.+?)_(?:change|difference|delta|diff)$/);
          ensure(changeMatch ? changeMatch[1] : key).change = value;
        });
      } else {
        const keys = order.length > 0
          ? order
          : Object.keys(previous ?? {}).filter((key) => isMoneyString(previous[key]));

        keys.forEach((key) => {
          if (hasValue(current?.[key]) || hasValue(previous?.[key])) ensure(key);
        });
      }

      const rows = [...metrics.values()]
        .map((metric) => ({
          ...metric,
          current: metric.current ?? (hasValue(current?.[metric.key]) ? current[metric.key] : null),
          previous: metric.previous ?? (hasValue(previous?.[metric.key]) ? previous[metric.key] : null),
        }))
        .filter((metric) => [metric.current, metric.previous, metric.change, metric.percent].some(hasValue))
        .sort((left, right) => orderIndex(left.key) - orderIndex(right.key));

      return { currency, metrics: rows };
    })
    .filter((group) => group.metrics.length > 0);
}

/* ---------- Ranked categories ---------- */

const RANKED_LIST_KEYS = ["categories", "items", "top_categories", "rows"];
const RANKED_TYPED_KEYS = {
  expense: "expense",
  expenses: "expense",
  top_expense: "expense",
  expense_categories: "expense",
  income: "income",
  incomes: "income",
  top_income: "income",
  income_categories: "income",
};

function rankedFromEntry(entry, currency) {
  const lists = [];

  RANKED_LIST_KEYS.forEach((key) => {
    if (Array.isArray(entry[key])) lists.push({ currency, type: null, rows: entry[key].filter(isObject) });
  });
  Object.entries(RANKED_TYPED_KEYS).forEach(([key, type]) => {
    if (Array.isArray(entry[key])) lists.push({ currency, type, rows: entry[key].filter(isObject) });
  });

  return lists;
}

const hasRankedList = (entry) =>
  [...RANKED_LIST_KEYS, ...Object.keys(RANKED_TYPED_KEYS)].some((key) => Array.isArray(entry[key]));

/*
 * Category rankings as { currency, type, rows } groups: rows grouped by their
 * own currency, or the lists nested under each currency row.
 */
export function parseRankedGroups(value) {
  let groups = [];

  if (Array.isArray(value)) {
    const objects = value.filter(isObject);

    if (objects.some(hasRankedList)) {
      groups = objects.flatMap((entry) => rankedFromEntry(entry, entry.currency_code ?? ""));
    } else {
      const byCurrency = new Map();

      objects.forEach((row) => {
        const currency = row.currency_code ?? "";
        if (!byCurrency.has(currency)) byCurrency.set(currency, []);
        byCurrency.get(currency).push(row);
      });
      groups = [...byCurrency].map(([currency, rows]) => ({ currency, type: null, rows }));
    }
  } else if (isObject(value)) {
    const entries = Object.entries(value);

    groups = entries.length > 0 && entries.every(([key]) => isCurrencyCode(key))
      ? entries.flatMap(([currency, entry]) => {
        if (Array.isArray(entry)) return [{ currency, type: null, rows: entry.filter(isObject) }];
        return isObject(entry) ? rankedFromEntry(entry, currency) : [];
      })
      : rankedFromEntry(value, value.currency_code ?? "");
  }

  return groups.filter((group) => group.rows.length > 0);
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

export function toRankedRow(row) {
  const color = pickValue(row, ["color", "category.color"]);

  return {
    id: pickValue(row, ["category_id", "category.id", "id"]),
    name: pickValue(row, ["name", "category_name", "category.name"]),
    type: pickValue(row, ["type", "category_type", "category.type"]),
    amount: pickValue(row, ["total", "amount", "total_expense", "total_income", "net", "total_amount", "value"]),
    percent: pickValue(row, ["percentage", "share_percentage", "share", "percent"]),
    count: pickValue(row, ["transaction_count", "transactions_count", "count"]),
    currency: pickValue(row, ["currency_code"]),
    color: HEX_COLOR.test(color ?? "") ? color : null,
  };
}

/* ---------- Transactions ---------- */

// `top_transactions` & co. as a flat list; each row keeps its own currency.
export function parseTransactions(value) {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return [];

  const list = ["transactions", "items", "data"].map((key) => value[key]).find(Array.isArray);
  if (list) return list.filter(isObject);

  return toCurrencyRows(value).flatMap((row) => {
    const rows = [...POINT_LIST_KEYS, "transactions"].map((key) => row[key]).find(Array.isArray) ?? [];
    return rows.filter(isObject).map((item) => ({ currency_code: row.currency_code, ...item }));
  });
}

export function toTransactionRow(row) {
  return {
    id: pickValue(row, ["transaction_id", "id"]),
    title: pickValue(row, ["description", "title", "name", "category.name", "category_name"]),
    type: pickValue(row, ["type"]),
    amount: pickValue(row, ["amount", "total", "signed_amount"]),
    currency: pickValue(row, ["currency_code", "account.currency_code"]),
    date: pickValue(row, ["occurred_at", "transaction_date", "posted_at", "date", "created_at"]),
    category: pickValue(row, ["category.name", "category_name"]),
    account: pickValue(row, ["account.name", "account_name"]),
  };
}

/* ---------- Distributions ---------- */

const DISTRIBUTION_KEYS = ["status", "progress_status", "effective_status", "direction", "key", "name", "label", "type"];
const DISTRIBUTION_COUNTS = ["count", "total_count", "budgets_count", "goals_count", "debts_count", "templates_count", "items_count", "total", "value"];

const toCount = (value) => {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  return typeof value === "string" && INTEGER.test(value.trim()) ? Number(value) : null;
};

function entriesFromMap(map) {
  const entries = Object.entries(map).filter(([key]) => key !== "currency_code");

  if (entries.length === 0) return null;

  const parsed = entries.map(([key, value]) => ({
    key,
    count: isObject(value) ? toCount(pickValue(value, DISTRIBUTION_COUNTS)) : toCount(value),
  }));

  return parsed.every((entry) => entry.count != null) ? parsed : null;
}

/*
 * Status / direction distributions as { currency, entries: [{ key, count }] }
 * groups (currency "" when the backend doesn't split them). Returns [] when
 * the value isn't made of counts.
 */
export function parseDistribution(value) {
  if (Array.isArray(value)) {
    const objects = value.filter(isObject);
    if (objects.length === 0) return [];

    const labelled = objects.filter((row) => hasValue(pickValue(row, DISTRIBUTION_KEYS)));

    if (labelled.length === objects.length) {
      const byCurrency = new Map();

      for (const row of objects) {
        const count = toCount(pickValue(row, DISTRIBUTION_COUNTS));
        if (count == null) return [];

        const currency = row.currency_code ?? "";
        if (!byCurrency.has(currency)) byCurrency.set(currency, []);
        byCurrency.get(currency).push({ key: String(pickValue(row, DISTRIBUTION_KEYS)), count });
      }

      return [...byCurrency].map(([currency, entries]) => ({ currency, entries }));
    }

    if (objects.every((row) => hasValue(row.currency_code))) {
      const groups = objects.map((row) => ({ currency: row.currency_code, entries: entriesFromMap(row) }));
      return groups.every((group) => group.entries) ? groups : [];
    }

    return [];
  }

  if (!isObject(value)) return [];

  const entries = Object.entries(value);

  if (entries.length > 0 && entries.every(([key, entry]) => isCurrencyCode(key) && isObject(entry))) {
    const groups = entries.map(([currency, entry]) => ({ currency, entries: entriesFromMap(entry) }));
    return groups.every((group) => group.entries) ? groups : [];
  }

  const flat = entriesFromMap(value);
  return flat ? [{ currency: value.currency_code ?? "", entries: flat }] : [];
}
