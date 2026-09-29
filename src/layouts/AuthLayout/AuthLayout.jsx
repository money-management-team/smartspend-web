import { useLanguageContext } from "../../contexts/language/useLanguageContext";
import logo from "../../assets/smart-spend-logo.png";
import "./AuthLayout.css";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useThemeContext } from "../../contexts/theme/useThemeContext";
import { PATH } from "../../routes/Path";
import AuthAnimatedBackground from "./AuthAnimatedBackground";

const AUTH_VARIANTS = {
  [PATH.AUTH.ACCOUNT_TYPE]: "account-type",
  [PATH.AUTH.SIGNIN]: "login",
  [PATH.AUTH.REGISTER]: "register",
  [PATH.AUTH.COMPANY_SIGNIN]: "company-login",
  [PATH.AUTH.COMPANY_REGISTER]: "company-register",
  [PATH.AUTH.FORGOT_PASSWORD]: "forgot",
  [PATH.AUTH.VERIFY_CODE]: "verify",
  [PATH.AUTH.RESET_PASSWORD]: "reset",
  [PATH.AUTH.PASSWORD_CHANGED]: "password-changed",
};

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

export default function AuthLayout({ variant }) {
  const { language, changeLanguage } = useLanguageContext();
  const { isDark, toggleTheme } = useThemeContext();
  const { pathname } = useLocation();

  const isArabic = language === "ar";
  const direction = isArabic ? "rtl" : "ltr";
  const activeVariant =
    variant ??
    AUTH_VARIANTS[pathname] ??
    // /verify-email/:id/:hash has params, so it can't be a key above.
    (pathname.startsWith(`${PATH.AUTH.VERIFY_EMAIL}/`) ? "verify-email" : "login");

  const themeLabel = isArabic
    ? isDark
      ? "تفعيل الوضع الفاتح"
      : "تفعيل الوضع الداكن"
    : isDark
      ? "Enable light mode"
      : "Enable dark mode";

  const languageLabel = isArabic
    ? "Switch language to English"
    : "تغيير اللغة إلى العربية";

  const handleChangeLanguage = async () => {
    await changeLanguage();
  };

  return (
    <div className="auth-shell" dir={direction}>
      <AuthAnimatedBackground />

      <header className="auth-header">
        <Link className="auth-brand" to={PATH.HOME} aria-label="Smart Spend">
          <img src={logo} alt="" />
          <strong>{isArabic ? "سمارت سبيند" : "Smart Spend"}</strong>
        </Link>

        <div className="auth-actions">
          <button
            className="auth-action auth-action--theme"
            type="button"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={toggleTheme}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            className="auth-action auth-action--language"
            type="button"
            aria-label={languageLabel}
            onClick={handleChangeLanguage}
          >
            <GlobeIcon />
            <span>{isArabic ? "English" : "العربية"}</span>
          </button>
        </div>
      </header>

      <main
        className={`auth-card auth-card--${activeVariant}`}
        data-auth-page={activeVariant}
      >
        <Outlet />
      </main>
    </div>
  );
}
