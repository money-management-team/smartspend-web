import {
  LuSearch,
  LuMoon,
  LuSun,

  LuBell,
  LuMenu,
  LuGlobe,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import { useThemeContext } from "../../../../contexts/theme/useThemeContext";

import "./DashboardHeader.css";

export default function DashboardHeader({
  onToggleSidebar,
}) {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useThemeContext();

  const isArabic =
    (
      i18n.resolvedLanguage ||
      i18n.language
    )
      ?.toLowerCase()
      .startsWith("ar");

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
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <LuSun /> : <LuMoon />}
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