import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import NotificationsHeader from "./components/NotificationsHeader/NotificationsHeader";
import NotificationList from "./components/NotificationList/NotificationList";
import { financialAlertsApi } from "../api/financialAlertsApi";
import { getApiErrorMessage } from "../api/apiClient";

import "./Notifications.css";
import Loading from "../../../../components/Loading/Loading";

function normalizeAlert(alert, index, generatedAt) {
  const severityToType = {
    critical: "budget",
    warning: "budget",
    info: "bill",
  };

  return {
    id: `${alert.type}-${alert.budget_id ?? index}`,
    title: alert.type?.replaceAll("_", " ") || "Financial alert",
    description: alert.message,
    type: severityToType[alert.severity] ?? "budget",
    time: generatedAt ?? "",
    unread: true,
    severity: alert.severity,
    budgetId: alert.budget_id,
  };
}

export default function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await financialAlertsApi.list({ signal });
      const alerts = response.data?.alerts ?? [];
      const generatedAt = response.data?.generated_at;
      setNotifications(alerts.map((alert, index) => normalizeAlert(alert, index, generatedAt)));
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(getApiErrorMessage(requestError, t));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    loadAlerts(controller.signal);
    return () => controller.abort();
  }, [loadAlerts]);

  const handleMarkAllAsRead = () => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, unread: false })));
  };

  const handleOpenNotification = (id) => {
    setNotifications((previous) => previous.map((notification) => (
      notification.id === id ? { ...notification, unread: false } : notification
    )));
  };

  return (
    <div className="notifications-page">
      <NotificationsHeader onMarkAllAsRead={handleMarkAllAsRead} />

      {isLoading && <Loading message={false} />}
      {!isLoading && error && (
        <div className="notifications-page__state notifications-page__state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => loadAlerts()}>{t("common.retry")}</button>
        </div>
      )}
      {!isLoading && !error && notifications.length === 0 && (
        <p className="notifications-page__state">{t("dashboard.notifications.states.empty")}</p>
      )}
      {!isLoading && !error && notifications.length > 0 && (
        <NotificationList notifications={notifications} onOpenNotification={handleOpenNotification} />
      )}
    </div>
  );
}
