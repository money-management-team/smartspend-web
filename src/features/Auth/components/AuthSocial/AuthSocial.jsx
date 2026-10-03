import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoogleIcon } from "../AuthIcons";
import {
  isGoogleConfigured,
  loadGoogleIdentity,
  setGoogleCredentialHandler,
} from "./googleIdentity";
import "../../../../components/AccessExperience/accessMessages";
import "./AuthSocial.css";

export default function AuthSocial({
  dividerLabel,
  googleLabel,
  onGoogleCredential,
  onGoogleUnavailable,
  disabled = false,
}) {
  const { t, i18n } = useTranslation("access");
  const slotRef = useRef(null);
  const pendingRef = useRef(false);
  const [status, setStatus] = useState(
    isGoogleConfigured ? "loading" : "unavailable",
  );
  const [attempt, setAttempt] = useState(0);
  const enabled = Boolean(onGoogleCredential);
  const locale = i18n.resolvedLanguage || "en";
  const handleCredential = useEffectEvent(async (token) => {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    try {
      await onGoogleCredential?.(token);
    } finally {
      pendingRef.current = false;
    }
  });

  useEffect(() => {
    if (!enabled) return;
    const slot = slotRef.current;
    let cancelled = false;
    let observer;
    let lastWidth = 0;
    const subscription = setGoogleCredentialHandler((token) => {
      if (!cancelled) return handleCredential(token);
    });
    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled) return;
        const render = () => {
          if (cancelled) return;
          const width = Math.min(
            400,
            Math.round(slot.clientWidth || slot.parentElement.clientWidth) ||
              300,
          );
          if (lastWidth === width) return;
          lastWidth = width;
          slot.replaceChildren();
          try {
            googleId.renderButton(slot, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "continue_with",
              shape: "pill",
              width,
              locale,
              state: subscription.state,
            });
            setStatus(slot.firstElementChild ? "ready" : "unavailable");
          } catch {
            setStatus("unavailable");
          }
        };
        render();
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(render);
          observer.observe(slot);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      observer?.disconnect();
      slot.replaceChildren();
    };
  }, [enabled, locale, attempt]);

  return (
    <div className="auth-social">
      <div className="auth-social__divider" aria-hidden="true">
        <span />
        <small>{dividerLabel}</small>
        <span />
      </div>
      <div
        className="auth-social__google"
        aria-busy={disabled || status === "loading"}
      >
        <div
          ref={slotRef}
          className="auth-social__google-slot"
          hidden={status !== "ready" || disabled}
        />
        {(status !== "ready" || disabled) && (
          <button
            className="auth-social__button"
            type="button"
            disabled={disabled || status === "loading"}
            onClick={() => {
              if (!isGoogleConfigured) {
                onGoogleUnavailable?.();
                return;
              }
              setStatus("loading");
              setAttempt((current) => current + 1);
            }}
          >
            <GoogleIcon />
            <span>
              {disabled
                ? t("googleWorking")
                : status === "loading"
                  ? t("googleLoading")
                  : googleLabel}
            </span>
          </button>
        )}
      </div>
      {status === "unavailable" && !disabled && (
        <p className="auth-social__status" role="status">
          {t("googleUnavailableHint")}
        </p>
      )}
    </div>
  );
}
