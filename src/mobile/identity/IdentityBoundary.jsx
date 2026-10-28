import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { createResourceStore } from "../data/resourceStore.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MoneyPrivacyProvider } from "../money/MoneyPrivacy.jsx";
import { createIdentityGuard, identityOf } from "./guard.js";
import { GuardContext } from "./guardContext.js";
import { StoreContext, reloadPage } from "./storeContext.js";

const SESSION_KEYS = /^(ACCESS_TOKEN|token|token_type|user|ROLE|workspace|remember_login)$/;

function IdentityChanged({ reason }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <div className="sm-root sm-identity" role="alert" data-sm-identity={reason}>
      <div className="sm-identity-body">
        <h1 className="sm-identity-title">{t("identity.title")}</h1>
        <p className="sm-text">{t(`identity.${reason}`)}</p>
        <p className="sm-text sm-muted">{t("identity.hidden")}</p>
        <button type="button" className="sm-button" onClick={reloadPage}>{t("identity.reload")}</button>
      </div>
    </div>
  );
}

function IdentityScope({ identity, children }) {
  const [guard] = useState(() => createIdentityGuard(identity));
  const [store] = useState(() => createResourceStore(guard));
  const status = useSyncExternalStore(guard.subscribe, guard.getStatus, guard.getStatus);

  // The moment the guard fails, every figure held in memory is dropped and
  // every request in flight is cancelled, before the screen has re-rendered.
  useEffect(() => guard.subscribe(() => store.dispose()), [guard, store]);

  // Re-check whenever the tab could have missed a change: another tab writing
  // storage, this tab coming back to the foreground, or a page restored from
  // the back/forward cache.
  useEffect(() => {
    const recheck = () => guard.check();
    const onStorage = (event) => {
      // key === null is "storage was cleared".
      if (event.key === null || SESSION_KEYS.test(event.key)) guard.check();
    };

    guard.check();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [guard]);

  // Leaving Mobile (or signing out) drops the data too.
  useEffect(() => () => store.clear(), [store]);

  if (!status.ok) return <IdentityChanged reason={status.reason} />;

  return (
    <GuardContext.Provider value={guard}>
      <StoreContext.Provider value={store}>
        <MoneyPrivacyProvider>{children}</MoneyPrivacyProvider>
      </StoreContext.Provider>
    </GuardContext.Provider>
  );
}

/*
 * Everything that shows or fetches financial data in Mobile sits inside this.
 * It is keyed by the session, so a different token or user is a different
 * scope: the old scope unmounts and takes its data with it. It uses the app's
 * one AuthProvider (no second auth context) and stores nothing: not the token
 * (only a fingerprint of it, in memory), not any financial payload.
 */
export default function IdentityBoundary({ children }) {
  const { token, user } = useAuthContext();
  const identity = identityOf(token, user?.id);
  const scopeKey = `${identity.fingerprint}:${identity.userId ?? ""}`;

  return (
    <IdentityScope key={scopeKey} identity={identity}>
      {children}
    </IdentityScope>
  );
}
