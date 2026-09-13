import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";

import "./CalendarSummary.css";

const GROUPS = [
  { key: "byType", label: "byType", prefix: "dashboard.calendar.types" },
  { key: "byStatus", label: "byStatus", prefix: "dashboard.calendar.statuses" },
  { key: "bySeverity", label: "bySeverity", prefix: "dashboard.calendar.severities" },
];

/*
 * The backend's `summary` for the period and filters: `total`, `by_type`,
 * `by_status`, `by_severity`. Nothing is recounted from the visible events.
 */
export default function CalendarSummary({ summary }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  if (!summary) return null;

  const groups = GROUPS.filter(({ key }) => summary[key].length > 0);

  return (
    <section className="calendar-summary" aria-label={t("dashboard.calendar.summary.label")}>
      {summary.total != null && (
        <p className="calendar-summary__total">
          <strong>
            <bdi>{summary.total.toLocaleString(locale)}</bdi>
          </strong>
          <span>{t("dashboard.calendar.summary.events", { count: summary.total })}</span>
        </p>
      )}

      {groups.map(({ key, label, prefix }) => (
        <div className="calendar-summary__group" key={key}>
          <h3>{t(`dashboard.calendar.summary.${label}`)}</h3>
          <ul>
            {summary[key].map(([value, count]) => (
              <li key={value} className={`calendar-summary__count calendar-summary__count--${value}`}>
                <strong>
                  <bdi>{count.toLocaleString(locale)}</bdi>
                </strong>
                <span>{translateEnum(t, i18n, prefix, value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
