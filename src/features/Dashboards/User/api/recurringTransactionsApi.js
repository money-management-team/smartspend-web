import { apiRequest, toMoneyString } from "./apiClient";

const rulePath = (ruleId) => `/recurring-transactions/${encodeURIComponent(ruleId)}`;

// Fields each write may carry. `user_id`, `status`, `next_due_date` and
// `last_processed_at` are never sent: the backend owns them. An update never
// sends the fields that define the rule's structure (account, category,
// currency, type, frequency, start date, anchor day): changing those means a
// new rule.
const CREATE_FIELDS = [
  "account_id",
  "category_id",
  "name",
  "type",
  "amount",
  "currency_code",
  "frequency",
  "interval",
  "start_date",
  "end_date",
  "max_occurrences",
  "processing_mode",
  "description",
  "notes",
  "metadata",
];
const UPDATE_FIELDS = [
  "name",
  "amount",
  "interval",
  "end_date",
  "max_occurrences",
  "processing_mode",
  "description",
  "notes",
  "metadata",
];

// Keeps only the allowed fields that are present; `amount` travels as a
// 4-decimal string.
function pickPayload(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined) body[field] = payload[field];
  });

  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);

  return body;
}

/*
 * A recurring transaction is a RULE, not money: creating, editing, pausing,
 * resuming, skipping or archiving it never moves money. Money moves only when
 * an occurrence is posted — by `confirmNext`, or by the backend's scheduler
 * for `processing_mode: "automatic"` rules.
 *
 * Envelopes:
 * - list → `data.recurring_transactions` (Laravel paginator, rows in `.data`).
 * - get / create / update / archive / pause / resume →
 *   `data.recurring_transaction` (with `account`, `category`, `owner`,
 *   `schedule`).
 * - confirmNext / skipNext → `data.occurrence` + `data.recurring_transaction`.
 * - listOccurrences → `data.occurrences` (paginator).
 *
 * There is intentionally no `delete`: DELETE /recurring-transactions/{id}
 * archives the rule (posted transactions and history are kept).
 */
export const recurringTransactionsApi = {
  // Query: workspace_id, account_id, category_id, type, status, frequency,
  // processing_mode, due_from, due_to, owner (mine | all), per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/recurring-transactions", { query, signal: options.signal }),

  get: (ruleId, options = {}) =>
    apiRequest(rulePath(ruleId), { signal: options.signal }),

  // No Idempotency-Key: creating a rule moves no money.
  create: (payload) =>
    apiRequest("/recurring-transactions", {
      method: "POST",
      body: pickPayload(payload, CREATE_FIELDS),
    }),

  // Partial update of the editable fields only. A new amount applies to
  // open, unposted occurrences; posted transactions keep theirs.
  update: (ruleId, payload) =>
    apiRequest(rulePath(ruleId), {
      method: "PATCH",
      body: pickPayload(payload, UPDATE_FIELDS),
    }),

  // DELETE archives: future occurrences stop, open ones are cancelled by the
  // backend, posted transactions and history are kept. 409 when already
  // archived.
  archive: (ruleId) =>
    apiRequest(rulePath(ruleId), { method: "DELETE" }),

  // No body and no Idempotency-Key. 422 when the rule can't be paused.
  pause: (ruleId) =>
    apiRequest(`${rulePath(ruleId)}/pause`, { method: "POST" }),

  // The backend recalculates `next_due_date` from today; periods missed while
  // paused are not posted retroactively. 422 when the rule can't be resumed.
  resume: (ruleId) =>
    apiRequest(`${rulePath(ruleId)}/resume`, { method: "POST" }),

  /*
   * MOVES REAL MONEY: posts the rule's oldest open occurrence as a real
   * transaction. No body (the occurrence is chosen by the backend, never by
   * the client) and no client Idempotency-Key: the backend derives the key
   * from the occurrence itself (`recurring:{ruleId}:{dueDate}`, returned as
   * `occurrence.idempotency_key`), so the same occurrence can never be posted
   * twice. See docs/recurring-transactions/confirm-and-skip.md.
   *
   * A 422 may carry `data.occurrence` (status "failed", `failure_reason`,
   * `attempts`) instead of field errors.
   */
  confirmNext: (ruleId) =>
    apiRequest(`${rulePath(ruleId)}/confirm-next`, { method: "POST" }),

  // Moves no money: the oldest open occurrence is marked "skipped" (kept in
  // history, `reason` stored as `failure_reason`). The body is optional.
  skipNext: (ruleId, reason) =>
    apiRequest(`${rulePath(ruleId)}/skip-next`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    }),

  // Query: occurrence_status (scheduled | due | posted | skipped | failed |
  // cancelled), due_from, due_to, per_page, page.
  listOccurrences: (ruleId, query = {}, options = {}) =>
    apiRequest(`${rulePath(ruleId)}/occurrences`, { query, signal: options.signal }),
};
