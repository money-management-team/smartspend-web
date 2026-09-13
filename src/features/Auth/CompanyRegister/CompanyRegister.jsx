import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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
import {
  BuildingIcon,
  ChevronDownIcon,
  MailIcon,
  UserIcon,
} from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSwitchPrompt from "../components/AuthSwitchPrompt/AuthSwitchPrompt";
import PasswordField from "../components/PasswordField/PasswordField";

import "./CompanyRegister.css";

/* `value` is what the backend receives; `key` picks the translated label. */
const TEAM_SIZES = [
  { value: "1-10", key: "small" },
  { value: "11-50", key: "medium" },
  { value: "51-200", key: "large" },
  { value: "200+", key: "enterprise" },
];

const initialForm = {
  company_name: "",
  team_size: TEAM_SIZES[0].value,
  name: "",
  identifier: "",
  password: "",
  password_confirmation: "",
  terms: false,
};

const PROMO_CHIPS = [0, 1, 2];

export default function CompanyRegister() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuthContext();
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
      setErrors({ terms: [t("auth.register.terms.required")] });
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
        account_type: "company",
        company_name: form.company_name.trim(),
        team_size: form.team_size,
      });

      navigate(PATH.USER.DASHBOARD, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      setGeneralError(getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Same normalization as AuthField: accept an array or a single message.
  const teamSizeErrors = [].concat(errors.team_size ?? []);
  const teamSizeErrorId = teamSizeErrors.length
    ? "company-register-team-size-error"
    : undefined;

  return (
    <>
      <AuthPromo
        title={t("auth.companyRegister.promo.title")}
        subtitle={t("auth.companyRegister.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          {PROMO_CHIPS.map((index) => (
            <span className="auth-promo__chip" key={index}>
              {t(`auth.companyRegister.promo.chips.${index}`)}
            </span>
          ))}
        </div>
      </AuthPromo>

      <section className="auth-panel">
        <AuthHeading
          title={t("auth.companyRegister.title")}
          subtitle={t("auth.companyRegister.subtitle")}
        />

        <form className="auth-form company-register-form" onSubmit={handleSubmit}>
          <div className="company-register-form__row">
            <AuthField
              id="company-register-company-name"
              label={t("auth.companyRegister.fields.companyName.label")}
              icon={<BuildingIcon />}
              errors={errors.company_name}
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder={t("auth.companyRegister.fields.companyName.placeholder")}
              autoComplete="organization"
              disabled={isSubmitting}
              required
            />

            {/* AuthField only renders <input>, so the select reuses its markup and classes. */}
            <div className="auth-field">
              <div className="auth-field__heading">
                <label
                  className="auth-field__label"
                  htmlFor="company-register-team-size"
                >
                  {t("auth.companyRegister.fields.teamSize.label")}
                </label>
              </div>

              <div className="auth-field__control">
                <select
                  id="company-register-team-size"
                  className="auth-field__input auth-field__input--end company-register-form__select"
                  name="team_size"
                  value={form.team_size}
                  onChange={handleChange}
                  aria-invalid={teamSizeErrors.length > 0}
                  aria-describedby={teamSizeErrorId}
                  disabled={isSubmitting}
                >
                  {TEAM_SIZES.map(({ value, key }) => (
                    <option value={value} key={value}>
                      {t(`auth.companyRegister.fields.teamSize.options.${key}`)}
                    </option>
                  ))}
                </select>

                <span className="auth-field__icon" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </div>

              {teamSizeErrorId && (
                <div className="auth-field__errors" id={teamSizeErrorId}>
                  {teamSizeErrors.map((message) => (
                    <small key={message}>{message}</small>
                  ))}
                </div>
              )}
            </div>
          </div>

          <AuthField
            id="company-register-owner"
            label={t("auth.companyRegister.fields.ownerName.label")}
            icon={<UserIcon />}
            errors={errors.name}
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder={t("auth.companyRegister.fields.ownerName.placeholder")}
            autoComplete="name"
            disabled={isSubmitting}
            required
          />

          <AuthField
            id="company-register-identifier"
            label={t("auth.companyRegister.fields.email.label")}
            icon={<MailIcon />}
            errors={errors.identifier}
            type="email"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder={t("auth.companyRegister.fields.email.placeholder")}
            autoComplete="username"
            disabled={isSubmitting}
            required
          />

          <PasswordField
            id="company-register-password"
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
            id="company-register-confirm-password"
            label={t("auth.register.fields.confirmPassword.label")}
            errors={errors.password_confirmation}
            name="password_confirmation"
            value={form.password_confirmation}
            onChange={handleChange}
            placeholder={t("auth.register.fields.confirmPassword.placeholder")}
            autoComplete="new-password"
            disabled={isSubmitting}
            minLength={8}
            required
          />

          <AuthCheckbox
            id="company-register-terms"
            name="terms"
            checked={form.terms}
            onChange={handleChange}
            errors={errors.terms}
            disabled={isSubmitting}
          >
            {t("auth.register.terms.prefix")}{" "}
            <a href="#terms">{t("auth.register.terms.link")}</a>
          </AuthCheckbox>

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthButton
            loading={isSubmitting}
            loadingLabel={t("auth.companyRegister.loading")}
          >
            {t("auth.companyRegister.submit")}
          </AuthButton>
        </form>

        <AuthSwitchPrompt
          prefix={t("auth.companyRegister.login.prefix")}
          linkLabel={t("auth.companyRegister.login.link")}
          to={PATH.AUTH.COMPANY_SIGNIN}
        />
      </section>
    </>
  );
}
