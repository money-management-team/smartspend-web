import { apiRequest, pickQuery, toMoneyString } from "./apiClient";

const transferPath = (transferId) => `/transfers/${encodeURIComponent(transferId)}`;

/*
 * Query params GET /transfers documents. `status` also accepts `confirmed`,
 * which the backend maps to `posted`. There is no `workspace_id` filter here,
 * so none can be sent.
 */
const LIST_QUERY = [
  "from_account_id",
  "to_account_id",
  "status",
  "currency_code",
  "date_from",
  "date_to",
  "per_page",
  "page",
];

/*
 * Envelopes: list → `data.transfers` (Laravel paginator, rows in `.data`,
 * newest `occurred_at` first); get / create → `data.transfer`;
 * reverse → `data.transfer` (status "reversed") + `data.reversals`.
 *
 * The backend exposes only GET/POST /transfers, GET /transfers/{id} and
 * POST /transfers/{id}/reverse: a posted transfer is never edited or deleted.
 * Cancelling one is a reversal, which reverses the whole movement, fee
 * included.
 */
export const transfersApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/transfers", {
      query: pickQuery(query, LIST_QUERY),
      signal: options.signal,
    }),

  get: (transferId, options = {}) =>
    apiRequest(transferPath(transferId), { signal: options.signal }),

  /*
   * Moves money, so the Idempotency-Key is required: a retry of the same
   * submission reuses its key and the backend replays the stored result
   * instead of transferring twice. Amounts go out as 4-decimal strings.
   */
  create(payload, idempotencyKey) {
    if (!idempotencyKey) {
      throw new Error("POST /transfers requires an Idempotency-Key.");
    }

    const body = { ...payload, amount: toMoneyString(payload.amount) };

    if (![undefined, null, ""].includes(payload.fee_amount)) {
      body.fee_amount = toMoneyString(payload.fee_amount);
    }

    return apiRequest("/transfers", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body,
    });
  },

  // Reverses the whole transfer by posting compensating ledger entries; the
  // transfer stays in history as "reversed". No Idempotency-Key is documented
  // for this endpoint, so none is sent.
  reverse: (transferId, reason) =>
    apiRequest(`${transferPath(transferId)}/reverse`, {
      method: "POST",
      body: { reason },
    }),
};
