import { useEffect, useState, useSyncExternalStore } from "react";
import { LuCircleCheck, LuLoaderCircle, LuMic, LuRotateCcw, LuSquare, LuWalletCards, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { createVoiceRecorder } from "../../voiceRecorder.js";
import { VOICE_RECORDING_POLICY } from "../../voiceCaptureContract.js";
import "./VoiceCapture.css";

const PREFIX = "dashboard.financialOperations.voice";
const pad = (value) => String(value).padStart(2, "0");
const duration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

/** Recording and playback stay local until the user explicitly submits the WAV. */
export default function VoiceCapture({ account, onRequireAccount, onSwitchToManual, onRecordingReady, disabled = false }) {
  const { t } = useTranslation();
  const [recorder] = useState(() => createVoiceRecorder());
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  const accountId = account?.id;
  // Cancel stays reusable during React StrictMode's effect cleanup/replay.
  useEffect(() => () => recorder.cancel(), [recorder, accountId]);

  const isRecording = state.status === "recording";
  const isBusy = state.status === "requesting" || state.status === "processing";
  const isReady = state.status === "ready" && state.result;
  const errorCode = state.error?.code ?? state.support.code;
  const statusKey = isRecording ? "listening" : state.status === "requesting" ? "requesting"
    : state.status === "processing" ? "processing" : isReady ? "ready" : "start";
  const toggle = () => {
    if (isRecording) { void recorder.stop().catch(() => {}); return; }
    if (disabled || isBusy || !state.support.supported) return;
    if (!(onRequireAccount ? onRequireAccount() : Boolean(account))) return;
    void recorder.start().catch(() => {}); // Display only the store's safe error codes.
  };
  const goManual = () => { recorder.cancel(); onSwitchToManual?.(); };

  return (
    <div className="capture-panel voice-capture" aria-busy={isBusy}>
      <div className="voice-capture__copy">
        <span className="capture-panel__kicker">{t(`${PREFIX}.kicker`)}</span>
        <h3>{t(`${PREFIX}.title`)}</h3>
        <p>{t(`${PREFIX}.description`)}</p>
        <div className="voice-capture__example">
          <span>{t(`${PREFIX}.exampleLabel`)}</span>
          <strong>{t(`${PREFIX}.example`)}</strong>
        </div>
        <p className="voice-capture__hint">{t(`${PREFIX}.hint`)}</p>
        {account && (
          <span className="capture-panel__account">
            <LuWalletCards aria-hidden="true" />
            {t("dashboard.financialOperations.captureStep.useAccount")}
            <b dir="auto">{account.name}</b>
          </span>
        )}
        <button type="button" className="voice-capture__manual" onClick={goManual}>{t(`${PREFIX}.fallback`)}</button>
      </div>
      <div className={`voice-capture__stage${isRecording ? " voice-capture__stage--live" : ""}`}>
        <span className="voice-capture__orb-wrap">
          <i className="voice-capture__pulse" aria-hidden="true" />
          <i className="voice-capture__pulse voice-capture__pulse--wide" aria-hidden="true" />
          <button type="button" className="voice-capture__orb" onClick={toggle}
            disabled={isBusy || (!isRecording && (disabled || !state.support.supported))}
            aria-pressed={isRecording}
            aria-label={t(`${PREFIX}.${isRecording ? "stop" : isReady ? "recordAgain" : "start"}`)}>
            {isBusy ? <LuLoaderCircle className="voice-capture__spinner" aria-hidden="true" />
              : isRecording ? <LuSquare aria-hidden="true" />
              : isReady ? <LuRotateCcw aria-hidden="true" /> : <LuMic aria-hidden="true" />}
          </button>
        </span>
        <strong role="status" aria-live="polite">{t(`${PREFIX}.${statusKey}`)}</strong>
        <output className="voice-capture__timer" dir="ltr" aria-label={t(`${PREFIX}.durationLabel`)}>
          {duration(state.elapsedMs)} <span>/ {duration(VOICE_RECORDING_POLICY.maxDurationSeconds * 1000)}</span>
        </output>
        <progress className="voice-capture__progress" max={VOICE_RECORDING_POLICY.maxDurationSeconds}
          value={Math.min(VOICE_RECORDING_POLICY.maxDurationSeconds, state.elapsedMs / 1000)} aria-label={t(`${PREFIX}.durationLabel`)} />
        {isRecording && (
          <div className="voice-capture__level" role="meter" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(state.level * 100)} aria-label={t(`${PREFIX}.levelLabel`)}>
            <span style={{ width: `${state.level * 100}%` }} />
          </div>
        )}
        {isBusy && (
          <button type="button" className="voice-capture__secondary voice-capture__stage-cancel" onClick={() => recorder.cancel()}>
            <LuX aria-hidden="true" />{t(`${PREFIX}.cancel`)}
          </button>
        )}
      </div>
      {errorCode && (
        <div className="voice-capture__feedback voice-capture__feedback--error" role="alert">
          {t(`${PREFIX}.errors.${errorCode}`, { defaultValue: t(`${PREFIX}.errors.VOICE_RECORDING_FAILED`) })}
        </div>
      )}
      {isReady && (
        <div className="voice-capture__preview">
          <div className="voice-capture__preview-heading">
            <span className="voice-capture__ready-icon"><LuCircleCheck aria-hidden="true" /></span>
            <div><strong>{t(`${PREFIX}.playLabel`)}</strong><p>{t(`${PREFIX}.previewHint`)}</p></div>
            <span className="voice-capture__duration" dir="ltr">{duration(state.result.durationMs)}</span>
          </div>
          <audio key={state.result.previewUrl} src={state.result.previewUrl} controls preload="metadata" aria-label={t(`${PREFIX}.playLabel`)} />
          {state.stopReason === "limit" && <p className="voice-capture__limit-note">{t(`${PREFIX}.stoppedAtLimit`)}</p>}
          {state.stopReason === "background" && <p className="voice-capture__limit-note">{t(`${PREFIX}.stoppedOnBackground`)}</p>}
          <div className="voice-capture__preview-actions">
            <button type="button" className="voice-capture__secondary" onClick={() => recorder.cancel()}>
              <LuX aria-hidden="true" />{t(`${PREFIX}.removeRecording`)}
            </button>
            {onRecordingReady && (
              <button type="button" className="capture-action capture-action--primary" disabled={disabled}
                onClick={() => onRecordingReady(state.result)}>{t(`${PREFIX}.useRecording`)}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
