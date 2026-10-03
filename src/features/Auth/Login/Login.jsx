import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { PATH } from "../../../routes/Path";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthCheckbox from "../components/AuthCheckbox/AuthCheckbox";
import { PolicyDialog } from "../components/PolicyConsent/PolicyConsent";
import AuthField from "../components/AuthField/AuthField";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { MailIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSocial from "../components/AuthSocial/AuthSocial";
import useGoogleSignIn from "../components/AuthSocial/useGoogleSignIn";
import AuthSwitchPrompt from "../components/AuthSwitchPrompt/AuthSwitchPrompt";
import PasswordField from "../components/PasswordField/PasswordField";

const initialForm = {
  identifier: "",
  password: "",
  remember: true,
};

const PROMO_CHIPS = [0, 1, 2];

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const google = useGoogleSignIn({
    remember: form.remember,
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
    setIsSubmitting(true);

    try {
      await login(
        {
          identifier: form.identifier.trim(),
          password: form.password,
        },
        { remember: form.remember },
      );

      navigate(PATH.USER.DASHBOARD, { replace: true });
    } catch (error) {
      if (error?.code === "VALIDATION_ERROR") setErrors(error.errors);
      setGeneralError(getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {google.needsConsent && (
        <PolicyDialog
          onAccept={google.acceptConsent}
          onClose={google.cancelConsent}
        />
      )}
      <AuthPromo
        title={t("auth.login.promo.title")}
        subtitle={t("auth.login.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          {PROMO_CHIPS.map((index) => (
            <span className="auth-promo__chip" key={index}>
              {t(`auth.login.promo.chips.${index}`)}
            </span>
          ))}
        </div>
      </AuthPromo>

      <section className="auth-panel">
        <AuthHeading
          title={t("auth.login.title")}
          subtitle={t("auth.login.subtitle")}
        />

        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthField
            id="login-identifier"
            label={t("auth.login.fields.contact.label")}
            icon={<MailIcon />}
            errors={errors.identifier}
            type="text"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder={t("auth.login.fields.contact.placeholder")}
            autoComplete="username"
            disabled={locked}
            required
          />

          <PasswordField
            id="login-password"
            label={t("auth.login.fields.password.label")}
            labelAction={
              <Link className="auth-field__link" to={PATH.AUTH.FORGOT_PASSWORD}>
                {t("auth.login.forgotPassword")}
              </Link>
            }
            errors={errors.password}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder={t("auth.login.fields.password.placeholder")}
            autoComplete="current-password"
            disabled={locked}
            required
          />

          <AuthCheckbox
            id="login-remember"
            name="remember"
            checked={form.remember}
            onChange={handleChange}
            disabled={locked}
          >
            {t("auth.login.remember")}
          </AuthCheckbox>

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthButton
            loading={isSubmitting || google.busy}
            loadingLabel={t("auth.login.loading")}
          >
            {t("auth.login.submit")}
          </AuthButton>
        </form>

        <AuthSocial
          dividerLabel={t("auth.login.social.divider")}
          googleLabel={t("auth.login.social.google")}
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
          prefix={t("auth.login.register.prefix")}
          linkLabel={t("auth.login.register.link")}
          to={PATH.AUTH.REGISTER}
        />
      </section>
    </>
  );
}
