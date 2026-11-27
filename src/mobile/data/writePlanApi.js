import { savingsPlansApi } from "../../features/Dashboards/User/api/savingsPlansApi.js";
import { MOBILE_WRITES, assertWriteOpen } from "./writeGate.js";

/*
 * The Smart Savings writes Mobile has code for, in their own file like the plan reads (data/readPlanApi.js): only
 * planning/smart/InstallmentReview.jsx imports it, and that is loaded behind the Smart Savings flag, so a build
 * without the flag has no Smart Savings send path (tests/mobileBundle.test.mjs). Every one is CLOSED by
 * data/writeGate.js: the gate is checked before anything else and throws WriteClosedError without sending.
 *
 *   installment.postpone   POST /savings-goals/{id}/planned-contributions/{iid}/postpone
 *                          input: expected_plan_version, expected_lock_version, new_date, reason? (the wrapper
 *                          sends those fields only); the submission's key is required.
 *
 * Writes come from forms/useWorkflowSubmit.js (one key per submission intent, kept across a reload), which calls
 * sendPlanWrite in place of the general facade's sendWorkflowWrite.
 */
const SENDERS = {
  "installment.postpone": ({ ids, input }, key) => savingsPlansApi.postpone(ids.goalId, ids.installmentId, input, key),
};

export const PLAN_SENDABLE_OPERATIONS = Object.freeze(Object.keys(SENDERS));

export function sendPlanWrite(write, key) {
  assertWriteOpen(write.operation);
  const send = SENDERS[write.operation];
  if (!send) throw new Error(`Mobile has no send path for ${write.operation}.`);
  if (MOBILE_WRITES[write.operation].key === "client" && !key) throw new Error(`${MOBILE_WRITES[write.operation].endpoint} needs the submission's key.`);
  return send(write, key);
}
