import {
  apiRequest,
  ApiError,
  getStoredWorkspace,
  updateStoredWorkspace,
} from "./apiClient";

/*
 * GET /dashboard: read-only aggregates calculated by the backend (period,
 * scope, totals, summary_by_currency, accounts, breakdown, transfers,
 * planning, commitments, recent_transactions). Nothing here moves money.
 *
 * Query: period (today | week | month | quarter | year | all | custom;
 * default month), date_from / date_to (custom only), workspace_id.
 */
export const dashboardApi = {
  get: (query = {}, options = {}) =>
    apiRequest("/dashboard", { query, signal: options.signal }),
};

export async function resolveWorkspaceId(options = {}) {
  const response = await dashboardApi.get({}, options);
  const scope = response.data?.scope ?? {};
  const workspaceIds = Array.from(
    new Set(
      [scope.workspace_id, ...(scope.workspace_ids ?? [])]
        .filter(Boolean)
        .map(Number),
    ),
  );
  const storedWorkspace = getStoredWorkspace();
  const storedWorkspaceId = Number(storedWorkspace?.id);
  const workspaceId = workspaceIds.includes(storedWorkspaceId)
    ? storedWorkspaceId
    : workspaceIds.length === 1
      ? workspaceIds[0]
      : null;

  if (!workspaceId) {
    throw new ApiError("", { code: "WORKSPACE_UNAVAILABLE" });
  }

  updateStoredWorkspace({
    ...(storedWorkspace ?? {}),
    id: workspaceId,
    base_currency_code: scope.primary_currency_code,
    timezone: response.data?.period?.timezone,
  });

  return workspaceId;
}
