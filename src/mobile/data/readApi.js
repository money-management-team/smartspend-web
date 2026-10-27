import { accountsApi } from "../../features/Dashboards/User/api/accountsApi.js";
import { budgetsApi } from "../../features/Dashboards/User/api/budgetsApi.js";
import { categoriesApi } from "../../features/Dashboards/User/api/categoriesApi.js";
import { getStoredWorkspace } from "../../features/Dashboards/User/api/apiClient.js";
import { dashboardApi } from "../../features/Dashboards/User/api/dashboardApi.js";
import { financialAlertsApi } from "../../features/Dashboards/User/api/financialAlertsApi.js";
import { recurringTransactionsApi } from "../../features/Dashboards/User/api/recurringTransactionsApi.js";
import { savingsGoalsApi } from "../../features/Dashboards/User/api/savingsGoalsApi.js";
import { transactionsApi } from "../../features/Dashboards/User/api/transactionsApi.js";

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

export const readDashboard = (signal) =>
  dashboardApi.get({ period: DASHBOARD_PERIOD, workspace_id: workspaceId() }, { signal });

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

/** The session's workspace for a Planning list query (read from storage, never written). */
export const planningWorkspaceId = workspaceId;
