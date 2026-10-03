import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

import { CALENDAR_VIEWS, getRangeError, MAX_RANGE_DAYS } from "../../calendarHelpers";

import "./CalendarToolbar.css";

/*
 * Period controls: Month / Week / Date range, previous / today / next for
 * month and week, and a from–to form for the range. Nothing is requested
 * until a range is applied, and only when it is valid (both dates, to >= from,
 * at most MAX_RANGE_DAYS days). The page keys this component by its filters,
 * so the draft follows back/forward navigation.
 */
export default function CalendarToolbar({
  view,
  periodLabel,
  initialRange,
  canGoPrevious,
  canGoNext,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onApplyRange,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialRange);
  const [rangeError, setRangeError] = useState("");

  const updateDraft = (event) => {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
    setRangeError("");
  };

  const applyRange = (event) => {
    event.preventDefault();
    const errorKey = getRangeError(draft.from, draft.to);

    if (errorKey) {
      setRangeError(t(`dashboard.calendar.range.errors.${errorKey}`, { max: MAX_RANGE_DAYS }));
      return;
    }

    onApplyRange(draft);
  };

  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar__row">
        <div className="calendar-toolbar__views" role="group" aria-label={t("dashboard.calendar.views.label")}>
          {CALENDAR_VIEWS.map((item) => (
            <button
              type="button"
              key={item}
              className={`calendar-toolbar__view${view === item ? " calendar-toolbar__view--active" : ""}`}
              aria-pressed={view === item}
              onClick={() => view !== item && onViewChange(item)}
            >
              {t(`dashboard.calendar.views.${item}`)}
            </button>
          ))}
        </div>

        {view !== "range" && (
          <div className="calendar-toolbar__nav">
            <button
              type="button"
              className="calendar-toolbar__arrow"
              onClick={onPrevious}
              disabled={!canGoPrevious}
              aria-label={t("dashboard.calendar.nav.previous")}
              title={t("dashboard.calendar.nav.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>

            <button type="button" className="calendar-toolbar__today" onClick={onToday}>
              {t("dashboard.calendar.nav.today")}
            </button>

            <button
              type="button"
              className="calendar-toolbar__arrow"
              onClick={onNext}
              disabled={!canGoNext}
              aria-label={t("dashboard.calendar.nav.next")}
              title={t("dashboard.calendar.nav.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <h2 className="calendar-toolbar__period" aria-live="polite">
        <bdi>{periodLabel}</bdi>
      </h2>

      {view === "range" && (
        <form className="calendar-toolbar__range" onSubmit={applyRange} noValidate>
          <label className="calendar-toolbar__field">
            <span>{t("dashboard.calendar.range.from")}</span>
            <input
              type="date"
              name="from"
              value={draft.from}
              max={draft.to || undefined}
              onChange={updateDraft}
              aria-invalid={Boolean(rangeError) || undefined}
            />
          </label>

          <label className="calendar-toolbar__field">
            <span>{t("dashboard.calendar.range.to")}</span>
            <input
              type="date"
              name="to"
              value={draft.to}
              min={draft.from || undefined}
              onChange={updateDraft}
              aria-invalid={Boolean(rangeError) || undefined}
            />
          </label>

          <button type="submit" className="calendar-toolbar__apply">
            {t("dashboard.calendar.range.apply")}
          </button>

          <p className="calendar-toolbar__hint">
            {t("dashboard.calendar.range.hint", { max: MAX_RANGE_DAYS })}
          </p>

          {rangeError && (
            <p className="calendar-toolbar__error" role="alert">
              {rangeError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
