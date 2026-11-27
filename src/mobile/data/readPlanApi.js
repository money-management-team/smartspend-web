import { savingsPlansApi } from "../../features/Dashboards/User/api/savingsPlansApi.js";

/*
 * The Smart Savings requests Mobile can make. All six are GETs:
 *
 *   GET /savings-goals/{id}/plan            the goal's active plan: installments, health, versions
 *   GET /savings-goals/{id}/plans           every plan the goal has had (first page), once asked for
 *   GET /savings-goals/{id}/plans/{plan}/installments
 *                                           an earlier plan's installments, page by page, once opened
 *   GET /savings-goals/{id}/planned-contributions/{iid}/funding-legs
 *                                           a split installment's payments, once opened (owner only)
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

/*
 * GET /savings-goals/{id}/plans: every plan the goal has had, newest first (docs/savings-goals/plan-management.md,
 * "Plan history"). Read only. Mobile reads the first page once the person asks for it, and a next page only when
 * "Show more" is pressed (`page` from 2).
 */
export const PLAN_HISTORY_PER_PAGE = 10;
export const readPlanHistory = (goalId, page, signal) =>
  savingsPlansApi.listHistory(goalId, { per_page: PLAN_HISTORY_PER_PAGE, ...(page > 1 ? { page } : {}) }, { signal });

/*
 * GET /savings-goals/{id}/plans/{plan}/installments: one earlier plan's installments in schedule order, a page at a
 * time (docs/savings-goals/plan-management.md, F5.2). Read only; Mobile asks for it only when a plan is opened and
 * for a next page only when "Show more" is pressed.
 */
/*
 * GET /savings-goals/{id}/planned-contributions/{installment}/funding-legs: the payments behind one split
 * installment (docs/savings-goals/api.md). Read only and owner only (403 otherwise). Mobile asks for it only when
 * the person opens an installment's payments, and shows the accounts and amounts; it never uses the response's
 * `reversal` block (eligibility, leg ids, lock version), which only the full version's reversal needs.
 */
export const readFundingLegs = (goalId, installmentId, signal) => savingsPlansApi.getFundingLegs(goalId, installmentId, { signal });

export const PLAN_INSTALLMENTS_PER_PAGE = 10;
export const readPlanInstallments = (goalId, planId, page, signal) =>
  savingsPlansApi.listPlanInstallments(goalId, planId, { per_page: PLAN_INSTALLMENTS_PER_PAGE, ...(page > 1 ? { page } : {}) }, { signal });
