import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate } from "../../../utils/formatters";
import { getEventKey } from "../../calendarHelpers";
import CalendarEvent from "../CalendarEvent/CalendarEvent";

import "./CalendarAgenda.css";

/*
 * The period's events as a list grouped by day (every event, or only the day
 * selected in the grid). `groups` is `[{ date, events }]` in date order.
 */
export default function CalendarAgenda({ groups, today, selectedDate, onShowAll }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  return (
    <section className="calendar-agenda" aria-labelledby="calendar-agenda-title">
      <header className="calendar-agenda__header">
        <h3 id="calendar-agenda-title">
          {selectedDate ? (
            t("dashboard.calendar.agenda.selectedDay", { date: formatDate(selectedDate, locale) })
          ) : (
            t("dashboard.calendar.agenda.title")
          )}
        </h3>

        {selectedDate && (
          <button type="button" className="calendar-agenda__show-all" onClick={onShowAll}>
            {t("dashboard.calendar.agenda.showAll")}
          </button>
        )}
      </header>

      {groups.length === 0 ? (
        <p className="calendar-agenda__empty">{t("dashboard.calendar.states.emptyDay")}</p>
      ) : (
        <ol className="calendar-agenda__days">
          {groups.map(({ date, events }) => (
            <li key={date || "undated"} className="calendar-agenda__day">
              <h4 className="calendar-agenda__date">
                {date ? <bdi>{formatDate(date, locale)}</bdi> : t("dashboard.calendar.agenda.noDate")}
                {date === today && <span className="calendar-agenda__today">{t("dashboard.calendar.nav.today")}</span>}
              </h4>

              <ul className="calendar-agenda__events">
                {events.map((event, index) => (
                  <CalendarEvent key={getEventKey(event, index)} event={event} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
