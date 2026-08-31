import { apiRequest, toMoneyString } from "./apiClient";

function normalizeBudgetPayload(payload) {
  const normalized = { ...payload };

  if (payload.amount_limit !== undefined && payload.amount_limit !== "") {
    normalized.amount_limit = toMoneyString(payload.amount_limit);
  }

  if (!normalized.category_id) {
    delete normalized.category_id;
  }

  return normalized;
}

export const budgetsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/budgets", { query, signal: options.signal }),

  get: (budgetId, options = {}) =>
    apiRequest(`/budgets/${budgetId}`, { signal: options.signal }),

  getProgress: (budgetId, options = {}) =>
    apiRequest(`/budgets/${budgetId}/progress`, { signal: options.signal }),

  create: (payload) =>
    apiRequest("/budgets", {
      method: "POST",
      body: normalizeBudgetPayload(payload),
    }),

  update: (budgetId, payload) =>
    apiRequest(`/budgets/${budgetId}`, {
      method: "PUT",
      body: normalizeBudgetPayload(payload),
    }),

  archive: (budgetId) =>
    apiRequest(`/budgets/${budgetId}`, { method: "DELETE" }),
};
