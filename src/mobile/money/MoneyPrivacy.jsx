import { useEffect, useMemo, useSyncExternalStore } from "react";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { createExperienceStore } from "../../features/Dashboards/User/Experience/experienceStore.js";
import { MoneyPrivacyContext } from "./privacyContext.js";

function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/*
 * Follows the "hide amounts" device preference that the full app already
 * keeps (Display preferences), so a person who chose to hide their balances
 * does not see them again just because they opened the Mobile version.
 *
 * It reads that one setting through the full app's own preference store and
 * never writes it: Mobile has no control for it, and the store's `update` is
 * not called anywhere in src/mobile (tests/mobileReadOnly.test.mjs).
 */
export function MoneyPrivacyProvider({ children }) {
  const { user, workspace } = useAuthContext();
  const store = useMemo(
    () => createExperienceStore({ userId: user?.id, workspaceId: workspace?.id, storage: deviceStorage(), eventTarget: window }),
    [user?.id, workspace?.id],
  );
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => store.connect(), [store]);

  return <MoneyPrivacyContext.Provider value={preferences.hiddenMoney === true}>{children}</MoneyPrivacyContext.Provider>;
}
