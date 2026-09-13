import { apiRequest, toMoneyString } from "./apiClient";

const debtPath = (debtId) => `/debts/${encodeURIComponent(debtId)}`;
// Payment-level actions are addressed by the PAYMENT id, never the debt id.
const paymentPath = (paymentId) => `/debt-payments/${encodeURIComponent(paymentId)}`;

// Fields a create may carry. `user_id`, `status`, `paid_amount`,
// `remaining_amount` and `opening_transaction_id` are never sent: the owner
// comes from the token and the rest is calculated by the backend.
const CREATE_FIELDS = [
  "workspace_id",
  "direction",
  "counterparty_name",
  "original_amount",
  "currency_code",
  "issued_at",
  "due_date",
  "account_id",
  "notes",
  "metadata",
];
// An update never sends `user_id`, `workspace_id`, `direction`,
// `currency_code`, `status`, `paid_amount`, `remaining_amount` or
// `opening_transaction_id`: they are fixed or calculated by the backend.
// `original_amount` is only accepted before the first payment.
const UPDATE_FIELDS = ["counterparty_name", "original_amount", "issued_at", "due_date", "notes", "metadata"];
const PAYMENT_FIELDS = ["account_id", "amount", "paid_at", "notes", "metadata"];

// Keeps only the allowed fields that are present; money travels as a
// 4-decimal string and is never parsed into a float.
function pickPayload(payload, fields) {
  const body = {};

  fields.forEach((field) => {
    if (payload?.[field] !== undefined) body[field] = payload[field];
  });

  if (body.original_amount !== undefined) {
    body.original_amount = toMoneyString(body.original_amount);
  }
  if (body.amount !== undefined) body.amount = toMoneyString(body.amount);

  return body;
}

/*
 * A debt is either informational (no `account_id`: nothing moves in the
 * ledger) or recorded with an opening movement (`account_id` given: the
 * backend posts the movement on that account itself). The frontend never
 * creates a transaction for it and never changes a balance.
 *
 * Envelopes:
 * - list → `data.debts` (Laravel paginator, rows in `.data`).
 * - summary → `data.summary.by_currency` (one entry per currency; amounts in
 *   different currencies are never added together).
 * - get / create / update / archive → `data.debt`.
 * - listPayments → `data.payments` (Laravel paginator, rows in `.data`).
 * - recordPayment / reversePayment → `data.payment` + `data.debt`.
 *
 * There is intentionally no `delete`: DELETE /debts/{id} archives the debt
 * (its payments and ledger history are kept), and `archive` states that.
 */
export const debtsApi = {
  // Query: workspace_id, direction (payable | receivable), status (active |
  // partially_paid | paid | archived | overdue), currency_code, counterparty,
  // due_from, due_to, owner (mine | all), per_page, page.
  list: (query = {}, options = {}) =>
    apiRequest("/debts", { query, signal: options.signal }),

  // Query: workspace_id, owner (mine | all).
  summary: (query = {}, options = {}) =>
    apiRequest("/debts/summary", { query, signal: options.signal }),

  get: (debtId, options = {}) =>
    apiRequest(debtPath(debtId), { signal: options.signal }),

  // No Idempotency-Key: the backend doesn't require one for POST /debts, even
  // when `account_id` makes it post an opening movement.
  create: (payload) =>
    apiRequest("/debts", {
      method: "POST",
      body: pickPayload(payload, CREATE_FIELDS),
    }),

  // Partial update (PATCH; PUT is also accepted by the backend but not used):
  // send only the fields that changed. The backend recalculates
  // `remaining_amount` when `original_amount` changes, rejects
  // `original_amount` once a payment exists, and rejects any change to an
  // archived debt with 409.
  update: (debtId, payload) =>
    apiRequest(debtPath(debtId), {
      method: "PATCH",
      body: pickPayload(payload, UPDATE_FIELDS),
    }),

  // DELETE archives: the debt becomes read-only and its history is kept.
  // Rejected with 409 when an open debt already has payments, or when it is
  // already archived.
  archive: (debtId) =>
    apiRequest(debtPath(debtId), { method: "DELETE" }),

  // Query: per_page, page. Reversed payments stay in the list.
  listPayments: (debtId, query = {}, options = {}) =>
    apiRequest(`${debtPath(debtId)}/payments`, { query, signal: options.signal }),

  // A real movement on `account_id` (payable: money out; receivable: money
  // in), so the Idempotency-Key is required: a retry of the same submission
  // reuses its key and the backend replays the stored result instead of
  // recording the payment twice.
  recordPayment: (debtId, payload, idempotencyKey) => {
    if (!idempotencyKey) {
      throw new Error("POST /debts/{id}/payments requires an Idempotency-Key.");
    }

    return apiRequest(`${debtPath(debtId)}/payments`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: pickPayload(payload, PAYMENT_FIELDS),
    });
  },

  // POST /debt-payments/{paymentId}/reverse: the PAYMENT id, not the debt id.
  // No Idempotency-Key is documented: a payment can only be reversed once, so
  // a repeated request is rejected with 409 instead of reversing twice.
  reversePayment: (paymentId, reason) =>
    apiRequest(`${paymentPath(paymentId)}/reverse`, {
      method: "POST",
      body: { reason },
    }),
};
