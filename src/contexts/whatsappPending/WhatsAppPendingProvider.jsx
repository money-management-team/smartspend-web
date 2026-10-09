import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AuthContext } from "../auth/authContext.js";
import { ApiError } from "../../features/Dashboards/User/api/apiClient.js";
import { whatsappApi } from "../../features/Dashboards/User/api/whatsappApi.js";
import { parseDraftSummaryResponse } from "../../features/Dashboards/User/FinancialOperations/whatsappContract.js";
import { WhatsAppPendingContext } from "./whatsappPendingContext.js";

// Opening a page that shows the count re-reads it only if it is older than this.
const FRESH_FOR_MS = 30_000;
// A tab that returns to view re-reads it, but not more often than this. No polling.
const VISIBLE_REFRESH_MIN_MS = 60_000;

/*
 * Single owner of the backend's pending-review count
 * (GET /integrations/whatsapp/expense-drafts/summary, `pending_review_count`).
 * The sidebar, the Attention Center, the draft inbox and Settings read it
 * from here, so the dashboard makes one request instead of one per widget.
 *
 * - It is the backend's global figure for the user: never derived from rows.
 * - It does not depend on whether WhatsApp is enabled: historical drafts
 *   stay reviewable, so they stay counted.
 * - The result belongs to the signed-in user (`userId`) and reload number.
 *   After logout or a different user, the old number is never returned (the
 *   hook reports "loading" until that user's own answer arrives).
 * - `refresh()` forces a re-read (after confirm/discard, on a manual refresh);
 *   `ensureFresh()` re-reads only when the last answer is old. A newer request
 *   cancels an older one, and an older answer never replaces a newer one.
 * - Nothing is stored in the browser.
 */
export default function WhatsAppPendingProvider({ children, api = whatsappApi, userId: userIdProp }) {
  const auth = useContext(AuthContext);
  const signedIn = Boolean(auth && (auth.isAuthenticated ?? auth.token));
  const userId = userIdProp ?? (signedIn ? (auth.user?.id ?? "session") : null);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, count: null, error: null });
  // When the last answer arrived; null while a request is in flight (or none yet),
  // so a page asking "is it fresh?" never starts a second, duplicate request.
  const loadedAtRef = useRef(null);
  const key = userId == null ? null : `${userId}#${reloadKey}`;

  useEffect(() => {
    if (key == null) return undefined;

    const controller = new AbortController();
    loadedAtRef.current = null;

    api
      .getDraftSummary({ signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        loadedAtRef.current = Date.now();
        setResult({ key, count: parseDraftSummaryResponse(response).pendingReviewCount, error: null });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        loadedAtRef.current = Date.now();
        setResult({
          key,
          count: null,
          error: error instanceof ApiError ? error : new ApiError("", { code: "MALFORMED_RESPONSE" }),
        });
      });

    return () => controller.abort();
  }, [api, key]);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  const ensureFresh = useCallback(() => {
    const loadedAt = loadedAtRef.current;
    if (loadedAt !== null && Date.now() - loadedAt > FRESH_FOR_MS) setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (key == null || typeof document === "undefined") return undefined;

    const onVisible = () => {
      const loadedAt = loadedAtRef.current;
      if (document.visibilityState === "visible" && loadedAt !== null && Date.now() - loadedAt >= VISIBLE_REFRESH_MIN_MS) {
        setReloadKey((value) => value + 1);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [key]);

  const current = key != null && result.key === key;
  // While a re-read of the SAME user is in flight the last known number stays
  // (a badge must not flicker); a different user never sees it.
  const sameUser = key != null && typeof result.key === "string" && result.key.split("#")[0] === String(userId);

  const value = useMemo(() => ({
    count: sameUser ? result.count : null,
    loading: key != null && !current && !sameUser,
    error: current ? result.error : null,
    refresh,
    ensureFresh,
  }), [current, ensureFresh, key, refresh, result.count, result.error, sameUser]);

  return <WhatsAppPendingContext.Provider value={value}>{children}</WhatsAppPendingContext.Provider>;
}
