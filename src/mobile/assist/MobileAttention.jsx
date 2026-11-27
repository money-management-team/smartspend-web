import { useMemo } from "react";
import { LuBellRing, LuCalendarClock, LuCircleCheck, LuMessageCircle, LuMic, LuReceipt, LuRefreshCw } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { assistKeys, loadReceiptsToReview, loadVoiceToReview, whatsAppDraftsLoader } from "../data/assistLoaders.js";
import { calendarLoader, keys, loadAlerts } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { todayIn } from "../forms/validation.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildPage, normalizeCapture, normalizeDraft } from "../models/assist.js";
import { comingUp, monthOf } from "../models/attention.js";
import { monthParam, shiftMonth } from "../models/calendar.js";
import { buildAlertsModel } from "../models/home.js";
import { formatDay, formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_ATTENTION, captureDetailPath, mobileSubjectPath, whatsappDraftPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import IconButton from "../ui/IconButton.jsx";
import Skeleton from "../ui/Skeleton.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const REVIEW_ICONS = { receipt: LuReceipt, voice: LuMic, whatsapp: LuMessageCircle };
const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");

/* A read's validated items, or why there are none: { state: "loading" | "error" | "ready", items, error }. */
function parsed(resource, build) {
  if (resource.loading) return { state: "loading", items: [] };
  if (resource.status === "error") return { state: "error", items: [], error: resource.error };
  try {
    return { state: "ready", items: build(resource.data) };
  } catch {
    return { state: "error", items: [], error: MALFORMED };
  }
}

const receiptsOf = (data) => buildPage(data, "captures", (raw) => normalizeCapture(raw, "receipt")).items.filter((item) => item.status === "ready_for_review");
const voiceOf = (data) => buildPage(data, "captures", (raw) => normalizeCapture(raw, "voice")).items.filter((item) => item.status === "ready_for_review");
const draftsOf = (data) => buildPage(data, "drafts", normalizeDraft).items.filter((item) => item.status === "ready_for_review");

function ReviewIcon({ kind }) {
  const Icon = REVIEW_ICONS[kind] ?? LuReceipt;
  return <span className="sm-tile-icon sm-row-icon" aria-hidden="true"><Icon /></span>;
}

function ReviewRow({ row }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const when = row.createdAt ? formatMoment(row.createdAt, localeOf(i18n)) : null;

  return (
    <Link className="sm-row" to={row.to} state={{ from: MOBILE_ATTENTION }} data-sm-review={`${row.kind}:${row.id}`}>
      <ReviewIcon kind={row.kind} />
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{row.title}</span>
        <span className="sm-row-meta">{t(`attentionCenter.kinds.${row.kind}`)}{when ? <> · <bdi>{when}</bdi></> : null}</span>
      </span>
      <span className="sm-row-end">
        {row.amount && <span className="sm-row-amount"><Money plain value={row.amount} currency={row.currency ?? undefined} /></span>}
        <Chevron />
      </span>
    </Link>
  );
}

function EventRow({ event, overdue }) {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const to = mobileSubjectPath(event.subjectType, event.subjectId);
  const content = (
    <>
      <span className="sm-tile-icon sm-row-icon" aria-hidden="true"><LuCalendarClock /></span>
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{event.title ?? t("attentionCenter.untitledEvent")}</span>
        <span className="sm-row-meta">
          <bdi>{formatDay(event.date, localeOf(i18n), "UTC") ?? event.date}</bdi>
          {overdue && <> · <span className="sm-chip sm-plan-chip" data-sm-tone="bad">{t("attentionCenter.overdue")}</span></>}
        </span>
      </span>
      <span className="sm-row-end">
        {event.amount && <span className="sm-row-amount"><Money plain plus={event.direction === "income"} value={event.amount} currency={event.currency ?? undefined} /></span>}
        {to && <Chevron />}
      </span>
    </>
  );

  return to ? (
    <Link className="sm-row" to={to} state={{ from: MOBILE_ATTENTION }} data-sm-event={event.id}>{content}</Link>
  ) : (
    <div className="sm-row sm-row-static" data-sm-event={event.id}>{content}</div>
  );
}

/*
 * Needs your attention: the full version's Attention Center (Experience/AttentionCenter.jsx),
 * on Mobile and read-only. Three independent sections, each read with GET and
 * each failing on its own: the backend's financial alerts; receipts, voice
 * notes and WhatsApp drafts waiting for review (each opens its own review
 * page, where confirming stays a separate, gated step); and calendar items that
 * are overdue or due in the next 14 days, from this month and next (the same
 * reads, and the same store keys, as the Calendar screen).
 *
 * Home reads only its dashboard and alerts; this screen is where everything
 * else that waits for the person is gathered, so Home stays one fast read.
 */
export default function MobileAttention() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const today = todayIn(user?.timezone ?? workspace?.timezone);
  const thisMonth = monthOf(today);
  const nextMonth = shiftMonth(thisMonth, 1) ?? thisMonth;
  const calendarNow = useMemo(() => calendarLoader(thisMonth.month, thisMonth.year), [thisMonth.month, thisMonth.year]);
  const calendarNext = useMemo(() => calendarLoader(nextMonth.month, nextMonth.year), [nextMonth.month, nextMonth.year]);
  const draftsLoader = useMemo(() => whatsAppDraftsLoader("ready_for_review", 1), []);

  const alerts = useResource(keys.alerts, loadAlerts);
  const receipts = useResource(assistKeys.receiptsToReview, loadReceiptsToReview);
  const voice = useResource(assistKeys.voiceToReview, loadVoiceToReview);
  const drafts = useResource(assistKeys.whatsappDrafts("ready_for_review", 1), draftsLoader);
  const monthA = useResource(`calendar:${monthParam(thisMonth)}`, calendarNow);
  const monthB = useResource(`calendar:${monthParam(nextMonth)}`, calendarNext);
  const all = [alerts, receipts, voice, drafts, monthA, monthB];
  const refreshing = all.some((resource) => resource.refreshing);
  const refresh = () => all.forEach((resource) => resource.reload());

  const alertModel = useMemo(() => (alerts.data === undefined ? null : buildAlertsModel(alerts.data)), [alerts.data]);
  const sources = {
    receipt: parsed(receipts, receiptsOf),
    voice: parsed(voice, voiceOf),
    whatsapp: parsed(drafts, draftsOf),
  };
  // A person without WhatsApp has no drafts to review: a refusal of that list is not an error worth showing.
  const whatsappAbsent = sources.whatsapp.state === "error" && ["FORBIDDEN", "NOT_FOUND"].includes(sources.whatsapp.error?.code);
  const rows = [
    ...sources.receipt.items.map((item) => ({ kind: "receipt", id: item.id, to: captureDetailPath("receipt", item.id), title: item.review.merchant_name || item.review.description || t("captures.untitled.receipt"), amount: item.review.amount, currency: item.review.currency_code, createdAt: item.createdAt })),
    ...sources.voice.items.map((item) => ({ kind: "voice", id: item.id, to: captureDetailPath("voice", item.id), title: item.review.merchant_name || item.review.description || t("captures.untitled.voice"), amount: item.review.amount, currency: item.review.currency_code, createdAt: item.createdAt })),
    ...sources.whatsapp.items.map((item) => ({ kind: "whatsapp", id: item.id, to: whatsappDraftPath(item.id), title: item.review.description || t("whatsapp.untitled"), amount: item.review.amount, currency: item.currency, createdAt: item.createdAt })),
  ];
  const reviewLoading = Object.values(sources).some((source) => source.state === "loading");
  const reviewErrors = Object.entries(sources).filter(([kind, source]) => source.state === "error" && !(kind === "whatsapp" && whatsappAbsent));

  const calendarLoading = monthA.loading || monthB.loading;
  const calendar = useMemo(() => {
    if (monthA.data === undefined || monthB.data === undefined) return null;
    try {
      return comingUp([{ data: monthA.data, month: thisMonth }, { data: monthB.data, month: nextMonth }], today);
    } catch {
      return { error: MALFORMED };
    }
  }, [monthA.data, monthB.data, thisMonth, nextMonth, today]);
  const calendarError = monthA.status === "error" ? monthA.error : monthB.status === "error" ? monthB.error : calendar?.error ?? null;

  const settled = !alerts.loading && !reviewLoading && !calendarLoading;
  const clear = settled && (alertModel?.count ?? 0) === 0 && alerts.status !== "error" && rows.length === 0 && reviewErrors.length === 0 && !calendarError && calendar && calendar.overdue.length === 0 && calendar.soon.length === 0;

  return (
    <section className="sm-page" data-sm-screen="attention" data-sm-state={settled ? (clear ? "clear" : "ready") : "loading"}>
      <div className="sm-list-meta">
        <p className="sm-text sm-muted sm-fine">{t("attentionCenter.intro")}</p>
        <IconButton label={t(refreshing ? "home.refreshing" : "home.refresh")} icon={LuRefreshCw} spinning={refreshing} onClick={refresh} disabled={refreshing} aria-busy={refreshing} />
      </div>

      {clear && (
        <div className="sm-card sm-all-clear" role="status" data-sm-note="all-clear">
          <span className="sm-all-clear-icon" aria-hidden="true"><LuCircleCheck /></span>
          <h2 className="sm-card-title">{t("attentionCenter.clearTitle")}</h2>
          <p className="sm-text sm-muted">{t("attentionCenter.clearBody")}</p>
        </div>
      )}

      {(alerts.status === "error" || (alertModel && alertModel.count > 0)) && (
        <section className="sm-card sm-attention" aria-labelledby="sm-attn-alerts" data-sm-section="alerts">
          <div className="sm-card-head">
            <h2 id="sm-attn-alerts" className="sm-card-title"><LuBellRing aria-hidden="true" className="sm-title-icon" />{t("attentionCenter.alerts")}</h2>
          </div>
          {alerts.status === "error" ? (
            <ErrorPanel error={alerts.error ?? MALFORMED} onRetry={alerts.reload} retrying={alerts.refreshing} compact />
          ) : (
            <ul className="sm-list">
              {alertModel.items.map((alert, index) => (
                <li key={index} className="sm-alert" data-sm-severity={alert.severity}>
                  <span className="sm-chip sm-chip-severity">{t(`home.attention.${alert.severity}`)}</span>
                  <span className="sm-user-text">{alert.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!clear && (
        <section className="sm-card" aria-labelledby="sm-attn-review" data-sm-section="review">
          <div className="sm-card-head">
            <h2 id="sm-attn-review" className="sm-card-title">{t("attentionCenter.review")}</h2>
            {!reviewLoading && rows.length > 0 && <span className="sm-chip" data-sm-count={rows.length}>{rows.length}</span>}
          </div>
          {reviewLoading && rows.length === 0 ? (
            <Skeleton lines={3} label={t("attentionCenter.loading")} />
          ) : rows.length > 0 ? (
            <ul className="sm-list">{rows.map((row) => <li key={`${row.kind}:${row.id}`}><ReviewRow row={row} /></li>)}</ul>
          ) : (
            reviewErrors.length === 0 && <p className="sm-text sm-muted" data-sm-empty="review">{t("attentionCenter.reviewEmpty")}</p>
          )}
          {reviewErrors.map(([kind, source]) => (
            <div key={kind} data-sm-source-error={kind}>
              <p className="sm-text sm-fine sm-muted">{t(`attentionCenter.kinds.${kind}`)}</p>
              <ErrorPanel error={source.error ?? MALFORMED} onRetry={{ receipt: receipts, voice, whatsapp: drafts }[kind].reload} compact />
            </div>
          ))}
          <p className="sm-text sm-muted sm-fine">{t("attentionCenter.reviewNote")}</p>
        </section>
      )}

      {!clear && (
        <section className="sm-card" aria-labelledby="sm-attn-soon" data-sm-section="coming-up">
          <h2 id="sm-attn-soon" className="sm-card-title">{t("attentionCenter.comingUp")}</h2>
          {calendarError ? (
            <ErrorPanel error={calendarError} onRetry={() => { monthA.reload(); monthB.reload(); }} compact />
          ) : calendarLoading || !calendar ? (
            <Skeleton lines={3} label={t("attentionCenter.loading")} />
          ) : calendar.overdue.length + calendar.soon.length === 0 ? (
            <p className="sm-text sm-muted" data-sm-empty="coming-up">{t("attentionCenter.comingUpEmpty")}</p>
          ) : (
            <ul className="sm-list">
              {calendar.overdue.map((event) => <li key={`o:${event.id}`}><EventRow event={event} overdue /></li>)}
              {calendar.soon.map((event) => <li key={`s:${event.id}`}><EventRow event={event} /></li>)}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}
