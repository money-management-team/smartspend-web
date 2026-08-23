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

export default function NotificationItem({
  notification,
  onOpen,
}) {
  const { t } = useTranslation();

  const Icon =
    icons[notification.type] ??
    LuBell;

  return (
    <article
      className={`notification-item ${
        notification.unread
          ? "notification-item--unread"
          : ""
      }`}
      onClick={onOpen}
    >
      {/* ICON */}

      <span className="notification-item__icon">
        <Icon />
      </span>

      {/* CONTENT */}

      <div className="notification-item__content">
        <div className="notification-item__title-row">
          <h2>
            {t(
              `dashboard.notifications.items.${notification.key}.title`,
            )}
          </h2>

          {notification.unread && (
            <span className="notification-item__badge">
              {t(
                "dashboard.notifications.unread",
              )}
            </span>
          )}
        </div>

        <p>
          {t(
            `dashboard.notifications.items.${notification.key}.description`,
          )}
        </p>
      </div>

      {/* TIME */}

      <time className="notification-item__time">
        {notification.time}
      </time>
    </article>
  );
}