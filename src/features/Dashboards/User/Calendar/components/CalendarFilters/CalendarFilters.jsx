import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { CALENDAR_EVENT_TYPES, hasActiveCalendarFilters } from "../../calendarHelpers";

import "./CalendarFilters.css";

const toggle = (values, value) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/*
 * Backend filters for GET /calendar: event types (`types[]`), statuses
 * (`statuses[]`) and owner. Nothing selected means every type / status.
 * The status choices are the statuses the backend reported for the period
 * (`summary.by_status`) plus any already selected, so no value is invented.
 */
export default function CalendarFilters({ filters, statusOptions, onChange, onClear }) {
  const { t, i18n } = useTranslation();

  return (
    <div className="calendar-filters" role="group" aria-label={t("dashboard.calendar.filters.label")}>
      <fieldset className="calendar-filters__group">
        <legend>{t("dashboard.calendar.filters.types")}</legend>
        <div className="calendar-filters__chips">
          {CALENDAR_EVENT_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={`calendar-filters__chip calendar-filters__chip--${type}${filters.types.includes(type) ? " calendar-filters__chip--active" : ""}`}
              aria-pressed={filters.types.includes(type)}
              onClick={() => onChange({ types: toggle(filters.types, type) })}
            >
              <span className="calendar-filters__swatch" aria-hidden="true" />
              {t(`dashboard.calendar.types.${type}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {statusOptions.length > 0 && (
        <fieldset className="calendar-filters__group">
          <legend>{t("dashboard.calendar.filters.statuses")}</legend>
          <div className="calendar-filters__chips">
            {statusOptions.map((status) => (
              <button
                type="button"
                key={status}
                className={`calendar-filters__chip${filters.statuses.includes(status) ? " calendar-filters__chip--active" : ""}`}
                aria-pressed={filters.statuses.includes(status)}
                onClick={() => onChange({ statuses: toggle(filters.statuses, status) })}
              >
                {translateEnum(t, i18n, "dashboard.calendar.statuses", status)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="calendar-filters__end">
        <label className="calendar-filters__field">
          <span>{t("dashboard.calendar.filters.owner")}</span>
          <select value={filters.owner} onChange={(event) => onChange({ owner: event.target.value })}>
            <option value="">{t("dashboard.calendar.filters.ownerAny")}</option>
            <option value="mine">{t("dashboard.calendar.filters.ownerMine")}</option>
          </select>
        </label>

        {hasActiveCalendarFilters(filters) && (
          <button type="button" className="calendar-filters__clear" onClick={onClear}>
            <LuX aria-hidden="true" />
            <span>{t("dashboard.calendar.filters.clear")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
