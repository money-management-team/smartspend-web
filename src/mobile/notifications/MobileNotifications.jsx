import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { keys, loadUnreadCount } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { isWriteOpen } from "../data/writeGate.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { outcomeMessageKey } from "../models/notificationWrites.js";
import { NOTIFICATION_STATUSES } from "../models/notifications.js";
import { mobileSubjectPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { NOTIFICATION_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";
import { useNotificationWrite } from "./useNotificationWrite.js";

const SEVERITY_TONES = { info: "neutral", warning: "warn", critical: "bad" };

/*
 * Mark as read, for one unread notification (PATCH /notifications/{id}/read). While the write gate keeps it closed
 * (data/writeGate.js, the default), the control opens an explanation with a disabled button and the row keeps the
 * server's read state. Once approved, it is one button that sends once (useNotificationWrite.js), disabled while any
 * notification write is on its way. Opening a notification's subject never marks it read.
 */
function MarkRead({ id, open, busy, sendingThis, onSend }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [explain, setExplain] = useState(false);

  if (open) {
    return (
      <span className="sm-mark-read" data-sm-mark-read={id}>
        <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={busy} aria-busy={sendingThis || undefined} onClick={() => onSend(id)} data-sm-action="mark-read">
          {t(sendingThis ? "notifications.write.sending" : "notifications.markRead")}
        </button>
      </span>
    );
  }

  return (
    <span className="sm-mark-read" data-sm-mark-read={id}>
      <button type="button" className="sm-button sm-button-quiet sm-button-small" aria-expanded={explain} aria-controls={`${ids}-panel`} onClick={() => setExplain(!explain)} data-sm-action="mark-read">{t("notifications.markRead")}</button>
      {explain && (
        <span id={`${ids}-panel`} className="sm-mark-read-panel" role="note" data-sm-note="write-closed" data-sm-write="notifications.markRead">
          <span className="sm-text sm-muted sm-fine">{t("notifications.markReadClosed")}</span>
          <button type="button" className="sm-button sm-button-small" disabled data-sm-action="send">{t("notifications.markRead")}</button>
        </span>
      )}
    </span>
  );
}

function NotificationRow({ notification, locale, write }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const when = formatMoment(notification.createdAt, locale);
  const subject = mobileSubjectPath(notification.subjectType, notification.subjectId);

  return (
    <article className="sm-row sm-note-row" data-sm-notification={notification.id} data-sm-read={notification.read === true ? "true" : notification.read === false ? "false" : "unknown"} aria-labelledby={`sm-note-${notification.id}`}>
      <span className="sm-row-main">
        <span className="sm-chips-inline">
          <span className="sm-chip sm-plan-chip" data-sm-tone={SEVERITY_TONES[notification.severity]}>{t(`notifications.severity.${notification.severity}`)}</span>
          {notification.read === false && <span className="sm-chip">{t("notifications.unread")}</span>}
        </span>
        <h3 id={`sm-note-${notification.id}`} className="sm-row-title sm-user-text">{notification.title ?? t("notifications.untitled")}</h3>
        {notification.message && <p className="sm-text sm-user-text">{notification.message}</p>}
        {notification.amount && <span className="sm-row-meta"><Money plain value={notification.amount} currency={notification.currency} /></span>}
        {when && <span className="sm-row-meta"><bdi>{when}</bdi></span>}
        {subject && <Link className="sm-note-link" to={subject}>{t("notifications.open")}</Link>}
        {notification.read === false && <MarkRead id={notification.id} open={write.readOpen} busy={write.sending} sendingThis={write.sending && write.target === String(notification.id)} onSend={write.markRead} />}
      </span>
    </article>
  );
}

/* What the last notification write came to, in words; a refusal or an unknown outcome is announced as an alert. */
function WriteOutcomeLine({ write }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const key = write.sending ? "sending" : outcomeMessageKey(write.outcome);
  if (!key) return null;
  const alert = write.phase === "rejected" || write.phase === "unknown";
  const outcome = write.sending ? "sending" : write.phase;

  return (
    <p className="sm-text sm-fine sm-notification-outcome" role={alert ? "alert" : "status"} data-sm-write-outcome={outcome} data-sm-write-code={write.outcome?.code ?? undefined}>
      {key === "closed" ? t("notifications.markReadClosed") : t(`notifications.write.${key}`)}
    </p>
  );
}

/*
 * The server's unread count, and Mark all as read (POST /notifications/read-all). The count is the last one the server
 * gave: from GET /notifications/unread-count, or from a notification write's own answer. Closed by default: the button
 * is disabled and says why.
 */
function UnreadSummary({ write }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const resource = useResource(keys.unreadCount, loadUnreadCount);
  const count = Number.isSafeInteger(resource.data?.unread_count) && resource.data.unread_count >= 0 ? resource.data.unread_count : null;
  const sendingAll = write.sending && write.target === "all";

  return (
    <div className="sm-unread-summary" data-sm-unread={count ?? "unknown"}>
      <p className="sm-text" role="status">{count === null ? t("notifications.unreadUnknown") : t("notifications.unreadCount", { count })}</p>
      {count !== 0 &&
        (write.readAllOpen ? (
          <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled={write.sending} aria-busy={sendingAll || undefined} onClick={write.markAllRead} data-sm-action="mark-all-read">
            {t(sendingAll ? "notifications.write.sending" : "notifications.markAll")}
          </button>
        ) : (
          <>
            <button type="button" className="sm-button sm-button-quiet sm-button-small" disabled aria-describedby="sm-mark-all-closed" data-sm-action="mark-all-read">{t("notifications.markAll")}</button>
            <p id="sm-mark-all-closed" className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="notifications.markAllRead">{t("notifications.markReadClosed")}</p>
          </>
        ))}
      <WriteOutcomeLine write={write} />
    </div>
  );
}

/*
 * The notification inbox: GET /notifications a page at a time, all, unread or read. Looking at it does not mark
 * anything read; the read state shown is the server's. Marking read (one, or all) is a write, closed unless approved
 * (useNotificationWrite.js); after one, the rows are read again so they show the server's state.
 */
export default function MobileNotifications() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(NOTIFICATION_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;
  const mutation = useNotificationWrite({ onRowsStale: screen.refresh });
  const write = { ...mutation, readOpen: isWriteOpen("notifications.markRead"), readAllOpen: isWriteOpen("notifications.markAllRead") };

  const toolbar = (
    <div className="sm-card sm-plan-filters">
      <UnreadSummary write={write} />
      <FilterTabs
        tight
        label={t("notifications.filterStatus")}
        value={filters.status}
        options={[{ value: "", label: t("notifications.all") }, ...NOTIFICATION_STATUSES.map((value) => ({ value, label: t(`notifications.status.${value}`) }))]}
        onChange={(status) => setFilters({ ...filters, status })}
      />
    </div>
  );

  return (
    <PagedListView
      screen="notifications"
      list={screen.list}
      toolbar={toolbar}
      filtered={screen.filtered}
      onResetFilters={screen.reset}
      strings="notifications"
      pages={screen.pages}
      perPage={NOTIFICATION_LIST.perPage}
      onLoadMore={screen.loadMore}
      onRefresh={screen.refresh}
      fullPath={PATH.USER.NOTIFICATIONS}
      renderRow={(notification) => <NotificationRow notification={notification} locale={locale} write={write} />}
    />
  );
}
