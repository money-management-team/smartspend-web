import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { PATH } from "../../../routes/Path";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthCheckbox from "../components/AuthCheckbox/AuthCheckbox";
import AuthField from "../components/AuthField/AuthField";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import {
  CardIcon,
  MailIcon,
  ShieldIcon,
  SparklesIcon,
  UserIcon,
} from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSocial from "../components/AuthSocial/AuthSocial";
import AuthSwitchPrompt from "../components/AuthSwitchPrompt/AuthSwitchPrompt";
import PasswordField from "../components/PasswordField/PasswordField";

import "./Register.css";

const initialForm = {
  name: "",
  identifier: "",
  password: "",
  passwordConfirmation: "",
  termsAccepted: false,
};

/*
 * Backend field → form field. The single consent checkbox covers both the
 * terms and the privacy policy, so both consent errors land on it.
 */
const FORM_FIELD_BY_API_FIELD = {
  name: "name",
  identifier: "identifier",
  password: "password",
  password_confirmation: "passwordConfirmation",
  terms_accepted: "termsAccepted",
  privacy_accepted: "termsAccepted",
};

const toRegisterPayload = (form) => ({
  name: form.name.trim(),
  identifier: form.identifier.trim(),
  password: form.password,
  password_confirmation: form.passwordConfirmation,
  terms_accepted: form.termsAccepted,
  privacy_accepted: form.termsAccepted,
});

const toFormErrors = (apiErrors = {}) => {
  const formErrors = {};

  Object.entries(apiErrors).forEach(([apiField, messages]) => {
    const field = FORM_FIELD_BY_API_FIELD[apiField];
    if (!field) return;

    formErrors[field] = [
      ...new Set([...(formErrors[field] ?? []), ...[].concat(messages)]),
    ];
  });

  return formErrors;
};

const featureIcons = [ShieldIcon, SparklesIcon, CardIcon];

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuthContext();
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
    if (isSubmitting) return;

    setErrors({});
    setGeneralError("");

    if (!form.termsAccepted) {
      setErrors({ termsAccepted: [t("auth.register.terms.required")] });
      return;
    }

    setIsSubmitting(true);

    try {
      await register(toRegisterPayload(form));

      navigate(PATH.USER.DASHBOARD, { replace: true });
    } catch (error) {
      if (error?.code === "VALIDATION_ERROR") {
        setErrors(toFormErrors(error.errors));
      }
      setGeneralError(getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    if (isSubmitting) return;

    setErrors({});
    setGeneralError("");
    setIsSubmitting(true);

    try {
      await loginWithGoogle(idToken);

      navigate(PATH.USER.DASHBOARD, { replace: true });
    } catch (error) {
      // No field to show `id_token` errors under, so its message is the alert.
      setGeneralError(
        error?.errors?.id_token?.[0] ?? getApiErrorMessage(error, t),
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
      <AuthPromo
        title={t("auth.register.promo.title")}
        subtitle={t("auth.register.promo.subtitle")}
      >
        <ul className="register-features">
          {features.map((feature, index) => {
            const Icon = featureIcons[index];

            return (
              <li className="register-feature" key={index}>
                <span className="register-feature__icon" aria-hidden="true">
                  <Icon />
                </span>

                <span className="register-feature__copy">
                  <strong>{feature.title}</strong>
                  <small>{feature.description}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </AuthPromo>

      <section className="auth-panel">
        <AuthHeading
          title={t("auth.register.title")}
          subtitle={t("auth.register.subtitle")}
        />

        <form className="auth-form register-form" onSubmit={handleSubmit}>
          <AuthField
            id="register-name"
            label={t("auth.register.fields.fullName.label")}
            icon={<UserIcon />}
            errors={errors.name}
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder={t("auth.register.fields.fullName.placeholder")}
            autoComplete="name"
            disabled={isSubmitting}
            required
          />

          <AuthField
            id="register-identifier"
            label={t("auth.register.fields.contact.label")}
            icon={<MailIcon />}
            errors={errors.identifier}
            type="text"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder={t("auth.register.fields.contact.placeholder")}
            autoComplete="username"
            disabled={isSubmitting}
            required
          />

          <PasswordField
            id="register-password"
            label={t("auth.register.fields.password.label")}
            errors={errors.password}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder={t("auth.register.fields.password.placeholder")}
            autoComplete="new-password"
            disabled={isSubmitting}
            minLength={8}
            required
          />

          <PasswordField
            id="register-confirm-password"
            label={t("auth.register.fields.confirmPassword.label")}
            errors={errors.passwordConfirmation}
            name="passwordConfirmation"
            value={form.passwordConfirmation}
            onChange={handleChange}
            placeholder={t("auth.register.fields.confirmPassword.placeholder")}
            autoComplete="new-password"
            disabled={isSubmitting}
            minLength={8}
            required
          />

          <AuthCheckbox
            id="register-terms"
            name="termsAccepted"
            checked={form.termsAccepted}
            onChange={handleChange}
            errors={errors.termsAccepted}
            disabled={isSubmitting}
          >
            {t("auth.register.terms.prefix")}{" "}
            <a href="#terms">{t("auth.register.terms.link")}</a>
          </AuthCheckbox>

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthButton
            loading={isSubmitting}
            loadingLabel={t("auth.register.loading")}
          >
            {t("auth.register.submit")}
          </AuthButton>
        </form>

        <AuthSocial
          dividerLabel={t("auth.register.social.divider")}
          googleLabel={t("auth.register.social.google")}
          appleLabel={t("auth.register.social.apple")}
          onGoogleCredential={handleGoogleCredential}
          onGoogleUnavailable={() =>
            setGeneralError(t("auth.common.googleUnavailable"))
          }
          disabled={isSubmitting}
        />

        <AuthSwitchPrompt
          prefix={t("auth.register.login.prefix")}
          linkLabel={t("auth.register.login.link")}
          to={PATH.AUTH.SIGNIN}
        />
      </section>
    </>
  );
}
