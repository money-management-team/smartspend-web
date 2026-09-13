import { useState } from "react";
import { Outlet } from "react-router-dom";

import UnreadNotificationsProvider from "../../contexts/notifications/unreadNotificationsProvider";
import DashboardHeader from "./components/DashboardHeader/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar/DashboardSidebar";
import EmailVerificationBanner from "./components/EmailVerificationBanner/EmailVerificationBanner";

import "./DashboardLayout.css";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // The unread notification count is shared by the header bell, the sidebar
  // and the Notifications page, so it is owned here, inside the signed-in area.
  return (
    <UnreadNotificationsProvider>
      <div className="dashboard-layout">
        <DashboardSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
        />

        {isSidebarOpen && (
          <button
            type="button"
            className="dashboard-layout__overlay"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          />
        )}

        <div className="dashboard-layout__main">
          <DashboardHeader
            onToggleSidebar={toggleSidebar}
          />

          <main className="dashboard-layout__content">
            <EmailVerificationBanner />
            <Outlet />
          </main>
        </div>
      </div>
    </UnreadNotificationsProvider>
  );
}
