import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuEye, LuEyeOff, LuMail } from "react-icons/lu";

import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { getApiErrorMessage } from "../../../api/apiClient";
import { authApi } from "../../../api/authApi";

import "./ChangePassword.css";

// Backend rules: min 8, at least one letter and one number (Laravel's
// `\pL` / `\pN`), confirmed, different from the current password.
const MIN_LENGTH = 8;
const FIELDS = [
  { name: "current_password", label: "currentPassword", autoComplete: "current-password" },
  { name: "password", label: "newPassword", autoComplete: "new-password" },
  { name: "password_confirmation", label: "confirmPassword", autoComplete: "new-password" },
];
const EMPTY_FORM = { current_password: "", password: "", password_confirmation: "" };
const FIELD_NAMES = FIELDS.map((field) => field.name);

function getRequirements(form) {
  return {
    length: form.password.length >= MIN_LENGTH,
    letters: /\p{L}/u.test(form.password),
    numbers: /\p{N}/u.test(form.password),
    different: Boolean(form.password) && form.password !== form.current_password,
  };
}

// Same checks as the backend, so an obviously invalid form never leaves the
// browser. Passwords are never trimmed.
function validate(form, t) {
  const errors = {};
  const add = (field, key) => {
    errors[field] = [t(`dashboard.settings.security.validation.${key}`, { min: MIN_LENGTH })];
  };
  const requirements = getRequirements(form);

  if (!form.current_password) add("current_password", "currentRequired");

  if (!form.password) add("password", "newRequired");
  else if (!requirements.length) add("password", "minLength");
  else if (!requirements.letters) add("password", "letters");
  else if (!requirements.numbers) add("password", "numbers");
  else if (form.current_password && !requirements.different) add("password", "different");

  if (!form.password_confirmation) add("password_confirmation", "confirmRequired");
  else if (form.password_confirmation !== form.password) add("password_confirmation", "mismatch");

  return errors;
}

// Backend field errors for the three inputs only; anything else is shown in
// the form's message.
function pickFieldErrors(errors) {
  const picked = {};

  FIELD_NAMES.forEach((name) => {
    const messages = [errors?.[name]].flat().filter((message) => typeof message === "string");
    if (messages.length) picked[name] = messages;
  });

  return picked;
}

function PasswordInput({ id, label, errors, disabled, ...inputProps }) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="change-password__field">
      <label htmlFor={id}>{label}</label>

      <div className="change-password__control">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          dir="ltr"
          aria-invalid={Boolean(errorId)}
          aria-describedby={errorId}
          disabled={disabled}
          {...inputProps}
        />

        <button
          type="button"
          className="change-password__toggle"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={t("auth.common.showPassword")}
          aria-pressed={isVisible}
          aria-controls={id}
          disabled={disabled}
        >
          {isVisible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
        </button>
      </div>

      {errorId && (
        <div className="change-password__errors" id={errorId}>
          {/* Backend messages can be in either language. */}
          {errors.map((message) => (
            <small key={message} dir="auto">
              {message}
            </small>
          ))}
        </div>
      )}
    </div>
  );
}

/*
 * Change the signed-in user's password (PATCH /profile/password).
 *
 * - The backend revokes every other session; this device keeps its token, so
 *   nothing in the stored session changes and the user stays signed in.
 * - The three values live only in this component's state and are cleared as
 *   soon as the backend accepts them; they are never stored anywhere.
 * - An account created with Google may have no password: the backend answers
 *   422. The reset-link block below the form (the existing forgot/reset
 *   password flow) is how such an account sets one.
 */
export default function ChangePassword() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const email = user?.email ?? "";

  const [form, setForm] = useState(EMPTY_FORM);
  // Bumped after a success so the inputs remount with their text hidden again.
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState({});
  // { tone: "success" | "error", message }
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  // The rejection was about the current password or the account itself (not
  // the new password): a reset link is the way forward.
  const [suggestReset, setSuggestReset] = useState(false);

  // { status: "idle" | "sending" | "sent" | "error", message }
  const [resetState, setResetState] = useState({ status: "idle", message: "" });
  const resetPendingRef = useRef(false);

  const requirements = getRequirements(form);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
    setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const localErrors = validate(form, t);

    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setFeedback(null);
      return;
    }

    pendingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setFeedback(null);
    setSuggestReset(false);

    try {
      await authApi.changePassword({
        currentPassword: form.current_password,
        password: form.password,
        passwordConfirmation: form.password_confirmation,
      });

      setForm(EMPTY_FORM);
      setFormKey((key) => key + 1);
      setFeedback({ tone: "success", message: t("dashboard.settings.security.success") });
    } catch (error) {
      // apiClient already cleared the session and signalled the expiry; the
      // route guard takes the user to sign in.
      if (error?.code === "UNAUTHENTICATED") return;

      const isValidation = error?.code === "VALIDATION_ERROR";
      const fieldErrors = isValidation ? pickFieldErrors(error.errors) : {};
      const aboutNewPassword = Boolean(fieldErrors.password || fieldErrors.password_confirmation);

      // Messages, by what the 422 is about:
      // - the new password (policy, same as current, mismatch) → its fields;
      // - the current password (wrong, or none on a Google-created account)
      //   → the field shows the backend's reason, the reset link is offered;
      // - no field at all (e.g. an account without a password) → the
      //   backend's own message, with the reset link offered.
      let message = getApiErrorMessage(error, t);
      if (aboutNewPassword) message = t("dashboard.settings.security.errors.checkFields");
      else if (fieldErrors.current_password) {
        message = t("dashboard.settings.security.errors.currentRejected");
      }

      setErrors(fieldErrors);
      setFeedback({ tone: "error", message });
      setSuggestReset(isValidation && !aboutNewPassword);
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Reuses the forgot/reset password flow: the backend emails a link to the
  // existing Reset Password page, which works while signed in.
  const requestResetLink = async () => {
    if (!email || resetPendingRef.current) return;

    resetPendingRef.current = true;
    setResetState({ status: "sending", message: "" });

    try {
      await authApi.forgotPassword(email);
      setResetState({ status: "sent", message: t("dashboard.settings.security.reset.sent") });
    } catch (error) {
      setResetState({ status: "error", message: getApiErrorMessage(error, t) });
    } finally {
      resetPendingRef.current = false;
    }
  };

  const requirementItems = ["length", "letters", "numbers", "different"];

  return (
    <section className="change-password" aria-labelledby="change-password-title">
      <header className="change-password__header">
        <h2 id="change-password-title">{t("dashboard.settings.security.changePassword")}</h2>
        <p>{t("dashboard.settings.security.subtitle")}</p>
      </header>

      <form className="change-password__form" onSubmit={handleSubmit} noValidate>
        {/* Lets password managers attach the new password to this account. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email || user?.phone || ""}
          readOnly
          hidden
        />

        {FIELDS.map((field) => (
          <PasswordInput
            key={`${field.name}-${formKey}`}
            id={`change-password-${field.name}`}
            name={field.name}
            label={t(`dashboard.settings.security.fields.${field.label}`)}
            value={form[field.name]}
            onChange={handleChange}
            autoComplete={field.autoComplete}
            errors={errors[field.name]}
            disabled={isSubmitting}
          />
        ))}

        <ul className="change-password__requirements" aria-label={t("dashboard.settings.security.requirements.label")}>
          {requirementItems.map((key) => (
            <li
              key={key}
              className={`change-password__requirement${
                requirements[key] ? " change-password__requirement--passed" : ""
              }`}
            >
              <LuCheck aria-hidden="true" />
              <span>{t(`dashboard.settings.security.requirements.${key}`, { min: MIN_LENGTH })}</span>
            </li>
          ))}
        </ul>

        {feedback && (
          <p
            className={`change-password__message change-password__message--${feedback.tone}`}
            role={feedback.tone === "error" ? "alert" : "status"}
            dir="auto"
          >
            {feedback.message}
          </p>
        )}

        <button type="submit" className="change-password__submit" disabled={isSubmitting}>
          {isSubmitting
            ? t("dashboard.settings.security.submitting")
            : t("dashboard.settings.security.submit")}
        </button>
      </form>

      <div
        className={`change-password__reset${suggestReset ? " change-password__reset--highlight" : ""}`}
      >
        <span className="change-password__reset-icon" aria-hidden="true">
          <LuMail />
        </span>

        <div className="change-password__reset-copy">
          <strong>{t("dashboard.settings.security.reset.title")}</strong>
          <p>
            {t(
              email
                ? "dashboard.settings.security.reset.body"
                : "dashboard.settings.security.reset.noEmail",
            )}
          </p>
          {resetState.message && (
            <p
              className={`change-password__reset-message${
                resetState.status === "error" ? " change-password__reset-message--error" : ""
              }`}
              role={resetState.status === "error" ? "alert" : "status"}
            >
              {resetState.message}
              {resetState.status === "sent" && (
                <>
                  {" "}
                  <bdi dir="ltr">{email}</bdi>
                </>
              )}
            </p>
          )}
        </div>

        {email && (
          <button
            type="button"
            className="change-password__reset-action"
            onClick={requestResetLink}
            disabled={resetState.status === "sending"}
          >
            {resetState.status === "sending"
              ? t("dashboard.settings.security.reset.sending")
              : t("dashboard.settings.security.reset.action")}
          </button>
        )}
      </div>
    </section>
  );
}
