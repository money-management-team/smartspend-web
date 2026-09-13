import { apiRequest } from "./apiClient";

const accountPath = (accountId) => `/accounts/${encodeURIComponent(accountId)}`;

/*
 * Envelopes: list → `data.accounts` (active accounts only);
 * get / create / update / archive → `data.account`.
 *
 * There is intentionally no `delete`: DELETE /accounts/{id} is a backend
 * alias of archive (nothing is removed), and `archive` states that clearly.
 */
export const accountsApi = {
  // `query.id_workspace` limits the list to one workspace.
  list: (query = {}, options = {}) =>
    apiRequest("/accounts", { query, signal: options.signal }),

  get: (accountId, options = {}) =>
    apiRequest(accountPath(accountId), { signal: options.signal }),

  create: (payload) =>
    apiRequest("/accounts", {
      method: "POST",
      body: payload,
    }),

  // Partial update: send only the fields that changed. A changed
  // `opening_balance` is rejected with 409 once money has moved.
  update: (accountId, payload) =>
    apiRequest(accountPath(accountId), {
      method: "PATCH",
      body: payload,
    }),

  // Hides the account from active lists and blocks new activity; its
  // financial history is kept.
  archive: (accountId) =>
    apiRequest(`${accountPath(accountId)}/archive`, { method: "POST" }),
};
