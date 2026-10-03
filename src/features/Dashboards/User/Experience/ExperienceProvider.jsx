import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import appI18n from "../../../../i18n";
import { ExperienceContext } from "./experienceContext";
import { createExperienceStore } from "./experienceStore";
import { experienceMessages } from "./experienceMessages";
import "./Experience.css";

Object.entries(experienceMessages).forEach(([language, messages]) =>
  appI18n.addResourceBundle(language, "experience", messages, true, true),
);

export default function ExperienceProvider({ children }) {
  const { user, workspace } = useAuthContext();
  const store = useMemo(() => {
    let storage;
    try {
      storage = window.localStorage;
    } catch {
      /* Browsers can deny storage. */
    }
    return createExperienceStore({
      userId: user?.id,
      workspaceId: workspace?.id,
      storage,
      eventTarget: window,
    });
  }, [user?.id, workspace?.id]);
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.connect(), [store]);
  const value = useMemo(
    () => ({ preferences, update: store.update, workspaceId: workspace?.id }),
    [preferences, store, workspace?.id],
  );
  return (
    <ExperienceContext.Provider value={value}>
      <div
        className="experience-root"
        data-money-private={preferences.hiddenMoney ? "true" : undefined}
      >
        {children}
      </div>
    </ExperienceContext.Provider>
  );
}
