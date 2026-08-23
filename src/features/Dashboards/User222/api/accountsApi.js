import { apiRequest } from "./apiClient";

export const accountsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/accounts", { query, signal: options.signal }),

  get: (accountId, options = {}) =>
    apiRequest(`/accounts/${accountId}`, { signal: options.signal }),

  create: (payload) =>
    apiRequest("/accounts", {
      method: "POST",
      body: payload,
    }),

  update: (accountId, payload) =>
    apiRequest(`/accounts/${accountId}`, {
      method: "PUT",
      body: payload,
    }),

  archive: (accountId) =>
    apiRequest(`/accounts/${accountId}/archive`, { method: "POST" }),
};
