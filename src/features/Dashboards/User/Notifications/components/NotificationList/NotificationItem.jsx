import {
  LuBell,
  LuCalendarClock,
  LuShieldAlert,
  LuSparkles,
} from "react-icons/lu";
import { useTranslation } from "react-i18next";

const icons = {
  bill: LuCalendarClock,
  budget: LuShieldAlert,
  ai: LuSparkles,
  security: LuBell,
};

export default function NotificationItem({ notification, onOpen }) {
  const { t } = useTranslation();
  const Icon = icons[notification.type] ?? LuBell;
  const translatedTitle = notification.key
    ? t(`dashboard.notifications.items.${notification.key}.title`)
    : notification.title;
  const translatedDescription = notification.key
    ? t(`dashboard.notifications.items.${notification.key}.description`)
    : notification.description;

  return (
    <article
      className={`notification-item ${notification.unread ? "notification-item--unread" : ""}`}
      onClick={onOpen}
    >
      <span className="notification-item__icon"><Icon /></span>

      <div className="notification-item__content">
        <div className="notification-item__title-row">
          <h2>{translatedTitle}</h2>
          {notification.unread && (
            <span className="notification-item__badge">{t("dashboard.notifications.unread")}</span>
          )}
        </div>
        <p title={translatedDescription}>{translatedDescription}</p>
      </div>

      <time className="notification-item__time">{notification.time}</time>
    </article>
  );
}
