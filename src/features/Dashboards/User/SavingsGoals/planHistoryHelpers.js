import { isDateOnly } from "./smartPlanHelpers";

/*
 * Pure helpers for a goal's plan history (GET /savings-goals/{id}/plans).
 * Every amount is the backend's own string and is only displayed; dates are
 * compared or counted by whole days. Nothing here reads the goal's ledger:
 * a plan's figures describe the plan, never the goal's current balance.
 */

export const PLAN_STATUSES = ["active", "completed", "discontinued", "superseded"];
export const CLOSED_REASONS = ["plan_superseded", "plan_discontinued", "goal_archived", "goal_achieved"];
export const HISTORY_PAGE_SIZE = 5;

/**
 * `{ plans, page, lastPage, total }` from `data.savings_plans` (a Laravel
 * paginator), keeping only this goal's plans; null when the shape is wrong.
 */
export function readPlanHistory(data, goalId) {
  const page = data?.savings_plans;
  if (!page || typeof page !== "object" || !Array.isArray(page.data)) return null;

  return {
    plans: page.data.filter(
      (plan) => plan && String(plan.savings_goal_id) === String(goalId) && PLAN_STATUSES.includes(plan.status),
    ),
    page: Number(page.current_page) || 1,
    lastPage: Number(page.last_page) || 1,
    total: Number(page.total) || 0,
  };
}

/** Older pages appended after the ones shown, without repeating a plan. */
export function appendPlans(shown, next) {
  const ids = new Set(shown.map((plan) => String(plan.id)));
  return [...shown, ...next.filter((plan) => !ids.has(String(plan.id)))];
}

/** When the plan stopped being active, as the backend recorded it. */
export const getPlanEndedAt = (plan) =>
  plan?.completed_at ?? plan?.discontinued_at ?? plan?.superseded_at ?? null;

/** An ISO timestamp as Y-m-d on `timeZone`'s calendar (else locally). */
export function toDateIn(timestamp, timeZone) {
  if (isDateOnly(timestamp)) return timestamp;

  const date = new Date(timestamp ?? "");
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(date);
  }
}

/** Whole days from `from` to `to` (both Y-m-d); positive when `to` is later. */
export function daysBetween(from, to) {
  if (!isDateOnly(from) || !isDateOnly(to)) return null;

  const toUtc = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/*
 * How a completed plan finished against its own schedule: the day it was
 * completed (on the user's calendar) beside the last installment date it
 * planned. `verdict` is "early", "onTime" or "late"; `days` is how many.
 * Completion is when the goal reached its target (by an installment or any
 * other contribution), so a plan can finish before its schedule does.
 */
export function getCompletionPerformance(plan, timeZone) {
  if (plan?.status !== "completed") return null;

  const completedOn = toDateIn(plan.completed_at, timeZone);
  const plannedOn = isDateOnly(plan.expected_completion_date) ? plan.expected_completion_date : null;
  const difference = daysBetween(completedOn, plannedOn);

  if (completedOn == null) return null;
  if (difference == null) return { completedOn, plannedOn, verdict: null, days: 0 };

  return {
    completedOn,
    plannedOn,
    verdict: difference > 0 ? "early" : difference < 0 ? "late" : "onTime",
    days: Math.abs(difference),
  };
}

/** Confirmed installments as a share of the plan's installments (0–100), by count. */
export function getInstallmentShare(summary) {
  const total = Number(summary?.total) || 0;
  const fulfilled = Number(summary?.fulfilled) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((fulfilled / total) * 100));
}

/** The i18n key for how the plan ended, from its status and `closed_reason`. */
export function getEndingKey(plan) {
  if (plan?.status === "active") return null;
  if (CLOSED_REASONS.includes(plan?.closed_reason)) return plan.closed_reason;
  return plan?.status ?? null;
}
