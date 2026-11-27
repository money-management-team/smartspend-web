import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_SCREENS } from "../navigation.js";

/* An unknown /m/... address: say so, and offer the way back. */
export default function MobileNotAvailable() {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-page" data-sm-screen="not-available">
      <div className="sm-card">
        <h2 className="sm-card-title">{t("titles.notAvailable")}</h2>
        <p className="sm-text">{t("notAvailable.body")}</p>
        <Link className="sm-button" to={MOBILE_SCREENS[0].mobile} replace>{t("notAvailable.home")}</Link>
      </div>
    </section>
  );
}
