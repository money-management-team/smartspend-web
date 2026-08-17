import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./Register.css";
import { PATH } from "../../../routes/Path";
import { Link } from "react-router-dom";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.25a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
      <path d="M6.5 19.1v-1.25c0-2.15 2.1-3.9 4.7-3.9h1.6c2.6 0 4.7 1.75 4.7 3.9v1.25" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />

      <path d="m5 7 7 5.2L19 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.7 19 6.4v5.35c0 4.6-2.95 7.7-7 8.9-4.05-1.2-7-4.3-7-8.9V6.4l7-2.7Z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 1.15 4.1a5.2 5.2 0 0 0 3.65 3.65L21 12l-4.2 1.2a5.2 5.2 0 0 0-3.6 3.6L12 21l-1.2-4.2a5.2 5.2 0 0 0-3.6-3.6L3 12l4.2-1.25a5.2 5.2 0 0 0 3.55-3.55L12 3Z" />

      <path d="m18.3 3.4.45 1.55a2 2 0 0 0 1.35 1.35l1.5.45-1.5.45a2 2 0 0 0-1.35 1.35l-.45 1.55-.45-1.55A2 2 0 0 0 16.5 7.2L15 6.75l1.5-.45a2 2 0 0 0 1.35-1.35l.45-1.55Z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5.3" width="18" height="13.4" rx="2.2" />

      <path d="M3 9.2h18" />
    </svg>
  );
}

const featureIcons = [ShieldIcon, SparklesIcon, CardIcon];

export default function Register() {
  const { t } = useTranslation();

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  const features = [0, 1, 2].map((index) => ({
    title: t(`auth.register.promo.features.${index}.title`),

    description: t(`auth.register.promo.features.${index}.description`),
  }));

  return (
    <>
      {/* ==========================
          PROMO SECTION
      ========================== */}

      <section
        className="register-promo"
        aria-label={t("auth.register.promo.title")}
      >
        <div className="register-promo__rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="register-promo__content">
          <div className="register-promo__logo">
            <img src={logo} alt="Smart Spend" />
          </div>

          <h2>{t("auth.register.promo.title")}</h2>

          <p className="register-promo__subtitle">
            {t("auth.register.promo.subtitle")}
          </p>

          <div className="register-promo__features">
            {features.map((feature, index) => {
              const Icon = featureIcons[index];

              return (
                <article className="register-feature" key={index}>
                  <span className="register-feature__icon">
                    <Icon />
                  </span>

                  <span className="register-feature__copy">
                    <strong>{feature.title}</strong>

                    <small>{feature.description}</small>
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==========================
          REGISTER FORM
      ========================== */}

      <section className="register-form-panel">
        <header className="register-form-panel__header">
          <h1>{t("auth.register.title")}</h1>

          <p>{t("auth.register.subtitle")}</p>
        </header>

        <form className="register-form" onSubmit={handleSubmit}>
          {/* Full Name */}

          <label className="register-field">
            <span>{t("auth.register.fields.fullName.label")}</span>

            <span className="register-input-wrap">
              <input
                type="text"
                name="fullName"
                placeholder={t("auth.register.fields.fullName.placeholder")}
                autoComplete="name"
              />

              <span className="register-input-icon">
                <UserIcon />
              </span>
            </span>
          </label>

          {/* Email / Phone */}

          <label className="register-field">
            <span>{t("auth.register.fields.contact.label")}</span>

            <span className="register-input-wrap">
              <input
                type="text"
                name="contact"
                placeholder={t("auth.register.fields.contact.placeholder")}
                autoComplete="email"
              />

              <span className="register-input-icon">
                <MailIcon />
              </span>
            </span>
          </label>

          {/* Password */}

          <label className="register-field">
            <span>{t("auth.register.fields.password.label")}</span>

            <span className="register-input-wrap">
              <input
                type="password"
                name="password"
                placeholder={t("auth.register.fields.password.placeholder")}
                autoComplete="new-password"
              />
            </span>
          </label>

          {/* Confirm Password */}

          <label className="register-field">
            <span>{t("auth.register.fields.confirmPassword.label")}</span>

            <span className="register-input-wrap">
              <input
                type="password"
                name="confirmPassword"
                placeholder={t(
                  "auth.register.fields.confirmPassword.placeholder",
                )}
                autoComplete="new-password"
              />
            </span>
          </label>

          {/* Terms */}

          <label className="register-consent">
            <input type="checkbox" name="terms" />

            <span className="register-consent__check" aria-hidden="true" />

            <span>
              {t("auth.register.terms.prefix")}{" "}
              <a href="#terms">{t("auth.register.terms.link")}</a>
            </span>
          </label>

          {/* Submit */}

          <button className="register-submit" type="submit">
            {t("auth.register.submit")}
          </button>

          {/* Divider */}

          <div className="register-divider" aria-hidden="true">
            <span />

            <small>{t("auth.register.social.divider")}</small>

            <span />
          </div>

          {/* Social */}

          <div className="register-social">
            <button type="button">{t("auth.register.social.google")}</button>

            <button type="button">{t("auth.register.social.apple")}</button>
          </div>

          {/* Login */}

          <p className="register-login">
            {t("auth.register.login.prefix")}{" "}
            <Link to={PATH.AUTH.SIGNIN}>{t("auth.register.login.link")}</Link>
          </p>
        </form>
      </section>
    </>
  );
}
