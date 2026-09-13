import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  authApi,
  normalizeCurrentUser,
} from "../../features/Dashboards/User/api/authApi";
import {
  ApiError,
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthSession,
  getStoredAuthSession,
  persistAuthSession,
  updateStoredUser,
  updateStoredWorkspace,
} from "../../features/Dashboards/User/api/apiClient";
import { AuthContext } from "./authContext";

const emptySession = {
  user: null,
  token: null,
  role: "guest",
  workspace: null,
};

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getStoredAuthSession());
  const [initializing, setInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState(null);
  // Token whose user/workspace just came from login or register, so the
  // restore effect doesn't fetch GET /user again for it.
  const freshTokenRef = useRef(null);

  const clearAuth = useCallback(() => {
    freshTokenRef.current = null;
    clearAuthSession();
    setSession(emptySession);
  }, []);

  const applyAuthData = useCallback((authData, options) => {
    persistAuthSession(authData, options);
    freshTokenRef.current = authData.token;
    setSession({
      token: authData.token,
      user: authData.user,
      workspace: authData.workspace ?? null,
      role: authData.user.role ?? "user",
    });
    setInitializationError(null);
    setInitializing(false);
  }, []);

  const login = useCallback(
    async (credentials, { remember = true } = {}) => {
      const response = await authApi.login(credentials);
      const authData = response.data;

      if (!authData?.token || !authData?.user) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      // The login response has no workspace; GET /user completes the session
      // before anything is stored.
      const userResponse = await authApi.getCurrentUser({
        token: authData.token,
      });
      const { user, workspace } = normalizeCurrentUser(userResponse.data);

      if (!user) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      applyAuthData({ ...authData, user, workspace }, { remember });
      return user;
    },
    [applyAuthData],
  );

  const register = useCallback(
    async (registrationData) => {
      const response = await authApi.register(registrationData);
      const authData = response.data;

      if (!authData?.token || !authData?.user) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      applyAuthData(authData, { remember: true });
      return authData.user;
    },
    [applyAuthData],
  );

  // 200 (existing user) and 201 (new user) carry the same full session.
  const loginWithGoogle = useCallback(
    async (idToken, { remember = true } = {}) => {
      const response = await authApi.loginWithGoogle(idToken);
      const authData = response.data;

      if (!authData?.token || !authData?.user) {
        throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      }

      applyAuthData(authData, { remember });
      return authData.user;
    },
    [applyAuthData],
  );

  const logout = useCallback(async () => {
    try {
      if (session.token) await authApi.logout();
    } finally {
      clearAuth();
    }
  }, [clearAuth, session.token]);

  const updateUser = useCallback((user) => {
    if (!user) return;

    updateStoredUser(user);
    setSession((current) => ({
      ...current,
      user,
      role: user.role ?? current.role ?? "user",
    }));
  }, []);

  const updateWorkspace = useCallback((workspace) => {
    updateStoredWorkspace(workspace);
    setSession((current) => ({ ...current, workspace }));
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAuth();
      setInitializing(false);
    };

    globalThis.addEventListener?.(
      AUTH_SESSION_EXPIRED_EVENT,
      handleSessionExpired,
    );

    return () => {
      globalThis.removeEventListener?.(
        AUTH_SESSION_EXPIRED_EVENT,
        handleSessionExpired,
      );
    };
  }, [clearAuth]);

  useEffect(() => {
    if (!session.token) {
      setInitializing(false);
      return undefined;
    }

    if (session.token === freshTokenRef.current) return undefined;

    const controller = new AbortController();

    const restoreSession = async () => {
      try {
        const response = await authApi.getCurrentUser({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          const { user, workspace } = normalizeCurrentUser(response.data);

          updateUser(user);
          if (workspace) updateWorkspace(workspace);
          setInitializationError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 401) {
          clearAuth();
        } else {
          setInitializationError(error);
        }
      } finally {
        if (!controller.signal.aborted) setInitializing(false);
      }
    };

    restoreSession();
    return () => controller.abort();
  }, [clearAuth, session.token, updateUser, updateWorkspace]);

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      role: session.role,
      workspace: session.workspace,
      login,
      register,
      loginWithGoogle,
      logout,
      clearAuth,
      updateUser,
      updateWorkspace,
      initializing,
      initializationError,
      isAuthenticated: Boolean(session.token),
    }),
    [
      clearAuth,
      initializationError,
      initializing,
      login,
      loginWithGoogle,
      logout,
      register,
      session,
      updateUser,
      updateWorkspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
