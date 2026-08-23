import { apiRequest } from "./apiClient";

export const categoriesApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/categories", { query, signal: options.signal }),

  create: (payload) =>
    apiRequest("/categories", {
      method: "POST",
      body: payload,
    }),

  update: (categoryId, payload) =>
    apiRequest(`/categories/${categoryId}`, {
      method: "PUT",
      body: payload,
    }),

  archive: (categoryId) =>
    apiRequest(`/categories/${categoryId}/archive`, { method: "POST" }),
};
