import { apiRequest, toMoneyString } from "./apiClient";

const transactionPath = (transactionId) =>
  `/transactions/${encodeURIComponent(transactionId)}`;

// Amounts always travel as 4-decimal strings; absent fields stay absent so a
// partial correction never sends an empty amount.
const withMoney = (payload) =>
  payload.amount === undefined
    ? payload
    : { ...payload, amount: toMoneyString(payload.amount) };

// Money-moving writes must carry the caller's key: the caller decides when a
// retry is the same operation (same key) or a new one (new key).
function idempotentWrite(endpoint, method, payload, idempotencyKey) {
  if (!idempotencyKey) {
    throw new Error(`${method} ${endpoint} requires an Idempotency-Key.`);
  }

  return apiRequest(endpoint, {
    method,
    headers: { "Idempotency-Key": idempotencyKey },
    body: withMoney(payload),
  });
}

/*
 * Envelopes:
 * - list → `data.transactions` is a Laravel paginator; the rows are in
 *   `data.transactions.data`. Scoped by the backend to the user's workspaces,
 *   so no `workspace_id` is sent.
 * - get / createIncome / createExpense / correct → `data.transaction`.
 * - reverse → `data.transaction_original` and `data.reversals`.
 *
 * A posted transaction is never edited in place: `correct` (PATCH) reverses
 * it and returns a NEW replacement transaction with a new id. There is no
 * delete; cancelling is `reverse`.
 */
export const transactionsApi = {
  // Filters: account_id, type, category_id, status, currency_code, date_from,
  // date_to, sort_by (occurred_at|amount|created_at), sort_dir, per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/transactions", { query, signal: options.signal }),

  get: (transactionId, options = {}) =>
    apiRequest(transactionPath(transactionId), { signal: options.signal }),

  createIncome: (payload, idempotencyKey) =>
    idempotentWrite("/transactions/income", "POST", payload, idempotencyKey),

  createExpense: (payload, idempotencyKey) =>
    idempotentWrite("/transactions/expense", "POST", payload, idempotencyKey),

  // Correction by reversal. `payload.reason` is required; send only the
  // fields that changed. The response is the replacement transaction.
  correct: (transactionId, payload, idempotencyKey) =>
    idempotentWrite(transactionPath(transactionId), "PATCH", payload, idempotencyKey),

  reverse: (transactionId, reason) =>
    apiRequest(`${transactionPath(transactionId)}/reverse`, {
      method: "POST",
      body: { reason },
    }),
};
