import { useTranslation } from "react-i18next";

import "./NotificationsHeader.css";

export default function NotificationsHeader() {
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
    </header>
  );
}
