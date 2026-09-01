import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuGlobe,
  LuMoon,
  LuSun,
} from "react-icons/lu";

import logo from "../../../assets/smart-spend-logo.png";
import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { useThemeContext } from "../../../contexts/theme/useThemeContext";
import { PATH } from "../../../routes/Path";

import "./PublicChrome.css";

export default function PublicNavbar() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuthContext();
  const { isDark, toggleTheme } = useThemeContext();

  const currentLanguage = i18n.resolvedLanguage || i18n.language || "en";

  const isArabic = currentLanguage.startsWith("ar");

  const changeLanguage = async () => {
    await i18n.changeLanguage(isArabic ? "en" : "ar");
  };

  const scrollToSection = (id) => {
  const section = document.getElementById(id);

  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

  return (
    <header className="home-navbar">
      <div className="home-container home-navbar__inner">
        <Link to="/" className="home-navbar__brand">
          <img src={logo} alt="Smart Spend" />

          <span>
            <strong>Smart Spend</strong>
            <small>AI money management</small>
          </span>
        </Link>


        <nav
          className="home-navbar__links"
          aria-label="Public navigation"
        >
          <a  onClick={() => scrollToSection("features")}>{t("home.nav.features")}</a>

          <a onClick={() => scrollToSection("how-it-works")}>{t("home.nav.howItWorks")}</a>

          <a onClick={() => scrollToSection("security")}>{t("home.nav.security")}</a>

          <a onClick={() => scrollToSection("faq")}>{t("home.nav.faq")}</a>
        </nav>

        <div className="home-navbar__actions">
          <button
            type="button"
            className="home-navbar__language"
            onClick={changeLanguage}
            aria-label={isArabic ? "Switch to English" : "Switch to Arabic"}
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

          {isAuthenticated ? (
            <NavLink
              to={PATH.USER.DASHBOARD}
              className="home-primary-button home-navbar__start"
            >
              {t("home.nav.dashboard")}
            </NavLink>
          ) : (
            <>
              <NavLink to={PATH.AUTH.SIGNIN} className="home-navbar__signin">
                {t("home.nav.signIn")}
              </NavLink>

              <NavLink
                to={PATH.AUTH.REGISTER}
                className="home-primary-button home-navbar__start"
              >
                {t("home.nav.startNow")}
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
