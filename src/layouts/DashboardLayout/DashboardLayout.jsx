import { useState } from "react";
import { Outlet } from "react-router-dom";

import DashboardHeader from "./components/DashboardHeader/DashboardHeader";
import DashboardSidebar from "./components/DashboardSidebar/DashboardSidebar";

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

  return (
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}