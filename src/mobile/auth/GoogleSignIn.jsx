import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import useGoogleSignIn from "../../features/Auth/components/AuthSocial/useGoogleSignIn.js";
import { getGoogleButtonOptions, loadGoogleIdentity, setGoogleCredentialHandler } from "../../features/Auth/components/AuthSocial/googleIdentity.js";
import { useThemeContext } from "../../contexts/theme/useThemeContext";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";

const SHARED_IDENTITY = Object.freeze({ load: loadGoogleIdentity, subscribe: setGoogleCredentialHandler });

const isStandalone = () => {
  try {
    return window.matchMedia?.("(display-mode: standalone)")?.matches === true || window.navigator.standalone === true;
  } catch {
    return false;
  }
};

/*
 * "Continue with Google" on Mobile, with the app's own mechanism and nothing new:
 *
 *   - googleIdentity.js loads Google Identity Services, renders Google's own
 *     button into the slot and hands back the credential (popup mode);
 *   - useGoogleSignIn.js (the full version's hook) sends it to the one
 *     AuthProvider's loginWithGoogle, keeps the credential in memory only, asks
 *     for policy consent when the backend requires it, and goes to the safe
 *     return address (getPostAuthPath; a Mobile address comes back to Mobile,
 *     the dashboard is sent to Mobile Home by the presentation rules).
 *
 * Mobile adds only the slot, its own consent panel (the full version's dialog
 * is Desktop UI) and the words around them. Closing Google's window does
 * nothing; a blocked or missing window, or Google not loading or not being
 * configured, leaves email and password sign-in in place and says so. In an
 * installed app Google's window may not open; that is said too.
 *
 * `identity` replaces the loader in tests (no real Google request is made there).
 */
export default function GoogleSignIn({ remember, identity = SHARED_IDENTITY, disabled = false }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { theme } = useThemeContext();
  const ids = useId();
  const slotRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | unavailable
  const [error, setError] = useState("");
  const google = useGoogleSignIn({ remember, onError: setError });
  const onCredential = useEffectEvent((token) => (disabled ? undefined : google.handleCredential(token)));
  const consentRef = useRef(null);
  const language = t("auth.googleLocale");

  useEffect(() => {
    const slot = slotRef.current;
    let cancelled = false;
    const subscription = identity.subscribe((token) => {
      if (!cancelled) return onCredential(token);
    });
    Promise.resolve()
      .then(() => identity.load())
      .then((googleId) => {
        if (cancelled || !slot) return;
        slot.replaceChildren();
        googleId.renderButton(slot, getGoogleButtonOptions({ theme, language, width: slot.clientWidth || 300, state: subscription.state }));
        setStatus(slot.firstElementChild ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      slot?.replaceChildren();
    };
  }, [identity, theme, language]);

  useEffect(() => {
    if (google.needsConsent) consentRef.current?.focus();
  }, [google.needsConsent]);

  return (
    <div className="sm-google" data-sm-google={status} aria-busy={google.busy || undefined}>
      <div ref={slotRef} className="sm-google-slot" hidden={status === "unavailable"} />
      {status === "unavailable" && <p className="sm-text sm-muted sm-fine" data-sm-note="google-unavailable">{t("auth.googleUnavailable")}</p>}
      {status === "ready" && <p className="sm-text sm-muted sm-fine">{t(isStandalone() ? "auth.googleStandalone" : "auth.googlePopup")}</p>}
      {google.busy && <p className="sm-text sm-muted" role="status">{t("auth.signin.busy")}</p>}
      {error && <p className="sm-error sm-error-compact" role="alert" data-sm-google-error>{error}</p>}
      {google.needsConsent && (
        <section className="sm-card sm-google-consent" role="alertdialog" aria-modal="false" aria-labelledby={`${ids}-consent`} tabIndex={-1} ref={consentRef} data-sm-google-consent>
          <h2 id={`${ids}-consent`} className="sm-card-title">{t("auth.googleConsentTitle")}</h2>
          <p className="sm-text">{t("auth.googleConsentBody")}</p>
          <p className="sm-text"><a href="/terms.html" target="_blank" rel="noopener noreferrer">{t("auth.register.terms")}</a> · <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{t("auth.register.privacy")}</a></p>
          <div className="sm-actions sm-form-actions">
            <button type="button" className="sm-button" onClick={google.acceptConsent} data-sm-action="google-accept">{t("auth.googleAccept")}</button>
            <button type="button" className="sm-button sm-button-quiet" onClick={google.cancelConsent} data-sm-action="google-cancel">{t("forms.cancel")}</button>
          </div>
        </section>
      )}
    </div>
  );
}
