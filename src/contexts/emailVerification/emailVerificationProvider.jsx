import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authApi,
  normalizeEmailVerificationStatus,
} from "../../features/Dashboards/User/api/authApi";
import { useAuthContext } from "../auth/useAuthContext";
import { EmailVerificationContext } from "./emailVerificationContext";

/*
 * Single owner of GET /auth/email/status: fetched once per signed-in session
 * (and again on `refresh()`), then shared with every consumer.
 */
export default function EmailVerificationProvider({ children }) {
  const { token, initializing } = useAuthContext();
  // `token` records which session the result belongs to, so a previous
  // session's status is never shown after logout or a new login.
  const [result, setResult] = useState({ token: null, status: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initializing || !token) return undefined;

    const controller = new AbortController();

    authApi
      .getEmailVerificationStatus({ signal: controller.signal })
      .then((response) => {
        setResult({
          token,
          status: normalizeEmailVerificationStatus(response.data),
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // A 401 already went through the session-expired flow in apiClient.
        setResult({ token, status: null, error });
      });

    return () => controller.abort();
  }, [initializing, reloadKey, token]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const resend = useCallback(async () => {
    const response = await authApi.resendVerificationEmail();

    // Already verified is a success: re-read the status so warnings go away.
    if (response.data?.already_verified === true) refresh();

    return response;
  }, [refresh]);

  const isCurrent = Boolean(token) && result.token === token;

  const value = useMemo(
    () => ({
      status: isCurrent ? result.status : null,
      error: isCurrent ? result.error : null,
      loading: Boolean(token) && !isCurrent,
      refresh,
      resend,
    }),
    [isCurrent, refresh, resend, result, token],
  );

  return (
    <EmailVerificationContext.Provider value={value}>
      {children}
    </EmailVerificationContext.Provider>
  );
}
