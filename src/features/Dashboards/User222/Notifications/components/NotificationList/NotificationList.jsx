import NotificationItem from "./NotificationItem";

import "./NotificationList.css";

export default function NotificationList({
  notifications,
  onOpenNotification,
}) {
  return (
    <section className="notification-list">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onOpen={() =>
            onOpenNotification(
              notification.id,
            )
          }
        />
      ))}
    </section>
  );
}