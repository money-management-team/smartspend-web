import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * The S04A body of Home, Activity and Planning: a plain explanation, with no
 * figures, accounts or transactions, so nothing here can be mistaken for the
 * user's real records.
 */
export default function PlaceholderScreen({ id }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-page" data-sm-screen={id} aria-labelledby={`sm-${id}-heading`}>
      <div className="sm-card">
        <h2 id={`sm-${id}-heading`} className="sm-card-title">{t("placeholder.heading")}</h2>
        <p className="sm-text">{t("placeholder.body")}</p>
        <p className="sm-text">{t("placeholder.nothing")}</p>
        <p className="sm-text sm-muted">{t("placeholder.full")}</p>
      </div>
    </section>
  );
}
