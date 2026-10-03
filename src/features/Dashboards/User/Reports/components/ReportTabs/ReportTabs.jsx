import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";

import { REPORT_DEFINITIONS, REPORT_GROUPS } from "../../reportDefinitions";

import "./ReportTabs.css";

/*
 * The report switcher; switching keeps the shared filters (see Reports.jsx).
 * Wide screens get a grouped side rail of buttons. Below the desktop
 * breakpoint the same choice is a native select (grouped with optgroups),
 * which fits any width and is easy to use by touch. Only one of the two is
 * displayed at a time, so assistive technology meets a single control.
 */
export default function ReportTabs({ activeReport, onChange }) {
  const { t } = useTranslation();
  const selectId = useId();

  return (
    <nav className="report-tabs" aria-label={t("dashboard.reports.tabs.label")}>
      <div className="report-tabs__rail">
        {REPORT_GROUPS.map((group) => (
          <div className="report-tabs__group" key={group.id}>
            <span className="report-tabs__group-label">{t(`dashboard.reports.tabs.groups.${group.id}`)}</span>

            <ul className="report-tabs__list">
              {group.reports.map((report) => {
                const Icon = REPORT_DEFINITIONS[report].icon;
                const isActive = report === activeReport;

                return (
                  <li key={report}>
                    <button
                      type="button"
                      className={`report-tab ${isActive ? "report-tab--active" : ""}`}
                      aria-pressed={isActive}
                      onClick={() => onChange(report)}
                    >
                      <span className="report-tab__icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="report-tab__label">{t(`dashboard.reports.names.${report}`)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="report-tabs__picker">
        <label className="report-tabs__picker-label" htmlFor={selectId}>
          {t("dashboard.reports.tabs.label")}
        </label>
        <div className="report-tabs__select">
          <select id={selectId} value={activeReport} onChange={(event) => onChange(event.target.value)}>
            {REPORT_GROUPS.map((group) => (
              <optgroup key={group.id} label={t(`dashboard.reports.tabs.groups.${group.id}`)}>
                {group.reports.map((report) => (
                  <option key={report} value={report}>
                    {t(`dashboard.reports.names.${report}`)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <LuChevronDown aria-hidden="true" />
        </div>
      </div>
    </nav>
  );
}
