import {
  LuActivity,
  LuArrowLeftRight,
  LuHandCoins,
  LuLayoutDashboard,
  LuPiggyBank,
  LuRepeat,
  LuScale,
  LuTags,
  LuTarget,
  LuWallet,
} from "react-icons/lu";

import {
  getAccountDetailsPath,
  getBudgetDetailsPath,
  getCategoryDetailsPath,
  getDebtDetailsPath,
  getRecurringDetailsPath,
  getSavingsGoalDetailsPath,
  getTransactionDetailsPath,
  getTransferDetailsPath,
} from "../../../../routes/Path";
import { pickValue } from "./reportHelpers";

/*
 * What each report shows, on top of the shared primitives. Nothing here
 * calculates: every entry names backend fields to display.
 *
 * - summary: groups of `summary_by_currency` fields, in order. Fields the
 *   backend sends that aren't listed are still shown after them.
 * - notes: the financial rule that explains the report's numbers.
 * - analytics: report-specific sections, keyed by their `analytics` field.
 *   `comparison_by_currency`, `previous_summary_by_currency` and
 *   `trend_by_currency` are handled for every report; any other analytics
 *   field the backend sends is rendered by the generic block.
 * - columns: the `items` table. A column is shown only when at least one row
 *   has a value for it; `keys` are tried in order (dot paths allowed).
 */

const linkBy = (keys, toPath) => (row) => {
  const id = pickValue(row, keys);
  return id == null ? null : toPath(id);
};

const CURRENCY_COLUMN = { id: "currency_code", type: "currency", keys: ["currency_code"] };

export const REPORT_DEFINITIONS = {
  overview: {
    icon: LuLayoutDashboard,
    notes: ["overview"],
    summary: [
      { title: "incomeExpense", fields: ["total_income", "total_expense", "net_income"] },
      { title: "cashFlow", fields: ["total_inflow", "total_outflow", "net_cash_flow"] },
      { title: "transfers", fields: ["transfer_in", "transfer_out", "net_internal_transfer_effect"] },
      { title: "balances", fields: ["current_account_balance"] },
      { title: "budgets", fields: ["budgets_total", "budgets_spent"] },
      { title: "savings", fields: ["savings_target", "savings_saved"] },
      { title: "debts", fields: ["payable_outstanding", "receivable_outstanding"] },
      { title: "recurring", fields: ["recurring_expected_income", "recurring_expected_expense"], forecast: true },
    ],
    analytics: [
      { key: "top_expense_categories", kind: "ranked", title: "topExpenseCategories" },
      { key: "top_income_categories", kind: "ranked", title: "topIncomeCategories" },
      { key: "top_transactions", kind: "transactions", title: "topTransactions" },
      { key: "recent_high_value_transactions", kind: "transactions", title: "recentHighValueTransactions" },
      { key: "budget_status_distribution", kind: "distribution", title: "budgetStatusDistribution" },
      { key: "savings_progress_summary", kind: "generic", title: "savingsProgressSummary" },
      { key: "debt_summary", kind: "generic", title: "debtSummary" },
      { key: "recurring_forecast", kind: "generic", title: "recurringForecast", forecast: true },
    ],
    columns: [],
  },

  "income-expense": {
    icon: LuScale,
    notes: ["incomeExpense"],
    summary: [{ fields: ["total_income", "total_expense", "net_income", "transaction_count"] }],
    analytics: [
      { key: "categories_by_currency", kind: "ranked", title: "topCategories" },
      { key: "top_transactions", kind: "transactions", title: "topTransactions" },
      {
        key: "average_expense_by_currency",
        kind: "metrics",
        title: "averageExpense",
      },
    ],
    columns: [
      { id: "date", type: "date", keys: ["occurred_at", "transaction_date", "posted_at", "date", "period_start", "period"] },
      {
        id: "description",
        type: "text",
        primary: true,
        keys: ["description", "name", "label"],
        link: linkBy(["transaction_id", "id"], getTransactionDetailsPath),
      },
      { id: "category", type: "text", keys: ["category.name", "category_name"] },
      { id: "account", type: "text", keys: ["account.name", "account_name"] },
      { id: "type", type: "status", keys: ["type"] },
      { id: "amount", type: "money", keys: ["amount"] },
      { id: "income", type: "money", keys: ["total_income", "income"] },
      { id: "expense", type: "money", keys: ["total_expense", "expense"] },
      { id: "net_income", type: "money", tone: true, keys: ["net_income", "net"] },
      { id: "transaction_count", type: "count", keys: ["transaction_count", "transactions_count"] },
      CURRENCY_COLUMN,
    ],
  },

  "cash-flow": {
    icon: LuActivity,
    notes: ["cashFlow"],
    summary: [{ fields: ["total_inflow", "total_outflow", "net_cash_flow"] }],
    analytics: [],
    columns: [
      { id: "date", type: "date", keys: ["occurred_at", "transaction_date", "posted_at", "date", "period_start", "period"] },
      {
        id: "description",
        type: "text",
        primary: true,
        keys: ["description", "name", "label"],
        link: linkBy(["transaction_id"], getTransactionDetailsPath),
      },
      { id: "bucket", type: "status", keys: ["bucket", "flow_type", "movement_type", "flow"] },
      { id: "type", type: "status", keys: ["type"] },
      { id: "account", type: "text", keys: ["account.name", "account_name"] },
      { id: "inflow", type: "money", keys: ["inflow", "total_inflow"] },
      { id: "outflow", type: "money", keys: ["outflow", "total_outflow"] },
      { id: "amount", type: "money", tone: true, keys: ["amount"] },
      { id: "net_cash_flow", type: "money", tone: true, keys: ["net_cash_flow", "net"] },
      CURRENCY_COLUMN,
    ],
  },

  accounts: {
    icon: LuWallet,
    notes: ["accounts"],
    summary: [
      {
        fields: [
          "total_current_balance",
          "total_net_change",
          "total_inflow",
          "total_outflow",
          "total_opening_balance",
          "accounts_count",
        ],
      },
    ],
    analytics: [],
    columns: [
      {
        id: "name",
        type: "text",
        primary: true,
        keys: ["name"],
        link: linkBy(["account_id"], getAccountDetailsPath),
      },
      { id: "type", type: "enum", keys: ["type"] },
      CURRENCY_COLUMN,
      { id: "opening_balance", type: "money", keys: ["opening_balance"] },
      { id: "inflow", type: "money", keys: ["inflow"] },
      { id: "outflow", type: "money", keys: ["outflow"] },
      { id: "net_change", type: "money", tone: true, keys: ["net_change"] },
      { id: "current_balance", type: "money", tone: true, keys: ["current_balance"] },
      { id: "transaction_count", type: "count", keys: ["transaction_count"] },
      { id: "latest_transaction_at", type: "datetime", keys: ["latest_transaction_at"] },
      { id: "status", type: "status", keys: ["status"] },
    ],
  },

  categories: {
    icon: LuTags,
    notes: ["categories"],
    summary: [{ fields: ["total_income", "total_expense", "net_income", "categories_count"] }],
    analytics: [],
    columns: [
      {
        id: "name",
        type: "text",
        primary: true,
        keys: ["name", "category_name", "category.name"],
        link: linkBy(["category_id", "category.id"], getCategoryDetailsPath),
      },
      { id: "type", type: "status", keys: ["type", "category_type", "category.type"] },
      CURRENCY_COLUMN,
      { id: "income", type: "money", keys: ["total_income", "income"] },
      { id: "expense", type: "money", keys: ["total_expense", "expense"] },
      { id: "refunds", type: "money", keys: ["total_refunds", "refunds", "refund_total"] },
      { id: "total", type: "money", keys: ["total", "amount", "total_amount"] },
      { id: "net", type: "money", tone: true, keys: ["net", "net_total", "net_amount"] },
      { id: "percentage", type: "percent", keys: ["percentage", "share_percentage", "share"] },
      { id: "transaction_count", type: "count", keys: ["transaction_count", "transactions_count"] },
    ],
  },

  transfers: {
    icon: LuArrowLeftRight,
    notes: ["transfers"],
    summary: [
      {
        fields: [
          "transfers_count",
          "total_principal",
          "total_fees",
          "transfer_in",
          "transfer_out",
          "net_internal_transfer_effect",
        ],
      },
    ],
    analytics: [],
    columns: [
      { id: "date", type: "date", keys: ["transferred_at", "occurred_at", "transfer_date", "date", "created_at", "period_start", "period"] },
      {
        id: "description",
        type: "text",
        primary: true,
        keys: ["description", "reference", "name", "label"],
        link: linkBy(["transfer_id"], getTransferDetailsPath),
      },
      { id: "from_account", type: "text", keys: ["from_account.name", "source_account.name", "from_account_name"] },
      { id: "to_account", type: "text", keys: ["to_account.name", "destination_account.name", "to_account_name"] },
      { id: "principal", type: "money", keys: ["principal_amount", "principal", "amount"] },
      { id: "fee", type: "money", keys: ["fee_amount", "fee", "total_fees"] },
      { id: "transfer_in", type: "money", keys: ["transfer_in"] },
      { id: "transfer_out", type: "money", keys: ["transfer_out"] },
      { id: "transfers_count", type: "count", keys: ["transfers_count", "count"] },
      CURRENCY_COLUMN,
      { id: "status", type: "status", keys: ["status"] },
    ],
  },

  budgets: {
    icon: LuTarget,
    notes: ["budgets"],
    summary: [{ fields: ["total_budget", "total_spent", "total_remaining", "budgets_count"] }],
    analytics: [
      { key: "status_distribution", kind: "distribution", title: "statusDistribution" },
      {
        key: "utilization_by_currency",
        kind: "metrics",
        title: "utilization",
        fields: ["utilization_percentage", "total_budget", "total_spent", "total_remaining"],
      },
    ],
    columns: [
      {
        id: "name",
        type: "text",
        primary: true,
        keys: ["name"],
        link: linkBy(["budget_id"], getBudgetDetailsPath),
      },
      { id: "category", type: "text", keys: ["category.name", "category_name"] },
      { id: "scope", type: "enum", keys: ["scope"] },
      { id: "amount_limit", type: "money", keys: ["amount_limit"] },
      { id: "spent", type: "money", keys: ["spent"] },
      { id: "remaining", type: "money", tone: true, keys: ["remaining"] },
      { id: "progress", type: "progress", keys: ["progress_percentage"], statusKeys: ["progress_status"] },
      { id: "expense_count", type: "count", keys: ["expense_count"] },
      { id: "period", type: "range", keys: ["period_start"], endKeys: ["period_end"] },
      { id: "status", type: "status", keys: ["status"] },
    ],
  },

  "savings-goals": {
    icon: LuPiggyBank,
    notes: ["savingsGoals"],
    summary: [
      { fields: ["total_target", "total_saved", "total_remaining", "goals_count"] },
      { title: "periodMovements", fields: ["period_contributions", "period_withdrawals", "period_net_movement"] },
    ],
    analytics: [{ key: "status_distribution", kind: "distribution", title: "statusDistribution" }],
    columns: [
      {
        id: "name",
        type: "text",
        primary: true,
        keys: ["name"],
        link: linkBy(["savings_goal_id"], getSavingsGoalDetailsPath),
      },
      { id: "account", type: "text", keys: ["account.name", "account_name"] },
      { id: "target_amount", type: "money", keys: ["target_amount"] },
      { id: "saved_amount", type: "money", keys: ["saved_amount", "current_amount"] },
      { id: "remaining_amount", type: "money", keys: ["remaining_amount"] },
      { id: "progress", type: "progress", keys: ["progress_percentage"], statusKeys: ["progress_status"] },
      { id: "period_contributions", type: "money", keys: ["period_contributions"] },
      { id: "period_withdrawals", type: "money", keys: ["period_withdrawals"] },
      { id: "period_net_movement", type: "money", tone: true, keys: ["period_net_movement"] },
      { id: "latest_movement_at", type: "datetime", keys: ["latest_movement_at"] },
      { id: "target_date", type: "date", keys: ["target_date"] },
      { id: "status", type: "status", keys: ["status"] },
    ],
  },

  debts: {
    icon: LuHandCoins,
    notes: ["debts"],
    summary: [
      { title: "payable", fields: ["payable_original", "payable_outstanding"] },
      { title: "receivable", fields: ["receivable_original", "receivable_outstanding"] },
      { title: "periodMovements", fields: ["debt_received", "debt_given", "payments", "collections"] },
      { fields: ["debts_count"] },
    ],
    analytics: [
      {
        key: "current_outstanding_by_currency",
        kind: "metrics",
        title: "currentOutstanding",
        fields: ["payable", "receivable", "net_position", "active_debts_count", "overdue_debts_count"],
      },
      { key: "direction_distribution", kind: "distribution", title: "directionDistribution" },
    ],
    columns: [
      {
        id: "counterparty_name",
        type: "text",
        primary: true,
        keys: ["counterparty_name"],
        link: linkBy(["debt_id"], getDebtDetailsPath),
      },
      { id: "direction", type: "status", keys: ["direction"] },
      { id: "original_principal", type: "money", keys: ["original_principal"] },
      { id: "outstanding_amount", type: "money", keys: ["outstanding_amount"] },
      { id: "amount_paid_or_collected", type: "money", keys: ["amount_paid_or_collected"] },
      { id: "status", type: "status", keys: ["effective_status", "status"] },
      { id: "opened_at", type: "date", keys: ["opened_at"] },
      { id: "due_date", type: "date", keys: ["due_date"] },
      { id: "latest_payment_at", type: "datetime", keys: ["latest_payment_at"] },
      { id: "payment_count", type: "count", keys: ["payment_count"] },
      { id: "period_movement_total", type: "money", keys: ["period_movement_total"] },
      { id: "period_movement_count", type: "count", keys: ["period_movement_count"] },
    ],
  },

  recurring: {
    icon: LuRepeat,
    notes: ["recurring"],
    summary: [
      {
        title: "templates",
        fields: ["active_templates", "paused_templates", "completed_templates", "archived_templates"],
      },
      { title: "forecast", fields: ["expected_income", "expected_expense"], forecast: true },
      {
        title: "occurrences",
        fields: ["posted_occurrences", "skipped_occurrences", "failed_occurrences", "upcoming_occurrences"],
      },
    ],
    analytics: [{ key: "forecast_by_currency", kind: "metrics", title: "forecast", forecast: true }],
    columns: [
      {
        id: "name",
        type: "text",
        primary: true,
        keys: ["name", "description"],
        link: linkBy(["recurring_transaction_id"], getRecurringDetailsPath),
      },
      { id: "type", type: "status", keys: ["type"] },
      { id: "amount", type: "money", keys: ["amount"] },
      { id: "frequency", type: "frequency", keys: ["frequency"], intervalKeys: ["interval"] },
      { id: "account", type: "text", keys: ["account.name", "account_name"] },
      { id: "category", type: "text", keys: ["category.name", "category_name"] },
      { id: "expected_next_occurrence", type: "date", keys: ["expected_next_occurrence.due_date", "expected_next_occurrence.scheduled_for", "expected_next_occurrence.date", "expected_next_occurrence", "next_run_at"] },
      { id: "last_run_at", type: "datetime", keys: ["last_run_at"] },
      { id: "occurrence_counts", type: "occurrences", keys: ["occurrence_counts"] },
      { id: "status", type: "status", keys: ["status"] },
    ],
  },
};

// Keys of `analytics` rendered by the page itself (period header, comparison,
// trend, flags) rather than as a section.
export const COMMON_ANALYTICS_KEYS = new Set([
  "previous_period",
  "previous_summary_by_currency",
  "comparison_by_currency",
  "trend_by_currency",
  "actual_source",
  "templates_are_forecast_only",
]);

// Occurrence states shown in the recurring table, in lifecycle order.
export const OCCURRENCE_STATES = ["posted", "skipped", "failed", "scheduled", "due", "cancelled"];
