import { apiRequest } from "./apiClient";

/*
 * GET /financial-alerts → `data.generated_at`, `data.alerts[]` ({ type,
 * severity, message, budget_id… }) and `data.summary`.
 *
 * The alerts are calculated by the backend at request time from the current
 * budgets: they are not stored, have no read/unread state and are not the
 * persistent Notifications feature.
 *
 * The workspace filter is `id_workspace` (NOT `workspace_id`, unlike most
 * endpoints); it is omitted when unknown.
 */
export const financialAlertsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/financial-alerts", { query, signal: options.signal }),
};
