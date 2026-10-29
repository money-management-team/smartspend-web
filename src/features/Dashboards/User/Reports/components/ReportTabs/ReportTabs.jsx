import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import { REPORT_GROUPS } from "../../reportDefinitions";
import "./ReportTabs.css";

// One accessible grouped select on every screen size; every report remains available.
export default function ReportTabs({ activeReport, onChange }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <nav className="report-tabs" aria-label={t("dashboard.reports.tabs.label")}>
      <label className="report-tabs__picker-label" htmlFor={id}>{t("dashboard.reports.tabs.label")}</label>
      <div className="report-tabs__select">
        <select id={id} value={activeReport} onChange={(event) => onChange(event.target.value)}>
          {REPORT_GROUPS.map((group) => <optgroup key={group.id} label={t(`dashboard.reports.tabs.groups.${group.id}`)}>
            {group.reports.map((report) => <option key={report} value={report}>{t(`dashboard.reports.names.${report}`)}</option>)}
          </optgroup>)}
        </select>
        <LuChevronDown aria-hidden="true" />
      </div>
    </nav>
  );
}
