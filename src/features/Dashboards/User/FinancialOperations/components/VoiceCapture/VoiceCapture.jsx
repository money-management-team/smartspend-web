import { useEffect, useState } from "react";
import { LuMic, LuSquare, LuWalletCards } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./VoiceCapture.css";

const pad = (value) => String(value).padStart(2, "0");

/*
 * Voice entry. The speech-to-operation service isn't wired to the backend
 * yet, so stopping the recorder says so plainly instead of inventing an
 * operation, and offers manual entry, which does record money.
 */
export default function VoiceCapture({ account, onRequireAccount, onSwitchToManual }) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isRecording) return undefined;

    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const toggle = () => {
    if (!onRequireAccount()) return;

    if (isRecording) {
      setIsRecording(false);
      setIsDone(true);
      return;
    }

    setSeconds(0);
    setIsDone(false);
    setIsRecording(true);
  };

  const label = isRecording
    ? "dashboard.financialOperations.voice.listening"
    : "dashboard.financialOperations.voice.start";

  return (
    <div className="capture-panel voice-capture">
      <div className="voice-capture__copy">
        <span className="capture-panel__kicker">
          {t("dashboard.financialOperations.voice.kicker")}
        </span>

        <h3>{t("dashboard.financialOperations.voice.title")}</h3>
        <p>{t("dashboard.financialOperations.voice.description")}</p>

        {account && (
          <span className="capture-panel__account">
            <LuWalletCards aria-hidden="true" />
            {t("dashboard.financialOperations.captureStep.useAccount")}
            <b dir="auto">{account.name}</b>
          </span>
        )}

        {isDone && (
          <div className="capture-notice" role="status">
            <p>{t("dashboard.financialOperations.voice.unavailable")}</p>
            <button type="button" onClick={onSwitchToManual}>
              {t("dashboard.financialOperations.voice.fallback")}
            </button>
          </div>
        )}
      </div>

      <div
        className={
          isRecording ? "voice-capture__stage voice-capture__stage--live" : "voice-capture__stage"
        }
      >
        <span className="voice-capture__orb-wrap">
          <i className="voice-capture__pulse" aria-hidden="true" />
          <i className="voice-capture__pulse voice-capture__pulse--wide" aria-hidden="true" />

          <button
            type="button"
            className="voice-capture__orb"
            onClick={toggle}
            aria-pressed={isRecording}
            aria-label={t(
              isRecording
                ? "dashboard.financialOperations.voice.stop"
                : "dashboard.financialOperations.voice.start",
            )}
          >
            {isRecording ? <LuSquare aria-hidden="true" /> : <LuMic aria-hidden="true" />}
          </button>
        </span>

        <strong>{t(label)}</strong>
        <small dir="ltr">
          {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
        </small>
      </div>
    </div>
  );
}
