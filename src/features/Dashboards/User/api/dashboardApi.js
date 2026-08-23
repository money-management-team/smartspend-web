import { apiRequest, ApiError } from "./apiClient";

export const dashboardApi = {
  get: (query = {}, options = {}) =>
    apiRequest("/dashboard", { query, signal: options.signal }),
};

export async function resolveWorkspaceId(options = {}) {
  const storedWorkspace = localStorage.getItem("workspace");

  if (storedWorkspace) {
    try {
      const workspace = JSON.parse(storedWorkspace);
      if (workspace?.id) return workspace.id;
    } catch {
      localStorage.removeItem("workspace");
    }
  }

  const response = await dashboardApi.get({}, options);
  const workspaceId =
    response.data?.scope?.workspace_id ?? response.data?.scope?.workspace_ids?.[0];

  if (workspaceId) {
    let currentWorkspace = {};
    try {
      currentWorkspace = JSON.parse(localStorage.getItem("workspace")) ?? {};
    } catch {
      currentWorkspace = {};
    }

    localStorage.setItem(
      "workspace",
      JSON.stringify({ ...currentWorkspace, id: workspaceId }),
    );
  }

  if (!workspaceId) {
    throw new ApiError("", { code: "WORKSPACE_UNAVAILABLE" });
  }

  return workspaceId;
}
