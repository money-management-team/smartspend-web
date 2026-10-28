import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * What the shell says about the device and the app: offline (nothing can be
 * loaded or sent; nothing is queued), and an update that is ready (applied only
 * on the person's tap). Both are polite status messages, not dialogs.
 */
export default function PwaNotices({ pwa }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <>
      {!pwa.online && (
        <div className="sm-card sm-pwa-note" role="status" data-sm-pwa="offline">
          <p className="sm-text">{t("pwa.offline")}</p>
        </div>
      )}
      {pwa.updateReady && (
        <div className="sm-card sm-pwa-note" role="status" data-sm-pwa="update">
          <p className="sm-text">{t("pwa.updateReady")}</p>
          <button type="button" className="sm-button sm-button-small" onClick={pwa.update}>{t("pwa.reload")}</button>
        </div>
      )}
    </>
  );
}

/* In More: install where the browser offers it, and the steps on iPhone and iPad (no install prompt exists there). */
export function InstallCard({ pwa, enabled }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  if (!enabled) return null;
  const nav = globalThis.navigator;
  const standalone = globalThis.matchMedia?.("(display-mode: standalone)")?.matches || nav?.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(nav?.userAgent ?? "") || (nav?.platform === "MacIntel" && nav?.maxTouchPoints > 1);
  if (standalone) return null;

  return (
    <div className="sm-card" data-sm-pwa="install">
      <h2 className="sm-card-title">{t("pwa.installTitle")}</h2>
      {pwa.canInstall ? (
        <button type="button" className="sm-button" onClick={pwa.install}>{t("pwa.install")}</button>
      ) : ios ? (
        <p className="sm-text">{t("pwa.iosSteps")}</p>
      ) : (
        <p className="sm-text sm-muted">{t("pwa.notOffered")}</p>
      )}
      <p className="sm-text sm-muted sm-fine">{t("pwa.installNote")}</p>
    </div>
  );
}
