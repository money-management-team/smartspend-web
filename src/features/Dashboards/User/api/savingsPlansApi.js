import { apiRequest, toMoneyString } from "./apiClient";

const goalPath = (goalId) => `/savings-goals/${encodeURIComponent(goalId)}`;
const installmentPath = (goalId, installmentId) =>
  `${goalPath(goalId)}/planned-contributions/${encodeURIComponent(installmentId)}`;

// Fields each installment write may carry. Versions pin the plan and the
// installment the user reviewed: anything changed since is a 409, never a
// write against a different state.
const WRITE_FIELDS = {
  confirm: ["expected_plan_version", "expected_lock_version", "from_account_id", "amount"],
  postpone: ["expected_plan_version", "expected_lock_version", "new_date", "reason"],
  skip: ["expected_plan_version", "expected_lock_version", "reason"],
};

function pickBody(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined && payload[field] !== "") body[field] = payload[field];
  });

  // Exactly the amount the preview showed, as a 4-decimal string.
  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);

  return body;
}

// Every installment write requires an Idempotency-Key: an identical retry
// reuses it and the backend replays the stored result.
function writeInstallment(goalId, installmentId, action, payload, idempotencyKey) {
  if (!idempotencyKey) {
    throw new Error(`POST …/planned-contributions/{id}/${action} requires an Idempotency-Key.`);
  }

  return apiRequest(`${installmentPath(goalId, installmentId)}/${action}`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: pickBody(payload, WRITE_FIELDS[action]),
  });
}

/*
 * Smart savings plans (backend `feature/savings-reversal-integrity`). A goal
 * without an active plan is flexible saving; a goal with one is a smart plan.
 * A plan is intent, not money: it holds no balance, and nothing moves until
 * the owner confirms an installment.
 *
 * Envelopes:
 * - getActive → `data.savings_goal`, `data.balance` (saved / remaining from
 *   the ledger), `data.savings_plan` (with `next_installment` and
 *   `installments`) and `data.plan_health`. 404 when the goal has no active
 *   plan, which is how a flexible goal is told apart.
 * - getConfirmationPreview → `data.confirmation` (confirmable, blocker,
 *   warnings, versions, suggested_amount, accounts with balances). Read only.
 * - confirm → `data.contribution`, `data.installment`, `data.savings_goal`,
 *   `data.balance`, `data.savings_plan` (id, status, plan_version),
 *   `data.plan_health` (201). Moves money.
 * - postpone / skip → `data.installment`, `data.result` (`money_moved:
 *   false`), `data.balance`, `data.savings_plan`, `data.plan_health`.
 *
 * Conflicts are 409 with the backend's `code` in `ApiError.serverCode` and
 * its context (e.g. `latest_allowed_date`) in `ApiError.payload`.
 */
export const savingsPlansApi = {
  getActive: (goalId, options = {}) =>
    apiRequest(`${goalPath(goalId)}/plan`, { signal: options.signal }),

  getConfirmationPreview: (goalId, installmentId, options = {}) =>
    apiRequest(`${installmentPath(goalId, installmentId)}/confirmation-preview`, {
      signal: options.signal,
    }),

  // Moves `amount` from `from_account_id` into the goal: one transfer.
  confirm: (goalId, installmentId, payload, idempotencyKey) =>
    writeInstallment(goalId, installmentId, "confirm", payload, idempotencyKey),

  // Moves this installment's date only. No money.
  postpone: (goalId, installmentId, payload, idempotencyKey) =>
    writeInstallment(goalId, installmentId, "postpone", payload, idempotencyKey),

  // Marks this installment skipped. No money; the target is unchanged.
  skip: (goalId, installmentId, payload, idempotencyKey) =>
    writeInstallment(goalId, installmentId, "skip", payload, idempotencyKey),
};
