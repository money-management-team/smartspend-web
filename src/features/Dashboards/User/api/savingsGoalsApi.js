import {
  apiRequest,
  createIdempotencyKey,
  toMoneyString,
} from "./apiClient";

function normalizeGoalPayload(payload) {
  const normalized = { ...payload };

  if (payload.target_amount !== undefined && payload.target_amount !== "") {
    normalized.target_amount = toMoneyString(payload.target_amount);
  }

  if (!normalized.target_date) {
    delete normalized.target_date;
  }

  return normalized;
}

export const savingsGoalsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/savings-goals", { query, signal: options.signal }),

  get: (goalId, options = {}) =>
    apiRequest(`/savings-goals/${goalId}`, { signal: options.signal }),

  getProgress: (goalId, options = {}) =>
    apiRequest(`/savings-goals/${goalId}/progress`, { signal: options.signal }),

  listContributions: (goalId, query = {}, options = {}) =>
    apiRequest(`/savings-goals/${goalId}/contributions`, {
      query,
      signal: options.signal,
    }),

  create: (payload) =>
    apiRequest("/savings-goals", {
      method: "POST",
      body: normalizeGoalPayload(payload),
    }),

  update: (goalId, payload) =>
    apiRequest(`/savings-goals/${goalId}`, {
      method: "PUT",
      body: normalizeGoalPayload(payload),
    }),

  contribute(goalId, payload, idempotencyKey = createIdempotencyKey("goal-contribution")) {
    return apiRequest(`/savings-goals/${goalId}/contributions`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...payload,
        amount: toMoneyString(payload.amount),
      },
    });
  },

  archive: (goalId) =>
    apiRequest(`/savings-goals/${goalId}`, { method: "DELETE" }),
};
