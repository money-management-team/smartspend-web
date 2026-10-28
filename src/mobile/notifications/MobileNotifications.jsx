import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { NOTIFICATION_STATUSES } from "../models/notifications.js";
import { mobileSubjectPath } from "../navigation.js";
import FilterTabs from "../planning/FilterTabs.jsx";
import { NOTIFICATION_LIST } from "../planning/lists.js";
import PagedListView from "../planning/PagedListView.jsx";
import { useListScreen } from "../planning/useListScreen.js";

const SEVERITY_TONES = { info: "neutral", warning: "warn", critical: "bad" };

function NotificationRow({ notification, locale }) {
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
      </span>
    </article>
  );
}

/*
 * The notification inbox, read-only: GET /notifications a page at a time, all,
 * unread or read. Looking at it does not mark anything read (that would be a
 * write); the read state shown is the server's.
 */
export default function MobileNotifications() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const screen = useListScreen(NOTIFICATION_LIST);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const { filters, setFilters } = screen;

  const toolbar = (
    <div className="sm-card sm-plan-filters">
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
      renderRow={(notification) => <NotificationRow notification={notification} locale={locale} />}
    />
  );
}
