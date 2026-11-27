import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { createExperienceStore } from "../../features/Dashboards/User/Experience/experienceStore.js";
import { MoneyPrivacyContext, MoneyPrivacyToggleContext } from "./privacyContext.js";

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
 * It reads and changes that one setting through the full app's own
 * preference store, so the choice is the same in both versions on this device.
 * `update` is called here only, and only with `hiddenMoney`
 * (tests/mobileReadOnly.test.mjs); the store keys it by person and workspace.
 */
export function MoneyPrivacyProvider({ children }) {
  const { user, workspace } = useAuthContext();
  const store = useMemo(
    () => createExperienceStore({ userId: user?.id, workspaceId: workspace?.id, storage: deviceStorage(), eventTarget: window }),
    [user?.id, workspace?.id],
  );
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => store.connect(), [store]);
  const setHidden = useCallback((hidden) => store.update({ hiddenMoney: hidden === true }), [store]);

  return (
    <MoneyPrivacyToggleContext.Provider value={setHidden}>
      <MoneyPrivacyContext.Provider value={preferences.hiddenMoney === true}>{children}</MoneyPrivacyContext.Provider>
    </MoneyPrivacyToggleContext.Provider>
  );
}
