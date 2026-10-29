import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import logo from "../../assets/smart-spend-logo.png";
import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { PATH } from "../../routes/Path.js";
import { errorKind } from "../data/errorKind.js";
import { textError } from "../forms/validation.js";
import "../i18n/register.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_PROFILE, MOBILE_REGISTER, MOBILE_SIGNIN } from "../navigation.js";
import { usePresentation } from "../presentation/usePresentation.js";
import { useOnline } from "../ui/useOnline.js";
import { mobileDestination } from "./destination.js";

const PASSWORD_MIN = 8;
const firstOf = (value) => (Array.isArray(value) ? value.find((item) => typeof item === "string") : typeof value === "string" ? value : null)?.slice(0, 300) ?? null;

/*
 * Mobile's sign-in and registration. The screens are Mobile's; the sign-in
 * itself is the app's: `login`, `register` and the session they store come from
 * the one AuthProvider (contexts/auth), exactly as the full version's pages use
 * them, with the same fields (identifier and password; name, identifier,
 * password, confirmation and one consent for terms and privacy) and the same
 * Remember me default (on). Mobile stores no token and makes no request of its
 * own here, so cross-tab sign-in protection and the session-expiry flow are
 * unchanged. Google sign-in, forgotten passwords and the signed email links are
 * the full version's pages, linked from here.
 */
function AuthFrame({ screen, title, children }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { setPreference } = usePresentation();
  const navigate = useNavigate();
  // The full version's sign-in, with Google: the choice is stored, as from More.
  const toFull = () => {
    setPreference("desktop");
    navigate(PATH.AUTH.SIGNIN);
  };
  return (
    <div className="sm-root sm-standalone sm-auth" data-sm-screen={screen}>
      <main className="sm-standalone-body sm-auth-body">
        <img className="sm-auth-logo" src={logo} alt={t("bar.logo")} width="48" height="48" />
        <h1 className="sm-identity-title">{title}</h1>
        {children}
        <button type="button" className="sm-link-button" onClick={toFull} data-sm-action="full-version">{t("auth.fullVersion")}</button>
      </main>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const [shown, setShown] = useState(false);
  return (
    <span className="sm-password">
      <input id={id} className="sm-input" type={shown ? "text" : "password"} dir="ltr" autoComplete={autoComplete} autoCapitalize="none" spellCheck="false" value={value} onChange={onChange} aria-invalid={invalid ? "true" : undefined} aria-describedby={describedBy} required />
      <button type="button" className="sm-button sm-button-quiet sm-button-small" aria-pressed={shown} aria-controls={id} onClick={() => setShown(!shown)} data-sm-action="toggle-password">{t(shown ? "auth.hide" : "auth.show")}</button>
    </span>
  );
}

/* A failed sign-in or registration in words: the backend's field messages under their fields, the rest here. */
function failureText(error, t, online, context) {
  if (error?.code === "VALIDATION_ERROR") return error.message ? String(error.message).slice(0, 300) : t(`auth.${context}.invalid`);
  if (error?.code === "UNAUTHENTICATED") return t("auth.signin.wrong");
  return t(`errors.${errorKind(error, online)}`);
}

function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = async (...args) => {
    // One request per tap: a second submit while the first is on its way does nothing, and nothing is retried.
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      return await action(...args);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return [run, busy];
}

export function MobileSignIn() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState("");
  const alertRef = useRef(null);
  const [submit, busy] = useSubmit(async () => {
    try {
      await login({ identifier: identifier.trim(), password }, { remember });
      navigate(mobileDestination(location.state), { replace: true });
    } catch (error) {
      setErrors(error?.code === "VALIDATION_ERROR" ? { identifier: firstOf(error.errors?.identifier), password: firstOf(error.errors?.password) } : {});
      setGeneral(failureText(error, t, online, "signin"));
    }
  });

  useEffect(() => {
    if (general) alertRef.current?.focus();
  }, [general]);

  const onSubmit = (event) => {
    event.preventDefault();
    const local = { identifier: identifier.trim() ? null : t("forms.errors.required"), password: password ? null : t("forms.errors.required") };
    setErrors(local);
    setGeneral(local.identifier || local.password ? t("auth.fix") : "");
    if (!local.identifier && !local.password) submit();
  };

  return (
    <AuthFrame screen="signin" title={t("auth.signin.title")}>
      <p className="sm-text sm-muted">{t("auth.signin.intro")}</p>
      <form className="sm-auth-form" onSubmit={onSubmit} noValidate aria-busy={busy} data-sm-form="signin">
        {general && <div className="sm-error sm-error-compact" role="alert" tabIndex={-1} ref={alertRef} data-sm-auth-error>{general}</div>}
        <div className="sm-field">
          <label className="sm-label" htmlFor={`${ids}-identifier`}>{t("auth.identifier")}</label>
          <input id={`${ids}-identifier`} className="sm-input" type="text" inputMode="email" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck="false" value={identifier} onChange={(event) => setIdentifier(event.target.value)} aria-invalid={errors.identifier ? "true" : undefined} aria-describedby={errors.identifier ? `${ids}-identifier-error` : undefined} disabled={busy} required />
          {errors.identifier && <p id={`${ids}-identifier-error`} className="sm-text sm-form-error">{errors.identifier}</p>}
        </div>
        <div className="sm-field">
          <span className="sm-auth-label-row">
            <label className="sm-label" htmlFor={`${ids}-password`}>{t("auth.password")}</label>
            <Link className="sm-note-link" to={PATH.AUTH.FORGOT_PASSWORD}>{t("auth.forgot")}</Link>
          </span>
          <PasswordInput id={`${ids}-password`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" invalid={Boolean(errors.password)} describedBy={errors.password ? `${ids}-password-error` : undefined} />
          {errors.password && <p id={`${ids}-password-error`} className="sm-text sm-form-error">{errors.password}</p>}
        </div>
        <label className="sm-choice sm-cat-choice">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={busy} />
          <span>{t("auth.remember")}</span>
        </label>
        <button type="submit" className="sm-button" disabled={busy} aria-busy={busy} data-sm-action="signin">{t(busy ? "auth.signin.busy" : "auth.signin.submit")}</button>
      </form>
      <Link className="sm-button sm-button-quiet" to={PATH.AUTH.SIGNIN} state={location.state} data-sm-action="google">{t("auth.google")}</Link>
      <p className="sm-text sm-muted sm-fine">{t("auth.googleNote")}</p>
      <p className="sm-text">{t("auth.noAccount")} <Link to={MOBILE_REGISTER} state={location.state}>{t("auth.register.link")}</Link></p>
    </AuthFrame>
  );
}

export function MobileRegister() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const { register } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const [values, setValues] = useState({ name: "", identifier: "", password: "", confirmation: "", accepted: false });
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState("");
  const alertRef = useRef(null);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const [submit, busy] = useSubmit(async () => {
    try {
      await register({ name: values.name.trim(), identifier: values.identifier.trim(), password: values.password, password_confirmation: values.confirmation, terms_accepted: values.accepted, privacy_accepted: values.accepted });
      // A new account starts unverified: Profile shows the email status and how to verify.
      navigate(MOBILE_PROFILE, { replace: true });
    } catch (error) {
      const fields = error?.code === "VALIDATION_ERROR" ? error.errors ?? {} : {};
      setErrors({ name: firstOf(fields.name), identifier: firstOf(fields.identifier), password: firstOf(fields.password), confirmation: firstOf(fields.password_confirmation), accepted: firstOf(fields.terms_accepted) ?? firstOf(fields.privacy_accepted) });
      setGeneral(failureText(error, t, online, "register"));
    }
  });

  useEffect(() => {
    if (general) alertRef.current?.focus();
  }, [general]);

  const onSubmit = (event) => {
    event.preventDefault();
    const nameError = textError(values.name, { required: true, max: 255 });
    const local = {
      name: nameError ? t(`forms.errors.${nameError}`, { max: 255 }) : null,
      identifier: values.identifier.trim() ? null : t("forms.errors.required"),
      password: !values.password ? t("forms.errors.required") : values.password.length < PASSWORD_MIN ? t("forms.errors.passwordShort") : null,
      confirmation: values.confirmation !== values.password ? t("forms.errors.passwordMismatch") : null,
      accepted: values.accepted ? null : t("auth.register.consentRequired"),
    };
    setErrors(local);
    const bad = Object.values(local).some(Boolean);
    setGeneral(bad ? t("auth.fix") : "");
    if (!bad) submit();
  };

  const field = (name, label, input) => (
    <div className="sm-field">
      <label className="sm-label" htmlFor={`${ids}-${name}`}>{label}</label>
      {input}
      {errors[name] && <p id={`${ids}-${name}-error`} className="sm-text sm-form-error">{errors[name]}</p>}
    </div>
  );
  const describe = (name) => (errors[name] ? `${ids}-${name}-error` : undefined);

  return (
    <AuthFrame screen="register" title={t("auth.register.title")}>
      <p className="sm-text sm-muted">{t("auth.register.intro")}</p>
      <form className="sm-auth-form" onSubmit={onSubmit} noValidate aria-busy={busy} data-sm-form="register">
        {general && <div className="sm-error sm-error-compact" role="alert" tabIndex={-1} ref={alertRef} data-sm-auth-error>{general}</div>}
        {field("name", t("auth.register.name"), <input id={`${ids}-name`} className="sm-input" dir="auto" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={errors.name ? "true" : undefined} aria-describedby={describe("name")} disabled={busy} required />)}
        {field("identifier", t("auth.identifier"), <input id={`${ids}-identifier`} className="sm-input" type="text" inputMode="email" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck="false" value={values.identifier} onChange={set("identifier")} aria-invalid={errors.identifier ? "true" : undefined} aria-describedby={describe("identifier")} disabled={busy} required />)}
        {field("password", t("auth.password"), <PasswordInput id={`${ids}-password`} value={values.password} onChange={set("password")} autoComplete="new-password" invalid={Boolean(errors.password)} describedBy={describe("password") ?? `${ids}-password-hint`} />)}
        <p id={`${ids}-password-hint`} className="sm-text sm-muted sm-fine">{t("auth.register.passwordHint", { min: PASSWORD_MIN })}</p>
        {field("confirmation", t("auth.register.confirmation"), <PasswordInput id={`${ids}-confirmation`} value={values.confirmation} onChange={set("confirmation")} autoComplete="new-password" invalid={Boolean(errors.confirmation)} describedBy={describe("confirmation")} />)}
        <label className="sm-choice sm-cat-choice">
          <input type="checkbox" checked={values.accepted} onChange={set("accepted")} aria-invalid={errors.accepted ? "true" : undefined} aria-describedby={describe("accepted")} disabled={busy} />
          <span>{t("auth.register.consent")} <a href="/terms.html" target="_blank" rel="noopener noreferrer">{t("auth.register.terms")}</a> · <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{t("auth.register.privacy")}</a></span>
        </label>
        {errors.accepted && <p id={`${ids}-accepted-error`} className="sm-text sm-form-error">{errors.accepted}</p>}
        <button type="submit" className="sm-button" disabled={busy} aria-busy={busy} data-sm-action="register">{t(busy ? "auth.register.busy" : "auth.register.submit")}</button>
      </form>
      <p className="sm-text sm-muted sm-fine">{t("auth.register.verifyNote")}</p>
      <p className="sm-text">{t("auth.haveAccount")} <Link to={MOBILE_SIGNIN} state={location.state}>{t("auth.signin.link")}</Link></p>
    </AuthFrame>
  );
}
