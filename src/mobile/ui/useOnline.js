import { useSyncExternalStore } from "react";

function subscribe(notify) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);

  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** navigator.onLine, kept current. It only describes the device's link, not whether SmartSpend is reachable. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);
