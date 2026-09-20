import { useTranslation } from "react-i18next";

import { REPORT_DEFINITIONS } from "../../reportDefinitions";
import { REPORT_NAMES } from "../../reportHelpers";

import "./ReportTabs.css";

// One button per report; switching keeps the shared filters (see Reports.jsx).
export default function ReportTabs({ activeReport, onChange }) {
  const { t } = useTranslation();

  return (
    <nav className="report-tabs" aria-label={t("dashboard.reports.tabs.label")}>
      <div className="report-tabs__list">
        {REPORT_NAMES.map((report) => {
          const Icon = REPORT_DEFINITIONS[report].icon;
          const isActive = report === activeReport;

          return (
            <button
              key={report}
              type="button"
              className={`report-tab ${isActive ? "report-tab--active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onChange(report)}
            >
              <Icon aria-hidden="true" />
              <span>{t(`dashboard.reports.names.${report}`)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
