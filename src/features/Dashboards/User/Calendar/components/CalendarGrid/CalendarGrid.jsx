import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate } from "../../../utils/formatters";
import {
  getEventKey,
  getEventSeverity,
  getEventTypeClass,
  getWeekdayNames,
  MONTH_CELL_LIMIT,
} from "../../calendarHelpers";

import "./CalendarGrid.css";

/*
 * Month or week grid. Each day is a button that selects it, so the agenda
 * below lists that day's events in full (links and actions live there).
 * Cells show the event titles, coloured by type; a month cell shows the first
 * few and "+N more". Days outside the period (padding to full weeks) are
 * dimmed and have no events.
 */
export default function CalendarGrid({ days, eventsByDate, view, weekStart, today, selectedDate, onSelectDate }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const weekdays = getWeekdayNames(locale, weekStart);
  const limit = view === "month" ? MONTH_CELL_LIMIT : Infinity;
  const dayNumber = new Intl.NumberFormat(locale);

  return (
    <div className={`calendar-grid calendar-grid--${view}`}>
      <div className="calendar-grid__weekdays" aria-hidden="true">
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="calendar-grid__days">
        {days.map(({ date, inPeriod }) => {
          const events = inPeriod ? (eventsByDate.get(date) ?? []) : [];
          const visible = events.slice(0, limit);
          const hidden = events.length - visible.length;
          const isSelected = date === selectedDate;
          const classes = [
            "calendar-grid__day",
            !inPeriod && "calendar-grid__day--outside",
            date === today && "calendar-grid__day--today",
            isSelected && "calendar-grid__day--selected",
            events.length > 0 && "calendar-grid__day--has-events",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              type="button"
              key={date}
              className={classes}
              onClick={() => onSelectDate(isSelected ? null : date)}
              disabled={!inPeriod}
              aria-pressed={inPeriod ? isSelected : undefined}
              aria-current={date === today ? "date" : undefined}
              aria-label={t("dashboard.calendar.grid.dayLabel", {
                date: formatDate(date, locale),
                count: events.length,
              })}
            >
              <span className="calendar-grid__number">{dayNumber.format(Number(date.slice(8)))}</span>

              {visible.length > 0 && (
                <span className="calendar-grid__events" aria-hidden="true">
                  {visible.map((event, index) => (
                    <span
                      key={getEventKey(event, index)}
                      className={`calendar-grid__event calendar-grid__event--${getEventTypeClass(event)} calendar-grid__event--${getEventSeverity(event)}`}
                      dir="auto"
                    >
                      {event.title || t(`dashboard.calendar.types.${getEventTypeClass(event)}`)}
                    </span>
                  ))}
                  {hidden > 0 && (
                    <span className="calendar-grid__more">{t("dashboard.calendar.grid.more", { count: hidden })}</span>
                  )}
                </span>
              )}

              {events.length > 0 && (
                <span className="calendar-grid__dots" aria-hidden="true">
                  {events.slice(0, 4).map((event, index) => (
                    <span
                      key={getEventKey(event, index)}
                      className={`calendar-grid__dot calendar-grid__dot--${getEventTypeClass(event)}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
