import { readAccount, readAccountMovements, readAccounts, readAlerts, readBudget, readBudgets, readCategories, readCategory, readCategoryList, readDashboard, readGoal, readGoals, readRule, readRules, readTransaction, readTransactions } from "./readApi.js";

/*
 * What each store entry loads: the response's `data`, as the backend sent it.
 * Reading it into something displayable (and refusing what does not hold
 * together) is the models' job, so a bad response is kept out of the screens.
 */

export const loadDashboard = async (signal) => (await readDashboard(signal)).data;
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

export const keys = {
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
  alerts: "alerts",
  accounts: "accounts",
  account: (id) => `account:${id}`,
  movements: (id, page) => `movements:${id}:${page}`,
};
