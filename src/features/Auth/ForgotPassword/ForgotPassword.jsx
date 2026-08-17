import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./ForgotPassword.css";
import { Link } from "react-router-dom";
import { PATH } from "../../../routes/Path";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
      />

      <path d="m5 7 7 5.2L19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

export default function ForgotPassword() {
  const { t } = useTranslation();

  const handleSubmit = (event) => {
    event.preventDefault();

    // API Logic Later

    // window.location.hash = "#verify-code";
  };

  return (
    <>
      {/* =============================
          BLUE PROMO SECTION
      ============================== */}

      <section
        className="forgot-promo"
        aria-label={t(
          "auth.forgotPassword.promo.title",
        )}
      >
        <div
          className="forgot-promo__rings"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <div className="forgot-promo__content">
          <div className="forgot-promo__logo">
            <img
              src={logo}
              alt="Smart Spend"
            />
          </div>

          <h2>
            {t(
              "auth.forgotPassword.promo.title",
            )}
          </h2>

          <p>
            {t(
              "auth.forgotPassword.promo.subtitle",
            )}
          </p>
        </div>
      </section>

      {/* =============================
          FORM SECTION
      ============================== */}

      <section className="forgot-form-panel">
        {/* Progress */}

        <div
          className="forgot-progress"
          aria-hidden="true"
        >
          <span className="forgot-progress__item forgot-progress__item--active" />

          <span className="forgot-progress__item" />

          <span className="forgot-progress__item" />

          <span className="forgot-progress__item" />
        </div>

        {/* Header */}

        <header className="forgot-form-header">
          <h1>
            {t("auth.forgotPassword.title")}
          </h1>

          <p>
            {t(
              "auth.forgotPassword.subtitle",
            )}
          </p>
        </header>

        {/* Form */}

        <form
          className="forgot-form"
          onSubmit={handleSubmit}
        >
          <label className="forgot-field">
            <span className="forgot-field__label">
              {t(
                "auth.forgotPassword.field.label",
              )}
            </span>

            <span className="forgot-input-wrap">
              <input
                type="text"
                name="contact"
                placeholder={t(
                  "auth.forgotPassword.field.placeholder",
                )}
                autoComplete="email"
              />

              <span className="forgot-input-icon">
                <MailIcon />
              </span>
            </span>
          </label>

          <button
            className="forgot-submit"
            type="submit"
          >
            {t(
              "auth.forgotPassword.submit",
            )}
          </button>
        </form>

        {/* Back */}

        <Link
        to={PATH.AUTH.SIGNIN}
          className="forgot-back"
        >
          <ArrowIcon />

          <span>
            {t("auth.forgotPassword.back")}
          </span>
        </Link>
      </section>
    </>
  );
}