import { useLanguageContext } from "../../../contexts/language/useLanguageContext";
import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./Login.css";
import { Link } from "react-router-dom";
import { PATH } from "../../../routes/Path";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />

      <path d="m5 7 7 5.2L19 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.7 12.2 3.2 3.2 7.4-7.4" />
    </svg>
  );
}

export default function Login() {
  const { language } = useLanguageContext();

  const { t } = useTranslation();

  const isArabic = language === "ar";

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  const fields = (
    <>
      {/* Email / Phone */}

      <label className="login-field">
        <span>{t("auth.login.fields.contact.label")}</span>

        <span className="login-input-wrap">
          <input
            type="text"
            name="contact"
            placeholder={t("auth.login.fields.contact.placeholder")}
            autoComplete="email"
          />

          <span className="login-input-icon">
            <MailIcon />
          </span>
        </span>
      </label>

      {/* Password */}

      <label className="login-field">
        <span className="login-field__heading">
          <span>{t("auth.login.fields.password.label")}</span>

          <Link to={PATH.AUTH.FORGOT_PASSWORD}>
            {t("auth.login.forgotPassword")}
          </Link>
        </span>

        <span className="login-input-wrap">
          <input
            type="password"
            name="password"
            placeholder={t("auth.login.fields.password.placeholder")}
            autoComplete="current-password"
          />
        </span>
      </label>

      {/* Remember */}

      <label className="login-remember">
        <input type="checkbox" name="remember" defaultChecked />

        <span className="login-remember__check" aria-hidden="true">
          <CheckIcon />
        </span>

        <span>{t("auth.login.remember")}</span>
      </label>

      {/* Submit */}

      <button className="login-submit" type="submit">
        {t("auth.login.submit")}
      </button>
    </>
  );

  const heading = (
    <header className="login-form-panel__header">
      <h1>{t("auth.login.title")}</h1>

      <p>{t("auth.login.subtitle")}</p>
    </header>
  );

  const social = (
    <>
      <div className="login-divider" aria-hidden="true">
        <span />

        <small>{t("auth.login.social.divider")}</small>

        <span />
      </div>

      <div className="login-social">
        <button type="button">{t("auth.login.social.google")}</button>

        <button type="button">{t("auth.login.social.apple")}</button>
      </div>
    </>
  );

  return (
    <>
      {/* ==========================
          PROMO
      ========================== */}

      <section className="login-promo" aria-label={t("auth.login.promo.title")}>
        <div className="login-promo__rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="login-promo__content">
          <div className="login-promo__logo">
            <img src={logo} alt="Smart Spend" />
          </div>

          <h2>{t("auth.login.promo.title")}</h2>

          <p className="login-promo__subtitle">
            {t("auth.login.promo.subtitle")}
          </p>

          <div className="login-promo__chips">
            <span className="login-promo__chip">
              {t("auth.login.promo.chips.0")}
            </span>

            <span className="login-promo__chip">
              {t("auth.login.promo.chips.1")}
            </span>

            <span className="login-promo__chip">
              {t("auth.login.promo.chips.2")}
            </span>
          </div>
        </div>
      </section>

      {/* ==========================
          FORM
      ========================== */}

      <section
        className={`login-form-panel ${
          isArabic ? "login-form-panel--ar" : "login-form-panel--en"
        }`}
      >
        <form className="login-form" onSubmit={handleSubmit}>
          {isArabic ? (
            <>
              {heading}

              <div className="login-form__fields">{fields}</div>

              {social}

              <p className="login-register">
                {t("auth.login.register.prefix")}{" "}
                <Link to={PATH.AUTH.REGISTER}>
                  {t("auth.login.register.link")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="login-form__fields login-form__fields--english">
                {fields}
              </div>

              {heading}

              {social}

              <p className="login-register">
                {t("auth.login.register.prefix")}{" "}
                <Link to={PATH.AUTH.REGISTER}>
                  {t("auth.login.register.link")}
                </Link>
              </p>
            </>
          )}
        </form>
      </section>
    </>
  );
}
