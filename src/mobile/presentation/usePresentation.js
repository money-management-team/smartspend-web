import { useCallback, useSyncExternalStore } from "react";

import {
  PRESENTATION_EVENT,
  PRESENTATION_KEY,
  detectEnvironment,
  readPreference,
  resolveMode,
  writePreference,
} from "./preference.js";

function subscribe(notify) {
  const onStorage = (event) => {
    if (event.key === null || event.key === PRESENTATION_KEY) notify();
  };

  window.addEventListener(PRESENTATION_EVENT, notify);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PRESENTATION_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

/*
 * The stored choice (auto | mobile | desktop), the mode it resolves to, and a
 * setter. The device is read when this renders, not watched, so rotating a
 * phone or resizing a window never changes the mode by itself.
 */
export function usePresentation() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "auto");
  const setPreference = useCallback((next) => writePreference(next), []);

  return {
    preference,
    mode: resolveMode(preference, detectEnvironment()),
    setPreference,
  };
}
