import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../features/Dashboards/User/api/apiClient";
import { notificationsApi } from "../../features/Dashboards/User/api/notificationsApi";
import { toUnreadCount } from "../../features/Dashboards/User/Notifications/notificationHelpers";
import { useAuthContext } from "../auth/useAuthContext";
import { UnreadNotificationsContext } from "./unreadNotificationsContext";

// A tab that comes back into view refetches the count, but not more often
// than this. There is no polling interval.
const VISIBLE_REFRESH_MIN_MS = 60_000;

/*
 * Single owner of the unread notification count shown by the header bell and
 * the sidebar. It calls GET /notifications/unread-count once per signed-in
 * session, again on `refresh()`, and when the browser tab becomes visible
 * after at least a minute.
 *
 * `setCount(value)` takes the `unread_count` that other notification
 * responses already carry (the list, mark-read, mark-all-read), so the badge
 * always shows a backend figure and is never decremented locally. A count
 * given this way wins over a fetch that was already in flight.
 */
export default function UnreadNotificationsProvider({ children }) {
  const { token } = useAuthContext();
  // `token` ties the result to the session it belongs to, so a previous
  // session's count is never shown after logout or a new login.
  const [result, setResult] = useState({ token: null, count: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const versionRef = useRef(0);
  const lastLoadRef = useRef(0);

  useEffect(() => {
    if (!token) return undefined;

    const controller = new AbortController();
    const version = versionRef.current;
    lastLoadRef.current = Date.now();

    notificationsApi
      .unreadCount({ signal: controller.signal })
      .then((response) => {
        if (versionRef.current !== version) return;
        const count = toUnreadCount(response?.data?.unread_count);

        setResult(
          count == null
            ? { token, count: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) }
            : { token, count, error: null },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        if (versionRef.current !== version) return;
        // A 401 already went through the session-expired flow in apiClient.
        setResult({ token, count: null, error });
      });

    return () => controller.abort();
  }, [reloadKey, token]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const setCount = useCallback(
    (value) => {
      const count = toUnreadCount(value);

      if (count == null) {
        // The response didn't carry a usable count: ask the backend.
        refresh();
        return;
      }

      versionRef.current += 1;
      setResult({ token, count, error: null });
    },
    [refresh, token],
  );

  useEffect(() => {
    if (!token || typeof document === "undefined") return undefined;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadRef.current < VISIBLE_REFRESH_MIN_MS) return;
      refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refresh, token]);

  const isCurrent = Boolean(token) && result.token === token;

  const value = useMemo(
    () => ({
      count: isCurrent ? result.count : null,
      error: isCurrent ? result.error : null,
      loading: Boolean(token) && !isCurrent,
      refresh,
      setCount,
    }),
    [isCurrent, refresh, result, setCount, token],
  );

  return (
    <UnreadNotificationsContext.Provider value={value}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
}
