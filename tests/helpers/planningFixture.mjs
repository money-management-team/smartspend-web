import { envelope, failure } from "./mobileApi.mjs";

/*
 * Fictional Planning data and a backend that answers like GET /budgets,
 * GET /savings-goals and GET /recurring-transactions (and their one-record and
 * plan reads): it filters by the documented query parameters and pages with a
 * Laravel-shaped paginator. A test can wrap it to delay or fail a request.
 */

export const budget = (id, over = {}) => ({
  id,
  workspace_id: 1,
  name: `Budget ${id}`,
  scope: "general",
  category_id: null,
  category: null,
  amount_limit: "800.0000",
  currency_code: "ILS",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
  status: "active",
  archived_at: null,
  notes: null,
  progress: {
    budget_id: id,
    name: `Budget ${id}`,
    scope: "general",
    currency_code: "ILS",
    amount_limit: "800.0000",
    spent: "200.0000",
    remaining: "600.0000",
    percentage_used: "25.0000",
    status: "safe",
    expenses_count: 4,
    days_remaining: 12,
    period_start: "2026-10-01",
    period_end: "2026-10-31",
    has_started: true,
    has_ended: false,
    is_archived: false,
  },
  ...over,
});

export const goal = (id, over = {}) => ({
  id,
  workspace_id: 1,
  name: `Goal ${id}`,
  target_amount: "3000.0000",
  currency_code: "ILS",
  target_date: "2026-12-31",
  status: "active",
  achieved_at: null,
  archived_at: null,
  notes: null,
  account: { id: 5, name: `Goal ${id} jar`, type: "savings", currency_code: "ILS" },
  progress: {
    goal_id: id,
    account_id: 5,
    target_amount: "3000.0000",
    saved_amount: "1200.0000",
    remaining_amount: "1800.0000",
    percentage_funded: "40.0000",
    status: "in_progress",
    contributions_count: 3,
    days_remaining: 66,
    is_achieved: false,
    deadline_passed: false,
    is_archived: false,
  },
  ...over,
});

export const rule = (id, over = {}) => ({
  id,
  name: `Rule ${id}`,
  type: "expense",
  amount: "120.0000",
  currency_code: "ILS",
  account_id: 1,
  account: { id: 1, name: "Everyday wallet" },
  category_id: 4,
  category: { id: 4, name: "Rent" },
  frequency: "monthly",
  interval: 1,
  anchor_day: 1,
  start_date: "2026-01-01",
  end_date: null,
  max_occurrences: null,
  processing_mode: "manual",
  status: "active",
  next_due_date: "2026-11-01",
  last_processed_at: "2026-10-01T06:00:00Z",
  description: null,
  notes: null,
  archived_at: null,
  schedule: { next_occurrence: null, open_occurrences_count: 1 },
  ...over,
});

export const paginator = (rows, { page = 1, perPage = 20 } = {}) => {
  const total = rows.length;
  const slice = rows.slice((page - 1) * perPage, page * perPage);

  return {
    data: slice,
    total,
    current_page: page,
    per_page: perPage,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    from: slice.length ? (page - 1) * perPage + 1 : null,
    to: slice.length ? (page - 1) * perPage + slice.length : null,
  };
};

const pageOf = (call, rows, key) => ({ body: envelope({ [key]: paginator(rows, { page: Number(call.query.page ?? 1), perPage: Number(call.query.per_page ?? 20) }) }) });

/**
 * @param {{ budgets?: object[], goals?: object[], rules?: object[], alerts?: object[], plans?: Record<string, object | null> }} data
 * `plans` maps a goal id to the body of GET /savings-goals/{id}/plan (absent or null: 404, a goal with no plan).
 */
export function planningBackend({ budgets = [], goals = [], rules = [], alerts = [], plans = {} } = {}) {
  return (call) => {
    const q = call.query;
    const one = /^\/(budgets|savings-goals|recurring-transactions)\/(\d+)$/.exec(call.path);

    if (call.path === "/financial-alerts") return { body: envelope({ generated_at: "2026-10-26T00:00:00Z", alerts }) };

    if (call.path === "/budgets") {
      const rows = budgets.filter((row) => (!q.status || row.status === q.status) && (!q.progress_status || row.progress?.status === q.progress_status));
      return pageOf(call, rows, "budgets");
    }

    if (call.path === "/savings-goals") return pageOf(call, goals.filter((row) => !q.status || row.status === q.status), "savings_goals");

    if (call.path === "/recurring-transactions") {
      return pageOf(call, rules.filter((row) => (!q.status || row.status === q.status) && (!q.type || row.type === q.type)), "recurring_transactions");
    }

    const plan = /^\/savings-goals\/(\d+)\/plan$/.exec(call.path);
    if (plan) return plans[plan[1]] ? { body: envelope(plans[plan[1]]) } : failure(404, "No active plan");

    if (one) {
      const [, kind, id] = one;
      const [rows, key] = { budgets: [budgets, "budget"], "savings-goals": [goals, "savings_goal"], "recurring-transactions": [rules, "recurring_transaction"] }[kind];
      const found = rows.find((row) => String(row.id) === id);
      return found ? { body: envelope({ [key]: found }) } : failure(404, "Not found");
    }

    return failure(404, "Not found");
  };
}

export const activePlan = (goalId, over = {}) => ({
  savings_goal: { id: goalId },
  balance: { saved_amount: "1200.0000" },
  savings_plan: { id: 70 + goalId, savings_goal_id: goalId, status: "active", plan_version: 2, next_installment: { id: 900, planned_date: "2026-11-05", amount: "250.0000", is_overdue: false }, installments: [] },
  plan_health: { executable: true, replanning_recommended: false },
  ...over,
});
