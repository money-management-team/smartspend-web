import { savingsPlansApi } from "../../features/Dashboards/User/api/savingsPlansApi.js";

/*
 * The Smart Savings requests Mobile can make. All three are GETs:
 *
 *   GET /savings-goals/{id}/plan            the goal's active plan: installments, health, versions
 *   GET /savings-goals/{id}/plan-options    options for a goal with no plan (frequency, interval)
 *   GET /savings-goals/{id}/planned-contributions/{iid}/confirmation-preview
 *                                           what confirming one installment would move; moves nothing
 *
 * They are in their own file, away from data/readApi.js, because Smart Savings
 * is unreleased and ships only in a build with VITE_SMART_SAVINGS_ENABLED=true.
 * Only the plan section (planning/SmartPlanSection.jsx and planning/smart/)
 * imports this, and that section is loaded behind the flag
 * (planning/smartSavingsGate.js), so a build without the flag has no code that
 * can ask for a plan (tests/mobileBundle.test.mjs checks the built bundles).
 *
 * The wrapper also holds confirm, postpone, skip, create, revise and the
 * funding writes; none of them is named here. A goal with no active plan
 * answers 404, which the section reads as "no plan".
 */
export const readGoalPlan = (goalId, signal) => savingsPlansApi.getActive(goalId, { signal });

// Only the documented schedule parameters: frequency and interval (docs/savings-goals/smart-plans.md, F3).
export const readPlanOptions = (goalId, { frequency, interval }, signal) => savingsPlansApi.getOptions(goalId, { frequency, interval }, { signal });

export const readConfirmationPreview = (goalId, installmentId, signal) => savingsPlansApi.getConfirmationPreview(goalId, installmentId, { signal });
