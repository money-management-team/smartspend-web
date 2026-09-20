import { apiRequest, pickQuery } from "./apiClient";

/*
 * Sprint 6 read-only reports (GET /reports/*). Every figure is calculated by
 * the backend (Ledger, BalanceService, BudgetProgressService,
 * SavingsGoalProgressService, …): the frontend never rebuilds a total and never
 * adds amounts in different currencies together.
 *
 * Every report answers with the same envelope under `data`:
 *   report, period, filters, summary_by_currency, analytics, items, pagination
 * Analytics differ per report. `/reports/overview` returns `items: []` and
 * `pagination: []` (no item pagination).
 *
 * Query (documented): from, to (YYYY-MM-DD), currency (ISO code; omitted for
 * all currencies), group_by (day | week | month), per_page. `page` selects the
 * page of `items` described by `data.pagination.current_page`. Nothing else is
 * sent: the filters echoed back in `data.filters` (account_id, category_id,
 * type, status, …) are not accepted as request filters until the contract says
 * so. The workspace comes from the token; no `workspace_id` is sent.
 */
export const REPORT_QUERY_KEYS = ["from", "to", "currency", "group_by", "per_page", "page"];

// Report name (`data.report`) → endpoint. The name is also the tab id.
export const REPORT_ENDPOINTS = {
  overview: "/reports/overview",
  "income-expense": "/reports/income-expense",
  "cash-flow": "/reports/cash-flow",
  accounts: "/reports/accounts",
  categories: "/reports/categories",
  transfers: "/reports/transfers",
  budgets: "/reports/budgets",
  "savings-goals": "/reports/savings-goals",
  debts: "/reports/debts",
  recurring: "/reports/recurring",
};

export function getReport(reportName, query = {}, options = {}) {
  const endpoint = REPORT_ENDPOINTS[reportName];

  if (!endpoint) throw new Error(`Unknown report "${reportName}".`);

  return apiRequest(endpoint, {
    query: pickQuery(query, REPORT_QUERY_KEYS),
    signal: options.signal,
  });
}

export const reportsApi = {
  getOverviewReport: (query, options) => getReport("overview", query, options),
  getIncomeExpenseReport: (query, options) => getReport("income-expense", query, options),
  getCashFlowReport: (query, options) => getReport("cash-flow", query, options),
  getAccountsReport: (query, options) => getReport("accounts", query, options),
  getCategoriesReport: (query, options) => getReport("categories", query, options),
  getTransfersReport: (query, options) => getReport("transfers", query, options),
  getBudgetsReport: (query, options) => getReport("budgets", query, options),
  getSavingsGoalsReport: (query, options) => getReport("savings-goals", query, options),
  getDebtsReport: (query, options) => getReport("debts", query, options),
  getRecurringReport: (query, options) => getReport("recurring", query, options),
};
