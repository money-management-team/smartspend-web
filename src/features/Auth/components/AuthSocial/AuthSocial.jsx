import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppleIcon, GoogleIcon } from "../AuthIcons";
import {
  loadGoogleIdentity,
  setGoogleCredentialHandler,
} from "./googleIdentity";

import "./AuthSocial.css";

const GOOGLE_BUTTON_MAX_WIDTH = 400;

/*
 * Stretch Google's rendered button (40px "large") over the whole slot (our
 * 44px button), so every point of our button reaches Google's. Transforms
 * don't change layout size, so measuring again is stable.
 */
function fitGoogleButton(slot) {
  const rendered = slot.firstElementChild;
  if (!rendered?.offsetWidth || !rendered.offsetHeight) return false;

  slot.style.setProperty(
    "--auth-google-scale-x",
    String(Math.max(1, slot.clientWidth / rendered.offsetWidth)),
  );
  slot.style.setProperty(
    "--auth-google-scale-y",
    String(Math.max(1, slot.clientHeight / rendered.offsetHeight)),
  );
  return true;
}

/*
 * "Or continue with" divider + Google / Apple buttons.
 *
 * Google (only when `onGoogleCredential` is given): GIS returns an ID token
 * only from its own rendered button, so that button is rendered invisibly
 * (opacity 0) on top of ours. The user sees our design; the click lands on
 * Google's button and opens Google's account popup.
 * - `onGoogleCredential(idToken)`: receives the ID token (JWT). May return a
 *   promise; further credentials are ignored until it settles.
 * - `onGoogleUnavailable()`: our button was clicked but Google can't be used
 *   (missing VITE_GOOGLE_CLIENT_ID, blocked script, offline).
 * - `disabled`: disables both buttons and removes Google's button.
 * Apple is still a placeholder with no handler.
 */
export default function AuthSocial({
  dividerLabel,
  googleLabel,
  appleLabel,
  onGoogleCredential,
  onGoogleUnavailable,
  disabled = false,
}) {
  const { i18n } = useTranslation();
  const googleSlotRef = useRef(null);
  const credentialPendingRef = useRef(false);
  // "loading" | "ready" (Google's button is rendered) | "unavailable"
  const [googleStatus, setGoogleStatus] = useState("loading");
  const googleEnabled = Boolean(onGoogleCredential);
  const googleLocale = i18n.resolvedLanguage;
  const overlayActive = googleEnabled && googleStatus === "ready" && !disabled;

  const handleCredential = useEffectEvent(async (idToken) => {
    if (disabled || credentialPendingRef.current) return;

    credentialPendingRef.current = true;
    try {
      await onGoogleCredential?.(idToken);
    } finally {
      credentialPendingRef.current = false;
    }
  });

  useEffect(() => {
    if (!googleEnabled) return undefined;

    const slot = googleSlotRef.current;
    let observer = null;
    let frameId = 0;
    let cancelled = false;
    const unsubscribe = setGoogleCredentialHandler((idToken) =>
      handleCredential(idToken),
    );

    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled) return;

        // Render (again) whenever the slot width changes. The slot is 0 wide
        // while hidden, so this also waits until it is laid out.
        let renderedWidth = 0;
        observer = new ResizeObserver(() => {
          const width = Math.round(slot.clientWidth);
          if (!width || width === renderedWidth) return;

          renderedWidth = width;
          googleId.renderButton(slot, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            width: Math.min(width, GOOGLE_BUTTON_MAX_WIDTH),
            locale: googleLocale,
          });

          if (!slot.firstElementChild) {
            setGoogleStatus("unavailable");
            return;
          }

          if (!fitGoogleButton(slot)) {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => fitGoogleButton(slot));
          }
          setGoogleStatus("ready");
        });
        observer.observe(slot);
      })
      .catch(() => {
        if (!cancelled) setGoogleStatus("unavailable");
      });

    return () => {
      cancelled = true;
      unsubscribe();
      observer?.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [googleEnabled, googleLocale]);

  const handleGoogleClick = () => {
    if (googleStatus === "unavailable") onGoogleUnavailable?.();
  };

  return (
    <div className="auth-social">
      <div className="auth-social__divider" aria-hidden="true">
        <span />
        <small>{dividerLabel}</small>
        <span />
      </div>

      <div className="auth-social__buttons">
        <div className="auth-social__google">
          <button
            className="auth-social__button"
            type="button"
            onClick={googleEnabled ? handleGoogleClick : undefined}
            disabled={disabled}
            tabIndex={overlayActive ? -1 : undefined}
            aria-hidden={overlayActive || undefined}
          >
            <GoogleIcon />
            <span>{googleLabel}</span>
          </button>

          {googleEnabled && (
            <div
              ref={googleSlotRef}
              className="auth-social__google-slot"
              hidden={disabled}
            />
          )}
        </div>

        <button className="auth-social__button" type="button" disabled={disabled}>
          <AppleIcon />
          <span>{appleLabel}</span>
        </button>
      </div>
    </div>
  );
}
