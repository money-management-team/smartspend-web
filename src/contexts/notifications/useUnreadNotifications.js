import { useContext } from "react";
import { UnreadNotificationsContext } from "./unreadNotificationsContext";

export const useUnreadNotifications = () => {
  const context = useContext(UnreadNotificationsContext);

  if (!context) {
    throw new Error(
      "useUnreadNotifications must be used inside UnreadNotificationsProvider.",
    );
  }

  return context;
};
