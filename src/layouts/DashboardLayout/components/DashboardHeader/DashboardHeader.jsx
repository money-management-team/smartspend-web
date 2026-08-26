import {
  LuSearch,
  LuMoon,
  LuSun,

  LuBell,
  LuMenu,
  LuGlobe,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { useThemeContext } from "../../../../contexts/theme/useThemeContext";

import "./DashboardHeader.css";
import { Link } from "react-router-dom";
import { PATH } from "../../../../routes/Path";

const getUserInitials = (name) => {
  const nameParts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (nameParts.length === 0) return "U";

  if (nameParts.length === 1) {
    return Array.from(nameParts[0]).slice(0, 2).join("").toLocaleUpperCase();
  }

  return `${Array.from(nameParts[0])[0]}${Array.from(nameParts.at(-1))[0]}`
    .toLocaleUpperCase();
};

export default function DashboardHeader({
  onToggleSidebar,
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthContext();
  const { isDark, toggleTheme } = useThemeContext();
  const userInitials = getUserInitials(user?.name);

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

        <Link to={PATH.USER.NOTIFICATIONS}
          type="button"
          className="dashboard-header__notification"
        >
          <LuBell />

          <span className="dashboard-header__notification-badge">
            3
          </span>
        </Link>

        <Link to={PATH.USER.SETTING}
          type="button"
          className="dashboard-header__avatar"
          aria-label={user?.name || t("dashboard.header.userProfile")}
          title={user?.name || undefined}
        >
          {userInitials}
        </Link>
      </div>
    </header>
  );
}
