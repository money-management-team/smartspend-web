import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuArrowUpRight, LuCheck, LuCircleAlert, LuInfo, LuTriangleAlert } from "react-icons/lu";

import { getSubjectPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney } from "../../../Dashboard/dashboardHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDateTime } from "../../../utils/formatters";
import { getNotificationSeverity, isNotificationRead } from "../../notificationHelpers";

import "./NotificationItem.css";

const SEVERITY_ICONS = {
  critical: LuCircleAlert,
  warning: LuTriangleAlert,
  info: LuInfo,
};

// A click that opens the link elsewhere (new tab, new window…) is left to
// the browser.
const isPlainClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/*
 * One persistent notification. Every field is the backend's: severity, type,
 * title, body, amount + currency (only when sent) and read state.
 *
 * `subject_type` + `subject_id` are a reference, mapped to an app route by
 * `getSubjectPath`; without a known route the notification has no link.
 * Opening an unread notification goes through `onOpen`, which marks it read
 * before navigating.
 */
export default function NotificationItem({ notification, isPending, onOpen, onMarkRead }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const isRead = isNotificationRead(notification);
  const severity = getNotificationSeverity(notification);
  const path = getSubjectPath(notification.subject_type, notification.subject_id);
  const title = notification.title || translateEnum(t, i18n, "dashboard.notifications.types", notification.type);
  const hasAmount = notification.amount != null && notification.amount !== "";

  const handleOpen = (event) => {
    if (isRead) return;

    if (isPlainClick(event)) {
      event.preventDefault();
      onOpen(notification, path);
    } else {
      // Opened elsewhere: still mark it read here, without navigating.
      onMarkRead(notification);
    }
  };

  return (
    <li
      className={`notification-item notification-item--${severity}${isRead ? "" : " notification-item--unread"}`}
      aria-busy={isPending || undefined}
    >
      <span className="notification-item__icon" aria-hidden="true">
        {createElement(SEVERITY_ICONS[severity])}
      </span>

      <div className="notification-item__copy">
        <div className="notification-item__heading">
          <span className={`notification-item__badge notification-item__badge--${severity}`}>
            {translateEnum(t, i18n, "dashboard.notifications.severities", notification.severity) ||
              t("dashboard.notifications.severities.info")}
          </span>

          {notification.type && (
            <span className="notification-item__type">
              {translateEnum(t, i18n, "dashboard.notifications.types", notification.type)}
            </span>
          )}

          {!isRead && (
            <span className="notification-item__new">
              <span className="notification-item__dot" aria-hidden="true" />
              {t("dashboard.notifications.item.new")}
            </span>
          )}
        </div>

        <h3 className="notification-item__title" dir="auto">
          {path ? (
            <Link to={path} onClick={handleOpen} className="notification-item__link">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>

        {notification.body && (
          <p className="notification-item__body" dir="auto">
            {notification.body}
          </p>
        )}

        <div className="notification-item__meta">
          {notification.created_at && (
            <time dateTime={notification.created_at}>
              <bdi>{formatDateTime(notification.created_at, locale)}</bdi>
            </time>
          )}

          {hasAmount && (
            <span className="notification-item__amount">
              <bdi dir="ltr">
                {/* Without a currency the backend's amount is shown as is,
                    rather than assuming one. */}
                {notification.currency_code
                  ? formatOptionalMoney(notification.amount, notification.currency_code, locale)
                  : notification.amount}
              </bdi>
            </span>
          )}

          {isRead && notification.read_at && (
            <span>
              {t("dashboard.notifications.item.readAt", {
                date: formatDateTime(notification.read_at, locale),
              })}
            </span>
          )}
        </div>
      </div>

      <div className="notification-item__actions">
        {path && (
          <Link
            to={path}
            onClick={handleOpen}
            className="notification-item__action"
            aria-label={t("dashboard.notifications.item.openLabel", { title })}
          >
            <LuArrowUpRight className="notification-item__open-icon" aria-hidden="true" />
            <span>{t("dashboard.notifications.item.open")}</span>
          </Link>
        )}

        {!isRead && (
          <button
            type="button"
            className="notification-item__action"
            onClick={() => onMarkRead(notification)}
            disabled={isPending}
            aria-label={t("dashboard.notifications.item.markReadLabel", { title })}
          >
            <LuCheck aria-hidden="true" />
            <span>
              {isPending ? t("dashboard.notifications.item.marking") : t("dashboard.notifications.item.markRead")}
            </span>
          </button>
        )}
      </div>
    </li>
  );
}
