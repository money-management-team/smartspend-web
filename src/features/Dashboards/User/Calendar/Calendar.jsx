import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { LuInfo } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { ApiError, getStoredWorkspace } from "../api/apiClient";
import { calendarApi } from "../api/calendarApi";
import { formatDate } from "../utils/formatters";
import CalendarAgenda from "./components/CalendarAgenda/CalendarAgenda";
import CalendarFilters from "./components/CalendarFilters/CalendarFilters";
import CalendarGrid from "./components/CalendarGrid/CalendarGrid";
import CalendarSummary from "./components/CalendarSummary/CalendarSummary";
import CalendarToolbar from "./components/CalendarToolbar/CalendarToolbar";
import {
  addDays,
  buildCalendarDays,
  calendarFiltersToQuery,
  calendarFiltersToSearchParams,
  getCalendarErrorMessage,
  getRequestedRange,
  getTodayIso,
  getWeekStart,
  groupEventsByDate,
  hasActiveCalendarFilters,
  MAX_YEAR,
  MIN_YEAR,
  parseCalendarResponse,
  readCalendarFilters,
  shiftMonth,
  startOfWeek,
} from "./calendarHelpers";

import "./Calendar.css";

const isYearInRange = (iso) => {
  const year = Number(iso.slice(0, 4));
  return year >= MIN_YEAR && year <= MAX_YEAR;
};

/*
 * Financial calendar (GET /calendar — `/financial-calendar` is a backend alias
 * that is not used). A read-only view of dated records the backend aggregates
 * from recurring occurrences, debt due dates, budget period ends and savings
 * goal targets: nothing is stored or changed here, and every event, status
 * and summary figure is the backend's.
 *
 * Period (month / week / custom range) and filters live in the URL; each
 * change is one request. Selecting a day in the grid narrows the agenda to it.
 */
export default function Calendar() {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const weekStart = getWeekStart(i18n.language);
  // The day the calendar opens on, in the workspace's time zone when known.
  const [today] = useState(() => getTodayIso(getStoredWorkspace()?.timezone));
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readCalendarFilters(searchParams, { today, weekStart });
  const filterKey = calendarFiltersToSearchParams(filters).toString();

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (period, filters or retry changed), it is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });
  // Statuses the backend has reported (`summary.by_status`), offered as filters.
  const [knownStatuses, setKnownStatuses] = useState([]);
  // The day selected in the grid, for the period it was selected in.
  const [selection, setSelection] = useState({ key: null, date: null });

  useEffect(() => {
    const controller = new AbortController();
    const query = calendarFiltersToQuery(
      readCalendarFilters(new URLSearchParams(filterKey), { today, weekStart }),
    );

    calendarApi
      .get(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parseCalendarResponse(response);

        setResult(
          parsed
            ? { key: requestKey, data: parsed, error: null }
            : { key: requestKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );

        const statuses = parsed?.summary?.byStatus.map(([status]) => status) ?? [];
        if (statuses.length) {
          setKnownStatuses((current) => Array.from(new Set([...current, ...statuses])));
        }
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey, today, weekStart]);

  const isLoading = result.key !== requestKey;
  const { data, error } = isLoading ? { data: null, error: null } : result;

  // The backend's period once loaded, the requested one until then.
  const range = data?.period.from && data?.period.to ? data.period : getRequestedRange(filters);
  const days = filters.view === "range" ? [] : buildCalendarDays(range, weekStart);
  const events = data?.events ?? [];
  const groups = groupEventsByDate(events);
  const eventsByDate = new Map(groups.map((group) => [group.date, group.events]));
  const selectedDate = selection.key === filterKey ? selection.date : null;
  const visibleGroups = selectedDate ? groups.filter((group) => group.date === selectedDate) : groups;
  const statusOptions = Array.from(new Set([...knownStatuses, ...filters.statuses]));
  const isFiltered = hasActiveCalendarFilters(filters);

  const periodLabel =
    filters.view === "month"
      ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
          new Date(Date.UTC(filters.year, filters.month - 1, 1)),
        )
      : t("dashboard.calendar.periodRange", {
          from: formatDate(range.from, locale),
          to: formatDate(range.to, locale),
        });

  /* ---------- Navigation ---------- */

  const setFilters = (changes) => setSearchParams(calendarFiltersToSearchParams({ ...filters, ...changes }));

  const reload = () => setReloadKey((key) => key + 1);

  const requested = getRequestedRange(filters);
  // The day a view switch keeps in sight: today when it is in the period,
  // otherwise the period's first day.
  const anchor = today >= requested.from && today <= requested.to ? today : requested.from;

  const changeView = (view) => {
    if (view === "month") {
      const [year, month] = anchor.split("-").map(Number);
      setFilters({ view, month, year, from: "", to: "" });
    } else if (view === "week") {
      const from = startOfWeek(anchor, weekStart);
      setFilters({ view, from, to: addDays(from, 6), month: null, year: null });
    } else {
      setFilters({ view, from: requested.from, to: requested.to, month: null, year: null });
    }
  };

  const previousMonth = filters.view === "month" ? shiftMonth(filters, -1) : null;
  const nextMonth = filters.view === "month" ? shiftMonth(filters, 1) : null;
  const previousWeek = filters.view === "week" ? addDays(filters.from, -7) : null;
  const nextWeek = filters.view === "week" ? addDays(filters.from, 7) : null;

  const goPrevious = () =>
    filters.view === "month" ? setFilters(previousMonth) : setFilters({ from: previousWeek, to: addDays(previousWeek, 6) });

  const goNext = () =>
    filters.view === "month" ? setFilters(nextMonth) : setFilters({ from: nextWeek, to: addDays(nextWeek, 6) });

  const goToday = () => {
    if (filters.view === "month") {
      const [year, month] = today.split("-").map(Number);
      setFilters({ month, year });
    } else {
      const from = startOfWeek(today, weekStart);
      setFilters({ from, to: addDays(from, 6) });
    }
    setSelection({ key: null, date: null });
  };

  const clearFilters = () => setFilters({ types: [], statuses: [], owner: "" });

  /* ---------- Render ---------- */

  return (
    <div className="calendar-page">
      <header className="calendar-page__header">
        <h1>{t("dashboard.calendar.title")}</h1>
        <p>{t("dashboard.calendar.subtitle")}</p>
        <p className="calendar-page__note">
          <LuInfo aria-hidden="true" />
          <span>{t("dashboard.calendar.readOnlyNote")}</span>
        </p>
      </header>

      <CalendarToolbar
        key={`${filters.view}:${requested.from}:${requested.to}`}
        view={filters.view}
        periodLabel={periodLabel}
        initialRange={requested}
        canGoPrevious={filters.view === "month" ? Boolean(previousMonth) : Boolean(previousWeek && isYearInRange(previousWeek))}
        canGoNext={filters.view === "month" ? Boolean(nextMonth) : Boolean(nextWeek && isYearInRange(nextWeek))}
        onViewChange={changeView}
        onPrevious={goPrevious}
        onNext={goNext}
        onToday={goToday}
        onApplyRange={({ from, to }) => setFilters({ view: "range", from, to, month: null, year: null })}
      />

      <CalendarFilters filters={filters} statusOptions={statusOptions} onChange={setFilters} onClear={clearFilters} />

      {error ? (
        <div className="calendar-page__state calendar-page__state--error" role="alert">
          <p>{getCalendarErrorMessage(error, t)}</p>
          <button type="button" onClick={reload}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          {data?.summary && <CalendarSummary summary={data.summary} />}

          <div className={`calendar-page__body${isLoading ? " calendar-page__body--loading" : ""}`} aria-busy={isLoading}>
            {days.length > 0 && (
              <CalendarGrid
                days={days}
                eventsByDate={eventsByDate}
                view={filters.view}
                weekStart={weekStart}
                today={today}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelection({ key: filterKey, date })}
              />
            )}

            {isLoading && <Loading message={t("dashboard.calendar.states.loading")} />}

            {!isLoading && events.length === 0 && (
              <div className="calendar-page__state">
                <p>{t(isFiltered ? "dashboard.calendar.states.emptyFiltered" : "dashboard.calendar.states.empty")}</p>
                {isFiltered && (
                  <button type="button" onClick={clearFilters}>
                    {t("dashboard.calendar.filters.clear")}
                  </button>
                )}
              </div>
            )}

            {!isLoading && events.length > 0 && (
              <CalendarAgenda
                groups={visibleGroups}
                today={today}
                selectedDate={selectedDate}
                onShowAll={() => setSelection({ key: null, date: null })}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
