import { apiRequest } from "./apiClient";

export const financialAlertsApi = {
  list: (options = {}) =>
    apiRequest("/financial-alerts", { signal: options.signal }),
};
