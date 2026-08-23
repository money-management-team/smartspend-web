import { useState } from "react";

import NotificationsHeader from "./components/NotificationsHeader/NotificationsHeader";
import NotificationList from "./components/NotificationList/NotificationList";

import "./Notifications.css";

const initialNotifications = [
  {
    id: 1,
    key: "rent",
    type: "bill",
    time: "2h",
    unread: true,
  },
  {
    id: 2,
    key: "softwareBudget",
    type: "budget",
    time: "5h",
    unread: true,
  },
  {
    id: 3,
    key: "monthlyAnalysis",
    type: "ai",
    time: "1d",
    unread: true,
  },
  {
    id: 4,
    key: "newDevice",
    type: "security",
    time: "3d",
    unread: false,
  },
];

export default function Notifications() {
  const [notifications, setNotifications] =
    useState(initialNotifications);

  const handleMarkAllAsRead = () => {
    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );

    /*
     * Backend later:
     *
     * await api.patch(
     *   "/notifications/read-all"
     * );
     */
  };

  const handleOpenNotification = (id) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification,
      ),
    );

    /*
     * Backend later:
     *
     * await api.patch(
     *   `/notifications/${id}/read`
     * );
     */
  };

  return (
    <div className="notifications-page">
      <NotificationsHeader
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      <NotificationList
        notifications={notifications}
        onOpenNotification={handleOpenNotification}
      />
    </div>
  );
}