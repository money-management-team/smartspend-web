import { apiRequest, pickQuery } from "./apiClient";

const conversation = (id) => `/ai/conversations/${encodeURIComponent(id)}`;
const insight = (id) => `/ai/insights/${encodeURIComponent(id)}`;

export const aiCopilotApi = {
  conversations: (query = {}, options = {}) => apiRequest("/ai/conversations", { query: pickQuery(query, ["page", "per_page"]), signal: options.signal }),
  createConversation: (locale) => apiRequest("/ai/conversations", { method: "POST", body: { locale } }),
  conversation: (id, query = {}, options = {}) => apiRequest(conversation(id), { query: pickQuery(query, ["page", "per_page"]), signal: options.signal }),
  deleteConversation: (id) => apiRequest(conversation(id), { method: "DELETE" }),
  sendMessage: (id, content, clientRequestId) => apiRequest(`${conversation(id)}/messages`, { method: "POST", body: { content, client_request_id: clientRequestId }, timeoutMs: 90_000 }),
  messageFeedback: (id, feedback) => apiRequest(`/ai/messages/${encodeURIComponent(id)}/feedback`, { method: "POST", body: feedback }),
  insights: (query = {}, options = {}) => apiRequest("/ai/insights", { query: pickQuery(query, ["page", "per_page", "type", "status", "currency_code"]), signal: options.signal }),
  insight: (id) => apiRequest(insight(id)),
  refreshInsights: () => apiRequest("/ai/insights/refresh", { method: "POST" }),
  dismissInsight: (id) => apiRequest(`${insight(id)}/dismiss`, { method: "POST" }),
  insightFeedback: (id, feedback) => apiRequest(`${insight(id)}/feedback`, { method: "POST", body: feedback }),
  forecast: () => apiRequest("/ai/forecast", { timeoutMs: 90_000 }),
  settings: (options = {}) => apiRequest("/ai/settings", { signal: options.signal }),
  updateSettings: (settings) => apiRequest("/ai/settings", { method: "PUT", body: settings }),
  deleteData: () => apiRequest("/ai/data", { method: "DELETE", body: { confirmation: "DELETE_AI_DATA" } }),
};
