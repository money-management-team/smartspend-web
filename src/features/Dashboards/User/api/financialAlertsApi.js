import { apiRequest } from "./apiClient";

/*
 * GET /financial-alerts → `data.generated_at`, `data.alerts[]` ({ type,
 * severity, message, budget_id… }) and `data.summary`.
 *
 * The alerts are calculated by the backend at request time from the current
 * budgets: they are not stored, have no read/unread state and are not the
 * persistent Notifications feature.
 *
 * The workspace filter is `workspace_id`, as FinancialAlertController reads it
 * (fix/financial-idempotency-p0 @ 6b696d72). `id_workspace` is not a parameter
 * of this endpoint: the backend ignores it. Omit the filter when it is unknown.
 */
export const financialAlertsApi = {
  list: (query = {}, options = {}) =>
    apiRequest("/financial-alerts", { query, signal: options.signal }),
};
