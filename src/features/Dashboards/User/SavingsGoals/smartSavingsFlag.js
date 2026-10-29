/*
 * Smart savings plans are unreleased: everything about them (plan lookups,
 * the plan panel, plan creation and its routes) is on only when the build
 * sets VITE_SMART_SAVINGS_ENABLED=true. Kept free of imports so the route
 * table can read it without pulling the feature into the main bundle.
 */
export const SMART_SAVINGS_ENABLED = import.meta.env.VITE_SMART_SAVINGS_ENABLED === "true";
