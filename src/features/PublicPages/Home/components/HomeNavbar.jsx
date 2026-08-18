import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuGlobe,
  LuMoon,
  LuSun,
  //   LuGlobe2,
} from "react-icons/lu";

import logo from "../../../../assets/smart-spend-logo.png";
import { useThemeContext } from "../../../../contexts/theme/useThemeContext";

export default function HomeNavbar() {
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useThemeContext();

  const currentLanguage = i18n.resolvedLanguage || i18n.language || "en";

  const isArabic = currentLanguage.startsWith("ar");

  const changeLanguage = async () => {
    await i18n.changeLanguage(isArabic ? "en" : "ar");
  };

  return (
    <header className="home-navbar">
      <div className="home-container home-navbar__inner">
        <a href="/" className="home-navbar__brand">
          <img src={logo} alt="Smart Spend" />

          <strong>Smart Spend</strong>
        </a>

        <nav className="home-navbar__links">
          <a href="#features">{t("home.nav.features")}</a>

          <a href="#how-it-works">{t("home.nav.howItWorks")}</a>

          <a href="#security">{t("home.nav.security")}</a>

          <a href="#faq">{t("home.nav.faq")}</a>
        </nav>

        <div className="home-navbar__actions">
          <button
            type="button"
            className="home-navbar__language"
            onClick={changeLanguage}
          >
            <LuGlobe />

            <span>{isArabic ? "English" : "العربية"}</span>
          </button>

          <button
            type="button"
            className="home-navbar__theme"
            onClick={toggleTheme}
            aria-label={
              isDark ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDark ? <LuSun /> : <LuMoon />}
          </button>

          <NavLink to="/signin" className="home-navbar__signin">
            {t("home.nav.signIn")}
          </NavLink>

          <NavLink
            to="/register"
            className="home-primary-button home-navbar__start"
          >
            {t("home.nav.startNow")}
          </NavLink>
        </div>
      </div>
    </header>
  );
}