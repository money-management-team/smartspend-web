import { budgetsLoader, debtsLoader, goalsLoader, keys, notificationsLoader, rulesLoader, transfersLoader } from "../data/loaders.js";
import { BUDGETS_PER_PAGE, DEBTS_PER_PAGE, GOALS_PER_PAGE, NOTIFICATIONS_PER_PAGE, RULES_PER_PAGE, TRANSFERS_PER_PAGE, planningWorkspaceId } from "../data/readApi.js";
import { buildDebtsPage, debtFilterSignature, debtFiltersToQuery, debtFiltersToSearchParams, hasActiveDebtFilters, readDebtFilters } from "../models/debts.js";
import { buildNotificationsPage, hasActiveNotificationFilters, notificationFilterSignature, notificationFiltersToQuery, notificationFiltersToSearchParams, readNotificationFilters } from "../models/notifications.js";
import { buildTransfersPage, hasActiveTransferFilters, readTransferFilters, transferFilterSignature, transferFiltersToQuery, transferFiltersToSearchParams } from "../models/transfers.js";
import { budgetFilterSignature, budgetFiltersToQuery, budgetFiltersToSearchParams, buildBudgetsPage, hasActiveBudgetFilters, readBudgetFilters } from "../models/budgets.js";
import { buildGoalsPage, goalFilterSignature, goalFiltersToQuery, goalFiltersToSearchParams, hasActiveGoalFilters, readGoalFilters } from "../models/goals.js";
import { buildRulesPage, hasActiveRuleFilters, readRuleFilters, ruleFilterSignature, ruleFiltersToQuery, ruleFiltersToSearchParams } from "../models/recurring.js";

/*
 * The three Planning lists, each as one description: how its filters are read
 * from and written to the address, how a page is asked for, how it is read. The
 * list screens and the overview share these, so a page the overview has read is
 * the page the list shows (the same store key and the same request).
 */
export const BUDGET_LIST = Object.freeze({
  keyOf: keys.budgets,
  perPage: BUDGETS_PER_PAGE,
  build: buildBudgetsPage,
  readFilters: readBudgetFilters,
  toSearchParams: budgetFiltersToSearchParams,
  signatureOf: budgetFilterSignature,
  toQuery: budgetFiltersToQuery,
  loaderOf: budgetsLoader,
  isFiltered: hasActiveBudgetFilters,
});

export const GOAL_LIST = Object.freeze({
  keyOf: keys.goals,
  perPage: GOALS_PER_PAGE,
  build: buildGoalsPage,
  readFilters: readGoalFilters,
  toSearchParams: goalFiltersToSearchParams,
  signatureOf: goalFilterSignature,
  toQuery: goalFiltersToQuery,
  loaderOf: goalsLoader,
  isFiltered: hasActiveGoalFilters,
});

export const RULE_LIST = Object.freeze({
  keyOf: keys.rules,
  perPage: RULES_PER_PAGE,
  build: buildRulesPage,
  readFilters: readRuleFilters,
  toSearchParams: ruleFiltersToSearchParams,
  signatureOf: ruleFilterSignature,
  toQuery: ruleFiltersToQuery,
  loaderOf: rulesLoader,
  isFiltered: hasActiveRuleFilters,
});

export const DEBT_LIST = Object.freeze({
  keyOf: keys.debts,
  perPage: DEBTS_PER_PAGE,
  build: buildDebtsPage,
  readFilters: readDebtFilters,
  toSearchParams: debtFiltersToSearchParams,
  signatureOf: debtFilterSignature,
  toQuery: debtFiltersToQuery,
  loaderOf: debtsLoader,
  isFiltered: hasActiveDebtFilters,
});

export const TRANSFER_LIST = Object.freeze({
  keyOf: keys.transfers,
  perPage: TRANSFERS_PER_PAGE,
  build: buildTransfersPage,
  readFilters: readTransferFilters,
  toSearchParams: transferFiltersToSearchParams,
  signatureOf: transferFilterSignature,
  toQuery: transferFiltersToQuery,
  loaderOf: transfersLoader,
  isFiltered: hasActiveTransferFilters,
});

export const NOTIFICATION_LIST = Object.freeze({
  keyOf: keys.notifications,
  perPage: NOTIFICATIONS_PER_PAGE,
  build: buildNotificationsPage,
  readFilters: readNotificationFilters,
  toSearchParams: notificationFiltersToSearchParams,
  signatureOf: notificationFilterSignature,
  toQuery: notificationFiltersToQuery,
  loaderOf: notificationsLoader,
  isFiltered: hasActiveNotificationFilters,
});

/** The loader of one page of a list for the given (already sanitised) filters. */
export const pageLoader = (list, filters, page) => list.loaderOf(list.toQuery(filters, page, list.perPage, planningWorkspaceId()));
