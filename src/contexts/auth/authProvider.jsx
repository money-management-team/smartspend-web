import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { AuthContext } from "./authContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(
    () => localStorage.getItem("ACCESS_TOKEN"),
  );
  const [role, setRoleState] = useState(
    () => localStorage.getItem("ROLE") || "guest",
  );
  const [initializing, setInitializing] = useState(true);

  const setToken = useCallback((nextToken) => {
    setTokenState(nextToken);

    if (nextToken) {
      localStorage.setItem("ACCESS_TOKEN", nextToken);
    } else {
      localStorage.removeItem("ACCESS_TOKEN");
    }
  }, []);

  const setRole = useCallback((nextRole) => {
    const resolvedRole = nextRole || "guest";

    setRoleState(resolvedRole);
    localStorage.setItem("ROLE", resolvedRole);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    setRole("guest");
  }, [setRole, setToken]);

  const applyAuthData = useCallback(
    (authData) => {
      if (!authData?.token || !authData?.user) {
        throw new Error("Invalid authentication response.");
      }

      setToken(authData.token);
      setUser(authData.user);
      setRole(authData.user.role || "user");
    },
    [setRole, setToken],
  );

  const login = useCallback(
    async (credentials) => {
      const response = await api.post("/login", credentials);
      const authData = response.data.data;

      applyAuthData(authData);

      return authData.user;
    },
    [applyAuthData],
  );

  const register = useCallback(
    async (registrationData) => {
      const response = await api.post("/register", registrationData);
      const authData = response.data.data;

      applyAuthData(authData);

      return authData.user;
    },
    [applyAuthData],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/logout");
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      if (!token) {
        setInitializing(false);

        return;
      }

      try {
        const response = await api.get("/user");

        if (!cancelled) {
          const currentUser = response.data.data;

          setUser(currentUser);
          setRole(currentUser?.role || "user");
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [clearAuth, setRole, token]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      token,
      setToken,
      role,
      setRole,
      login,
      register,
      logout,
      initializing,
      isAuthenticated: Boolean(token),
    }),
    [
      initializing,
      login,
      logout,
      register,
      role,
      setRole,
      setToken,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}