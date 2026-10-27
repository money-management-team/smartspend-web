import { amountIn, dateOnlyOrNull, flagOrNull, idText, isRecord } from "./values.js";

/*
 * A savings goal's Smart Savings plan, read-only, for the one place that shows
 * it (planning/SmartPlanSection.jsx, which exists only in a build with Smart
 * Savings switched on).
 *
 * GET /savings-goals/{id}/plan answers with savings_goal, balance,
 * savings_plan (with next_installment), and plan_health (docs/savings-goals/
 * smart-plans.md). Only an ACTIVE plan of THIS goal is shown: a response about
 * another goal, or a plan in any other state, is refused rather than shown as
 * if it were the current plan. The 404 the backend sends for a goal with no
 * active plan is "no plan", not an error (see the section).
 *
 * Mobile shows what the plan says and nothing it could act on: no installment
 * is confirmed, postponed or skipped here, and no plan is created or revised.
 */

export function buildPlanSummary(data, goalId, currency) {
  if (!isRecord(data) || !isRecord(data.savings_plan) || !isRecord(data.savings_goal)) return null;

  const plan = data.savings_plan;

  if (idText(data.savings_goal.id) !== String(goalId)) return null;
  if (plan.savings_goal_id != null && idText(plan.savings_goal_id) !== String(goalId)) return null;
  if (plan.status !== "active") return null;

  const next = isRecord(plan.next_installment) ? plan.next_installment : null;
  const health = isRecord(data.plan_health) ? data.plan_health : null;

  return {
    next: next
      ? { date: dateOnlyOrNull(next.planned_date), amount: amountIn(next.amount, currency), overdue: flagOrNull(next.is_overdue) }
      : null,
    executable: flagOrNull(health?.executable),
    replanningRecommended: flagOrNull(health?.replanning_recommended),
  };
}
