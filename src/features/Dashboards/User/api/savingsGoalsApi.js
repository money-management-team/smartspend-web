import { apiRequest, toMoneyString } from "./apiClient";

const goalPath = (goalId) => `/savings-goals/${encodeURIComponent(goalId)}`;

// Fields each write may carry. `user_id`, `account_id` and `status` are never
// sent: the owner comes from the token, the backend creates the goal's own
// savings account, and the lifecycle status is the backend's to decide. An
// update never sends `workspace_id` or `currency_code` either; they are fixed
// once the goal (and its account) exists.
const CREATE_FIELDS = [
  "workspace_id",
  "name",
  "target_amount",
  "currency_code",
  "target_date",
  "notes",
  "metadata",
];
const UPDATE_FIELDS = ["name", "target_amount", "target_date", "notes", "metadata"];
const MOVEMENT_FIELDS = {
  contribution: ["from_account_id", "amount", "description", "occurred_at"],
  withdrawal: ["to_account_id", "amount", "description", "occurred_at"],
};

// Keeps only the allowed fields that are present; money travels as a
// 4-decimal string and is never parsed into a float.
function pickPayload(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined) body[field] = payload[field];
  });

  if (body.target_amount !== undefined) body.target_amount = toMoneyString(body.target_amount);
  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);

  return body;
}

// Contributions and withdrawals are real transfers between the goal's savings
// account and another account, so both require an Idempotency-Key: a retry of
// the same submission reuses its key and the backend replays the stored
// result instead of moving the money twice.
function moveMoney(goalId, type, payload, idempotencyKey) {
  if (!idempotencyKey) {
    throw new Error(`POST /savings-goals/{id}/${type}s requires an Idempotency-Key.`);
  }

  return apiRequest(`${goalPath(goalId)}/${type}s`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: pickPayload(payload, MOVEMENT_FIELDS[type]),
  });
}

/*
 * Envelopes:
 * - list → `data.savings_goals` (Laravel paginator, rows in `.data`).
 * - get / create / update / archive / pause / resume → `data.savings_goal`,
 *   with its `account` and the `progress` the backend recalculated.
 * - getProgress → `data.progress` only.
 * - listContributions → `data.contributions` (paginator).
 * - listActivity → `data.activity` (paginator; contributions + withdrawals).
 * - contribute → `data.contribution` + `data.savings_goal`.
 * - withdraw → `data.withdrawal` + `data.savings_goal`.
 *
 * There is intentionally no `delete`: DELETE /savings-goals/{id} archives the
 * goal (its account and history are kept), and `archive` states that clearly.
 */
export const savingsGoalsApi = {
  // Query: workspace_id, currency_code, status, progress_status, before_due,
  // per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/savings-goals", { query, signal: options.signal }),

  get: (goalId, options = {}) =>
    apiRequest(goalPath(goalId), { signal: options.signal }),

  // Fresh saved / remaining / percentage / status without the whole goal.
  getProgress: (goalId, options = {}) =>
    apiRequest(`${goalPath(goalId)}/progress`, { signal: options.signal }),

  // Query: per_page, page.
  listContributions: (goalId, query = {}, options = {}) =>
    apiRequest(`${goalPath(goalId)}/contributions`, { query, signal: options.signal }),

  // Query: type (contribution | withdrawal), per_page, page.
  listActivity: (goalId, query = {}, options = {}) =>
    apiRequest(`${goalPath(goalId)}/activity`, { query, signal: options.signal }),

  // The backend creates the goal's dedicated savings account.
  create: (payload) =>
    apiRequest("/savings-goals", {
      method: "POST",
      body: pickPayload(payload, CREATE_FIELDS),
    }),

  // Partial update: send only the fields that changed. A new target can flip
  // the lifecycle status (achieved ↔ active); the response says which. An
  // archived goal is rejected with 409.
  update: (goalId, payload) =>
    apiRequest(goalPath(goalId), {
      method: "PATCH",
      body: pickPayload(payload, UPDATE_FIELDS),
    }),

  // DELETE archives: the goal becomes read-only, its account and history are
  // kept. Rejected with 409 while the goal still holds money, or when it is
  // already archived.
  archive: (goalId) =>
    apiRequest(goalPath(goalId), { method: "DELETE" }),

  // Money from `from_account_id` into the goal's savings account.
  contribute: (goalId, payload, idempotencyKey) =>
    moveMoney(goalId, "contribution", payload, idempotencyKey),

  // Money from the goal's savings account to `to_account_id`.
  withdraw: (goalId, payload, idempotencyKey) =>
    moveMoney(goalId, "withdrawal", payload, idempotencyKey),

  // No body and no Idempotency-Key. Pause blocks new contributions only.
  pause: (goalId) =>
    apiRequest(`${goalPath(goalId)}/pause`, { method: "POST" }),

  // The response may be `active` or `achieved` (already fully funded).
  resume: (goalId) =>
    apiRequest(`${goalPath(goalId)}/resume`, { method: "POST" }),
};
