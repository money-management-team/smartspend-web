import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./ResetPassword.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />

      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 12.2 3.3 3.3 7.7-7.7" />
    </svg>
  );
}

export default function ResetPassword() {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  /*
   * ==========================================
   * PASSWORD RULES
   * ==========================================
   */

  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,

      hasLowercase: /[a-z]/.test(password),

      hasUppercase: /[A-Z]/.test(password),

      hasNumber: /\d/.test(password),
    }),
    [password],
  );

  /*
   * Uppercase + Lowercase requirement
   */
  const hasUpperAndLower =
    passwordRules.hasLowercase &&
    passwordRules.hasUppercase;

  /*
   * ==========================================
   * PASSWORD STRENGTH
   * ==========================================
   */

  const passwordStrength = useMemo(() => {
    if (!password) {
      return {
        level: 0,
        label: "—",
      };
    }

    const {
      minLength,
      hasLowercase,
      hasUppercase,
      hasNumber,
    } = passwordRules;

    /*
     * STRONG
     *
     * 8+ characters
     * lowercase
     * uppercase
     * number
     */
    if (
      minLength &&
      hasLowercase &&
      hasUppercase &&
      hasNumber
    ) {
      return {
        level: 3,

        label: t(
          "auth.resetPassword.strength.strong",
        ),
      };
    }

    /*
     * MEDIUM
     *
     * Example:
     * abcdefgh1
     * Abcdefgh
     *
     * يجب أن يكون الطول 8 على الأقل
     * مع وجود مزيج أفضل من مجرد نوع واحد
     */
    if (
      minLength &&
      (
        (
          hasNumber &&
          (hasLowercase || hasUppercase)
        ) ||
        (
          hasLowercase &&
          hasUppercase
        )
      )
    ) {
      return {
        level: 2,

        label: t(
          "auth.resetPassword.strength.medium",
        ),
      };
    }

    /*
     * WEAK
     *
     * Anything else
     */
    return {
      level: 1,

      label: t(
        "auth.resetPassword.strength.weak",
      ),
    };
  }, [password, passwordRules, t]);

  /*
   * ==========================================
   * VALID PASSWORD
   * ==========================================
   */

  const isPasswordValid =
    passwordRules.minLength &&
    hasUpperAndLower &&
    passwordRules.hasNumber;

  /*
   * ==========================================
   * PASSWORD MATCH
   * ==========================================
   */

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  /*
   * ==========================================
   * ENABLE SUBMIT
   * ==========================================
   */

  const canSubmit =
    isPasswordValid &&
    passwordsMatch;

  /*
   * ==========================================
   * SUBMIT
   * ==========================================
   */

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!isPasswordValid) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    console.log({
      password,
      password_confirmation:
        confirmPassword,
    });

    /*
     * Backend API later:
     *
     * await resetPassword({
     *   password,
     *   password_confirmation:
     *     confirmPassword,
     * });
     *
     * window.location.hash =
     *   "#password-changed";
     */
  };

  return (
    <>
      {/* ======================================
          PROMO SECTION
      ====================================== */}

      <section
        className="reset-promo"
        aria-label={t(
          "auth.resetPassword.promo.title",
        )}
      >
        {/* Rings */}

        <div
          className="reset-promo__rings"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        {/* Content */}

        <div className="reset-promo__content">
          {/* Logo */}

          <div className="reset-promo__logo">
            <img
              src={logo}
              alt="Smart Spend"
            />
          </div>

          {/* Title */}

          <h2>
            {t(
              "auth.resetPassword.promo.title",
            )}
          </h2>

          {/* Subtitle */}

          <p className="reset-promo__subtitle">
            {t(
              "auth.resetPassword.promo.subtitle",
            )}
          </p>

          {/* Promo Features */}

          <div className="reset-promo__features">
            <div className="reset-promo-feature">
              <ShieldIcon />

              <span>
                {t(
                  "auth.resetPassword.promo.dataProtection",
                )}
              </span>
            </div>

            <div className="reset-promo-feature">
              <LockIcon />

              <span>
                {t(
                  "auth.resetPassword.promo.encryption",
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================
          FORM SECTION
      ====================================== */}

      <section className="reset-form-panel">
        {/* Progress */}

        <div
          className="reset-progress"
          aria-hidden="true"
        >
          <span className="reset-progress__item reset-progress__item--active" />

          <span className="reset-progress__item reset-progress__item--active" />

          <span className="reset-progress__item reset-progress__item--active" />

          <span className="reset-progress__item" />
        </div>

        {/* Header */}

        <header className="reset-header">
          <h1>
            {t(
              "auth.resetPassword.title",
            )}
          </h1>

          <p>
            {t(
              "auth.resetPassword.subtitle",
            )}
          </p>
        </header>

        {/* Form */}

        <form
          className="reset-form"
          onSubmit={handleSubmit}
        >
          {/* =================================
              NEW PASSWORD
          ================================= */}

          <label className="reset-field">
            <span>
              {t(
                "auth.resetPassword.fields.password.label",
              )}
            </span>

            <span className="reset-input-wrap">
              <input
                type="password"
                name="password"
                value={password}
                placeholder={t(
                  "auth.resetPassword.fields.password.placeholder",
                )}
                autoComplete="new-password"
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
            </span>
          </label>

          {/* =================================
              PASSWORD STRENGTH
          ================================= */}

          <div className="reset-strength">
            {/* Strength Bar */}

            <div className="reset-strength__bar">
              <span
                className={`
                  reset-strength__value
                  reset-strength__value--${passwordStrength.level}
                `}
              />
            </div>

            {/* Strength Header */}

            <div className="reset-strength__heading">
              <span>
                {t(
                  "auth.resetPassword.strength.label",
                )}
              </span>

              <strong
                className={`
                  reset-strength__text
                  reset-strength__text--${passwordStrength.level}
                `}
              >
                {passwordStrength.label}
              </strong>
            </div>

            {/* =================================
                REQUIREMENTS
            ================================= */}

            <div className="reset-requirements">
              {/* 8 Characters */}

              <div
                className={`
                  reset-requirement
                  ${
                    passwordRules.minLength
                      ? "reset-requirement--passed"
                      : ""
                  }
                `}
              >
                <span className="reset-requirement__check">
                  {passwordRules.minLength && (
                    <CheckIcon />
                  )}
                </span>

                <span>
                  {t(
                    "auth.resetPassword.requirements.length",
                  )}
                </span>
              </div>

              {/* Uppercase + Lowercase */}

              <div
                className={`
                  reset-requirement
                  ${
                    hasUpperAndLower
                      ? "reset-requirement--passed"
                      : ""
                  }
                `}
              >
                <span className="reset-requirement__check">
                  {hasUpperAndLower && (
                    <CheckIcon />
                  )}
                </span>

                <span>
                  {t(
                    "auth.resetPassword.requirements.letters",
                  )}
                </span>
              </div>

              {/* Number */}

              <div
                className={`
                  reset-requirement
                  ${
                    passwordRules.hasNumber
                      ? "reset-requirement--passed"
                      : ""
                  }
                `}
              >
                <span className="reset-requirement__check">
                  {passwordRules.hasNumber && (
                    <CheckIcon />
                  )}
                </span>

                <span>
                  {t(
                    "auth.resetPassword.requirements.number",
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* =================================
              CONFIRM PASSWORD
          ================================= */}

          <label className="reset-field reset-field--confirm">
            <span>
              {t(
                "auth.resetPassword.fields.confirmPassword.label",
              )}
            </span>

            <span className="reset-input-wrap">
              <input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                placeholder={t(
                  "auth.resetPassword.fields.confirmPassword.placeholder",
                )}
                autoComplete="new-password"
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
              />
            </span>
          </label>

          {/* Password mismatch */}

          {confirmPassword &&
            !passwordsMatch && (
              <p className="reset-password-error">
                {t(
                  "auth.resetPassword.passwordMismatch",
                  {
                    defaultValue:
                      "Passwords do not match",
                  },
                )}
              </p>
            )}

          {/* Submit */}

          <button
            className="reset-submit"
            type="submit"
            disabled={!canSubmit}
          >
            {t(
              "auth.resetPassword.submit",
            )}
          </button>
        </form>

        {/* Back */}

        <a
          className="reset-back"
          href="#login"
        >
          <ArrowIcon />

          <span>
            {t(
              "auth.resetPassword.back",
            )}
          </span>
        </a>
      </section>
    </>
  );
}