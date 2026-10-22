import { getDisplayLocale } from "../Accounts/accountHelpers";
import { getApiErrorMessage } from "../api/apiClient";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import { formatDate, subtractMoney, sumMoney } from "../utils/formatters";

/*
 * Pure helpers for the smart plan on a goal's page. Every amount and date is
 * the backend's own string: nothing here adds, subtracts or rounds money.
 * Dates are only compared or stepped by whole days (Y-m-d strings).
 */

export const INSTALLMENT_STATES = [
  "overdue",
  "planned",
  "fulfilled",
  "partially_reversed",
  "skipped",
  "missed",
  "cancelled",
];
export const FUNDING_MODES = ["single", "priority", "allocated", "at_confirmation"];
export const HEALTH_REASONS = [
  "overdue_installments",
  "ahead_of_schedule",
  "behind_schedule",
  "skipped_installments",
];
export const CONFIRM_WARNINGS = [
  "installment_overdue",
  "amount_limited_to_remaining",
  "no_eligible_account",
  "insufficient_balance",
];
// Open installments shown before "Show all".
export const OPEN_ROWS_PREVIEW = 4;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const isDateOnly = (value) => typeof value === "string" && DATE_ONLY.test(value);

/* ---------- Response ---------- */

/**
 * `{ plan, health, balance }` from GET …/plan, or null when the response is
 * not this goal's active plan (treated as malformed, never patched).
 */
export function readPlanResponse(data, goalId) {
  const plan = data?.savings_plan;

  if (
    !plan ||
    plan.status !== "active" ||
    String(plan.savings_goal_id) !== String(goalId) ||
    !Array.isArray(plan.installments)
  ) {
    return null;
  }

  return {
    plan,
    health: data.plan_health && typeof data.plan_health === "object" ? data.plan_health : {},
    balance: data.balance && typeof data.balance === "object" ? data.balance : {},
  };
}

/* ---------- Timeline ---------- */

/*
 * The backend counts overdue installments against the workspace's own
 * calendar (`plan_health.overdue.count`). Installments are ordered by
 * sequence and a postponement can't pass the next one, so the overdue ones
 * are the first `count` open installments — no client clock involved.
 */
export function getOverdueInstallmentIds(plan, health) {
  const count = Number(health?.overdue?.count) || 0;

  return new Set(
    (plan?.installments ?? [])
      .filter((installment) => installment.status === "planned")
      .slice(0, count)
      .map((installment) => String(installment.id)),
  );
}

export function getInstallmentState(installment, overdueIds) {
  if (installment.status === "planned") {
    return overdueIds?.has(String(installment.id)) ? "overdue" : "planned";
  }

  if (installment.status === "fulfilled" && installment.reversal_state === "partially_reversed") {
    return "partially_reversed";
  }

  return installment.status;
}

export const isOpenInstallment = (installment) => installment?.status === "planned";

/**
 * Rows to show: every resolved installment plus the first OPEN_ROWS_PREVIEW
 * open ones, unless `showAll`. `hidden` is how many are left out.
 */
export function getVisibleInstallments(installments, showAll) {
  if (showAll) return { rows: installments, hidden: 0 };

  let open = 0;
  const rows = installments.filter((installment) => {
    if (!isOpenInstallment(installment)) return true;
    open += 1;
    return open <= OPEN_ROWS_PREVIEW;
  });

  return { rows, hidden: installments.length - rows.length };
}

/* ---------- Dates ---------- */

/** Today as Y-m-d in `timeZone` (the user's or workspace's), else locally. */
export function todayIn(timeZone, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

export function addDays(dateOnly, days) {
  if (!isDateOnly(dateOnly)) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const earliest = (...dates) => dates.filter(isDateOnly).sort()[0] ?? null;
const latest = (...dates) => dates.filter(isDateOnly).sort().at(-1) ?? null;

/*
 * The dates a postponement may use, as the backend states its rules:
 * today or later, after the current date, before the next installment in
 * sequence (whatever its status) and not past the goal's target date. These
 * bound the date picker; the backend re-checks every one of them.
 */
export function getPostponeBounds({ installment, installments, targetDate, today }) {
  const next = (installments ?? [])
    .filter((other) => Number(other.sequence) > Number(installment.sequence))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence))[0];

  const min = latest(today, addDays(installment.planned_date, 1));
  const beforeNext = next ? addDays(next.planned_date, -1) : null;
  const max = earliest(beforeNext, targetDate);

  return {
    min,
    max,
    nextDate: isDateOnly(next?.planned_date) ? next.planned_date : null,
    targetDate: isDateOnly(targetDate) ? targetDate : null,
    available: !max || !min || min <= max,
  };
}

/* ---------- Confirmation preview ---------- */

/**
 * `data.confirmation` from GET …/confirmation-preview when it is the preview
 * of `installmentId`, else null. The preview is read at one moment; the
 * confirmation re-checks everything under the backend's locks.
 */
export function readConfirmationPreview(confirmation, installmentId) {
  if (
    !confirmation ||
    typeof confirmation !== "object" ||
    String(confirmation.installment?.id) !== String(installmentId) ||
    !Array.isArray(confirmation.accounts)
  ) {
    return null;
  }

  return confirmation;
}

const coversAmount = (account) => account?.covers_suggested_amount === true;

/*
 * The account to preselect: the plan's own (single / priority) when it can
 * pay, else the only account that can. Otherwise none: the user chooses.
 */
export function pickDefaultAccountId(confirmation) {
  const accounts = confirmation?.accounts ?? [];
  const preferred = accounts.find(
    (account) => String(account.id) === String(confirmation?.default_account_id),
  );

  if (coversAmount(preferred)) return preferred.id;

  const covering = accounts.filter(coversAmount);
  return covering.length === 1 ? covering[0].id : null;
}

/** The body POST …/confirm sends: exactly what the preview showed. */
export function buildConfirmPayload(confirmation, accountId) {
  return {
    expected_plan_version: confirmation.savings_plan.plan_version,
    expected_lock_version: confirmation.installment.lock_version,
    from_account_id: Number(accountId),
    amount: confirmation.suggested_amount,
  };
}

/* ---------- Multi-account funding ---------- */

export const MAX_FUNDING_LEGS = 5;
// Breakdown problems the funding preview reports (`funding.problem`).
export const FUNDING_PROBLEMS = [
  "breakdown_required",
  "insufficient_balance",
  "exceeds_remaining",
  "breakdown_invalid",
  "account_not_eligible",
];
// Plans whose installments can be split across accounts by the user.
export const EDITABLE_FUNDING_MODES = ["priority", "at_confirmation"];

const MONEY = /^\d+(\.\d{1,4})?$/;
const isZeroMoney = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "").trim());

/** `data.funding_preview` for `installmentId`, or null. */
export function readFundingPreview(preview, installmentId) {
  if (
    !preview ||
    typeof preview !== "object" ||
    String(preview.installment?.id) !== String(installmentId) ||
    !preview.funding ||
    !Array.isArray(preview.funding.legs) ||
    !Array.isArray(preview.accounts)
  ) {
    return null;
  }

  return preview;
}

/** The legs as the user's editable rows: `{ account_id, amount }` strings. */
export const toDraftLegs = (legs) =>
  (legs ?? []).map((leg) => ({ account_id: String(leg.account_id), amount: String(leg.amount ?? "") }));

/**
 * What the user's own split still needs, exactly: `total − Σ legs` as a
 * 4-decimal string (BigInt minor units, never floats). Null when an amount
 * can't be read.
 */
export function remainingToAllocate(total, legs) {
  if (!MONEY.test(String(total ?? "")) || legs.some((leg) => !MONEY.test(String(leg.amount).trim()))) return null;
  return subtractMoney(total, sumMoney(legs.map((leg) => String(leg.amount).trim())));
}

/*
 * The user's split, checked before asking the backend: an account per leg,
 * no account twice, at most five legs, positive amounts with up to four
 * decimals, adding up to exactly the installment amount. The backend
 * checks balances, eligibility and the plan's rules again.
 */
export function validateDraftLegs(legs, total) {
  if (legs.length === 0) return "legsRequired";
  if (legs.length > MAX_FUNDING_LEGS) return "tooManyLegs";
  if (legs.some((leg) => !leg.account_id)) return "accountRequired";
  if (new Set(legs.map((leg) => String(leg.account_id))).size !== legs.length) return "duplicateAccount";
  if (legs.some((leg) => !MONEY.test(String(leg.amount).trim()) || isZeroMoney(leg.amount))) return "amountInvalid";

  const remaining = remainingToAllocate(total, legs);
  if (remaining === null) return "amountInvalid";
  if (!isZeroMoney(remaining)) return "totalMismatch";

  return null;
}

/** Identifies one requested breakdown: any edit makes its preview stale. */
export const getBreakdownKey = (amount, legs) =>
  JSON.stringify({ amount: amount ?? null, legs: legs ? legs.map((leg) => [String(leg.account_id), String(leg.amount).trim()]) : null });

/**
 * POST …/confirm-accounts: exactly what the preview showed and signed —
 * versions, amount, legs in the order shown, and `confirmation_intent`
 * unchanged.
 */
export function buildConfirmAccountsPayload(preview) {
  return {
    expected_plan_version: preview.savings_plan.plan_version,
    expected_lock_version: preview.installment.lock_version,
    amount: preview.funding.amount,
    legs: preview.funding.legs.map((leg) => ({ account_id: leg.account_id, amount: leg.amount })),
    confirmation_intent: preview.confirmation_intent,
  };
}

/* ---------- Reversal ---------- */

/*
 * A plan installment paid through confirm-accounts has no single goal
 * movement (`fulfilled_goal_movement_id` stays null; its payments are link
 * rows). Only those are reversed through …/reverse-legs; a single-account
 * confirmation keeps the existing transaction reversal.
 */
export const isMultiAccountInstallment = (installment) =>
  installment?.status === "fulfilled" &&
  installment.fulfilled_goal_movement_id == null &&
  installment.savings_plan_id != null;

/** Something left to reverse: a multi-account installment still holding money. */
export const canReverseLegs = (installment) =>
  isMultiAccountInstallment(installment) &&
  installment.effective_amount != null &&
  !isZeroMoney(installment.effective_amount);

/**
 * `data` of GET …/funding-legs for `installmentId`, or null. Each leg
 * carries `selectable`: true only for an effective leg of the current
 * confirmation whose id the backend lists in `reversal.effective_leg_ids`
 * (and only while reversal is eligible). History legs never are.
 */
export function readFundingLegs(data, installmentId) {
  if (
    !data ||
    typeof data !== "object" ||
    String(data.installment?.id) !== String(installmentId) ||
    !data.reversal ||
    !Array.isArray(data.reversal.effective_leg_ids) ||
    !Array.isArray(data.history)
  ) {
    return null;
  }

  const eligible = data.reversal.eligible === true;
  const selectableIds = new Set(eligible ? data.reversal.effective_leg_ids.map(String) : []);
  const current = data.current_confirmation;

  return {
    installment: data.installment,
    reversal: {
      eligible,
      effectiveLegIds: data.reversal.effective_leg_ids,
      lockVersion: data.reversal.expected_lock_version,
    },
    current: current
      ? {
          ...current,
          funding_legs: (current.funding_legs ?? []).map((leg) => ({
            ...leg,
            selectable: leg.is_effective === true && selectableIds.has(String(leg.id)),
          })),
        }
      : null,
    history: data.history.map((cycle) => ({
      ...cycle,
      funding_legs: (cycle.funding_legs ?? []).map((leg) => ({ ...leg, selectable: false })),
    })),
  };
}

export const REVERSAL_REASON_MIN = 3;
export const REVERSAL_REASON_MAX = 500;

/** POST …/reverse-legs: the chosen legs, or all live ones. */
export function buildReversePayload({ reason, lockVersion, legIds }) {
  return {
    reason: reason.trim(),
    expected_lock_version: lockVersion,
    ...(legIds ? { leg_ids: legIds.map(Number) } : { all: true }),
  };
}

/* ---------- Writes ---------- */

// 409s about the date the user chose: the dialog stays as it is and the
// user picks again. Every other 409 means the plan or installment changed.
const DATE_CONFLICTS = [
  "savings_installment_beyond_target_date",
  "savings_installment_schedule_conflict",
];
// 409s that no retry or new date can fix from this dialog.
const FINAL_CONFLICTS = ["savings_installment_postpone_limit_reached"];

/**
 * - "stale": the plan or installment changed (409 version / not open /
 *   goal not active…, or 404): refetch and ask the user to review again;
 * - "input": fix the input and resubmit (422, date 409s);
 * - "unknown": the outcome is unknown (network, timeout, 5xx): an identical
 *   retry reuses the Idempotency-Key, so it can't apply twice;
 * - "final": nothing to retry here (403, 429, postpone limit…).
 */
export function classifyPlanWriteError(error) {
  if (error?.code === "CONFLICT") {
    if (DATE_CONFLICTS.includes(error.serverCode)) return "input";
    if (FINAL_CONFLICTS.includes(error.serverCode)) return "final";
    return "stale";
  }
  if (error?.code === "NOT_FOUND") return "stale";
  if (error?.code === "VALIDATION_ERROR") return "input";
  if (UNKNOWN_OUTCOME_CODES.includes(error?.code)) return "unknown";
  return "final";
}

const WRITE_CONTEXTS = ["confirm", "postpone", "skip", "reverse", "create"];

/** A 409's context value (e.g. `latest_allowed_date`), from the error body. */
export const getConflictContext = (error, key) => error?.payload?.[key] ?? null;

/*
 * Wording for a smart-plan request. Known backend codes get their own
 * translated sentence (the backend's messages are English); 422 keeps the
 * backend's domain message, which is the specific reason.
 */
export function getSmartPlanErrorMessage(error, t, i18n, context = "load") {
  const prefix = "dashboard.savingsGoals.smartPlan.errors";

  if (error?.serverCode && i18n.exists(`${prefix}.codes.${error.serverCode}`)) {
    const date =
      getConflictContext(error, "latest_allowed_date") ?? getConflictContext(error, "target_date");

    return t(`${prefix}.codes.${error.serverCode}`, {
      date: isDateOnly(date) ? formatDate(date, getDisplayLocale(i18n.language)) : "",
      max: getConflictContext(error, "max_postponements") ?? "",
    });
  }

  if (error?.code === "FORBIDDEN") return t(`${prefix}.ownerOnly`);
  if (error?.code === "NOT_FOUND") {
    return t(context === "load" ? `${prefix}.planGone` : `${prefix}.installmentGone`);
  }
  // "Did it go through?" only means something for a write; a failed read
  // (load, preview) falls through to the plain network / server wording.
  if (WRITE_CONTEXTS.includes(context) && UNKNOWN_OUTCOME_CODES.includes(error?.code)) {
    return t(context === "confirm" ? `${prefix}.unknownOutcomeMoney` : `${prefix}.unknownOutcome`);
  }

  return getApiErrorMessage(error, t);
}

/* ---------- Plan health ---------- */

// "0", "0.0000", "-0.00": a zero amount, read from the string itself.
const isZeroAmount = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "0").trim());
const toCount = (value) => Number(value) || 0;

/*
 * What `plan_health` says about the plan, as a short list of signals. Every
 * figure is the backend's; nothing is computed. Informational only: nothing
 * here changes the plan.
 */
export function getHealthSignals(health) {
  if (!health || typeof health !== "object") return [];

  const signals = [];
  const reasons = Array.isArray(health.reasons) ? health.reasons : [];

  if (health.executable === false) signals.push({ key: "onHold", tone: "hold" });

  if (toCount(health.overdue?.count) > 0) {
    signals.push({
      key: "overdue",
      tone: "danger",
      count: toCount(health.overdue.count),
      amount: health.overdue.amount,
      date: health.overdue.oldest_planned_date,
    });
  }

  if (health.target_at_risk === true) {
    signals.push(
      isZeroAmount(health.uncovered_amount)
        ? { key: "endsAfterTarget", tone: "warning", date: health.scheduled_completion_date }
        : { key: "uncovered", tone: "warning", amount: health.uncovered_amount },
    );
  } else if (health.completion_delayed === true) {
    signals.push({ key: "delayed", tone: "info", date: health.scheduled_completion_date });
  }

  if (toCount(health.skipped_count) > 0) {
    signals.push({
      key: "skipped",
      tone: "info",
      count: toCount(health.skipped_count),
      amount: health.skipped_scheduled_amount,
    });
  }

  if (toCount(health.partially_reversed_count) > 0) {
    signals.push({
      key: "partiallyReversed",
      tone: "warning",
      count: toCount(health.partially_reversed_count),
      amount: health.partially_reversed_amount,
    });
  }

  if (reasons.includes("ahead_of_schedule")) signals.push({ key: "ahead", tone: "positive" });

  return signals;
}

/* ---------- Plan facts ---------- */

/** i18n key + count for the plan's rhythm (weekly / monthly × interval). */
export function getFrequencyLabel(plan) {
  const interval = Number(plan?.interval) || 1;
  const frequency = plan?.frequency === "weekly" ? "weekly" : plan?.frequency === "monthly" ? "monthly" : null;

  if (!frequency) return null;

  return interval === 1
    ? { key: `dashboard.savingsGoals.smartPlan.frequency.${frequency}`, count: 1 }
    : { key: `dashboard.savingsGoals.smartPlan.frequency.${frequency}Every`, count: interval };
}

/** Basis points (0–10000) as a percentage string for display, e.g. "60%". */
export function formatAllocation(bps, locale) {
  const value = Number(bps);
  if (bps == null || !Number.isFinite(value)) return null;

  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value / 10000);
}
