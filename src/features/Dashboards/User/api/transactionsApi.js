import { apiRequest, toMoneyString } from "./apiClient";

function normalizePayload(payload) {
  return {
    ...payload,
    amount: toMoneyString(payload.amount),
  };
}

export const transactionsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/transactions", { query, signal: options.signal }),

  get: (transactionId, options = {}) =>
    apiRequest(`/transactions/${transactionId}`, { signal: options.signal }),

  createIncome: (payload) =>
    apiRequest("/transactions/income", {
      method: "POST",
      body: normalizePayload(payload),
    }),

  createExpense: (payload) =>
    apiRequest("/transactions/expense", {
      method: "POST",
      body: normalizePayload(payload),
    }),

  update: (transactionId, payload) =>
    apiRequest(`/transactions/${transactionId}`, {
      method: "PUT",
      body: normalizePayload(payload),
    }),

  reverse: (transactionId, reason) =>
    apiRequest(`/transactions/${transactionId}/reverse`, {
      method: "POST",
      body: { reason },
    }),
};
