import { getStoredWorkspace } from "../api/apiClient";
import { formatMoney } from "../utils/formatters";

export const DASHBOARD_PERIODS = ["today", "week", "month", "quarter", "year", "all", "custom"];
export const DEFAULT_PERIOD = "month";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isTrue = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

/* ---------- Period filter (kept in the URL) ---------- */

// Validation key for a custom range, or null when it is valid. ISO dates
// compare correctly as strings.
export function getCustomRangeError(dateFrom, dateTo) {
  if (!DATE.test(dateFrom ?? "")) return "dateFromRequired";
  if (!DATE.test(dateTo ?? "")) return "dateToRequired";
  if (dateTo < dateFrom) return "dateToBeforeFrom";
  return null;
}

/*
 * `?period=` (default month) and, for custom, `?date_from=&date_to=`. An
 * unknown period, or a custom period without a valid range, falls back to the
 * default instead of sending the backend something it would reject.
 */
export function readDashboardFilters(searchParams) {
  const period = searchParams.get("period") ?? "";

  if (period === "custom") {
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";

    return getCustomRangeError(dateFrom, dateTo)
      ? { period: DEFAULT_PERIOD, date_from: "", date_to: "" }
      : { period, date_from: dateFrom, date_to: dateTo };
  }

  return {
    period: DASHBOARD_PERIODS.includes(period) ? period : DEFAULT_PERIOD,
    date_from: "",
    date_to: "",
  };
}

export function dashboardFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.period !== DEFAULT_PERIOD) params.set("period", filters.period);
  if (filters.period === "custom") {
    params.set("date_from", filters.date_from);
    params.set("date_to", filters.date_to);
  }

  return params;
}

// The session workspace when known; without it the backend aggregates every
// workspace the user can access.
export const dashboardFiltersToQuery = (filters) => ({
  period: filters.period,
  date_from: filters.period === "custom" ? filters.date_from : undefined,
  date_to: filters.period === "custom" ? filters.date_to : undefined,
  workspace_id: getStoredWorkspace()?.id,
});

/* ---------- Response ---------- */

// The one workspace the dashboard is scoped to, or null when it aggregates
// several (then the session workspace is left as it is).
export function getScopeWorkspaceId(scope) {
  if (scope?.workspace_id != null) return scope.workspace_id;
  const ids = Array.isArray(scope?.workspace_ids) ? scope.workspace_ids : [];
  return ids.length === 1 ? ids[0] : null;
}

// Rows of `summary_by_currency` (one per currency), as sent.
export const getCurrencySummaries = (data) =>
  Array.isArray(data?.summary_by_currency)
    ? data.summary_by_currency.filter((row) => row?.currency_code)
    : [];

// Several currencies: totals are the backend's figures in the primary
// currency, and the other currencies are listed separately, never summed.
export const isMultiCurrency = (data) =>
  isTrue(data?.scope?.is_multi_currency) || getCurrencySummaries(data).length > 1;

export const getPrimaryCurrency = (data) =>
  data?.scope?.primary_currency_code || data?.totals?.currency_code || "";

const firstDefined = (...values) => values.find((value) => value != null && value !== "");

/*
 * `data.transfers` is reported apart from income and expense (a transfer is
 * neither). Only the figures the backend sent are returned; nothing is
 * derived.
 */
export function getTransfersSummary(transfers) {
  if (!transfers || typeof transfers !== "object") return null;

  const count = firstDefined(transfers.count, transfers.transfers_count, transfers.total_count);
  const amount = firstDefined(transfers.total_amount, transfers.amount, transfers.total);
  const currency = firstDefined(transfers.currency_code);

  return count == null && amount == null ? null : { count, amount, currency };
}

// Rows of a planning / commitments block: `{ items: [...] }` or an array.
export function getBlockItems(block) {
  if (Array.isArray(block)) return block;
  if (Array.isArray(block?.items)) return block.items;
  if (Array.isArray(block?.upcoming)) return block.upcoming;
  return [];
}

// Numeric fields of a block to show as counts (e.g. `active_count`), in the
// order given; missing and non-numeric values are left out.
export const getBlockCounts = (block, keys) =>
  keys
    .map((key) => [key, block?.[key]])
    .filter(([, value]) => value != null && value !== "" && Number.isFinite(Number(value)));

/* ---------- Display ---------- */

// A backend amount formatted in its currency; "—" when the backend didn't
// send it (instead of pretending it is zero).
export const formatOptionalMoney = (value, currency, locale) =>
  value == null || value === "" ? "—" : formatMoney(value, currency || undefined, locale);

// Sign check on a decimal string, without converting it to a float.
export const isNegativeAmount = (value) => String(value ?? "").trim().startsWith("-");

// Label of the period the backend used (`period.preset`), or of the
// requested one while the response doesn't name it.
export function getPeriodLabel(t, period, requestedPeriod) {
  const preset = DASHBOARD_PERIODS.includes(period?.preset) ? period.preset : requestedPeriod;
  return DASHBOARD_PERIODS.includes(preset) ? t(`dashboard.user.period.options.${preset}`) : "";
}
