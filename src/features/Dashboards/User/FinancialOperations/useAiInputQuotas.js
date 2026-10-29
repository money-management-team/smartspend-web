import { useEffect, useState, useSyncExternalStore } from "react";
import { createAiInputQuotaStore } from "../api/aiInputQuotaStore.js";

export default function useAiInputQuotas(enabled = true) {
  const [store] = useState(() => createAiInputQuotaStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (!enabled) return undefined;
    void store.refresh();
    const focus = () => { if (!document.hidden) void store.refresh(); };
    const timer = window.setInterval(() => {
      if (!document.hidden && (store.needsRefresh() && !store.getSnapshot().error ||
          Object.values(store.getSnapshot().minuteUntil).some((until) => until > 0 && until <= Date.now()))) void store.refresh();
    }, 15000);
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); store.cancel(); };
  }, [enabled, store]);
  return { store, state };
}
