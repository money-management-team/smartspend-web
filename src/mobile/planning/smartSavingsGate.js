import { lazy } from "react";

/*
 * Smart Savings in Mobile is on only when the build switches it on, by the same
 * flag and the same rule as the full version (exactly VITE_SMART_SAVINGS_ENABLED
 * = "true"; the production workflow pins it off). The rule is written out here
 * rather than imported, because Mobile imports nothing from the full version's
 * features folder; tests/mobileSavings.test.mjs keeps the two in step.
 *
 * When it is off this is null: the plan section is never imported (the dynamic
 * import sits in the dead branch and is dropped from the bundle), no plan is
 * requested, and a goal's page shows nothing about plans.
 */
export const MOBILE_SMART_SAVINGS = import.meta.env.VITE_SMART_SAVINGS_ENABLED === "true";

export const SmartPlanSection = MOBILE_SMART_SAVINGS ? lazy(() => import("./SmartPlanSection.jsx")) : null;
