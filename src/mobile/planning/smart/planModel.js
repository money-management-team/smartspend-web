import { isCurrencyCode, parseDecimal } from "../../money/decimal.js";
import { dateOnlyOrNull, idText, isRecord, textOrNull } from "../../models/values.js";

/*
 * A Smart Savings plan, its history, its options and an installment's confirmation preview,
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

// The plan statuses and endings the history shows (the full version's planHistoryHelpers PLAN_STATUSES / CLOSED_REASONS).
export const HISTORY_STATUSES = Object.freeze(["active", "completed", "discontinued", "superseded"]);
const CLOSED_REASONS = Object.freeze(["plan_superseded", "plan_discontinued", "goal_archived", "goal_achieved"]);
const moment = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : null);
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

/*
 * One page of `data.savings_plans` (GET …/plans, a Laravel paginator) for this goal: `{ rows, total, page,
 * lastPage }`. It throws (a malformed answer) when the shape is wrong, the full version's readPlanHistory rule;
 * a row of another goal, or with a status the history doesn't know, is dropped. Each plan's figures are the
 * plan's own (what it agreed, how many installments were confirmed), never the goal's balance;
 * `financial_summary` is not shown, so nothing here depends on its attribution.
 */
export function buildPlanHistoryPage(data, goalId) {
  const page = isRecord(data) ? data.savings_plans : null;
  if (!isRecord(page) || !Array.isArray(page.data)) {
    throw Object.assign(new Error("Not a page of plans."), { code: "MALFORMED_RESPONSE" });
  }

  const rows = page.data.filter((plan) => isRecord(plan) && idText(plan.id) && idText(plan.savings_goal_id) === String(goalId) && HISTORY_STATUSES.includes(plan.status)).map((plan) => {
    const summary = isRecord(plan.installments_summary) ? plan.installments_summary : {};
    return {
      id: idText(plan.id),
      status: plan.status,
      planVersion: int(plan.plan_version),
      intensity: word(plan.intensity),
      frequency: word(plan.frequency),
      interval: int(plan.interval),
      installmentAmount: money(plan.installment_amount),
      startDate: dateOnlyOrNull(plan.start_date),
      lastDate: dateOnlyOrNull(plan.expected_completion_date),
      acceptedAt: moment(plan.accepted_at),
      endedAt: plan.status === "active" ? null : moment(plan.completed_at ?? plan.discontinued_at ?? plan.superseded_at),
      ending: plan.status === "active" ? null : CLOSED_REASONS.includes(plan.closed_reason) ? plan.closed_reason : plan.status,
      fulfilled: count(summary.fulfilled),
      total: count(summary.total),
    };
  });
  return { rows, total: count(page.total) ?? rows.length, page: int(page.current_page) ?? 1, lastPage: int(page.last_page) ?? 1 };
}

/*
 * One page of GET …/plans/{plan}/installments for this plan: `{ rows, total, page, lastPage }`. It throws (a
 * malformed answer) when the page is not this plan's or has no rows array, the full version's readPlanInstallments
 * rule; a row of another plan is dropped. `state` is the full version's getInstallmentState: a confirmed installment
 * with part of its payment reversed reads "partially_reversed". Every amount is the backend's own string.
 */
export function buildPlanInstallmentsPage(data, planId) {
  const plan = isRecord(data) ? data.savings_plan : null;
  const page = isRecord(data) ? data.installments : null;
  if (!isRecord(plan) || idText(plan.id) !== String(planId) || !isRecord(page) || !Array.isArray(page.data)) {
    throw Object.assign(new Error("Not this plan's installments."), { code: "MALFORMED_RESPONSE" });
  }
  const rows = page.data.filter((raw) => isRecord(raw) && idText(raw.savings_plan_id) === String(planId)).map((raw) => {
    const base = normalizeInstallment(raw);
    if (!base) return null;
    const state = raw.status === "fulfilled" && raw.reversal_state === "partially_reversed" ? "partially_reversed" : base.status;
    return {
      ...base,
      scheduled: money(raw.amount),
      state,
      confirmed: money(raw.effective_amount ?? raw.fulfilled_amount),
      reason: CLOSED_REASONS.includes(raw.resolution_reason) ? raw.resolution_reason : null,
      // Its payments can be read (GET …/funding-legs): a split payment (the full version's isMultiAccountInstallment:
      // confirmed, no single goal movement), and only for the plan's owner (`can_manage`; anyone else gets a 403).
      payments: raw.status === "fulfilled" && raw.fulfilled_goal_movement_id == null && plan.can_manage === true,
    };
  }).filter(Boolean);
  return { rows, total: count(page.total) ?? rows.length, page: int(page.current_page) ?? 1, lastPage: int(page.last_page) ?? 1 };
}

/*
 * GET …/funding-legs for this installment: `{ current, history }`, each a confirmation `{ key, confirmedAt, legs }`
 * and each leg `{ key, account, amount, currency, effective, reversedAt }`. It throws (a malformed answer) when the
 * response is about another installment or has no history list, the full version's readFundingLegs rule. Only what
 * is shown is kept: the account's name (never its id), the leg's own amount and whether it was reversed. Transfer
 * and movement ids and the `reversal` block are dropped. Nothing is added up: the installment's own amounts are
 * on its row.
 */
export function buildFundingLegs(data, installmentId) {
  if (!isRecord(data) || idText(data.installment?.id) !== String(installmentId) || !Array.isArray(data.history)) {
    throw Object.assign(new Error("Not this installment's payments."), { code: "MALFORMED_RESPONSE" });
  }
  const legsOf = (cycle) => (Array.isArray(cycle.funding_legs) ? cycle.funding_legs : []).filter(isRecord).map((leg, index) => ({
    key: idText(leg.id) ?? `leg-${index}`,
    account: textOrNull(leg.account_name, 80),
    amount: money(leg.amount),
    currency: isCurrencyCode(leg.currency_code) ? leg.currency_code : null,
    effective: leg.is_effective === true,
    reversedAt: moment(leg.reversed_at),
  }));
  const cycleOf = (cycle, index) => ({ key: int(cycle.confirmation_version) ?? `cycle-${index}`, confirmedAt: moment(cycle.confirmed_at), legs: legsOf(cycle) });
  return {
    current: isRecord(data.current_confirmation) ? cycleOf(data.current_confirmation, 0) : null,
    history: data.history.filter(isRecord).map(cycleOf),
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

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isCalendarDay = (value) => CALENDAR_DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** What is wrong with a postponement date against its bounds ("required" | "date" | "bounds"), or null. */
export function postponeDateError(date, bounds) {
  if (!date) return "required";
  if (!isCalendarDay(date)) return "date";
  if (!bounds.available || (bounds.min && date < bounds.min) || (bounds.max && date > bounds.max)) return "bounds";
  return null;
}

export const POSTPONE_REASON_MAX = 500;

/*
 * The write of a postponement, exactly as the review showed it, or `{ problem }` and nothing to send:
 *   "notOpen"   the installment is not open (status `planned`)
 *   "versions"  the plan or the installment has no version to name (so the backend could not check what was reviewed)
 *   "date"      the date is missing, not a day, or outside the bounds (postponeBounds)
 *   "reason"    the reason is longer than 500 characters
 * The versions are the ones read with the plan, never a default. The reason is trimmed and left out when empty.
 */
export function buildPostponeWrite({ goalId, installment, planVersion, date, reason, bounds }) {
  if (!installment?.open) return { problem: "notOpen" };
  if (!Number.isSafeInteger(planVersion) || !Number.isSafeInteger(installment.lockVersion)) return { problem: "versions" };
  if (postponeDateError(date, bounds)) return { problem: "date" };
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length > POSTPONE_REASON_MAX) return { problem: "reason" };
  return {
    write: {
      operation: "installment.postpone",
      ids: { goalId: String(goalId), installmentId: String(installment.id) },
      input: { expected_plan_version: planVersion, expected_lock_version: installment.lockVersion, new_date: date, ...(text ? { reason: text } : {}) },
    },
  };
}

/*
 * Coded 409s of a postponement that the backend raises before it changes anything (the full version's
 * classifyPlanWriteError and its error codes). Any other 409, with or without a code, is an unknown outcome.
 */
export const POSTPONE_DATE_CODES = Object.freeze(["savings_installment_beyond_target_date", "savings_installment_schedule_conflict"]);
export const POSTPONE_LIMIT_CODES = Object.freeze(["savings_installment_postpone_limit_reached"]);
export const POSTPONE_STALE_CODES = Object.freeze([
  "savings_plan_version_conflict",
  "savings_installment_version_conflict",
  "savings_installment_not_open",
  "savings_installment_not_in_active_plan",
  "savings_plan_not_active",
  "savings_goal_not_active",
]);
export const POSTPONE_CERTAIN_409 = Object.freeze(new Set([...POSTPONE_DATE_CODES, ...POSTPONE_LIMIT_CODES, ...POSTPONE_STALE_CODES]));

/** A certain refusal after which the review is about a state that no longer exists: the plan is read again. */
export const isStalePostpone = (outcome) => outcome?.code === "NOT_FOUND" || POSTPONE_STALE_CODES.includes(outcome?.error?.serverCode);

const dayIn = (value) => (typeof value === "string" && CALENDAR_DAY.test(value.slice(0, 10)) ? value.slice(0, 10) : null);

/*
 * What a postponement's outcome (forms/useWorkflowSubmit.js state) means for the person: `{ key, values, blocked }`.
 * `blocked`: nothing more may be sent from this review (a new review, after the plan is read again, is needed).
 * Only codes decide; no message text is read.
 */
export function describePostpone(state) {
  const error = state.error;
  switch (state.phase) {
    case "confirmed": {
      const date = dayIn(state.data?.installment?.planned_date);
      return { key: date ? "done" : "doneNoDate", values: { date }, blocked: true };
    }
    case "unknown":
      return { key: "unknown", values: {}, blocked: true };
    case "changed":
      return { key: "changed", values: {}, blocked: true };
    case "rejected": {
      const code = error?.serverCode;
      if (state.code === "CONFLICT" && POSTPONE_DATE_CODES.includes(code)) return { key: "date", values: { date: dayIn(error?.payload?.latest_allowed_date ?? error?.payload?.target_date) }, blocked: false };
      if (state.code === "CONFLICT" && POSTPONE_LIMIT_CODES.includes(code)) return { key: "limit", values: {}, blocked: true };
      if (isStalePostpone({ code: state.code, error })) return { key: "stale", values: {}, blocked: true };
      if (state.code === "VALIDATION_ERROR") return { key: "invalid", values: {}, blocked: false };
      if (state.code === "FORBIDDEN") return { key: "forbidden", values: {}, blocked: true };
      if (state.code === "RATE_LIMITED") return { key: "rateLimited", values: {}, blocked: false };
      if (state.code === "WRITE_CLOSED") return { key: "closed", values: {}, blocked: true };
      if (state.code === "STORAGE_UNAVAILABLE") return { key: "storage", values: {}, blocked: false };
      return { key: "rejected", values: {}, blocked: true };
    }
    default:
      return null;
  }
}
