import { savingsPlansApi } from "../api/savingsPlansApi";
import { getGoalStatus } from "./savingsGoalHelpers";

// Off unless VITE_SMART_SAVINGS_ENABLED=true; without it the overview is the
// flexible-only experience production already has, with no extra requests.
export { SMART_SAVINGS_ENABLED } from "./smartSavingsFlag";

export const PLAN_INTENSITIES = ["easy", "balanced", "intensive"];

// GET …/plan per goal is at most PER_PAGE requests; a small pool keeps a
// filter change from bursting into the rate limit.
export const PLAN_LOOKUP_CONCURRENCY = 4;
export const UPCOMING_LIMIT = 4;

const isDateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isMoneyString = (value) => typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value);

// Reaching the target completes the plan in the same transaction, and
// archiving discontinues it, so neither status can have an active plan.
export const canHaveActivePlan = (goal) => !["achieved", "archived"].includes(getGoalStatus(goal));

/*
 * The card-sized view of `GET /savings-goals/{id}/plan`. Values are the
 * backend's own strings (amount, date); nothing is recalculated. Anything
 * that doesn't look like this goal's active plan is "unavailable" rather
 * than guessed at.
 *
 * States: loading | smart | flexible (404: no active plan) | unavailable.
 */
export function toPlanSummary(data, goalId) {
  const plan = data?.savings_plan;

  if (
    !plan ||
    typeof plan !== "object" ||
    plan.status !== "active" ||
    String(plan.savings_goal_id) !== String(goalId)
  ) {
    return { state: "unavailable" };
  }

  const next = plan.next_installment;
  const health = data.plan_health ?? {};

  return {
    state: "smart",
    planId: plan.id,
    intensity: plan.intensity,
    currency: plan.currency_code,
    nextInstallment:
      next && isDateOnly(next.planned_date) && isMoneyString(next.amount)
        ? {
            id: next.id,
            date: next.planned_date,
            amount: next.amount,
            isOverdue: next.is_overdue === true,
          }
        : null,
    // false while the goal is paused: the plan is kept but on hold.
    executable: health.executable !== false,
    reviewSuggested: health.replanning_recommended === true,
  };
}

/** One goal's plan summary. Rethrows aborts; every other failure is a result. */
export async function lookupPlanSummary(goalId, { signal } = {}) {
  try {
    const response = await savingsPlansApi.getActive(goalId, { signal });
    return toPlanSummary(response?.data, goalId);
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) throw error;
    // 404 is the backend's answer for a goal without an active plan. Any
    // other failure (403, 429, 5xx, timeout) says nothing about the plan, so
    // the goal is not labelled flexible on its strength.
    return { state: error?.code === "NOT_FOUND" ? "flexible" : "unavailable" };
  }
}

/**
 * Looks up every goal's plan, `concurrency` at a time, reporting each result
 * through `onResult(goalId, summary)` as it arrives. Rejects only on abort.
 */
export async function loadPlanSummaries(
  goalIds,
  { signal, onResult, concurrency = PLAN_LOOKUP_CONCURRENCY } = {},
) {
  const queue = [...goalIds];

  const worker = async () => {
    while (queue.length > 0 && !signal?.aborted) {
      const goalId = queue.shift();
      const summary = await lookupPlanSummary(goalId, { signal });
      if (!signal?.aborted) onResult?.(goalId, summary);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

/*
 * The next open installment of each smart plan among `goals`, soonest first.
 * Plans on hold (paused goal) are left out: nothing is due on them until the
 * goal is resumed.
 */
export function getUpcomingInstallments(goals, summaries, limit = UPCOMING_LIMIT) {
  return goals
    .map((goal) => ({ goal, summary: summaries?.[String(goal.id)] }))
    .filter(
      ({ summary }) => summary?.state === "smart" && summary.executable && summary.nextInstallment,
    )
    .map(({ goal, summary }) => ({ goal, installment: summary.nextInstallment }))
    .sort(
      (left, right) =>
        left.installment.date.localeCompare(right.installment.date) ||
        Number(left.goal.id) - Number(right.goal.id),
    )
    .slice(0, limit);
}
