import { toMoneyString } from "../api/apiClient";
import { getAmountError } from "../FinancialOperations/transactionHelpers";
import { NAME_MAX, NOTES_MAX } from "../SavingsGoals/savingsGoalHelpers";

/*
 * Pure helpers for the smart plan wizard. Amounts stay strings: nothing here
 * adds, scales or rounds money. Allocations are whole basis points
 * (integers, 10000 = 100 %), parsed from the typed percentage with string
 * operations.
 */

export const STEPS = ["goal", "plan", "funding", "review"];
export const FUNDING_MODES = ["single", "priority", "allocated", "at_confirmation"];
export const MAX_SOURCES = 5;
export const TOTAL_BPS = 10000;

// How often installments fall due: the backend's frequency × interval.
export const RHYTHMS = {
  weekly: { frequency: "weekly", interval: 1 },
  biweekly: { frequency: "weekly", interval: 2 },
  monthly: { frequency: "monthly", interval: 1 },
  quarterly: { frequency: "monthly", interval: 3 },
};

export const AFFORDABILITY_BANDS = ["comfortable", "stretch", "strained", "unaffordable", "unknown"];
export const PROJECTION_STATUSES = [
  "scheduled",
  "already_funded",
  "deadline_before_first_installment",
  "too_many_installments",
  "above_contribution_limit",
];
export const STALE_VERDICTS = ["schedule_changed", "assessment_changed", "unavailable"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

export const emptyGoalForm = () => ({
  name: "",
  target_amount: "",
  currency_code: "ILS",
  target_date: "",
  notes: "",
  rhythm: "monthly",
  start_date: "",
});

/* ---------- Step 1 ---------- */

/**
 * Field → i18n key (under smartPlanWizard.validation) for the goal step.
 * For an existing goal only the schedule fields are the user's.
 */
export function validateGoalStep(form, { existing, today }) {
  const errors = {};

  if (!existing) {
    const name = form.name.trim();
    if (!name) errors.name = "nameRequired";
    else if (name.length > NAME_MAX) errors.name = "nameTooLong";

    const amountError = getAmountError(form.target_amount);
    if (amountError) errors.target_amount = amountError;

    if (!CURRENCY.test(form.currency_code)) errors.currency_code = "currencyRequired";

    if (form.target_date && !DATE.test(form.target_date)) errors.target_date = "dateInvalid";
    else if (form.target_date && form.target_date < today) errors.target_date = "dateInPast";

    if (form.notes.trim().length > NOTES_MAX) errors.notes = "notesTooLong";
  }

  if (!RHYTHMS[form.rhythm]) errors.rhythm = "rhythmRequired";

  if (form.start_date && !DATE.test(form.start_date)) errors.start_date = "dateInvalid";
  else if (form.start_date && form.start_date < today) errors.start_date = "dateInPast";
  else if (!existing && form.start_date && form.target_date && form.target_date < form.start_date) {
    errors.target_date = "targetBeforeStart";
  }

  return errors;
}

/* ---------- Preview ---------- */

/** What the preview (and therefore its fingerprints) depends on. */
export function getPreviewInput(form, { goal, workspaceId }) {
  const { frequency, interval } = RHYTHMS[form.rhythm] ?? RHYTHMS.monthly;
  const schedule = { frequency, interval, ...(form.start_date ? { start_date: form.start_date } : {}) };

  if (goal) return { goalId: goal.id, query: schedule };

  return {
    goalId: null,
    body: {
      workspace_id: workspaceId,
      target_amount: toMoneyString(form.target_amount.trim()),
      currency_code: form.currency_code,
      ...(form.target_date ? { target_date: form.target_date } : {}),
      ...schedule,
    },
  };
}

/*
 * Identifies one preview. Any change to these inputs (or `nonce`, bumped to
 * fetch again after a stale 409) makes the shown options — and the
 * selection made from them — out of date.
 */
export const getPreviewKey = (input, nonce = 0) => JSON.stringify({ ...input, nonce });

/** `data.plan_options` when it has the expected shape, else null. */
export function readPlanOptions(planOptions) {
  if (!planOptions || typeof planOptions !== "object" || !Array.isArray(planOptions.options)) return null;
  return planOptions;
}

/** An option the user may accept: feasible and not a duplicate schedule. */
export const isSelectableOption = (option) =>
  option?.is_feasible === true && !option.duplicate_of && Boolean(option.options_fingerprint);

/* ---------- Funding ---------- */

/**
 * "60" → 6000, "33.35" → 3335, "100" → 10000: a percentage with up to two
 * decimals as whole basis points, without floating point. Null when the
 * text isn't such a number.
 */
export function percentToBps(text) {
  const match = String(text ?? "").trim().match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** 6000 → "60", 3335 → "33.35": basis points as a percentage string. */
export function bpsToPercent(bps) {
  if (!Number.isInteger(bps)) return "";
  const whole = Math.floor(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** Whole basis points across sources; null if any share is unreadable. */
export function totalAllocationBps(sources) {
  let total = 0;
  for (const source of sources) {
    const bps = percentToBps(source.percent);
    if (bps === null) return null;
    total += bps;
  }
  return total;
}

/*
 * The funding shape rules the backend enforces (SavingsPlanFundingRules),
 * checked before sending so the user can fix them in place. Eligibility of
 * each account is still the backend's call.
 */
export function validateFunding(funding) {
  const { mode, sources } = funding;
  const ids = sources.map((source) => String(source.account_id));

  if (!FUNDING_MODES.includes(mode)) return "modeRequired";
  if (mode === "at_confirmation") return null;
  if (new Set(ids).size !== ids.length) return "duplicateAccount";
  if (mode === "single") return sources.length === 1 ? null : "chooseOneAccount";
  if (sources.length < 2) return "chooseTwoAccounts";
  if (sources.length > MAX_SOURCES) return "tooManyAccounts";

  if (mode === "allocated") {
    if (sources.some((source) => {
      const bps = percentToBps(source.percent);
      return bps === null || bps < 1 || bps > TOTAL_BPS;
    })) {
      return "allocationInvalid";
    }
    if (totalAllocationBps(sources) !== TOTAL_BPS) return "allocationTotal";
  }

  return null;
}

/** `funding` as the backend takes it: sources in priority order. */
export function buildFundingPayload(funding) {
  if (funding.mode === "at_confirmation") return { mode: "at_confirmation", sources: [] };

  return {
    mode: funding.mode,
    sources: funding.sources.map((source) => ({
      account_id: Number(source.account_id),
      ...(funding.mode === "allocated" ? { allocation_bps: percentToBps(source.percent) } : {}),
    })),
  };
}

/* ---------- Accept ---------- */

/** The plan selection the create endpoints verify against a fresh preview. */
export function buildPlanSelection(form, option, funding) {
  const { frequency, interval } = RHYTHMS[form.rhythm] ?? RHYTHMS.monthly;

  return {
    intensity: option.intensity,
    frequency,
    interval,
    ...(form.start_date ? { start_date: form.start_date } : {}),
    options_fingerprint: option.options_fingerprint,
    assessment_fingerprint: option.assessment_fingerprint,
    funding: buildFundingPayload(funding),
  };
}

/** POST /savings-goals/with-plan: the goal's fields plus `plan`. */
export function buildCreateWithGoalBody(form, workspaceId, selection) {
  return {
    workspace_id: workspaceId,
    name: form.name.trim(),
    target_amount: toMoneyString(form.target_amount.trim()),
    currency_code: form.currency_code,
    target_date: form.target_date || null,
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    plan: selection,
  };
}

/*
 * Which step a 422 field belongs to, so the review can send the user back
 * to fix it. Plan-selection fields come with or without the `plan.` prefix.
 */
export function getErrorStep(errors) {
  const fields = Object.keys(errors ?? {}).map((field) => field.replace(/^plan\./, ""));

  if (fields.some((field) => field.startsWith("funding"))) return "funding";
  if (fields.some((field) => ["intensity", "options_fingerprint", "assessment_fingerprint"].includes(field))) {
    return "plan";
  }
  if (fields.length > 0) return "goal";
  return null;
}
