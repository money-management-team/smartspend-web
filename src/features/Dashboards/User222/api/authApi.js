import { apiRequest, clearAuthSession } from "./apiClient";

export const authApi = {
  getCurrentUser: ({ signal } = {}) => apiRequest("/user", { signal }),

  updateProfile: (payload) =>
    apiRequest("/profile", {
      method: "PUT",
      body: payload,
    }),

  async logout() {
    try {
      return await apiRequest("/logout", { method: "POST" });
    } finally {
      clearAuthSession();
    }
  },
};
