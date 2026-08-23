import {
  apiRequest,
  createIdempotencyKey,
  toMoneyString,
} from "./apiClient";

export const transfersApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/transfers", { query, signal: options.signal }),

  get: (transferId, options = {}) =>
    apiRequest(`/transfers/${transferId}`, { signal: options.signal }),

  create(payload, idempotencyKey = createIdempotencyKey()) {
    const body = {
      ...payload,
      amount: toMoneyString(payload.amount),
    };

    if (payload.fee_amount !== undefined && payload.fee_amount !== "") {
      body.fee_amount = toMoneyString(payload.fee_amount);
    }

    return apiRequest("/transfers", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body,
    });
  },
};
