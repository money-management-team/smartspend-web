import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  LuSlidersHorizontal,
  LuSun,
  LuMoon,
  LuMonitor,
  LuCheck,
} from "react-icons/lu";

import { useThemeContext } from "../../../../../../contexts/theme/useThemeContext";
import { useLanguageContext } from "../../../../../../contexts/language/useLanguageContext";
import "./PreferencesSettings.css";

const PREF_STORAGE_KEY = "smartspend_preferences";

const getSavedPreferences = () => {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse error
  }
  return {
    dateFormat: "DD/MM/YYYY",
    currencyPosition: "after",
    notificationsEnabled: true,
    themeMode: "light",
  };
};

export default function PreferencesSettings() {
  const { t, i18n } = useTranslation();
  const { theme, changeTheme } = useThemeContext();
  const { language, setLanguage } = useLanguageContext();

  const [savedPrefs, setSavedPrefs] = useState(getSavedPreferences);

  // Form states
  const [themeMode, setThemeMode] = useState(() => {
    const saved = savedPrefs.themeMode;
    if (saved === "system") return "system";
    return theme || "light";
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => savedPrefs.notificationsEnabled ?? true,
  );
  const [dateFormat, setDateFormat] = useState(
    () => savedPrefs.dateFormat || "DD/MM/YYYY",
  );
  const [currencyPosition, setCurrencyPosition] = useState(
    () => savedPrefs.currencyPosition || "after",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Language Change Handler
  const handleSelectLanguage = useCallback(
    async (langCode) => {
      if (setLanguage) {
        await setLanguage(langCode);
      } else {
        await i18n.changeLanguage(langCode);
      }
      setSuccessMessage("");
    },
    [setLanguage, i18n],
  );

  // Theme Change Handler
  const handleSelectTheme = (mode) => {
    setThemeMode(mode);
    setSuccessMessage("");
    if (mode === "system") {
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      ).matches;
      changeTheme(prefersDark ? "dark" : "light");
    } else {
      changeTheme(mode);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);

    const updated = {
      dateFormat,
      currencyPosition,
      notificationsEnabled,
      themeMode,
    };

    try {
      localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(updated));
      setSavedPrefs(updated);
      setSuccessMessage(t("dashboard.settings.preferences.saved"));
    } catch {
      // storage error fallback
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDateFormat(savedPrefs.dateFormat || "DD/MM/YYYY");
    setCurrencyPosition(savedPrefs.currencyPosition || "after");
    setNotificationsEnabled(savedPrefs.notificationsEnabled ?? true);
    setThemeMode(savedPrefs.themeMode || "light");
    if (savedPrefs.themeMode === "system") {
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      ).matches;
      changeTheme(prefersDark ? "dark" : "light");
    } else {
      changeTheme(savedPrefs.themeMode || "light");
    }
    setSuccessMessage("");
  };

  const currentLang = language || i18n.language || "ar";
  const isArabic = currentLang.startsWith("ar");

  return (
    <section className="preferences-settings" aria-labelledby="preferences-heading">
      {/* Header */}
      <header className="preferences-settings__header">
        <div className="preferences-settings__header-icon-box">
          <LuSlidersHorizontal />
        </div>
        <div className="preferences-settings__header-text">
          <h2 id="preferences-heading">
            {t("dashboard.settings.preferences.title")}
          </h2>
          <p>{t("dashboard.settings.preferences.headerSubtitle")}</p>
        </div>
      </header>

      <form className="preferences-settings__form" onSubmit={handleSave}>
        {/* Language Section */}
        <section className="pref-section">
          <div className="pref-section__header">
            <h3 className="pref-section__title">
              {t("dashboard.settings.preferences.language.title")}
            </h3>
            <p className="pref-section__desc">
              {t("dashboard.settings.preferences.language.subtitle")}
            </p>
          </div>

          <div className="pref-cards-grid pref-cards-grid--two">
            {/* Arabic Card */}
            <div
              className={`pref-card ${isArabic ? "pref-card--active" : ""}`}
              onClick={() => handleSelectLanguage("ar")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectLanguage("ar");
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isArabic}
            >
              <div className="pref-card__content">
                <span className="pref-card__title">
                  {t("dashboard.settings.preferences.language.arabic")}
                </span>
                <span className="pref-card__sub">
                  {t("dashboard.settings.preferences.language.arabicSub")}
                </span>
              </div>
              <div
                className={`pref-card__radio ${isArabic ? "pref-card__radio--selected" : ""}`}
              >
                {isArabic && <LuCheck className="pref-card__check-icon" />}
              </div>
            </div>

            {/* English Card */}
            <div
              className={`pref-card ${!isArabic ? "pref-card--active" : ""}`}
              onClick={() => handleSelectLanguage("en")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectLanguage("en");
              }}
              role="button"
              tabIndex={0}
              aria-pressed={!isArabic}
            >
              <div className="pref-card__content">
                <span className="pref-card__title">
                  {t("dashboard.settings.preferences.language.english")}
                </span>
                <span className="pref-card__sub">
                  {t("dashboard.settings.preferences.language.englishSub")}
                </span>
              </div>
              <div
                className={`pref-card__radio ${!isArabic ? "pref-card__radio--selected" : ""}`}
              >
                {!isArabic && <LuCheck className="pref-card__check-icon" />}
              </div>
            </div>
          </div>
        </section>

        {/* Theme & Appearance Section */}
        <section className="pref-section">
          <div className="pref-section__header">
            <h3 className="pref-section__title">
              {t("dashboard.settings.preferences.theme.title")}
            </h3>
            <p className="pref-section__desc">
              {t("dashboard.settings.preferences.theme.subtitle")}
            </p>
          </div>

          <div className="pref-cards-grid pref-cards-grid--three">
            {/* Light Mode */}
            <div
              className={`pref-card ${themeMode === "light" ? "pref-card--active" : ""}`}
              onClick={() => handleSelectTheme("light")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectTheme("light");
              }}
              role="button"
              tabIndex={0}
              aria-pressed={themeMode === "light"}
            >
              <div className="pref-card__icon-wrap">
                <LuSun className="pref-card__icon" />
              </div>
              <div className="pref-card__content">
                <span className="pref-card__title">
                  {t("dashboard.settings.preferences.theme.light")}
                </span>
                <span className="pref-card__sub">
                  {t("dashboard.settings.preferences.theme.lightSub")}
                </span>
              </div>
              <div
                className={`pref-card__radio ${themeMode === "light" ? "pref-card__radio--selected" : ""}`}
              >
                {themeMode === "light" && <LuCheck className="pref-card__check-icon" />}
              </div>
            </div>

            {/* Dark Mode */}
            <div
              className={`pref-card ${themeMode === "dark" ? "pref-card--active" : ""}`}
              onClick={() => handleSelectTheme("dark")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectTheme("dark");
              }}
              role="button"
              tabIndex={0}
              aria-pressed={themeMode === "dark"}
            >
              <div className="pref-card__icon-wrap">
                <LuMoon className="pref-card__icon" />
              </div>
              <div className="pref-card__content">
                <span className="pref-card__title">
                  {t("dashboard.settings.preferences.theme.dark")}
                </span>
                <span className="pref-card__sub">
                  {t("dashboard.settings.preferences.theme.darkSub")}
                </span>
              </div>
              <div
                className={`pref-card__radio ${themeMode === "dark" ? "pref-card__radio--selected" : ""}`}
              >
                {themeMode === "dark" && <LuCheck className="pref-card__check-icon" />}
              </div>
            </div>

            {/* System Mode */}
            <div
              className={`pref-card ${themeMode === "system" ? "pref-card--active" : ""}`}
              onClick={() => handleSelectTheme("system")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelectTheme("system");
              }}
              role="button"
              tabIndex={0}
              aria-pressed={themeMode === "system"}
            >
              <div className="pref-card__icon-wrap">
                <LuMonitor className="pref-card__icon" />
              </div>
              <div className="pref-card__content">
                <span className="pref-card__title">
                  {t("dashboard.settings.preferences.theme.system")}
                </span>
                <span className="pref-card__sub">
                  {t("dashboard.settings.preferences.theme.systemSub")}
                </span>
              </div>
              <div
                className={`pref-card__radio ${themeMode === "system" ? "pref-card__radio--selected" : ""}`}
              >
                {themeMode === "system" && <LuCheck className="pref-card__check-icon" />}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="pref-section">
          <div className="pref-toggle-card">
            <div className="pref-toggle-card__main">
              <div className="pref-toggle-card__header-line">
                <span className="pref-toggle-card__title">
                  {t("dashboard.settings.preferences.notifications.title")}
                </span>
                <span
                  className={`pref-toggle-card__badge ${
                    notificationsEnabled
                      ? "pref-toggle-card__badge--enabled"
                      : "pref-toggle-card__badge--disabled"
                  }`}
                >
                  {notificationsEnabled
                    ? t("dashboard.settings.preferences.notifications.badge")
                    : isArabic
                    ? "معطل"
                    : "Disabled"}
                </span>
              </div>
              <p className="pref-toggle-card__desc">
                {t("dashboard.settings.preferences.notifications.subtitle")}
              </p>
            </div>

            <label className="pref-switch" aria-label="Toggle notifications">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => {
                  setNotificationsEnabled(e.target.checked);
                  setSuccessMessage("");
                }}
              />
              <span className="pref-switch__slider" />
            </label>
          </div>
        </section>

        {/* Date & Currency Formatting Section */}
        <section className="pref-section">
          <div className="pref-section__header">
            <h3 className="pref-section__title">
              {t("dashboard.settings.preferences.formatting.title")}
            </h3>
            <p className="pref-section__desc">
              {t("dashboard.settings.preferences.formatting.subtitle")}
            </p>
          </div>

          <div className="pref-fields-grid">
            {/* Date Format */}
            <label className="settings-field">
              <span>{t("dashboard.settings.preferences.formatting.dateFormat")}</span>
              <select
                value={dateFormat}
                onChange={(e) => {
                  setDateFormat(e.target.value);
                  setSuccessMessage("");
                }}
              >
                <option value="DD/MM/YYYY">
                  {t("dashboard.settings.preferences.formatting.dateFormatOption")}
                </option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (10/24/2024)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2024-10-24)</option>
              </select>
            </label>

            {/* Currency Position */}
            <label className="settings-field">
              <span>{t("dashboard.settings.preferences.formatting.currencyPos")}</span>
              <select
                value={currencyPosition}
                onChange={(e) => {
                  setCurrencyPosition(e.target.value);
                  setSuccessMessage("");
                }}
              >
                <option value="after">
                  {t("dashboard.settings.preferences.formatting.currencyAfter")}
                </option>
                <option value="before">
                  {t("dashboard.settings.preferences.formatting.currencyBefore")}
                </option>
              </select>
            </label>
          </div>
        </section>

        {/* Success / Status Message */}
        {successMessage && (
          <p className="pref-settings__message" role="status">
            {successMessage}
          </p>
        )}

        {/* Footer */}
        <div className="pref-settings__footer">
          <div className="pref-settings__synced-badge">
            <LuCheck className="pref-settings__synced-icon" />
            <span>{t("dashboard.settings.preferences.syncedBadge")}</span>
          </div>

          <div className="pref-settings__btn-group">
            <button
              type="submit"
              className="pref-settings__save"
              disabled={isSaving}
            >
              {t("dashboard.settings.preferences.save")}
            </button>
            <button
              type="button"
              className="pref-settings__cancel"
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t("dashboard.settings.preferences.cancel")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
