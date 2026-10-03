import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { useEmailVerification } from "../../../../contexts/emailVerification/useEmailVerification";
import { useResendVerificationEmail } from "../../../../contexts/emailVerification/useResendVerificationEmail";

import "./EmailVerificationBanner.css";

const DISMISS_KEY_PREFIX = "emailVerificationBannerDismissed:";

function readDismissed(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/*
 * Dashboard warning while GET /auth/email/status says `verified === false`.
 * `null` (verification doesn't apply) and `true` show nothing. After a
 * resend that turns out to be "already verified", the banner stays only to
 * show that confirmation until it is closed. The "X" button hides the warning
 * on every page; the choice is remembered per email address in localStorage.
 */
export default function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const { status } = useEmailVerification();
  const { send, isSending, notice, clearNotice } = useResendVerificationEmail();

  const email = status?.email ?? user?.email ?? "";
  const dismissKey = `${DISMISS_KEY_PREFIX}${email}`;
  const [dismissedKey, setDismissedKey] = useState(null);
  const isDismissed = dismissedKey === dismissKey || readDismissed(dismissKey);

  const isUnverified = status?.verified === false && !isDismissed;

  if (!isUnverified && !notice) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Storage unavailable: hide for this page load only.
    }
    setDismissedKey(dismissKey);
  };

  return (
    <section
      className={`email-verification-banner${
        isUnverified ? "" : " email-verification-banner--done"
      }`}
      aria-label={t("auth.emailVerification.title")}
    >
      <span className="email-verification-banner__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </span>

      <div className="email-verification-banner__text">
        {isUnverified && (
          <>
            <strong>{t("auth.emailVerification.title")}</strong>
            <p>
              <Trans
                i18nKey="auth.emailVerification.message"
                values={{ email }}
                components={{ email: <bdi /> }}
              />
            </p>
          </>
        )}

        {notice && (
          <p
            className={`email-verification-banner__notice email-verification-banner__notice--${notice.tone}`}
            role={notice.tone === "error" ? "alert" : "status"}
            dir="auto"
          >
            {notice.text}
          </p>
        )}
      </div>

      {isUnverified ? (
        <>
          <button
            type="button"
            className="email-verification-banner__action"
            onClick={send}
            disabled={isSending}
            aria-busy={isSending || undefined}
          >
            {t(
              isSending
                ? "auth.emailVerification.sending"
                : "auth.emailVerification.resend",
            )}
          </button>
          <button
            type="button"
            className="email-verification-banner__dismiss"
            onClick={dismiss}
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </>
      ) : (
        <button
          type="button"
          className="email-verification-banner__action email-verification-banner__action--quiet"
          onClick={clearNotice}
        >
          {t("common.close")}
        </button>
      )}
    </section>
  );
}
