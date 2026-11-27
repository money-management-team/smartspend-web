import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useResourceStore } from "../identity/storeContext.js";

// A read younger than this is shown as it is when a screen opens again.
const FRESH_MS = 60_000;

/*
 * One read of the identity scope's store, loaded when the screen needs it.
 *
 * `loader` receives an AbortSignal and must be stable (a module function, or
 * memoised on its inputs). A key that has never been read, or whose last read
 * is older than a minute, is read on mount; `reload` reads it again on demand
 * (the Retry and Refresh buttons) and is the only other way a read starts.
 * There is no polling and no background refresh. With `enabled: false` nothing
 * is read (an address that is not a valid id, for instance).
 */
export function useResource(key, loader, { enabled = true } = {}) {
  const store = useResourceStore();
  const entry = useSyncExternalStore(store.subscribe, () => store.get(key), () => store.get(key));

  const reload = useCallback(() => store.load(key, loader), [store, key, loader]);

  // An entry that goes back to idle while this screen is mounted was dropped (a write that may have changed it: forms/useWorkflowSubmit.js):
  // it is read again here, instead of leaving the screen on its loading state until it is opened anew.
  const dropped = entry.status === "idle";

  useEffect(() => {
    const current = store.get(key);
    const fresh = current.status === "ready" && Date.now() - current.updatedAt < FRESH_MS;
    const running = current.status === "loading" || current.status === "refreshing";

    if (enabled && !fresh && !running) store.load(key, loader);
  }, [store, key, loader, enabled, dropped]);

  return {
    status: entry.status,
    data: entry.data,
    error: entry.error,
    updatedAt: entry.updatedAt,
    loading: entry.status === "idle" || entry.status === "loading",
    refreshing: entry.status === "refreshing",
    stale: entry.status === "stale",
    reload,
  };
}
