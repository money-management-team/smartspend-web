import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { PATH } from "../../../routes/Path";
import {
  ApiError,
  getApiErrorMessage,
} from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthCheckbox from "../components/AuthCheckbox/AuthCheckbox";
import AuthField from "../components/AuthField/AuthField";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { BuildingIcon, MailIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSwitchPrompt from "../components/AuthSwitchPrompt/AuthSwitchPrompt";
import PasswordField from "../components/PasswordField/PasswordField";

const initialForm = {
  identifier: "",
  password: "",
  remember: true,
};

const PROMO_CHIPS = [0, 1, 2];

export default function CompanyLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthContext();
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
      if (error instanceof ApiError) setErrors(error.errors);
      setGeneralError(getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AuthPromo
        title={t("auth.companyLogin.promo.title")}
        subtitle={t("auth.companyLogin.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          {PROMO_CHIPS.map((index) => (
            <span className="auth-promo__chip" key={index}>
              {t(`auth.companyLogin.promo.chips.${index}`)}
            </span>
          ))}
        </div>
      </AuthPromo>

      <section className="auth-panel">
        <AuthHeading
          icon={<BuildingIcon />}
          title={t("auth.companyLogin.title")}
          subtitle={t("auth.companyLogin.subtitle")}
        />

        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthField
            id="company-login-identifier"
            label={t("auth.companyLogin.fields.email.label")}
            icon={<MailIcon />}
            errors={errors.identifier}
            type="email"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder={t("auth.companyLogin.fields.email.placeholder")}
            autoComplete="username"
            disabled={isSubmitting}
            required
          />

          <PasswordField
            id="company-login-password"
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
            disabled={isSubmitting}
            required
          />

          <AuthCheckbox
            id="company-login-remember"
            name="remember"
            checked={form.remember}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            {t("auth.login.remember")}
          </AuthCheckbox>

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthButton loading={isSubmitting} loadingLabel={t("auth.login.loading")}>
            {t("auth.companyLogin.submit")}
          </AuthButton>
        </form>

        <AuthSwitchPrompt
          prefix={t("auth.companyLogin.register.prefix")}
          linkLabel={t("auth.companyLogin.register.link")}
          to={PATH.AUTH.COMPANY_REGISTER}
        />
      </section>
    </>
  );
}
