import { apiRequest } from "./apiClient";

const categoryPath = (categoryId) =>
  `/categories/${encodeURIComponent(categoryId)}`;

/*
 * Envelopes: list → `data.categories` (active categories only, system ones
 * included); get / create / update / archive → `data.category`.
 *
 * There is intentionally no `delete`: DELETE /categories/{id} is a backend
 * alias of archive (nothing is removed), and `archive` states that clearly.
 */
export const categoriesApi = {
  // `query.workspace_id` limits the list to one workspace; `query.type` to
  // `income` or `expense`.
  list: (query = {}, options = {}) =>
    apiRequest("/categories", { query, signal: options.signal }),

  get: (categoryId, options = {}) =>
    apiRequest(categoryPath(categoryId), { signal: options.signal }),

  create: (payload) =>
    apiRequest("/categories", {
      method: "POST",
      body: payload,
    }),

  // Partial update: send only the fields that changed. System categories are
  // read-only and are rejected by the backend.
  update: (categoryId, payload) =>
    apiRequest(categoryPath(categoryId), {
      method: "PATCH",
      body: payload,
    }),

  // Sets `is_active` to false: the category leaves active lists, and existing
  // transactions keep it.
  archive: (categoryId) =>
    apiRequest(`${categoryPath(categoryId)}/archive`, { method: "POST" }),
};
