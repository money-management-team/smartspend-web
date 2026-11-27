import { isRecord } from "./values.js";

/*
 * Getting started: four things a new SmartSpend needs, each worked out from a read the app already makes, the same
 * four checks the full version's Getting Started makes (Experience/GettingStarted.jsx):
 *
 *   account       GET /accounts                         an active account that is not a savings goal's own, in this workspace
 *   transaction   GET /dashboard?period=all             recent_transactions is not empty, for this workspace
 *   budget        GET /budgets?per_page=1&page=1        the paginator's total is above zero
 *   goal          GET /savings-goals?per_page=1&page=1  the paginator's total is above zero
 *
 * A step is `true` (the read says it is done), `false` (the read says it is not), or `null` (the read failed or its
 * answer did not hold together: not known). Nothing is ever shown as done that was not read as done, and nothing is
 * stored: it is worked out again from the backend each time. Pure, so the rules are tested without a browser.
 */

export const SETUP_STEPS = Object.freeze(["account", "transaction", "budget", "goal"]);

const invalid = () => Object.assign(new Error("Setup data could not be validated."), { code: "MALFORMED_RESPONSE" });

/** GET /accounts: an active account of this workspace that is not a savings goal's own. */
export function hasAccount(data, workspaceId) {
  const rows = isRecord(data) ? data.accounts : null;
  if (!Array.isArray(rows)) throw invalid();
  return rows.some((row) => isRecord(row) && String(row.workspace_id) === String(workspaceId) && row.status === "active" && !row.savings_goal);
}

/** GET /dashboard?period=all: some recent transaction, and the answer is about this workspace. */
export function hasTransactions(data, workspaceId) {
  if (!isRecord(data) || !Array.isArray(data.recent_transactions) || String(data.scope?.workspace_id) !== String(workspaceId)) throw invalid();
  return data.recent_transactions.length > 0;
}

/** A list read with per_page=1 (the whole envelope): the paginator's own total says whether any exist. */
export function hasListTotal(response, key) {
  const total = isRecord(response) && isRecord(response.data) && isRecord(response.data[key]) ? response.data[key].total : null;
  if (!Number.isSafeInteger(total) || total < 0) throw invalid();
  return total > 0;
}

/** One step's state from its resource: null while unknown (not loaded, failed, or malformed). */
export function stepState(resource, read) {
  if (resource.status === "error" || resource.data === undefined) return null;
  try {
    return read(resource.data);
  } catch {
    return null;
  }
}

/**
 * The summary of the states: how many are done, how many could not be checked, and the percentage (whole numbers
 * of a whole number of steps, so no rounding). `confirmed` is true only when every step was read.
 */
export function summarize(states) {
  const total = states.length;
  const done = states.filter((state) => state === true).length;
  const unknown = states.filter((state) => state === null).length;
  return { total, done, unknown, confirmed: unknown === 0, complete: done === total, percent: total === 0 ? "0" : String((done * 100) / total) };
}
