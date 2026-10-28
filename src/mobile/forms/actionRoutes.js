import { MOBILE_ADD_ENTRY, MOBILE_PREFIX } from "../navigation.js";

/*
 * The addresses of the Mobile forms, in one place: the route table
 * (routes.jsx), the page title (shell/MobileAppShell.jsx) and the links on the
 * record pages all read this list, so an address cannot exist in one and not
 * in the others. Paths are relative to /m.
 */
export const RECORD_ACTIONS = Object.freeze([
  { path: "activity/:transactionId/correct", workflow: "transaction-correct" },
  { path: "activity/:transactionId/reverse", workflow: "transaction-reverse" },
  { path: "transfers/:transferId/reverse", workflow: "transfer-reverse" },
  { path: "accounts/:accountId/edit", workflow: "account-edit" },
  { path: "accounts/:accountId/archive", workflow: "account-archive" },
  { path: "planning/budgets/:budgetId/edit", workflow: "budget-edit" },
  { path: "planning/goals/:goalId/edit", workflow: "goal-edit" },
  { path: "planning/goals/:goalId/contribute", workflow: "goal-contribute" },
  { path: "planning/goals/:goalId/withdraw", workflow: "goal-withdraw" },
  { path: "planning/goals/:goalId/planned", workflow: "goal-plan" },
  { path: "planning/recurring/:ruleId/edit", workflow: "recurring-edit" },
  { path: "planning/recurring/:ruleId/confirm", workflow: "recurring-confirm" },
  { path: "planning/recurring/:ruleId/skip", workflow: "recurring-skip" },
  { path: "planning/debts/:debtId/edit", workflow: "debt-edit" },
  { path: "planning/debts/:debtId/payment", workflow: "debt-payment" },
  { path: "planning/debts/:debtId/payments/:paymentId/reverse", workflow: "debt-payment-reverse" },
]);

const patternOf = (path) => new RegExp(`^${MOBILE_PREFIX}/${path.replace(/:[A-Za-z]+/g, "[1-9][0-9]{0,14}")}$`);
const MATCHERS = RECORD_ACTIONS.map((action) => ({ ...action, pattern: patternOf(action.path) }));

/** The workflow whose form is at this Mobile address, or null. */
export function workflowAt(pathname) {
  if (pathname.startsWith(`${MOBILE_ADD_ENTRY}/`)) {
    const id = pathname.slice(MOBILE_ADD_ENTRY.length + 1);
    return /^[a-z]+$/.test(id) ? id : null;
  }
  return MATCHERS.find((action) => action.pattern.test(pathname))?.workflow ?? null;
}

/** The address of a workflow's form, with its ids filled in (each URL-encoded). */
export function actionPath(workflow, ids) {
  const action = RECORD_ACTIONS.find((item) => item.workflow === workflow);
  if (!action) throw new Error(`No form address for ${workflow}.`);
  return `${MOBILE_PREFIX}/${action.path.replace(/:([A-Za-z]+)/g, (_, name) => encodeURIComponent(ids[name]))}`;
}

export const newEntryPath = (workflow) => `${MOBILE_ADD_ENTRY}/${encodeURIComponent(workflow)}`;
