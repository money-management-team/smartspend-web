import { isCurrencyCode, parseDecimal } from "../../money/decimal.js";
import { dateOnlyOrNull, idText, isRecord, textOrNull } from "../../models/values.js";

/*
 * A Smart Savings plan, its options and an installment's confirmation preview,
 * as the plan section shows them. Pure. Only in a build with Smart Savings on
 * (this folder is imported only by planning/SmartPlanSection.jsx, which is
 * loaded behind the flag).
 *
 * Every figure is the backend's. Nothing here works out a balance, a remaining
 * amount, a completion date or whether an account can pay: the preview's own
 * `covers_suggested_amount` and `blocker` say that. An installment is "open"
 * only when its status is `planned`, the full version's rule (smartPlanHelpers.js
 * isOpenInstallment); opening a review changes nothing about it.
 */

const money = (value) => (parseDecimal(value) ? String(value) : null);
const int = (value) => (Number.isSafeInteger(value) ? value : null);
const word = (value) => (typeof value === "string" && /^[a-z][a-z0-9_]{0,40}$/.test(value) ? value : null);

export const INSTALLMENT_OPEN = "planned";
// The rhythms the full version offers, as frequency × interval (SmartPlanWizard RHYTHMS).
export const RHYTHMS = Object.freeze({ weekly: { frequency: "weekly", interval: 1 }, biweekly: { frequency: "weekly", interval: 2 }, monthly: { frequency: "monthly", interval: 1 }, quarterly: { frequency: "monthly", interval: 3 } });

function normalizeInstallment(raw) {
  const id = isRecord(raw) ? idText(raw.id) : null;
  if (!id) return null;
  return {
    id,
    sequence: int(raw.sequence),
    date: dateOnlyOrNull(raw.planned_date ?? raw.date),
    originalDate: dateOnlyOrNull(raw.original_planned_date),
    postponedCount: int(raw.postponed_count),
    amount: money(raw.effective_amount ?? raw.amount),
    status: word(raw.status),
    open: raw.status === INSTALLMENT_OPEN,
    overdue: raw.is_overdue === true,
    lockVersion: int(raw.lock_version),
    shortfall: money(raw.shortfall_amount),
    reversed: money(raw.reversed_amount),
  };
}

/** GET /savings-goals/{id}/plan for this goal, or null (another goal, or a plan that is not active). */
export function buildPlanDetail(data, goalId, currency) {
  if (!isRecord(data) || !isRecord(data.savings_plan) || !isRecord(data.savings_goal)) return null;
  const plan = data.savings_plan;
  if (idText(data.savings_goal.id) !== String(goalId)) return null;
  if (plan.savings_goal_id != null && idText(plan.savings_goal_id) !== String(goalId)) return null;
  if (plan.status !== "active") return null;

  const health = isRecord(data.plan_health) ? data.plan_health : {};
  const installments = (Array.isArray(plan.installments) ? plan.installments : []).map(normalizeInstallment).filter(Boolean).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const next = normalizeInstallment(plan.next_installment);

  return {
    id: idText(plan.id),
    currency: isCurrencyCode(currency) ? currency : null,
    planVersion: int(plan.plan_version),
    intensity: word(plan.intensity),
    frequency: word(plan.frequency),
    interval: int(plan.interval),
    installmentAmount: money(plan.installment_amount),
    finalInstallmentAmount: money(plan.final_installment_amount),
    installmentCount: int(plan.installment_count),
    startDate: dateOnlyOrNull(plan.start_date),
    expectedCompletion: dateOnlyOrNull(plan.expected_completion_date),
    scheduledCompletion: dateOnlyOrNull(plan.scheduled_completion_date),
    targetDate: dateOnlyOrNull(data.savings_goal.target_date ?? plan.target_date),
    next,
    installments: installments.length ? installments : next ? [next] : [],
    health: {
      executable: typeof health.executable === "boolean" ? health.executable : null,
      replan: health.replanning_recommended === true,
      outstandingAmount: money(health.outstanding_amount),
      outstandingCount: int(health.outstanding_count),
      overdueCount: int(health.overdue_count),
      atRisk: health.target_at_risk === true,
    },
  };
}

/** `data.plan_options` (GET …/plan-options), or null. An option that isn't feasible, or repeats another, can't be chosen. */
export function buildPlanOptions(data) {
  const block = isRecord(data) ? data.plan_options : null;
  if (!isRecord(block) || !Array.isArray(block.options)) return null;
  return block.options.filter(isRecord).map((option, index) => ({
    key: word(option.intensity) ?? `option-${index}`,
    intensity: word(option.intensity),
    feasible: option.is_feasible === true,
    duplicate: Boolean(option.duplicate_of),
    status: word(option.status),
    installmentAmount: money(option.installment_amount),
    finalInstallmentAmount: money(option.final_installment_amount),
    installmentCount: int(option.installment_count),
    firstDue: dateOnlyOrNull(option.first_due_date),
    completion: dateOnlyOrNull(option.expected_completion_date),
    shortfall: money(option.shortfall_amount),
    affordability: word(option.affordability?.band ?? option.affordability),
  }));
}

/*
 * `data.confirmation` (GET …/confirmation-preview) for this installment, or null:
 * the amount it would move, exactly as sent, and the accounts with the backend's
 * own answer to whether each can pay. A preview about another installment is
 * refused.
 */
export function buildConfirmationPreview(data, installmentId) {
  const preview = isRecord(data) ? data.confirmation : null;
  if (!isRecord(preview) || idText(preview.installment?.id) !== String(installmentId) || !Array.isArray(preview.accounts)) return null;
  return {
    goalName: textOrNull(preview.savings_goal?.name, 150),
    amount: money(preview.suggested_amount),
    date: dateOnlyOrNull(preview.installment?.planned_date),
    planVersion: int(preview.savings_plan?.plan_version),
    lockVersion: int(preview.installment?.lock_version),
    confirmable: preview.confirmable === true,
    blocker: isRecord(preview.blocker) ? { code: word(preview.blocker.code), message: textOrNull(preview.blocker.message, 300) } : null,
    warnings: (Array.isArray(preview.warnings) ? preview.warnings : []).map((item) => textOrNull(typeof item === "string" ? item : item?.message, 300)).filter(Boolean).slice(0, 6),
    defaultAccountId: idText(preview.default_account_id),
    accounts: preview.accounts.filter(isRecord).flatMap((account) => {
      const id = idText(account.id);
      return id ? [{ id, name: textOrNull(account.name, 80), available: money(account.available_balance), covers: account.covers_suggested_amount === true, overdraft: account.allows_overdraft === true }] : [];
    }),
  };
}

/** The account to preselect: the plan's own when it can pay, else the only one that can (the full version's pickDefaultAccountId). */
export function defaultAccount(preview) {
  const preferred = preview.accounts.find((account) => account.id === preview.defaultAccountId);
  if (preferred?.covers) return preferred.id;
  const covering = preview.accounts.filter((account) => account.covers);
  return covering.length === 1 ? covering[0].id : "";
}

const addDays = (day, count) => {
  if (!day) return null;
  const [y, m, d] = day.split("-").map((part) => parseInt(part, 10));
  return new Date(Date.UTC(y, m - 1, d + count)).toISOString().slice(0, 10);
};

/*
 * The dates a postponement may use, as the backend states its rules (the full
 * version's getPostponeBounds): today or later and after the current date,
 * before the next installment in sequence, and not past the goal's target date.
 * The backend re-checks every one of them.
 */
export function postponeBounds(installment, installments, targetDate, today) {
  const next = installments.filter((other) => (other.sequence ?? 0) > (installment.sequence ?? 0)).sort((a, b) => a.sequence - b.sequence)[0];
  const min = [today, addDays(installment.date, 1)].filter(Boolean).sort().at(-1) ?? null;
  const max = [next ? addDays(next.date, -1) : null, targetDate].filter(Boolean).sort()[0] ?? null;
  return { min, max, available: !min || !max || min <= max };
}
