import { accountsApi } from "../../features/Dashboards/User/api/accountsApi.js";
import { budgetsApi } from "../../features/Dashboards/User/api/budgetsApi.js";
import { calendarApi } from "../../features/Dashboards/User/api/calendarApi.js";
import { categoriesApi } from "../../features/Dashboards/User/api/categoriesApi.js";
import { getStoredWorkspace } from "../../features/Dashboards/User/api/apiClient.js";
import { dashboardApi } from "../../features/Dashboards/User/api/dashboardApi.js";
import { debtsApi } from "../../features/Dashboards/User/api/debtsApi.js";
import { financialAlertsApi } from "../../features/Dashboards/User/api/financialAlertsApi.js";
import { importsApi } from "../../features/Dashboards/User/api/importsApi.js";
import { notificationsApi } from "../../features/Dashboards/User/api/notificationsApi.js";
import { recurringTransactionsApi } from "../../features/Dashboards/User/api/recurringTransactionsApi.js";
import { reportExportsApi } from "../../features/Dashboards/User/api/reportExportsApi.js";
import { reportsApi } from "../../features/Dashboards/User/api/reportsApi.js";
import { savingsGoalsApi } from "../../features/Dashboards/User/api/savingsGoalsApi.js";
import { transactionsApi } from "../../features/Dashboards/User/api/transactionsApi.js";
import { transfersApi } from "../../features/Dashboards/User/api/transfersApi.js";

/*
 * Every request Mobile makes, in one file, and every one of them a GET.
 *
 * These go through the app's existing wrappers (and so apiRequest: bearer
 * token, Accept-Language, envelope checks, the 401 session-expired flow), and
 * only the wrappers' read methods are named here: list, get. The wrappers also
 * hold create/update/archive/correct/reverse; none of those is imported or
 * reachable from Mobile (tests/mobileReadOnly.test.mjs reads this file and
 * every other Mobile file to keep it that way).
 *
 * The endpoints and what Mobile relies on in them:
 *   GET /dashboard?period=month         totals, summary_by_currency, scope, accounts, recent_transactions
 *   GET /financial-alerts               alerts[]
 *   GET /accounts                       accounts[] (active)
 *   GET /accounts/{id}                  account
 *   GET /transactions?account_id=       a page of that account's movements
 *   GET /transactions?…filters          a page of Activity (type, status, account, category, dates, sort)
 *   GET /transactions/{id}              one transaction
 *   GET /categories                     the filter's category choices (active ones)
 *
 * The period is fixed at the API's default, "month": Mobile has no period
 * picker yet. The workspace filter is the session's workspace, read from
 * storage the way Desktop does, and never written back (Desktop's dashboard
 * stores it; Mobile only reads).
 */

export const DASHBOARD_PERIOD = "month";
export const MOVEMENTS_PER_PAGE = 20;

// Account ids in a URL are untrusted: digits only, no leading zero.
export const isAccountId = (value) => /^[1-9]\d{0,14}$/.test(String(value ?? ""));

const workspaceId = () => getStoredWorkspace()?.id;

// The periods GET /dashboard documents (docs/dashboard/api.md); `custom` needs both dates.
export const DASHBOARD_PERIODS = Object.freeze(["today", "week", "month", "quarter", "year", "all", "custom"]);

export const readDashboard = (signal, { period = DASHBOARD_PERIOD, from, to } = {}) =>
  dashboardApi.get({ period, ...(period === "custom" ? { date_from: from, date_to: to } : {}), workspace_id: workspaceId() }, { signal });

// Note the filter's name: financial alerts take `id_workspace`, not `workspace_id`.
export const readAlerts = (signal) => financialAlertsApi.list({ id_workspace: workspaceId() }, { signal });

export const readAccounts = (signal) => accountsApi.list({ id_workspace: workspaceId() }, { signal });

export const readAccount = (accountId, signal) => accountsApi.get(accountId, { signal });

export const readAccountMovements = (accountId, page, signal) =>
  transactionsApi.list(
    { account_id: accountId, page, per_page: MOVEMENTS_PER_PAGE, sort_by: "occurred_at", sort_dir: "desc" },
    { signal },
  );

// Activity: the filters are exactly those the Desktop list sends (docs/transactions/api.md); the query is built by models/activity.js.
export const ACTIVITY_PER_PAGE = 20;

export const readTransactions = (query, signal) => transactionsApi.list(query, { signal });

export const readTransaction = (transactionId, signal) => transactionsApi.get(transactionId, { signal });

export const readCategories = (signal) => categoriesApi.list({ workspace_id: workspaceId() }, { signal });

/*
 * Planning (S04B3): budgets, savings goals and recurring rules, read-only. The
 * lists use the page sizes of the Desktop lists, so a Mobile page asks the
 * backend for the same slice the full version would.
 *
 *   GET /budgets?status=&progress_status=       a page of budgets, each with its `progress`
 *   GET /budgets/{id}                           one budget with its `progress`
 *   GET /savings-goals?status=                  a page of goals, each with its `progress`
 *   GET /savings-goals/{id}                     one goal with its `progress`
 *   GET /recurring-transactions?status=&type=   a page of rules
 *   GET /recurring-transactions/{id}            one rule with its `schedule`
 *
 * The Smart Savings plan read (GET /savings-goals/{id}/plan) is NOT here: it is
 * in data/readPlanApi.js, which only a build with Smart Savings on includes.
 */
export const BUDGETS_PER_PAGE = 20;
export const GOALS_PER_PAGE = 12;
export const RULES_PER_PAGE = 15;

export const readBudgets = (query, signal) => budgetsApi.list(query, { signal });

export const readBudget = (budgetId, signal) => budgetsApi.get(budgetId, { signal });

export const readGoals = (query, signal) => savingsGoalsApi.list(query, { signal });

export const readGoal = (goalId, signal) => savingsGoalsApi.get(goalId, { signal });

export const readRules = (query, signal) => recurringTransactionsApi.list(query, { signal });

export const readRule = (ruleId, signal) => recurringTransactionsApi.get(ruleId, { signal });

/** The session's workspace for a list query or a category's creation (read from storage, never written). */
export const planningWorkspaceId = workspaceId;

/*
 * Categories (S04B4). The list is the same GET /categories the Activity filter
 * reads, with the backend's own `type` filter; a category is GET /categories/{id}.
 * Both answer for the session's workspace only.
 */
export const readCategoryList = (type, signal) => categoriesApi.list({ workspace_id: workspaceId(), type: type || undefined }, { signal });

export const readCategory = (categoryId, signal) => categoriesApi.get(categoryId, { signal });

/** The workspace the session stored at sign-in, as the list queries use it (read from storage, never written). */
export const sessionWorkspace = () => getStoredWorkspace();

/*
 * The full Mobile sprint: debts, transfers, the notification inbox and the
 * financial calendar, all read-only (only list / get / listPayments of the
 * wrappers are named; record, reverse, mark-read and the rest are not).
 *
 *   GET /debts?direction=&status=           a page of debts (data.debts), each with the backend's amounts and status
 *   GET /debts/{id}                         one debt (data.debt)
 *   GET /debts/{id}/payments                a page of its payments (data.payments), reversed ones included
 *   GET /transfers?status=                  a page of transfers (data.transfers); no workspace filter exists
 *   GET /transfers/{id}                     one transfer with its transactions and ledger entries
 *   GET /notifications?status=              a page of the person's inbox (data.notifications); no workspace
 *   GET /calendar?month=&year=&view=month   the month's events (data.events) and the backend's counts
 *
 * Listing notifications does not mark them read (that is a PATCH Mobile does
 * not send), so reading the inbox here changes nothing on the server.
 */
export const DEBTS_PER_PAGE = 20;
export const PAYMENTS_PER_PAGE = 10;
export const TRANSFERS_PER_PAGE = 20;
export const NOTIFICATIONS_PER_PAGE = 20;

export const readDebts = (query, signal) => debtsApi.list(query, { signal });

export const readDebt = (debtId, signal) => debtsApi.get(debtId, { signal });

export const readDebtPayments = (debtId, page, signal) => debtsApi.listPayments(debtId, { per_page: PAYMENTS_PER_PAGE, page }, { signal });

export const readTransfers = (query, signal) => transfersApi.list(query, { signal });

export const readTransfer = (transferId, signal) => transfersApi.get(transferId, { signal });

export const readNotifications = (query, signal) => notificationsApi.list(query, { signal });

export const readCalendarMonth = (month, year, signal) => calendarApi.get({ month, year, view: "month", workspace_id: workspaceId() }, { signal });

/*
 * Reports (the ten of them), read-only: GET /reports/{type}?from=&to= (and
 * per_page, page for the list reports). The backend scopes reports by the token;
 * no workspace is sent. Exports are not here (creating one is a write).
 */
const REPORT_READERS = {
  overview: (query, signal) => reportsApi.getOverviewReport(query, { signal }),
  "income-expense": (query, signal) => reportsApi.getIncomeExpenseReport(query, { signal }),
  "cash-flow": (query, signal) => reportsApi.getCashFlowReport(query, { signal }),
  accounts: (query, signal) => reportsApi.getAccountsReport(query, { signal }),
  categories: (query, signal) => reportsApi.getCategoriesReport(query, { signal }),
  transfers: (query, signal) => reportsApi.getTransfersReport(query, { signal }),
  budgets: (query, signal) => reportsApi.getBudgetsReport(query, { signal }),
  "savings-goals": (query, signal) => reportsApi.getSavingsGoalsReport(query, { signal }),
  debts: (query, signal) => reportsApi.getDebtsReport(query, { signal }),
  recurring: (query, signal) => reportsApi.getRecurringReport(query, { signal }),
};

export const readReport = (type, query, signal) => {
  if (!Object.hasOwn(REPORT_READERS, type)) throw Object.assign(new Error("Unknown report."), { code: "NOT_FOUND" });
  return REPORT_READERS[type](query, signal);
};

/*
 * The export history and statement imports, read-only:
 *   GET /report-exports?status=          a page of exports (data.report_exports)
 *   GET /report-exports/{id}/download    the file, only when the export says download_available
 *   GET /imports?status=                 a page of imports (data.imports)
 *   GET /imports/{id}                    one import with its status and row counts
 * Queueing, cancelling or revoking an export, and uploading, mapping,
 * validating, confirming, cancelling or reversing an import, are writes and are
 * not named here.
 */
export const EXPORTS_PER_PAGE = 20;
export const IMPORTS_PER_PAGE = 20;

export const readExports = (query, signal) => reportExportsApi.list(query, { signal });

export const readExportFile = (exportId, signal) => reportExportsApi.download(exportId, { signal });

export const readImports = (query, signal) => importsApi.list(query, { signal });

export const readImport = (importId, signal) => importsApi.get(importId, { signal });
