import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { PATH } from "../../../routes/Path";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthButton from "../components/AuthButton/AuthButton";
import PolicyConsent, {
  PolicyDialog,
} from "../components/PolicyConsent/PolicyConsent";
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
import useGoogleSignIn from "../components/AuthSocial/useGoogleSignIn";
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
  const { register } = useAuthContext();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const google = useGoogleSignIn({
    acceptedPolicies: form.termsAccepted,
    onAccepted: () =>
      setForm((current) => ({ ...current, termsAccepted: true })),
    onError: setGeneralError,
  });
  const locked = isSubmitting || google.busy || google.needsConsent;

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
    if (locked) return;

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

  const features = [0, 1, 2].map((index) => ({
    title: t(`auth.register.promo.features.${index}.title`),
    description: t(`auth.register.promo.features.${index}.description`),
  }));

  return (
    <>
      {google.needsConsent && (
        <PolicyDialog
          onAccept={google.acceptConsent}
          onClose={google.cancelConsent}
        />
      )}
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
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
            minLength={8}
            required
          />

          <PolicyConsent
            id="register-terms"
            name="termsAccepted"
            checked={form.termsAccepted}
            onChange={(accepted) => {
              setForm((current) => ({ ...current, termsAccepted: accepted }));
              setErrors((current) => ({
                ...current,
                termsAccepted: undefined,
              }));
              setGeneralError("");
            }}
            errors={errors.termsAccepted}
            disabled={locked}
          />

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthButton
            loading={isSubmitting || google.busy}
            loadingLabel={t("auth.register.loading")}
          >
            {t("auth.register.submit")}
          </AuthButton>
        </form>

        <AuthSocial
          dividerLabel={t("auth.register.social.divider")}
          googleLabel={t("auth.register.social.google")}
          onGoogleCredential={(idToken) => {
            setErrors({});
            return google.handleCredential(idToken);
          }}
          onGoogleUnavailable={() =>
            setGeneralError(t("auth.common.googleUnavailable"))
          }
          disabled={locked}
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
