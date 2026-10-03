import { apiRequest, createIdempotencyKey, pickQuery } from "./apiClient";

const path = (id) => `/imports/${encodeURIComponent(id)}`;

export const importsApi = {
  list: (query = {}, options = {}) => apiRequest("/imports", { query: pickQuery(query, ["workspace_id", "account_id", "status", "per_page", "page"]), signal: options.signal }),
  get: (id, options = {}) => apiRequest(path(id), { signal: options.signal }),
  upload: (file, workspaceId, accountId) => {
    const body = new FormData();
    body.append("file", file);
    body.append("workspace_id", String(workspaceId));
    if (accountId) body.append("account_id", String(accountId));
    return apiRequest("/imports", { method: "POST", body, timeoutMs: 60_000 });
  },
  mapping: (id, payload) => apiRequest(`${path(id)}/mapping`, { method: "POST", body: payload }),
  validate: (id) => apiRequest(`${path(id)}/validate`, { method: "POST", timeoutMs: 60_000 }),
  preview: (id, query = {}, options = {}) => apiRequest(`${path(id)}/preview`, { query: pickQuery(query, ["page", "per_page", "status"]), signal: options.signal }),
  updateRow: (id, rowId, payload) => apiRequest(`${path(id)}/rows/${encodeURIComponent(rowId)}`, { method: "PATCH", body: payload }),
  ignoreRow: (id, rowId) => apiRequest(`${path(id)}/rows/${encodeURIComponent(rowId)}/ignore`, { method: "POST" }),
  confirm: (id, key) => apiRequest(`${path(id)}/confirm`, { method: "POST", headers: { "Idempotency-Key": key } }),
  cancel: (id) => apiRequest(`${path(id)}/cancel`, { method: "POST" }),
  reverse: (id, reason, key) => apiRequest(`${path(id)}/reverse`, { method: "POST", body: { reason }, headers: { "Idempotency-Key": key } }),
};

// Each attempt keeps its key until the server returns success. An uncertain
// network response can then be retried without posting a statement twice.
export const newImportKey = () => createIdempotencyKey("import");
