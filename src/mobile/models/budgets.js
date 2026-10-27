import { isCurrencyCode } from "../money/decimal.js";
import { buildPlanningPage, parsePercent, readState } from "./planning.js";
import { amountIn, countOrNull, dateOnlyOrNull, flagOrNull, idText, isRecord, textOrNull } from "./values.js";

/*
 * Budgets as Mobile Planning shows them: the list's filters, a page of the
 * list, one budget.
 *
 * What the backend contract gives (docs/budgets/api.md, and the Desktop pages
 * that already read it; nothing here is invented):
 *
 * - GET /budgets takes status (active | archived: the lifecycle),
 *   progress_status (safe | warning | near_limit | exceeded), per_page and
 *   page, and answers with a Laravel paginator at data.budgets.
 * - A row carries its own `progress`: spent, remaining, percentage_used,
 *   status, days_remaining, expenses_count. Those are the backend's numbers
 *   and the only ones shown: Mobile adds up nothing, so a figure here always
 *   agrees with the full version.
 * - amount_limit and the progress amounts are in the budget's own currency. A
 *   progress block that names another budget or another currency is refused.
 * - A budget with no `progress` (an archived one) shows its limit and period,
 *   and says its progress is not available.
 */

export const BUDGET_LIFECYCLES = ["active", "archived"];
export const BUDGET_PROGRESS = ["safe", "warning", "near_limit", "exceeded"];
export const BUDGET_SCOPES = ["general", "category"];
export const DEFAULT_BUDGET_STATUS = "active";

/* ---------- Filters ---------- */

/** The filters in a URL, sanitised: anything that is not a documented value is dropped, never sent. The names are the Desktop list's. */
export function readBudgetFilters(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const status = params.get("status") ?? "";
  const progress = params.get("progress_status") ?? "";

  return {
    status: BUDGET_LIFECYCLES.includes(status) ? status : DEFAULT_BUDGET_STATUS,
    progress_status: BUDGET_PROGRESS.includes(progress) ? progress : "",
  };
}

// Defaults are left out to keep addresses short; equal filters give equal text.
export function budgetFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== DEFAULT_BUDGET_STATUS) params.set("status", filters.status);
  if (filters.progress_status) params.set("progress_status", filters.progress_status);

  return params;
}

export const budgetFilterSignature = (filters) => budgetFiltersToSearchParams(filters).toString() || "default";

export const hasActiveBudgetFilters = (filters) => filters.status !== DEFAULT_BUDGET_STATUS || Boolean(filters.progress_status);

export function budgetFiltersToQuery(filters, page, perPage, workspaceId) {
  return {
    workspace_id: workspaceId,
    status: filters.status,
    progress_status: filters.progress_status || undefined,
    per_page: perPage,
    page,
  };
}

/* ---------- One budget ---------- */

function buildProgress(raw, id, currency) {
  if (!isRecord(raw)) return null;
  // Figures that name another budget or another currency are not this budget's.
  if (raw.budget_id != null && idText(raw.budget_id) !== id) return null;
  if (raw.currency_code != null && raw.currency_code !== currency) return null;

  const state = readState(raw.status, BUDGET_PROGRESS);

  return {
    spent: amountIn(raw.spent, currency),
    remaining: amountIn(raw.remaining, currency),
    percent: parsePercent(raw.percentage_used),
    status: state.word,
    statusKnown: state.known,
    expensesCount: countOrNull(raw.expenses_count),
    daysRemaining: countOrNull(raw.days_remaining),
    hasStarted: flagOrNull(raw.has_started),
    hasEnded: flagOrNull(raw.has_ended),
  };
}

/** One budget, or null when it is not an object with a usable id. */
export function normalizeBudget(raw) {
  if (!isRecord(raw)) return null;

  const id = idText(raw.id);
  if (!id) return null;

  const currency = isCurrencyCode(raw.currency_code) ? raw.currency_code : null;
  const category = isRecord(raw.category) ? raw.category : null;
  // A missing or odd scope falls back to what the budget is attached to, as the full version does.
  const scope = BUDGET_SCOPES.includes(raw.scope) ? raw.scope : category || raw.category_id != null ? "category" : "general";
  const lifecycle = readState(raw.status ?? (raw.archived_at ? "archived" : null), BUDGET_LIFECYCLES);

  return {
    id,
    name: textOrNull(raw.name, 150),
    scope,
    categoryName: textOrNull(category?.name, 80),
    currency,
    limit: amountIn(raw.amount_limit, currency),
    periodStart: dateOnlyOrNull(raw.period_start),
    periodEnd: dateOnlyOrNull(raw.period_end),
    status: lifecycle.word,
    statusKnown: lifecycle.known,
    archived: lifecycle.word === "archived",
    notes: textOrNull(raw.notes, 1000),
    progress: buildProgress(raw.progress, id, currency),
  };
}

export const buildBudgetsPage = (response, expected) => buildPlanningPage(response, expected, "budgets", normalizeBudget);

/** GET /budgets/{id}. The budget must be the one asked for: a response about another id is refused, so figures never appear under the wrong record. */
export function buildBudgetDetail(data, requestedId) {
  const budget = normalizeBudget(isRecord(data) ? data.budget : null);
  return budget && budget.id === String(requestedId) ? budget : null;
}
