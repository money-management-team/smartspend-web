import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatClock } from "../money/format.js";
import ErrorPanel from "./ErrorPanel.jsx";

/*
 * Shown above figures that are from an earlier successful read of this
 * session because the latest read failed. The time says how old they are; the
 * figures themselves are not marked up as current anywhere else.
 */
export default function StaleNotice({ error, updatedAt, onRetry, retrying }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return (
    <div className="sm-stale" role="status" data-sm-stale="true">
      <p className="sm-text">{t("stale.notice", { time: formatClock(updatedAt, locale) })}</p>
      <ErrorPanel error={error} onRetry={onRetry} retrying={retrying} compact />
    </div>
  );
}
