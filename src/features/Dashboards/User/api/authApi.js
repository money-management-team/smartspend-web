import { apiRequest } from "./apiClient";

export const authApi = {
  login: (credentials) =>
    apiRequest("/login", {
      method: "POST",
      body: credentials,
      auth: false,
    }),

  register: (registrationData) =>
    apiRequest("/register", {
      method: "POST",
      body: registrationData,
      auth: false,
    }),

  getCurrentUser: ({ signal } = {}) => apiRequest("/user", { signal }),

  updateProfile: (payload) =>
    apiRequest("/profile", {
      method: "PUT",
      body: payload,
    }),

  logout: () => apiRequest("/logout", { method: "POST" }),
};
