import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_PREFIX } from "../navigation.js";
import { usePresentation } from "../presentation/usePresentation.js";

/*
 * /m/enter: the explicit way into Mobile for someone whose stored choice is
 * the full version (or whose device is not a phone). Nothing links here from
 * Desktop pages and nothing sends anyone here: it is for a bookmark, a link
 * someone shares, or typing the address. Opening it changes nothing by
 * itself; one tap on "Open Mobile" stores the choice, and "Stay" leaves it as
 * it was. Someone already in Mobile is simply taken to Home.
 */
export default function MobileEnter() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { mode, setPreference } = usePresentation();

  if (mode === "mobile") return <Navigate to={MOBILE_PREFIX} replace />;

  return (
    <div className="sm-root sm-standalone" data-sm-screen="enter">
      <main className="sm-standalone-body">
        <h1 className="sm-identity-title">{t("enter.title")}</h1>
        <p className="sm-text">{t("enter.body")}</p>
        <button type="button" className="sm-button" onClick={() => setPreference("mobile")}>{t("enter.open")}</button>
        <Link className="sm-button sm-button-quiet" to={PATH.USER.DASHBOARD}>{t("enter.stay")}</Link>
      </main>
    </div>
  );
}
