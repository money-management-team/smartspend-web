import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuArrowUpRight, LuCalendarDays, LuChartPie, LuHandCoins, LuRepeat2, LuTarget } from "react-icons/lu";

import { getSubjectPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney } from "../../../Dashboard/dashboardHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { getEventActions, getEventSeverity, getEventTypeClass } from "../../calendarHelpers";

import "./CalendarEvent.css";

const TYPE_ICONS = {
  recurring_occurrence: LuRepeat2,
  debt_due: LuHandCoins,
  budget_period_end: LuChartPie,
  savings_goal_target: LuTarget,
  other: LuCalendarDays,
};
const DIRECTIONS = ["income", "expense"];

/*
 * One calendar event, rendered from the backend's fields only. Optional
 * fields (amount, currency_code, direction, occurrence_status) are shown only
 * when present; the status is the backend's, never derived here.
 *
 * `subject_type` + `subject_id` map to the source record's page
 * (`getSubjectPath`). The event's `actions` open that same page, where the
 * resource's own flow runs: the calendar itself never changes anything.
 * Without a known route there is no link and no action.
 */
export default function CalendarEvent({ event }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const type = getEventTypeClass(event);
  const severity = getEventSeverity(event);
  const path = getSubjectPath(event.subject_type, event.subject_id);
  const actions = path ? getEventActions(event) : [];
  const typeLabel = translateEnum(t, i18n, "dashboard.calendar.types", event.type) || t("dashboard.calendar.types.other");
  const title = event.title || typeLabel;
  const hasAmount = event.amount != null && event.amount !== "";
  const direction = DIRECTIONS.includes(event.direction) ? event.direction : null;

  return (
    <li className={`calendar-event calendar-event--${type} calendar-event--${severity}`}>
      <span className="calendar-event__icon" aria-hidden="true">
        {createElement(TYPE_ICONS[type])}
      </span>

      <div className="calendar-event__copy">
        <div className="calendar-event__heading">
          <span className="calendar-event__type">{typeLabel}</span>

          {event.status && (
            <span className={`calendar-event__status calendar-event__status--${severity}`}>
              {translateEnum(t, i18n, "dashboard.calendar.statuses", event.status)}
            </span>
          )}

          {event.occurrence_status && event.occurrence_status !== event.status && (
            <span className="calendar-event__status">
              {translateEnum(t, i18n, "dashboard.recurring.occurrenceStatuses", event.occurrence_status)}
            </span>
          )}

          {severity !== "info" && (
            <span className={`calendar-event__severity calendar-event__severity--${severity}`}>
              {translateEnum(t, i18n, "dashboard.calendar.severities", event.severity)}
            </span>
          )}
        </div>

        <h4 className="calendar-event__title" dir="auto">
          {path ? (
            <Link to={path} className="calendar-event__link">
              {title}
            </Link>
          ) : (
            title
          )}
        </h4>

        {(hasAmount || direction) && (
          <p className="calendar-event__meta">
            {direction && (
              <span className={`calendar-event__direction calendar-event__direction--${direction}`}>
                {translateEnum(t, i18n, "dashboard.transactions.types", direction)}
              </span>
            )}
            {hasAmount && (
              <strong className="calendar-event__amount">
                <bdi dir="ltr">
                  {/* Without a currency the amount is shown as sent. */}
                  {event.currency_code
                    ? formatOptionalMoney(event.amount, event.currency_code, locale)
                    : event.amount}
                </bdi>
              </strong>
            )}
          </p>
        )}
      </div>

      {path && (
        <div className="calendar-event__actions" role="group" aria-label={t("dashboard.calendar.event.actionsLabel")}>
          {actions.map((action) => (
            <Link key={action} to={path} className="calendar-event__action">
              {translateEnum(t, i18n, "dashboard.calendar.actions", action)}
            </Link>
          ))}

          <Link
            to={path}
            className="calendar-event__action calendar-event__action--open"
            aria-label={t("dashboard.calendar.event.openLabel", { title })}
          >
            <LuArrowUpRight className="calendar-event__open-icon" aria-hidden="true" />
            <span>{t("dashboard.calendar.event.open")}</span>
          </Link>
        </div>
      )}
    </li>
  );
}
