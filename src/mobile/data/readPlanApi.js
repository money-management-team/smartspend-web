import { savingsPlansApi } from "../../features/Dashboards/User/api/savingsPlansApi.js";

/*
 * The one Smart Savings request Mobile can make, and it is a GET:
 *
 *   GET /savings-goals/{id}/plan   the goal's active plan: next installment and plan health
 *
 * It is in its own file, away from data/readApi.js, because Smart Savings is
 * unreleased and ships only in a build with VITE_SMART_SAVINGS_ENABLED=true.
 * Only planning/SmartPlanSection.jsx imports this, and that section is loaded
 * behind the flag (planning/smartSavingsGate.js), so a build without the flag
 * has no code that can ask for a plan (tests/mobileSavings.test.mjs checks the
 * built bundles).
 *
 * The wrapper also holds confirm, postpone, skip, create and revise; none of
 * them is named here. A goal with no active plan answers 404, which the section
 * reads as "no plan".
 */
export const readGoalPlan = (goalId, signal) => savingsPlansApi.getActive(goalId, { signal });
