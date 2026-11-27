import { apiRequest, toMoneyString } from "./apiClient";

const rulePath = (ruleId) => `/recurring-transactions/${encodeURIComponent(ruleId)}`;

// A confirm or skip must name its occurrence (a positive integer id). Without
// one nothing is sent: the backend would refuse it, and guessing "the next one"
// is exactly what let a repeated request act on the following period.
function requireOccurrenceId(occurrenceId, action) {
  const id = typeof occurrenceId === "string" && /^[1-9]\d*$/.test(occurrenceId) ? Number(occurrenceId) : occurrenceId;
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error(`POST /recurring-transactions/{id}/${action} requires the occurrence's id.`);
  }
  return id;
}

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

  // Creating a rule moves no money, but the rule posts every period, so the
  // Idempotency-Key is required (StoreRecurringTransactionRequest): a retry of
  // the same submission returns the rule it created instead of a second one.
  create: (payload, idempotencyKey) => {
    if (!idempotencyKey) {
      throw new Error("POST /recurring-transactions requires an Idempotency-Key.");
    }

    return apiRequest("/recurring-transactions", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: pickPayload(payload, CREATE_FIELDS),
    });
  },

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
   * MOVES REAL MONEY: posts the occurrence the person was shown
   * (`occurrenceId`, the rule's `schedule.next_occurrence.id`) as a real
   * transaction. The backend requires `occurrence_id` and refuses, changing
   * nothing, unless it is still the rule's earliest open occurrence (409
   * `recurring_occurrence_not_next` / `recurring_occurrence_not_open`). No
   * client Idempotency-Key: the backend derives the key from the occurrence
   * (`recurring:{ruleId}:{dueDate}`), and because the request names the
   * occurrence, a repeat gets the same result instead of posting the
   * following period. See docs/recurring-transactions/confirm-and-skip.md.
   *
   * A 422 may carry `data.occurrence` (status "failed", `failure_reason`,
   * `attempts`) instead of field errors.
   */
  confirmNext: (ruleId, occurrenceId) =>
    apiRequest(`${rulePath(ruleId)}/confirm-next`, {
      method: "POST",
      body: { occurrence_id: requireOccurrenceId(occurrenceId, "confirm-next") },
    }),

  // Moves no money: the named open occurrence is marked "skipped" (kept in
  // history, `reason` stored as `failure_reason`). `occurrenceId` is required,
  // `reason` optional; a repeat returns the same skipped occurrence.
  skipNext: (ruleId, occurrenceId, reason) =>
    apiRequest(`${rulePath(ruleId)}/skip-next`, {
      method: "POST",
      body: { occurrence_id: requireOccurrenceId(occurrenceId, "skip-next"), ...(reason ? { reason } : {}) },
    }),

  // Query: occurrence_status (scheduled | due | posted | skipped | failed |
  // cancelled), due_from, due_to, per_page, page.
  listOccurrences: (ruleId, query = {}, options = {}) =>
    apiRequest(`${rulePath(ruleId)}/occurrences`, { query, signal: options.signal }),
};
