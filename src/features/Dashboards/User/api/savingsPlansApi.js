import { apiRequest } from "./apiClient";

const goalPath = (goalId) => `/savings-goals/${encodeURIComponent(goalId)}`;

/*
 * Smart savings plans (backend `feature/savings-reversal-integrity`). A goal
 * without an active plan is flexible saving; a goal with one is a smart plan.
 * A plan is intent, not money: it holds no balance, and nothing moves until
 * the owner confirms an installment.
 *
 * Envelopes:
 * - getActive → `data.savings_goal`, `data.balance` (saved / remaining from
 *   the ledger), `data.savings_plan` (with `next_installment` and
 *   `installments`) and `data.plan_health`. 404 when the goal has no active
 *   plan, which is how a flexible goal is told apart.
 *
 * Only reads live here for now; the plan writes (create, revise,
 * discontinue, confirm, postpone, skip) arrive with their screens.
 */
export const savingsPlansApi = {
  getActive: (goalId, options = {}) =>
    apiRequest(`${goalPath(goalId)}/plan`, { signal: options.signal }),
};
