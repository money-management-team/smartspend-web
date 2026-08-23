import { useTranslation } from "react-i18next";

import "./NotificationsHeader.css";

export default function NotificationsHeader({
  onMarkAllAsRead,
}) {
  const { t } = useTranslation();

  return (
    <header className="notifications-header">
      <div className="notifications-header__copy">
        <h1>
          {t(
            "dashboard.notifications.title",
          )}
        </h1>

        <p>
          {t(
            "dashboard.notifications.subtitle",
          )}
        </p>
      </div>

      <button
        type="button"
        className="notifications-header__read-all"
        onClick={onMarkAllAsRead}
      >
        {t(
          "dashboard.notifications.markAllAsRead",
        )}
      </button>
    </header>
  );
}