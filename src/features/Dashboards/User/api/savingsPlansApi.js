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
  "confirm-accounts": ["expected_plan_version", "expected_lock_version", "amount", "legs", "confirmation_intent"],
  "reverse-legs": ["expected_lock_version", "reason", "leg_ids", "all"],
};

// Each leg's amount as a 4-decimal string, exactly as previewed.
const toLegs = (legs) =>
  legs.map((leg) => ({ account_id: Number(leg.account_id), amount: toMoneyString(leg.amount) }));

function pickBody(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined && payload[field] !== "") body[field] = payload[field];
  });

  // Exactly the amount the preview showed, as a 4-decimal string.
  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);
  if (Array.isArray(body.legs)) body.legs = toLegs(body.legs);

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
 * - previewProposal / getOptions → `data.plan_options`. Read only.
 * - createWithGoal / createForGoal → 201 with the GET …/plan envelope. A
 *   changed option is 409 `savings_plan_option_stale` with `verdict` and
 *   `current_option` in `ApiError.payload`.
 *
 * Conflicts are 409 with the backend's `code` in `ApiError.serverCode` and
 * its context (e.g. `latest_allowed_date`) in `ApiError.payload`.
 */
// Plan writes (create) carry the reviewed option's fingerprints; the backend
// regenerates the option and rejects anything that no longer matches.
function createPlan(endpoint, body, idempotencyKey) {
  if (!idempotencyKey) throw new Error(`POST ${endpoint} requires an Idempotency-Key.`);

  return apiRequest(endpoint, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body,
  });
}

export const savingsPlansApi = {
  getActive: (goalId, options = {}) =>
    apiRequest(`${goalPath(goalId)}/plan`, { signal: options.signal }),

  /*
   * Easy / Balanced / Intensive for a goal that doesn't exist yet. Read
   * only. Body: workspace_id, target_amount (4-decimal string),
   * currency_code, target_date?, frequency?, interval?, start_date?.
   * → `data.plan_options` ({ goal, schedule, capacity, options[],
   *   recommended_intensity, recommendation_reason, warnings }).
   */
  previewProposal: (body, options = {}) =>
    apiRequest("/savings-plans/preview", {
      method: "POST",
      body: { ...body, target_amount: toMoneyString(body.target_amount) },
      signal: options.signal,
    }),

  // The same options for an existing goal (remaining from its ledger).
  // Query: frequency?, interval?, start_date?, target_date?.
  getOptions: (goalId, query = {}, options = {}) =>
    apiRequest(`${goalPath(goalId)}/plan-options`, { query, signal: options.signal }),

  /*
   * The goal and its accepted plan in one transaction. Body: the goal's
   * fields plus `plan` { intensity, frequency, interval, start_date?,
   * options_fingerprint, assessment_fingerprint, funding { mode,
   * sources[] } }. Same key + same body replays the same goal.
   * → 201, the GET …/plan envelope.
   */
  createWithGoal: (body, idempotencyKey) =>
    createPlan("/savings-goals/with-plan", { ...body, target_amount: toMoneyString(body.target_amount) }, idempotencyKey),

  // A plan for an existing flexible goal (owner only). Body: the `plan`
  // fields above at the top level. → 201, the GET …/plan envelope.
  createForGoal: (goalId, body, idempotencyKey) =>
    createPlan(`${goalPath(goalId)}/plan`, body, idempotencyKey),

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

  /*
   * Read only, owner only: the exact amount from each account. With no
   * body the backend proposes the breakdown (allocated: the plan's shares;
   * priority: filled in the plan's order); `{ amount, legs }` checks the
   * user's own split. → `data.funding_preview`: the confirmation preview's
   * fields plus `funding { amount, legs[], shortfall_amount, problem }` and
   * `confirmation_intent` (only when confirmable). Moves nothing.
   */
  fundingPreview: (goalId, installmentId, body = {}, options = {}) =>
    apiRequest(`${installmentPath(goalId, installmentId)}/funding-preview`, {
      method: "POST",
      body: {
        ...(body.amount !== undefined ? { amount: toMoneyString(body.amount) } : {}),
        ...(Array.isArray(body.legs) ? { legs: toLegs(body.legs) } : {}),
      },
      signal: options.signal,
    }),

  /*
   * Read only, owner only: the payments behind one installment.
   * → `data.installment`, `data.current_confirmation` (the confirmation
   * paying it now, or null) with its `funding_legs`, `data.funding_legs`
   * (the same legs), `data.history` (earlier cycles, newest first, never
   * actionable) and `data.reversal` { eligible, effective_leg_ids,
   * expected_lock_version } — the only ids and the version reverse-legs
   * accepts. 404 outside the user's scope, 403 for another member.
   */
  getFundingLegs: (goalId, installmentId, options = {}) =>
    apiRequest(`${installmentPath(goalId, installmentId)}/funding-legs`, { signal: options.signal }),

  /*
   * Pays one installment from several accounts in one transaction, exactly
   * as previewed: expected versions, amount, legs and the preview's
   * `confirmation_intent`, unchanged. Moves money. → 201 with `installment`,
   * `funding_legs`, `reversal`, `savings_goal`, `balance`, `plan_health`.
   */
  confirmAccounts: (goalId, installmentId, payload, idempotencyKey) =>
    writeInstallment(goalId, installmentId, "confirm-accounts", payload, idempotencyKey),

  /*
   * Reverses the named payments (`leg_ids`) or every live one (`all: true`)
   * of a multi-account installment, all or nothing. Needs `reason` and the
   * installment's `expected_lock_version`. Moves money back to the source
   * accounts. → the same envelope as confirmAccounts plus
   * `previously_effective_amount`.
   */
  reverseLegs: (goalId, installmentId, payload, idempotencyKey) =>
    writeInstallment(goalId, installmentId, "reverse-legs", payload, idempotencyKey),
};
