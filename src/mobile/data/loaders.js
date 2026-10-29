import { readAccount, readAccountMovements, readAccounts, readAlerts, readBudget, readBudgets, readCalendarMonth, readCategories, readCategory, readCategoryList, readDashboard, readDebt, readDebtPayments, readDebts, readExports, readGoal, readGoals, readImport, readImports, readNotifications, readReport, readRule, readRules, readTransaction, readTransactions, readTransfer, readTransfers } from "./readApi.js";

/*
 * What each store entry loads: the response's `data`, as the backend sent it.
 * Reading it into something displayable (and refusing what does not hold
 * together) is the models' job, so a bad response is kept out of the screens.
 */

export const loadDashboard = async (signal) => (await readDashboard(signal)).data;
// Another period than the default month; the default keeps the plain "dashboard" entry the other screens share.
export const dashboardLoader = (period, from, to) => async (signal) => (await readDashboard(signal, { period, from, to })).data;
export const loadAlerts = async (signal) => (await readAlerts(signal)).data;
export const loadAccounts = async (signal) => (await readAccounts(signal)).data;

export const accountLoader = (accountId) => async (signal) => (await readAccount(accountId, signal)).data;

// A movements page is returned whole (the envelope), because the paginator numbers live beside `data`.
export const movementsLoader = (accountId, page) => (signal) => readAccountMovements(accountId, page, signal);

export const loadCategories = async (signal) => (await readCategories(signal)).data;

export const transactionLoader = (transactionId) => async (signal) => (await readTransaction(transactionId, signal)).data;

// An Activity page is returned whole (the envelope): the paginator numbers live beside `data`.
export const activityLoader = (query) => (signal) => readTransactions(query, signal);

// Planning lists are returned whole (the envelope), like Activity: the paginator numbers live beside `data`.
export const budgetsLoader = (query) => (signal) => readBudgets(query, signal);
export const goalsLoader = (query) => (signal) => readGoals(query, signal);
export const rulesLoader = (query) => (signal) => readRules(query, signal);

export const budgetLoader = (budgetId) => async (signal) => (await readBudget(budgetId, signal)).data;
export const goalLoader = (goalId) => async (signal) => (await readGoal(goalId, signal)).data;
export const ruleLoader = (ruleId) => async (signal) => (await readRule(ruleId, signal)).data;

export const categoryListLoader = (type) => async (signal) => (await readCategoryList(type, signal)).data;
export const categoryLoader = (categoryId) => async (signal) => (await readCategory(categoryId, signal)).data;

// Debts, transfers and notifications are pages (the envelope); one debt or transfer is its `data`.
export const debtsLoader = (query) => (signal) => readDebts(query, signal);
export const debtLoader = (debtId) => async (signal) => (await readDebt(debtId, signal)).data;
export const paymentsLoader = (debtId, page) => (signal) => readDebtPayments(debtId, page, signal);
export const transfersLoader = (query) => (signal) => readTransfers(query, signal);
export const transferLoader = (transferId) => async (signal) => (await readTransfer(transferId, signal)).data;
export const notificationsLoader = (query) => (signal) => readNotifications(query, signal);
export const calendarLoader = (month, year) => async (signal) => (await readCalendarMonth(month, year, signal)).data;

export const reportLoader = (type, query) => async (signal) => (await readReport(type, query, signal)).data;

export const exportsLoader = (query) => (signal) => readExports(query, signal);
export const importsLoader = (query) => (signal) => readImports(query, signal);
export const importLoader = (importId) => async (signal) => (await readImport(importId, signal)).data;

export const keys = {
  exports: (signature, page) => `exports:${signature}:${page}`,
  imports: (signature, page) => `imports:${signature}:${page}`,
  statementImport: (id) => `import:${id}`,
  report: (type, from, to, page) => `report:${type}:${from}:${to}:${page}`,
  debts: (signature, page) => `debts:${signature}:${page}`,
  debt: (id) => `debt:${id}`,
  payments: (id, page) => `payments:${id}:${page}`,
  transfers: (signature, page) => `transfers:${signature}:${page}`,
  transfer: (id) => `transfer:${id}`,
  notifications: (signature, page) => `notifications:${signature}:${page}`,
  categoryList: (type) => `categoryList:${type || "all"}`,
  category: (id) => `category:${id}`,
  budgets: (signature, page) => `budgets:${signature}:${page}`,
  budget: (id) => `budget:${id}`,
  goals: (signature, page) => `goals:${signature}:${page}`,
  goal: (id) => `goal:${id}`,
  goalPlan: (id) => `goalPlan:${id}`,
  rules: (signature, page) => `rules:${signature}:${page}`,
  rule: (id) => `rule:${id}`,
  categories: "categories",
  transaction: (id) => `transaction:${id}`,
  activity: (signature, page) => `activity:${signature}:${page}`,
  dashboard: "dashboard",
  dashboardFor: (period, from, to) => (period === "month" ? "dashboard" : `dashboard:${period}:${from ?? ""}:${to ?? ""}`),
  alerts: "alerts",
  accounts: "accounts",
  account: (id) => `account:${id}`,
  movements: (id, page) => `movements:${id}:${page}`,
};
