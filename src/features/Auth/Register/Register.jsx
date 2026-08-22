import { useState } from "react";
import { useTranslation } from "react-i18next";

import logo from "../../../assets/smart-spend-logo.png";

import "./Register.css";
import { PATH } from "../../../routes/Path";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

console.log(API_BASE_URL)

const initialForm = {
  name: "",
  identifier: "",
  password: "",
  password_confirmation: "",
  terms: false,
};

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
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((current) => {
      if (!current[name]) return current;

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });
    setGeneralError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrors({});
    setGeneralError("");

    if (!form.terms) {
      setErrors({ terms: ["يجب الموافقة على الشروط والأحكام"] });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          identifier: form.identifier.trim(),
          password: form.password,
          password_confirmation: form.password_confirmation,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 422 && result?.errors) {
          setErrors(result.errors);
        }

        setGeneralError(
          result?.message ?? "تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى.",
        );
        return;
      }

      if (!result?.status || !result?.data?.token) {
        setGeneralError("تم استلام استجابة غير متوقعة من الخادم.");
        return;
      }

      localStorage.setItem("token", result.data.token);
      localStorage.setItem("token_type", result.data.token_type ?? "Bearer");
      localStorage.setItem("user", JSON.stringify(result.data.user));
      localStorage.setItem("workspace", JSON.stringify(result.data.workspace));

      navigate("/Dashboard", { replace: true });
    } catch {
      setGeneralError(
        "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t("auth.register.fields.fullName.placeholder")}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "register-name-error" : undefined}
                disabled={isSubmitting}
                required
              />

              <span className="register-input-icon">
                <UserIcon />
              </span>
            </span>

            {errors.name?.map((error, index) => (
              <small className="register-field__error" id={index === 0 ? "register-name-error" : undefined} key={error}>
                {error}
              </small>
            ))}
          </label>

          {/* Email / Phone */}

          <label className="register-field">
            <span>{t("auth.register.fields.contact.label")}</span>

            <span className="register-input-wrap">
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                placeholder={t("auth.register.fields.contact.placeholder")}
                autoComplete="username"
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? "register-identifier-error" : undefined}
                disabled={isSubmitting}
                required
              />

              <span className="register-input-icon">
                <MailIcon />
              </span>
            </span>

            {errors.identifier?.map((error, index) => (
              <small className="register-field__error" id={index === 0 ? "register-identifier-error" : undefined} key={error}>
                {error}
              </small>
            ))}
          </label>

          {/* Password */}

          <label className="register-field">
            <span>{t("auth.register.fields.password.label")}</span>

            <span className="register-input-wrap">
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={t("auth.register.fields.password.placeholder")}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "register-password-error" : undefined}
                disabled={isSubmitting}
                minLength={8}
                required
              />
            </span>

            {errors.password?.map((error, index) => (
              <small className="register-field__error" id={index === 0 ? "register-password-error" : undefined} key={error}>
                {error}
              </small>
            ))}
          </label>

          {/* Confirm Password */}

          <label className="register-field">
            <span>{t("auth.register.fields.confirmPassword.label")}</span>

            <span className="register-input-wrap">
              <input
                type="password"
                name="password_confirmation"
                value={form.password_confirmation}
                onChange={handleChange}
                placeholder={t(
                  "auth.register.fields.confirmPassword.placeholder",
                )}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password_confirmation)}
                aria-describedby={errors.password_confirmation ? "register-confirm-password-error" : undefined}
                disabled={isSubmitting}
                minLength={8}
                required
              />
            </span>

            {errors.password_confirmation?.map((error, index) => (
              <small className="register-field__error" id={index === 0 ? "register-confirm-password-error" : undefined} key={error}>
                {error}
              </small>
            ))}
          </label>

          {/* Terms */}

          <label className="register-consent">
            <input
              type="checkbox"
              name="terms"
              checked={form.terms}
              onChange={handleChange}
              aria-invalid={Boolean(errors.terms)}
              disabled={isSubmitting}
            />

            <span className="register-consent__check" aria-hidden="true" />

            <span>
              {t("auth.register.terms.prefix")}{" "}
              <a href="#terms">{t("auth.register.terms.link")}</a>
            </span>
          </label>

          {errors.terms?.map((error) => (
            <small className="register-field__error register-terms-error" key={error}>
              {error}
            </small>
          ))}

          {generalError && (
            <p className="register-form__error" role="alert">
              {generalError}
            </p>
          )}

          {/* Submit */}

          <button className="register-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "جارٍ إنشاء الحساب..." : t("auth.register.submit")}
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