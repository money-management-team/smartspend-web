import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import logo from "../../assets/smart-spend-logo.png";
import "./AuthLayout.css";
import { Outlet } from "react-router-dom";
import { useThemeContext } from "../../contexts/theme/useThemeContext";

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.9 12h16.2M12 3.6c2.05 2.15 3.15 5 3.15 8.4S14.05 18.25 12 20.4M12 3.6C9.95 5.75 8.85 8.6 8.85 12s1.1 6.25 3.15 8.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.6 15.2A7.8 7.8 0 0 1 8.8 4.4 7.8 7.8 0 1 0 19.6 15.2Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.7" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

export default function AuthLayout({ variant = "register" }) {
  const { language, changeLanguage } = useLanguageContext();
  const { isDark, toggleTheme } = useThemeContext();

  const isArabic = language === "ar";
  const direction = isArabic ? "rtl" : "ltr";

  const handleChangeLanguage = async () => {
    await changeLanguage();
  };
  return (
    <div className="auth-shell" dir={direction}>
      <header className="auth-header">
        <a className="auth-brand" href="/" aria-label="Smart Spend">
          <img src={logo} alt="" />
          <strong>{isArabic ? "سمارت سبيند" : "Smart Spend"}</strong>
        </a>

        <div className="auth-actions">
          <button
            className="auth-action auth-action--theme"
            type="button"
            aria-label={
              isDark ? "Enable light mode" : "Enable dark mode"
            }
            onClick={toggleTheme}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            className="auth-action auth-action--language"
            type="button"
            onClick={handleChangeLanguage}
          >
            <GlobeIcon />
            <span>{isArabic ? "English" : "العربية"}</span>
          </button>
        </div>
      </header>

      <main className={`auth-card auth-card--${variant}`}>{<Outlet />}</main>
    </div>
  );
}