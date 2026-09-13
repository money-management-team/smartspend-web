import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuthContext } from "../../../contexts/auth/useAuthContext";
import { PATH } from "../../../routes/Path";
import { authApi } from "../../Dashboards/User/api/authApi";
import { getApiErrorMessage } from "../../Dashboards/User/api/apiClient";

import AuthAlert from "../components/AuthAlert/AuthAlert";
import AuthBackLink from "../components/AuthBackLink/AuthBackLink";
import AuthButton from "../components/AuthButton/AuthButton";
import AuthHeading from "../components/AuthHeading/AuthHeading";
import { CheckIcon, LockIcon, ShieldIcon } from "../components/AuthIcons";
import AuthPromo from "../components/AuthPromo/AuthPromo";
import AuthSteps from "../components/AuthSteps/AuthSteps";
import PasswordField from "../components/PasswordField/PasswordField";

import "./ResetPassword.css";

const STRENGTH_SEGMENTS = [1, 2, 3];

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearAuth } = useAuthContext();
  const [searchParams] = useSearchParams();

  /*
   * From the emailed link: /reset-password?token=…&identifier=…
   * An email can't contain spaces, so a space in `identifier` is a "+" that
   * reached us unencoded (query parsing turns "+" into a space).
   */
  const token = searchParams.get("token") ?? "";
  const identifier = (searchParams.get("identifier") ?? "").replaceAll(" ", "+");
  const isLinkComplete = Boolean(token && identifier);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  // The backend rejected the link itself (bad or expired token / identifier).
  const [isLinkRejected, setIsLinkRejected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canUseLink = isLinkComplete && !isLinkRejected;

  /*
   * ==========================================
   * PASSWORD RULES
   * Backend: at least 8 characters, letters and numbers.
   * ==========================================
   */

  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,

      hasLetter: /\p{L}/u.test(password),

      hasLowercase: /[a-z]/.test(password),

      hasUppercase: /[A-Z]/.test(password),

      hasNumber: /\d/.test(password),
    }),
    [password],
  );

  /*
   * ==========================================
   * PASSWORD STRENGTH
   * Informational only; it doesn't gate submitting.
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
    passwordRules.hasLetter &&
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

  const showMismatch = Boolean(confirmPassword) && !passwordsMatch;

  /*
   * ==========================================
   * ENABLE SUBMIT
   * ==========================================
   */

  const canSubmit =
    canUseLink &&
    isPasswordValid &&
    passwordsMatch;

  /*
   * ==========================================
   * SUBMIT
   * ==========================================
   */

  const clearFeedback = (field) => {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
    setGeneralError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setFieldErrors({});
    setGeneralError("");
    setIsSubmitting(true);

    try {
      await authApi.resetPassword({
        token,
        identifier,
        password,
        passwordConfirmation: confirmPassword,
      });

      // The backend revoked every access token for this account, so any
      // session stored in this browser is stale. No auto-login.
      clearAuth();
      navigate(PATH.AUTH.PASSWORD_CHANGED, { replace: true });
    } catch (error) {
      const errors =
        error?.code === "VALIDATION_ERROR" ? error.errors ?? {} : {};
      const linkMessage = errors.token?.[0] ?? errors.identifier?.[0];

      setFieldErrors({
        password: errors.password,
        passwordConfirmation: errors.password_confirmation,
      });
      setIsLinkRejected(Boolean(linkMessage));
      setGeneralError(linkMessage ?? getApiErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const requirements = [
    {
      key: "length",
      passed: passwordRules.minLength,
    },
    {
      key: "letters",
      passed: passwordRules.hasLetter,
    },
    {
      key: "number",
      passed: passwordRules.hasNumber,
    },
  ];

  const isFormDisabled = !canUseLink || isSubmitting;

  return (
    <>
      <AuthPromo
        title={t("auth.resetPassword.promo.title")}
        subtitle={t("auth.resetPassword.promo.subtitle")}
      >
        <div className="auth-promo__chips">
          <span className="auth-promo__chip">
            <ShieldIcon />
            {t("auth.resetPassword.promo.dataProtection")}
          </span>

          <span className="auth-promo__chip">
            <LockIcon />
            {t("auth.resetPassword.promo.encryption")}
          </span>
        </div>
      </AuthPromo>

      <section className="auth-panel">
        <AuthSteps current={3} />

        <AuthHeading
          icon={<LockIcon />}
          title={t("auth.resetPassword.title")}
          subtitle={t("auth.resetPassword.subtitle")}
        />

        <form className="auth-form" onSubmit={handleSubmit}>
          <PasswordField
            id="reset-password"
            label={t("auth.resetPassword.fields.password.label")}
            describedBy="reset-password-strength"
            errors={fieldErrors.password}
            name="password"
            value={password}
            placeholder={t(
              "auth.resetPassword.fields.password.placeholder",
            )}
            autoComplete="new-password"
            disabled={isFormDisabled}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFeedback("password");
            }}
          />

          {/* Strength + requirements */}

          <div
            className={`reset-strength reset-strength--${passwordStrength.level}`}
            id="reset-password-strength"
          >
            <div className="reset-strength__heading">
              <span>{t("auth.resetPassword.strength.label")}</span>

              <strong className="reset-strength__text" aria-live="polite">
                {passwordStrength.label}
              </strong>
            </div>

            <span className="reset-strength__meter" aria-hidden="true">
              {STRENGTH_SEGMENTS.map((segment) => (
                <span key={segment} />
              ))}
            </span>

            <ul className="reset-requirements">
              {requirements.map((requirement) => (
                <li
                  className={`reset-requirement${
                    requirement.passed ? " reset-requirement--passed" : ""
                  }`}
                  key={requirement.key}
                >
                  <span className="reset-requirement__check" aria-hidden="true">
                    <CheckIcon />
                  </span>

                  <span>
                    {t(`auth.resetPassword.requirements.${requirement.key}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <PasswordField
            id="reset-confirm-password"
            label={t("auth.resetPassword.fields.confirmPassword.label")}
            errors={
              showMismatch
                ? [t("auth.resetPassword.passwordMismatch")]
                : fieldErrors.passwordConfirmation
            }
            name="confirmPassword"
            value={confirmPassword}
            placeholder={t(
              "auth.resetPassword.fields.confirmPassword.placeholder",
            )}
            autoComplete="new-password"
            disabled={isFormDisabled}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFeedback("passwordConfirmation");
            }}
          />

          {!isLinkComplete && (
            <AuthAlert>{t("auth.resetPassword.invalidLink")}</AuthAlert>
          )}

          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          {canUseLink ? (
            <AuthButton
              disabled={!canSubmit}
              loading={isSubmitting}
              loadingLabel={t("auth.resetPassword.loading")}
            >
              {t("auth.resetPassword.submit")}
            </AuthButton>
          ) : (
            <AuthButton to={PATH.AUTH.FORGOT_PASSWORD}>
              {t("auth.resetPassword.requestNewLink")}
            </AuthButton>
          )}
        </form>

        <AuthBackLink to={PATH.AUTH.SIGNIN}>
          {t("auth.resetPassword.back")}
        </AuthBackLink>
      </section>
    </>
  );
}
