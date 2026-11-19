import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuCheck, LuCircle, LuInfo, LuLockKeyhole, LuMail } from "react-icons/lu";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { PATH } from "../../routes/Path.js";
import "../i18n/register.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { confirmationError, emailError, passwordChecklist, passwordError, readResetLink } from "../models/authRecovery.js";
import { MOBILE_FORGOT_PASSWORD, MOBILE_SIGNIN } from "../navigation.js";
import { AuthFrame, PasswordInput } from "./MobileAuth.jsx";
import { useAuthWrite, useCooldown } from "./useAuthWrite.js";

/*
 * Account recovery on Mobile: ask for a reset link (/m/forgot-password) and set the new password from it
 * (/m/reset-password). The contract, the limits and what is and is not handled are in docs/mobile/AUTH-RECOVERY.md.
 *
 * Both requests are writes and both are CLOSED (data/writeGate.js: auth.forgotPassword, auth.resetPassword). While closed the
 * screens say so, offer the full version, and send nothing; the gate is checked again inside the write facade.
 *
 * What these screens guarantee, because they handle a password and a reset token:
 *   - the token and the address from the emailed link are read once into memory and removed from the address bar, kept
 *     in no storage, and never written to a log; the page asks the browser to send no Referer while it is open
 *   - the new password lives in component state until the request is made, and is cleared after it
 *   - the same sentence answers "ask for a link" whatever the answer was about the address, so nothing says whether an
 *     account exists; only the backend's own format check (the same one made here first) can refuse an address
 *   - a request whose outcome is not known (no answer, timeout, 5xx) is said to be unknown, never "failed" or "done", and
 *     nothing is retried for the person
 *   - one request per submit, however many times the button is pressed
 * Messages are Mobile's own translated sentences chosen by the error's code; the backend's text is never shown.
 */

const fieldMessage = (t, key, max = 255) => (key ? t(`forms.errors.${key}`, { max }) : null);

/* "Back to sign in" as the way out of both pages. */
function BackToSignIn({ state }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  return <p className="sm-text sm-auth-switch"><Link to={MOBILE_SIGNIN} state={state} data-sm-action="back-to-signin">{t("recovery.backToSignIn")}</Link></p>;
}

function ClosedNote({ operation }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  return <p className="sm-draft-note" role="note" data-sm-note="write-closed" data-sm-write={operation}><LuInfo aria-hidden="true" /><span>{t("recovery.closed")}</span></p>;
}

export function MobileForgotPassword() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const { closed, busy, run } = useAuthWrite("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState(null);
  const [result, setResult] = useState(null);
  const [wait, startWait] = useCooldown();
  const alertRef = useRef(null);

  useEffect(() => {
    if (result && result.kind !== "sent") alertRef.current?.focus();
  }, [result]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (closed || busy || wait > 0) return;
    const local = emailError(email);
    setProblem(local);
    setResult(null);
    if (local) return;

    const outcome = await run(email.trim());
    if (outcome.kind === "busy") return;
    if (outcome.ok) {
      setResult({ kind: "sent" });
      startWait(60);
    } else if (outcome.kind === "rate") {
      setResult({ kind: "rate", seconds: outcome.seconds });
      startWait(outcome.seconds);
    } else if (outcome.kind === "unknown") {
      setResult({ kind: "unknown" });
      startWait(60);
    } else if (outcome.kind === "invalid" || outcome.kind === "link") {
      // The backend's format check refused it (a 422 on `identifier`, which the reset page reads as a link problem): the same
      // sentence as the one made here, so nothing more is learned.
      setProblem("email");
    } else {
      setResult({ kind: "failed" });
    }
  };

  const sent = result?.kind === "sent";
  const failure = result && !sent ? result : null;

  return (
    <AuthFrame screen="forgot" title={t("recovery.forgot.title")} fullPath={PATH.AUTH.FORGOT_PASSWORD}>
      <p className="sm-text sm-muted sm-auth-intro">{t("recovery.forgot.intro")}</p>
      {closed && <ClosedNote operation="auth.forgotPassword" />}
      {sent && (
        <div className="sm-card" role="status" data-sm-recovery="sent">
          <p className="sm-text">{t("recovery.forgot.sent")}</p>
          <p className="sm-text sm-muted sm-fine">{t("recovery.forgot.sentHint")}</p>
        </div>
      )}
      <form className="sm-auth-form" onSubmit={onSubmit} noValidate aria-busy={busy} data-sm-form="forgot">
        {failure && <div className="sm-error sm-error-compact" role="alert" tabIndex={-1} ref={alertRef} data-sm-auth-error data-sm-recovery={failure.kind}>{t(`recovery.forgot.${failure.kind}`, { seconds: failure.seconds })}</div>}
        <div className="sm-field">
          <label className="sm-label" htmlFor={`${ids}-email`}>{t("recovery.forgot.email")}</label>
          <span className="sm-auth-control">
            <span className="sm-auth-icon" aria-hidden="true"><LuMail /></span>
            <input id={`${ids}-email`} className="sm-input" type="text" inputMode="email" dir="ltr" autoComplete="email" autoCapitalize="none" spellCheck="false" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={problem ? "true" : undefined} aria-describedby={problem ? `${ids}-email-error` : undefined} disabled={busy} required />
          </span>
          {problem && <p id={`${ids}-email-error`} className="sm-text sm-form-error">{fieldMessage(t, problem)}</p>}
        </div>
        <button type="submit" className="sm-button sm-auth-submit" disabled={closed || busy || wait > 0} aria-busy={busy} data-sm-action="forgot-send">
          <span>{busy ? t("recovery.forgot.busy") : wait > 0 ? t("recovery.forgot.wait", { seconds: wait }) : t(sent || result ? "recovery.forgot.again" : "recovery.forgot.submit")}</span>
          {!busy && wait === 0 && <LuArrowRight className="sm-auth-submit-arrow" aria-hidden="true" />}
        </button>
      </form>
      <BackToSignIn />
    </AuthFrame>
  );
}

export function MobileResetPassword() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth, user } = useAuthContext();
  const { closed, busy, run } = useAuthWrite("auth.resetPassword");
  // Read once, into memory. The effect below removes the query from the address bar; nothing is ever stored.
  const [link] = useState(() => readResetLink(location.search));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState("form");
  const [failure, setFailure] = useState(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [wait, startWait] = useCooldown();
  const alertRef = useRef(null);

  // The token is in the address only until this page has it: replace the entry, so Back never returns to it.
  useEffect(() => {
    if (location.search || location.hash) navigate(location.pathname, { replace: true, state: null });
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);

  const checklist = passwordChecklist(password);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (closed || busy || wait > 0 || !link || phase !== "form") return;
    const local = { password: passwordError(password), confirmation: confirmationError(password, confirmation) };
    setErrors(local);
    if (local.password || local.confirmation) {
      setFailure({ kind: "fix" });
      return;
    }
    setFailure(null);

    const outcome = await run({ token: link.token, identifier: link.identifier, password, passwordConfirmation: confirmation });
    if (outcome.kind === "busy") return;
    if (outcome.ok) {
      // The password is not needed any more; the backend ended every session of the account, so a stored one here is stale.
      setPassword("");
      setConfirmation("");
      if (user?.email && String(user.email).toLowerCase() === link.identifier.toLowerCase()) clearAuth?.();
      setPhase("done");
    } else if (outcome.kind === "link") {
      setPhase(unconfirmed ? "linkMaybe" : "link");
    } else if (outcome.kind === "password") {
      setErrors({ password: "passwordMix" });
      setFailure({ kind: "password" });
    } else if (outcome.kind === "rate") {
      setFailure({ kind: "rate", seconds: outcome.seconds });
      startWait(outcome.seconds);
    } else if (outcome.kind === "unknown") {
      setUnconfirmed(true);
      setFailure({ kind: "unknown" });
    } else {
      setFailure({ kind: outcome.kind === "invalid" ? "invalid" : "failed" });
    }
  };

  const frame = (children) => (
    <AuthFrame screen="reset" title={t(phase === "done" ? "recovery.reset.doneTitle" : "recovery.reset.title")} fullPath={PATH.AUTH.FORGOT_PASSWORD}>
      {/* React hoists this into <head> while the page is open: the browser sends no Referer from a page that once had a token in its address. */}
      <meta name="referrer" content="no-referrer" />
      {children}
    </AuthFrame>
  );

  if (phase === "done") {
    return frame(
      <>
        <div className="sm-card" role="status" data-sm-recovery="done">
          <p className="sm-text">{t("recovery.reset.done")}</p>
          <p className="sm-text sm-muted sm-fine">{t("recovery.reset.doneNote")}</p>
        </div>
        <Link className="sm-button sm-auth-submit" to={MOBILE_SIGNIN} replace data-sm-action="signin-after-reset">{t("recovery.reset.signIn")}</Link>
      </>,
    );
  }

  // No usable link (opened by hand, cut short in the email, or already used and refreshed): nothing can be sent.
  if (!link || phase === "link" || phase === "linkMaybe") {
    const kind = !link ? "missing" : phase;
    return frame(
      <>
        <div className="sm-error sm-error-compact" role="alert" data-sm-recovery={kind} data-sm-auth-error>{t(`recovery.reset.${kind}`)}</div>
        <Link className="sm-button sm-auth-submit" to={MOBILE_FORGOT_PASSWORD} replace data-sm-action="new-link">{t("recovery.reset.newLink")}</Link>
        <BackToSignIn />
      </>,
    );
  }

  const field = (name, label, input) => (
    <div className="sm-field">
      <label className="sm-label" htmlFor={`${ids}-${name}`}>{label}</label>
      {input}
      {errors[name] && <p id={`${ids}-${name}-error`} className="sm-text sm-form-error">{fieldMessage(t, errors[name])}</p>}
    </div>
  );

  return frame(
    <>
      <p className="sm-text sm-muted sm-auth-intro">{t("recovery.reset.intro")}</p>
      {closed && <ClosedNote operation="auth.resetPassword" />}
      <form className="sm-auth-form" onSubmit={onSubmit} noValidate aria-busy={busy} data-sm-form="reset">
        {failure && <div className="sm-error sm-error-compact" role="alert" tabIndex={-1} ref={alertRef} data-sm-auth-error data-sm-recovery={failure.kind}>{failure.kind === "fix" ? t("auth.fix") : t(`recovery.reset.${failure.kind}`, { seconds: failure.seconds })}</div>}
        {field("password", t("recovery.reset.newPassword"),<PasswordInput id={`${ids}-password`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" invalid={Boolean(errors.password)} describedBy={errors.password ? `${ids}-password-error` : `${ids}-rules`} icon={<LuLockKeyhole />} />)}
        <ul id={`${ids}-rules`} className="sm-auth-rules" aria-label={t("recovery.reset.rulesTitle")} data-sm-rules>
          {["length", "letter", "digit"].map((rule) => (
            <li key={rule} data-sm-rule={rule} data-met={checklist[rule] ? "true" : "false"}>
              {checklist[rule] ? <LuCheck aria-hidden="true" /> : <LuCircle aria-hidden="true" />}
              <span>{t(`recovery.reset.rule.${rule}`)}</span>
              <span className="sm-auth-sr">{t(checklist[rule] ? "recovery.reset.met" : "recovery.reset.notMet")}</span>
            </li>
          ))}
        </ul>
        {field("confirmation", t("recovery.reset.confirmation"), <PasswordInput id={`${ids}-confirmation`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" invalid={Boolean(errors.confirmation)} describedBy={errors.confirmation ? `${ids}-confirmation-error` : undefined} icon={<LuLockKeyhole />} />)}
        <button type="submit" className="sm-button sm-auth-submit" disabled={closed || busy || wait > 0} aria-busy={busy} data-sm-action="reset-send">
          <span>{busy ? t("recovery.reset.busy") : wait > 0 ? t("recovery.reset.wait", { seconds: wait }) : t("recovery.reset.submit")}</span>
          {!busy && wait === 0 && <LuArrowRight className="sm-auth-submit-arrow" aria-hidden="true" />}
        </button>
      </form>
      <BackToSignIn />
    </>,
  );
}
