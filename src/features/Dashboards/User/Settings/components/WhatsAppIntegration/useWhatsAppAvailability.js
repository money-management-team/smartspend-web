import { useCallback, useEffect, useState } from "react";

import { whatsappApi } from "../../../api/whatsappApi.js";
import { parseWhatsAppAvailability } from "../../../FinancialOperations/whatsappContract.js";

/*
 * Reads GET /integrations/whatsapp. Same keyed-request pattern as the
 * dashboard pages: a result belongs to the request that produced it, so a
 * reload shows the loading state without setting state inside the effect.
 *
 * `replaceIntegration` applies a fresh integration from a save response
 * without another request; availability itself always comes from the server.
 */
export function useWhatsAppAvailability(api = whatsappApi) {
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    api
      .getIntegration({ signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult({ key: reloadKey, data: parseWhatsAppAvailability(response), error: null });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        // A failed background refresh keeps what is already on screen.
        setResult((current) => (current.key === reloadKey && current.data
          ? current
          : { key: reloadKey, data: null, error }));
      });

    return () => controller.abort();
  }, [api, reloadKey, refreshKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  // Re-reads in the background: the current screen stays put meanwhile.
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const replaceIntegration = useCallback((integration) => {
    setResult((current) => (current.data
      ? { ...current, data: { ...current.data, integration } }
      : current));
  }, []);

  const loading = result.key !== reloadKey;

  return {
    loading,
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    reload,
    refresh,
    replaceIntegration,
  };
}
