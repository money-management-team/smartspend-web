import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PATH } from "../../../routes/Path";
import { authApi } from "../../Dashboards/User/api/authApi";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthBackLink from "../components/AuthBackLink/AuthBackLink";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthField from "../components/AuthField/AuthField";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { KeyIcon, MailIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSteps from "../components/AuthSteps/AuthSteps";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState();
  const [generalError, setGeneralError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setEmail(event.target.value);
    setFieldErrors(undefined);
    setGeneralError("");
    // The confirmation was for the previous address.
    setSuccessMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFieldErrors(undefined);
    setGeneralError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await authApi.forgotPassword(email.trim());

      // Same response whether or not the email is registered.
      setSuccessMessage(
        response.message || t("auth.forgotPassword.success"),
      );
    } catch (error) {
      if (error?.code === "VALIDATION_ERROR") {
        setFieldErrors(error.errors?.identifier ?? error.errors?.email);
      }
      setGeneralError(getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AuthPromo
        title={t("auth.forgotPassword.promo.title")}
        subtitle={t("auth.forgotPassword.promo.subtitle")}
      />

      <section className="auth-panel">
        <AuthSteps current={1} />

        <AuthHeading
          icon={<KeyIcon />}
          title={t("auth.forgotPassword.title")}
          subtitle={t("auth.forgotPassword.subtitle")}
        />

        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthField
            id="forgot-email"
            label={t("auth.forgotPassword.field.label")}
            icon={<MailIcon />}
            errors={fieldErrors}
            type="email"
            name="identifier"
            value={email}
            onChange={handleChange}
            placeholder={t("auth.forgotPassword.field.placeholder")}
            autoComplete="email"
            disabled={isSubmitting}
            required
          />

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          {successMessage && (
            <AuthAlert variant="success">{successMessage}</AuthAlert>
          )}

          <AuthButton
            loading={isSubmitting}
            loadingLabel={t("auth.forgotPassword.loading")}
          >
            {t("auth.forgotPassword.submit")}
          </AuthButton>
        </form>

        <AuthBackLink to={PATH.AUTH.SIGNIN}>
          {t("auth.forgotPassword.back")}
        </AuthBackLink>
      </section>
    </>
  );
}
