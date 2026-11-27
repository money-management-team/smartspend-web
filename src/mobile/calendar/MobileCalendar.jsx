import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { calendarLoader } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDayHeading } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildCalendarMonth, monthParam, readCalendarMonth, shiftMonth } from "../models/calendar.js";
import { mobileSubjectPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";

// The statuses the full version has labels for (dashboard.calendar.statuses).
const EVENT_STATUSES = ["scheduled", "due", "posted", "skipped", "failed", "cancelled", "overdue", "active", "partially_paid", "paid", "paused", "achieved", "completed", "ended", "archived"];

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

function EventRow({ event }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const subject = mobileSubjectPath(event.subjectType, event.subjectId);
  const type = event.type ? t(`calendar.type.${event.type}`) : t("planning.state.unknown", { status: event.rawType ?? "?" });
  // The full version's labels (dashboard.calendar.statuses); a status SmartSpend adds later is shown as sent, labelled, not guessed at.
  const statusLabel = (status) => (EVENT_STATUSES.includes(status) ? t(`calendar.eventStatus.${status}`) : t("calendar.eventStatusOther", { status: status.replace(/_/g, " ") }));
  const content = (
    <span className="sm-row-main">
      <span className="sm-row-title sm-user-text">{event.title ?? type}</span>
      <span className="sm-row-meta">{type}{event.status && <> · <span data-sm-event-status={event.status}>{statusLabel(event.status)}</span></>}</span>
      {event.amount && (
        <span className="sm-row-meta">
          {/* An amount without a currency is shown as sent, never as a guessed currency. */}
          {event.currency ? <Money plain value={event.amount} currency={event.currency} /> : <bdi dir="ltr">{event.amount}</bdi>}
          {event.direction && <> · {t(`calendar.direction.${event.direction}`)}</>}
        </span>
      )}
    </span>
  );

  return subject ? (
    <Link className="sm-row" to={subject} data-sm-event={event.id}>
      {content}
      <Chevron />
    </Link>
  ) : (
    <div className="sm-row" data-sm-event={event.id}>{content}</div>
  );
}

/*
 * The financial calendar as an agenda, one month at a time, read-only
 * (GET /calendar?month=&year=&view=month). The month is in the address, so Back
 * returns to it. Events are the backend's: scheduled occurrences, due dates and
 * targets, not posted money; nothing here confirms or skips an occurrence.
 */
export default function MobileCalendar() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  // The month as text ("2026-10"): a plain string, so the memos below depend on a value, not an object.
  const monthKey = `${monthParam(readCalendarMonth(location.search))}`;
  const year = Number.parseInt(monthKey.slice(0, 4), 10);
  const monthNumber = Number.parseInt(monthKey.slice(5), 10);
  const current = () => ({ year, month: monthNumber });
  const loader = useMemo(() => calendarLoader(Number.parseInt(monthKey.slice(5), 10), Number.parseInt(monthKey.slice(0, 4), 10)), [monthKey]);
  const resource = useResource(`calendar:${monthKey}`, loader);
  const parsed = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildCalendarMonth(resource.data, { year: Number.parseInt(monthKey.slice(0, 4), 10), month: Number.parseInt(monthKey.slice(5), 10) });
    } catch {
      return null;
    }
  }, [resource.data, monthKey]);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", numberingSystem: "latn", timeZone: "UTC" }).format(Date.UTC(year, monthNumber - 1, 1));
  const go = (step) => {
    const next = shiftMonth(current(), step);
    if (next) navigate({ pathname: location.pathname, search: `?month=${monthParam(next)}` }, { replace: true });
  };

  const toolbar = (
    <div className="sm-card sm-cal-bar" role="group" aria-label={t("calendar.monthPicker")}>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => go(-1)} disabled={!shiftMonth(current(), -1)} aria-label={t("calendar.previous")}>
        <Chevron back />
      </button>
      <h2 className="sm-card-title sm-cal-month" aria-live="polite"><bdi>{title}</bdi></h2>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" onClick={() => go(1)} disabled={!shiftMonth(current(), 1)} aria-label={t("calendar.next")}>
        <Chevron />
      </button>
    </div>
  );

  let body;
  if (resource.loading) body = <Skeleton lines={5} label={t("calendar.loading")} />;
  else if (resource.status === "error" || !parsed) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} />;
  else if (parsed.days.length === 0) {
    body = (
      <div className="sm-card" data-sm-calendar="empty">
        <h2 className="sm-card-title">{t("calendar.empty.title")}</h2>
        <p className="sm-text">{t("calendar.empty.body")}</p>
      </div>
    );
  } else {
    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        <p className="sm-text" data-sm-count={parsed.count}>{t("calendar.count", { count: parsed.total ?? parsed.count })}</p>
        {parsed.days.map((day) => (
          <section key={day.date} className="sm-card" aria-labelledby={`sm-cal-${day.date}`}>
            <h3 id={`sm-cal-${day.date}`} className="sm-day-title"><bdi>{formatDayHeading(day.date, locale)}</bdi></h3>
            <ul className="sm-list">
              {day.events.map((event) => (
                <li key={event.id}><EventRow event={event} /></li>
              ))}
            </ul>
          </section>
        ))}
      </>
    );
  }

  return (
    <section className="sm-page" data-sm-screen="calendar" data-sm-month={monthParam(current())} data-sm-state={resource.loading ? "loading" : parsed ? (parsed.days.length ? "ready" : "empty") : "error"} aria-busy={resource.loading || undefined}>
      {toolbar}
      {body}
      <p className="sm-text sm-muted sm-fine">{t("calendar.readOnly")}</p>
      <Link className="sm-link-row" to={PATH.USER.CALENDAR}>
        <span>{t("calendar.openFull")}</span>
        <Chevron />
      </Link>
    </section>
  );
}
