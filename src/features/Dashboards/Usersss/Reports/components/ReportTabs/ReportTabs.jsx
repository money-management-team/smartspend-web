import { useTranslation } from "react-i18next";

import "./ReportTabs.css";

const tabs = [
  "monthly",
  "income",
  "expense",
];

export default function ReportTabs({
  activeReport,
  onChange,
}) {
  const { t } = useTranslation();

  return (
    <div className="report-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`report-tab ${
            activeReport === tab
              ? "report-tab--active"
              : ""
          }`}
          onClick={() => onChange(tab)}
        >
          {t(
            `dashboard.reports.tabs.${tab}`,
          )}
        </button>
      ))}
    </div>
  );
}