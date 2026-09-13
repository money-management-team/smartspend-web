import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import {
  hasActiveNotificationFilters,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_STATUSES,
} from "../../notificationHelpers";

import "./NotificationFilters.css";

const STATUS_OPTIONS = ["", ...NOTIFICATION_STATUSES];

/*
 * Backend filters for GET /notifications: read state (All / Unread / Read)
 * and severity. The inbox keeps them in the URL and goes back to page 1 when
 * one changes.
 */
export default function NotificationFilters({ filters, onChange, onClear, disabled = false }) {
  const { t } = useTranslation();

  return (
    <div className="notification-filters" role="group" aria-label={t("dashboard.notifications.filters.label")}>
      <div className="notification-filters__status" role="group" aria-label={t("dashboard.notifications.filters.status")}>
        {STATUS_OPTIONS.map((status) => (
          <button
            type="button"
            key={status || "all"}
            className={`notification-filters__chip${filters.status === status ? " notification-filters__chip--active" : ""}`}
            aria-pressed={filters.status === status}
            onClick={() => filters.status !== status && onChange({ status })}
            disabled={disabled}
          >
            {t(`dashboard.notifications.filters.statuses.${status || "all"}`)}
          </button>
        ))}
      </div>

      <label className="notification-filters__field">
        <span>{t("dashboard.notifications.filters.severity")}</span>
        <select
          name="severity"
          value={filters.severity}
          onChange={(event) => onChange({ severity: event.target.value })}
          disabled={disabled}
        >
          <option value="">{t("dashboard.notifications.filters.allSeverities")}</option>
          {NOTIFICATION_SEVERITIES.map((severity) => (
            <option value={severity} key={severity}>
              {t(`dashboard.notifications.severities.${severity}`)}
            </option>
          ))}
        </select>
      </label>

      {hasActiveNotificationFilters(filters) && (
        <button type="button" className="notification-filters__clear" onClick={onClear} disabled={disabled}>
          <LuX aria-hidden="true" />
          <span>{t("dashboard.notifications.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
