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

  loginWithGoogle: (idToken) =>
    apiRequest("/auth/google", {
      method: "POST",
      body: { id_token: idToken },
      auth: false,
    }),

  /*
   * Emails a reset link. The response is the same whether or not the email
   * belongs to an account, so it says nothing about the account.
   */
  forgotPassword: (email) =>
    apiRequest("/auth/forgot-password", {
      method: "POST",
      body: { identifier: email },
      auth: false,
    }),

  // Public: `token` and `identifier` come from the emailed reset link.
  resetPassword: ({ token, identifier, password, passwordConfirmation }) =>
    apiRequest("/auth/reset-password", {
      method: "POST",
      body: {
        token,
        identifier,
        password,
        password_confirmation: passwordConfirmation,
      },
      auth: false,
    }),

  /*
   * Public signed link. `search` is the link's raw query string
   * ("?expires=…&signature=…"), passed through untouched so the signature
   * still matches.
   */
  verifyEmail: ({ id, hash, search }) =>
    apiRequest(
      `/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}${search}`,
      { auth: false },
    ),

  // Uses the signed-in user's email; there is no body.
  resendVerificationEmail: () =>
    apiRequest("/auth/email/verification-notification", { method: "POST" }),

  getEmailVerificationStatus: ({ signal } = {}) =>
    apiRequest("/auth/email/status", { signal }),

  /*
   * `token` authenticates with a token that isn't stored yet (right after
   * login). It skips the stored-token lookup, so a 401 here doesn't fire the
   * session-expired event.
   */
  getCurrentUser: ({ signal, token } = {}) =>
    apiRequest("/user", {
      signal,
      ...(token && {
        auth: false,
        headers: { Authorization: `Bearer ${token}` },
      }),
    }),

  updateProfile: (payload) =>
    apiRequest("/profile", {
      method: "PUT",
      body: payload,
    }),

  /*
   * PATCH /profile/password (PUT is accepted too). On success the backend
   * revokes every OTHER access token of the account; the token that sent this
   * request stays valid, so the stored session is left untouched. A 422 can
   * also mean the account has no password yet (created with Google).
   */
  changePassword: ({ currentPassword, password, passwordConfirmation }) =>
    apiRequest("/profile/password", {
      method: "PATCH",
      body: {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      },
    }),

  logout: () => apiRequest("/logout", { method: "POST" }),
};

/*
 * `data` of GET /user: either the user itself or `{ user, workspace }`.
 * The workspace may also be nested on the user.
 */
export function normalizeCurrentUser(data) {
  const user = data?.user ?? data ?? null;

  return {
    user,
    workspace: data?.workspace ?? user?.workspace ?? null,
  };
}

/*
 * `data` of GET /auth/email/status. `verified` stays three-valued:
 * true (verified), false (has an email, not verified), null (verification
 * doesn't apply, e.g. no email). Never collapse null into false.
 */
export function normalizeEmailVerificationStatus(data) {
  const toTriState = (value) => (typeof value === "boolean" ? value : null);

  return {
    email: data?.email ?? null,
    requiresVerification: toTriState(data?.requires_verification),
    verified: toTriState(data?.verified),
    verifiedAt: data?.verified_at ?? null,
  };
}
