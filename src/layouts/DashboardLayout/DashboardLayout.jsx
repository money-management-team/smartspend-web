import DashboardWelcome from "./components/DashboardWelcome/DashboardWelcome";
import ExperienceProvider from "../../features/Dashboards/User/Experience/ExperienceProvider";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import ModalAccessibility from "../../components/ModalAccessibility/ModalAccessibility";
import UnreadNotificationsProvider from "../../contexts/notifications/unreadNotificationsProvider";
import RouteSuspense from "../../routes/RouteSuspense";
import DashboardHeader from "./components/DashboardHeader/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar/DashboardSidebar";
import EmailVerificationBanner from "./components/EmailVerificationBanner/EmailVerificationBanner";

import "./DashboardLayout.css";
import "./dashboardPrimitives.css";

export default function DashboardLayout() {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // The drawer closes with Escape (only relevant below the desktop breakpoint,
  // where the sidebar is off-canvas).
  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // The unread notification count is shared by the header bell, the sidebar
  // and the Notifications page, so it is owned here, inside the signed-in area.
  return (
    <ExperienceProvider>
      <UnreadNotificationsProvider>
        <ModalAccessibility />
        <DashboardWelcome />
        <div className="dashboard-layout">
          <DashboardSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

          {isSidebarOpen && (
            <button
              type="button"
              className="dashboard-layout__overlay"
              onClick={closeSidebar}
              aria-label={t("dashboard.sidebar.close")}
            />
          )}

          <div className="dashboard-layout__main">
            <DashboardHeader
              onToggleSidebar={toggleSidebar}
              isSidebarOpen={isSidebarOpen}
            />

            <main className="dashboard-layout__content">
              <EmailVerificationBanner />
              <RouteSuspense>
                <Outlet />
              </RouteSuspense>
            </main>
          </div>
        </div>
      </UnreadNotificationsProvider>
    </ExperienceProvider>
  );
}
