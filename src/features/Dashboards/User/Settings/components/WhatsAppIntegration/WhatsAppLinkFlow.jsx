import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuCopy, LuExternalLink, LuShieldCheck } from "react-icons/lu";

import { maskedDigits } from "./whatsappFormat.js";
import {
  buildWhatsAppDeepLink,
  copyTextToClipboard,
  getWhatsAppErrorMessage,
} from "./whatsappLinking.js";

const x = "dashboard.settings.whatsapp";
const STEPS = ["start", "send", "verify", "confirm"];
const ACTIVE_STEP = { creating: 0, waiting: 1, verified: 2, confirming: 3 };

function Stepper({ phase }) {
  const { t } = useTranslation();
  const active = ACTIVE_STEP[phase] ?? -1;

  return (
    <ol className="wa-steps" aria-label={t(`${x}.flow.label`)}>
      {STEPS.map((step, index) => {
        const status = index < active ? "done" : index === active ? "current" : "todo";
        return (
          <li
            key={step}
            className={`wa-steps__item wa-steps__item--${status}`}
            aria-current={status === "current" ? "step" : undefined}
          >
            <span className="wa-steps__dot" aria-hidden="true">
              {status === "done" ? <LuCheck /> : index + 1}
            </span>
            <span className="wa-steps__label">{t(`${x}.flow.steps.${step}`)}</span>
            {status === "done" && <span className="wa-sr-only">{t(`${x}.flow.stepDone`)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function CopyMessage({ message }) {
  const { t } = useTranslation();
  const [copy, setCopy] = useState("idle"); // idle | copied | failed
  const messageRef = useRef(null);

  async function copyMessage() {
    const copied = await copyTextToClipboard(message);
    setCopy(copied ? "copied" : "failed");

    if (!copied && messageRef.current) {
      // Fallback: select the text so a manual copy is one gesture away.
      const range = document.createRange();
      range.selectNodeContents(messageRef.current);
      const selection = globalThis.getSelection?.();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  return (
    <div className="wa-message">
      <span className="wa-message__label" id="wa-message-label">{t(`${x}.flow.message`)}</span>
      <div className="wa-message__row">
        <code className="wa-message__text" dir="ltr" ref={messageRef} aria-labelledby="wa-message-label">
          {message}
        </code>
        <button type="button" className="wa-button wa-button--soft" onClick={copyMessage}>
          {copy === "copied" ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
          {copy === "copied" ? t(`${x}.flow.copied`) : t(`${x}.flow.copy`)}
        </button>
      </div>
      <p className="wa-message__feedback" role="status">
        {copy === "copied" && t(`${x}.flow.copiedAnnounce`)}
        {copy === "failed" && t(`${x}.flow.copyFailed`)}
      </p>
    </div>
  );
}

function formatTime(iso, language) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(date);
}

export default function WhatsAppLinkFlow({ state, onConfirm, onCancel, onRestart }) {
  const { t, i18n } = useTranslation();
  const { phase, challenge, linking, error } = state;

  if (phase === "expired" || phase === "cancelled") {
    return (
      <div className="wa-panel wa-panel--notice" role="status">
        <h3>{t(`${x}.flow.${phase}Title`)}</h3>
        <p>{t(`${x}.flow.${phase}Body`)}</p>
        <div className="wa-actions">
          <button type="button" className="wa-button wa-button--primary" onClick={onRestart}>
            {t(`${x}.flow.restart`)}
          </button>
          <button type="button" className="wa-button" onClick={onCancel}>{t(`${x}.flow.close`)}</button>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    const canRetry = error?.context === "create" || error?.context === "poll";
    return (
      <div className="wa-panel wa-panel--notice">
        <h3>{t(`${x}.flow.failedTitle`)}</h3>
        <p role="alert">{getWhatsAppErrorMessage(error?.error, t, error?.context)}</p>
        <div className="wa-actions">
          {canRetry && (
            <button type="button" className="wa-button wa-button--primary" onClick={onRestart}>
              {t(`${x}.flow.retry`)}
            </button>
          )}
          <button type="button" className="wa-button" onClick={onCancel}>{t(`${x}.flow.close`)}</button>
        </div>
      </div>
    );
  }

  const digits = maskedDigits(challenge?.phone_last_digits);
  const expires = challenge?.expires_at ? formatTime(challenge.expires_at, i18n.language) : null;
  const deepLink = linking ? buildWhatsAppDeepLink(linking.public_number, linking.message) : null;

  return (
    <div className="wa-panel">
      <Stepper phase={phase} />

      {phase === "creating" && (
        <p className="wa-progress" role="status">
          <span className="wa-spinner" aria-hidden="true" />
          {t(`${x}.flow.creating`)}
        </p>
      )}

      {phase === "waiting" && linking && (
        <>
          <h3>{t(`${x}.flow.sendTitle`)}</h3>
          <p>{t(`${x}.flow.sendBody`)}</p>

          {linking.public_number && (
            <p className="wa-number">
              <span>{t(`${x}.flow.serviceNumber`)}</span>
              <bdi dir="ltr">{linking.public_number}</bdi>
            </p>
          )}

          <CopyMessage message={linking.message} />

          {deepLink && (
            <a
              className="wa-button wa-button--whatsapp"
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LuExternalLink aria-hidden="true" />
              {t(`${x}.flow.open`)}
            </a>
          )}

          <p className="wa-progress" role="status">
            <span className="wa-spinner" aria-hidden="true" />
            <span>
              {t(`${x}.flow.waiting`)}
              <small>{t(`${x}.flow.waitingHint`)}</small>
            </span>
          </p>

          <p className="wa-note">
            {expires && <>{t(`${x}.flow.expires`, { time: expires })} · </>}
            {t(`${x}.flow.copyNote`)}
          </p>

          <div className="wa-actions">
            <button type="button" className="wa-button" onClick={onCancel}>{t(`${x}.flow.cancel`)}</button>
          </div>
        </>
      )}

      {(phase === "verified" || phase === "confirming") && (
        <>
          <div className="wa-verified" role="status">
            <LuShieldCheck aria-hidden="true" />
            <div>
              <h3>{t(`${x}.flow.verifiedTitle`)}</h3>
              <p>
                {digits
                  ? t(`${x}.flow.verifiedBody`, { digits })
                  : t(`${x}.flow.verifiedBodyNoDigits`)}
              </p>
            </div>
          </div>

          {error && <p className="wa-error" role="alert">{getWhatsAppErrorMessage(error.error, t, error.context)}</p>}

          <div className="wa-actions">
            <button
              type="button"
              className="wa-button wa-button--primary"
              onClick={onConfirm}
              disabled={phase === "confirming"}
              aria-busy={phase === "confirming"}
            >
              {phase === "confirming" ? t(`${x}.flow.confirming`) : t(`${x}.flow.confirm`)}
            </button>
            <button type="button" className="wa-button" onClick={onCancel} disabled={phase === "confirming"}>
              {t(`${x}.flow.cancel`)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
