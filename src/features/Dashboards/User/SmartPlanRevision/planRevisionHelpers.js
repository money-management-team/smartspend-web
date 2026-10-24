import { canReverseLegs } from "../SavingsGoals/smartPlanHelpers";
import { RHYTHMS, bpsToPercent, buildFundingPayload, buildPlanSelection } from "../SmartPlanWizard/smartPlanWizardHelpers";

/*
 * Pure helpers for revising an active smart plan (PATCH …/plan). Nothing
 * here computes money: amounts are the backend's strings, and a revision
 * sends only the version the user reviewed, the chosen option's
 * fingerprints and the funding — never amounts or installments.
 */

export const REVISION_CHANGES = ["schedule", "funding"];
export const REVISION_STEPS = {
  schedule: ["schedule", "plan", "funding", "review"],
  funding: ["funding", "review"],
};

/** The wizard rhythm matching the plan's frequency × interval, or null. */
export function getPlanRhythm(plan) {
  const interval = Number(plan?.interval) || 1;
  return (
    Object.keys(RHYTHMS).find((key) => RHYTHMS[key].frequency === plan?.frequency && RHYTHMS[key].interval === interval) ??
    null
  );
}

/** The plan's funding as the funding step edits it: sources in priority order. */
export function getPlanFunding(plan) {
  const mode = plan?.funding_mode ?? "single";
  const sources = [...(plan?.funding_sources ?? [])]
    .sort((left, right) => Number(left.priority) - Number(right.priority))
    .map((source) => ({
      account_id: Number(source.account_id),
      percent: mode === "allocated" && source.allocation_bps != null ? bpsToPercent(Number(source.allocation_bps)) : "",
    }));

  return { mode, sources: mode === "at_confirmation" ? [] : sources };
}

/*
 * True when `funding` is exactly the plan's current setup: same mode, same
 * accounts in the same order, same shares. The backend records nothing for
 * such a "change", so the page doesn't offer to send it.
 */
export function isSameFunding(plan, funding) {
  const current = buildFundingPayload(getPlanFunding(plan));
  const next = buildFundingPayload(funding);

  return JSON.stringify(current) === JSON.stringify(next);
}

/** PATCH …/plan, change=schedule: a fresh option, its fingerprints and the funding. */
export function buildScheduleRevision(plan, form, option, funding) {
  return {
    change: "schedule",
    expected_plan_version: plan.plan_version,
    ...buildPlanSelection(form, option, funding),
  };
}

/** PATCH …/plan, change=funding: the funding only; the schedule stays. */
export function buildFundingRevision(plan, funding) {
  return {
    change: "funding",
    expected_plan_version: plan.plan_version,
    funding: buildFundingPayload(funding),
  };
}

/*
 * Installments of the current plan whose payments, split across several
 * accounts, can still be reversed here. A schedule change closes this plan,
 * and the backend doesn't yet list a closed plan's installments, so the
 * review says so before the user approves.
 */
export const countReversibleSplitPayments = (plan) =>
  (plan?.installments ?? []).filter((installment) => canReverseLegs(installment)).length;

/** The plan's next open installment date, if any. */
export const getNextDueDate = (plan) => plan?.next_installment?.planned_date ?? null;

/*
 * Which stage a 422 belongs to (`funding.*` → funding; the option fields →
 * plan; schedule fields → schedule), so the review can send the user back.
 */
export function getRevisionErrorStep(errors, change) {
  const fields = Object.keys(errors ?? {});

  if (fields.some((field) => field.startsWith("funding"))) return "funding";
  if (change !== "schedule") return null;
  if (fields.some((field) => ["intensity", "options_fingerprint", "assessment_fingerprint"].includes(field))) return "plan";
  if (fields.some((field) => ["frequency", "interval", "start_date", "target_date"].includes(field))) return "schedule";
  return null;
}
