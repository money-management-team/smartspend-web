import {
  LuSearch,
  LuMoon,
  LuSun,

  LuBell,
  LuMenu,
  LuGlobe,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

import "./DashboardHeader.css";

export default function DashboardHeader({
  onToggleSidebar,
}) {
  const { t, i18n } = useTranslation();

  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem(
        "smart-spend-theme",
      ) || "light",
  );

  const isArabic =
    (
      i18n.resolvedLanguage ||
      i18n.language
    )
      ?.toLowerCase()
      .startsWith("ar");

  useEffect(() => {
    document.documentElement.dataset.theme =
      theme;

    localStorage.setItem(
      "smart-spend-theme",
      theme,
    );
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light"
        ? "dark"
        : "light",
    );
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(
      isArabic
        ? "en"
        : "ar",
    );
  };

  return (
    <header className="dashboard-header">
      <button
        type="button"
        className="dashboard-header__menu"
        onClick={onToggleSidebar}
      >
        <LuMenu />
      </button>

      <div className="dashboard-header__search">
        <LuSearch />

        <input
          type="search"
          placeholder={t(
            "dashboard.header.searchPlaceholder",
          )}
        />
      </div>

      <div className="dashboard-header__actions">
        <button
          type="button"
          className="dashboard-header__icon-button"
          onClick={toggleTheme}
        >
          {theme === "light" ? (
            <LuMoon />
          ) : (
            <LuSun />
          )}
        </button>

        <button
          type="button"
          className="dashboard-header__language"
          onClick={toggleLanguage}
        >
          <LuGlobe />

          <span>
            {isArabic
              ? "English"
              : "العربية"}
          </span>
        </button>

        <button
          type="button"
          className="dashboard-header__notification"
        >
          <LuBell />

          <span className="dashboard-header__notification-badge">
            3
          </span>
        </button>

        <button
          type="button"
          className="dashboard-header__avatar"
        >
          LH
        </button>
      </div>
    </header>
  );
}