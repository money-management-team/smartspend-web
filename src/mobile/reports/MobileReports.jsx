import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { REPORT_TYPES } from "../models/reports.js";
import { MOBILE_EXPORTS, reportPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/*
 * The ten reports, as one list to choose from. Every report is read-only; the
 * export history is beside them. Building a PDF and queueing a CSV or Excel
 * export happen in the full version.
 */
export default function MobileReports() {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  return (
    <section className="sm-page" data-sm-screen="reports">
      <p className="sm-text">{t("reports.intro")}</p>
      <ul className="sm-card sm-list" aria-label={t("reports.listLabel")}>
        {REPORT_TYPES.map((type) => (
          <li key={type}>
            <Link className="sm-link-row" to={reportPath(type)} data-sm-report={type}>
              <span className="sm-row-main">
                <span className="sm-row-title">{t(`reports.type.${type}.title`)}</span>
                <span className="sm-row-meta">{t(`reports.type.${type}.hint`)}</span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>

      <div className="sm-card">
        <h2 className="sm-card-title">{t("reports.exportsTitle")}</h2>
        <p className="sm-text sm-muted">{t("reports.exportsBody")}</p>
        <Link className="sm-link-row" to={MOBILE_EXPORTS}>
          <span>{t("reports.exportsHistory")}</span>
          <Chevron />
        </Link>
        <Link className="sm-link-row" to={PATH.USER.REPORTS}>
          <span>{t("reports.openFull")}</span>
          <Chevron />
        </Link>
      </div>
    </section>
  );
}
