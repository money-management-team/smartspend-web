import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./PasswordChanged.css";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 12.2 3.3 3.3 7.7-7.7" />
    </svg>
  );
}

export default function PasswordChanged() {
  const { t, i18n } = useTranslation();

  const isArabic = (i18n.resolvedLanguage || i18n.language)
    ?.toLowerCase()
    .startsWith("ar");

  return (
    <>
      {/* ==========================
          PROMO SECTION
      ========================== */}

      <section
        className="password-changed-promo"
        aria-label={t("auth.passwordChanged.promo.title")}
      >
        <div className="password-changed-promo__rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="password-changed-promo__content">
          <div className="password-changed-promo__logo">
            <img src={logo} alt="Smart Spend" />
          </div>

          <h2>{t("auth.passwordChanged.promo.title")}</h2>

          <p>{t("auth.passwordChanged.promo.subtitle")}</p>
        </div>
      </section>

      {/* ==========================
          SUCCESS SECTION
      ========================== */}

      <section className="password-changed-panel">
        {/* Progress */}

        <div className="password-changed-progress" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        {/* Success Icon */}

        <div className="password-changed-success-icon">
          <CheckIcon />
        </div>

        {/* Content */}

        <header className="password-changed-header">
          <h1>{t("auth.passwordChanged.title")}</h1>

          <p>{t("auth.passwordChanged.subtitle")}</p>
        </header>

        {/* 
          التصميم العربي المرفق يحتوي الزر،
          بينما التصميم الإنجليزي لا يحتويه.
        */}

        <a href="#login" className="password-changed-button">
          {t("auth.passwordChanged.back")}
        </a>
      </section>
    </>
  );
}
