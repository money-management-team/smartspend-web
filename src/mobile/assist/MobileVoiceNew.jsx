import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { sessionWorkspace } from "../data/readApi.js";
import { isWriteOpen } from "../data/writeGate.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import WriteOutcome from "../forms/WriteOutcome.jsx";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_CAPTURES, backPathFrom, captureDetailPath } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import { useCaptureUpload } from "./useCaptureUpload.js";
import { VOICE_RECORDING_POLICY, createMobileVoiceRecorder } from "./voiceRecorderFactory.js";

const pad = (value) => String(value).padStart(2, "0");
const clock = (ms) => {
  const seconds = Math.min(VOICE_RECORDING_POLICY.maxDurationSeconds, Math.floor(ms / 1000));
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

/*
 * Recording an expense by voice, on this device only, through the same
 * recorder and WAV conversion the full version uses
 * (FinancialOperations/voiceRecorder.js + voiceAudioWav.js): asking for the
 * microphone only on Record, a 60-second limit, playback here, record again
 * or discard. Rebuilding that byte-exact conversion a second time for Mobile
 * would be the kind of duplication this phase was asked to avoid, and a
 * second, independently-maintained encoder is exactly how the two versions'
 * accepted recordings quietly drift apart.
 *
 * Uploading it is POST /ai/voice-expense-captures (data/writeGate.js's
 * "voice.upload"): closed while data/writeGate.js's APPROVED stays empty, in
 * which case Upload stays disabled and says so, exactly as before this screen
 * had any send code. Opened, it uploads once through useCaptureUpload.js and
 * goes straight to the capture's own page (assist/MobileCaptures.jsx's
 * MobileCaptureDetail) to be read and reviewed — never recorded as an expense
 * from here. Nothing is stored; leaving the page (asked first) forgets the
 * recording.
 */
export default function MobileVoiceNew() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = backPathFrom(location.state, MOBILE_CAPTURES);
  const [recorder] = useState(() => createMobileVoiceRecorder());
  const rec = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discardRef = useRef(null);
  const open = isWriteOpen("voice.upload");
  const send = useCaptureUpload("voice.upload");
  const outcomeRef = useRef(null);

  const recording = rec.status === "recording";
  const busy = rec.status === "requesting" || rec.status === "processing";
  const ready = rec.status === "ready" && Boolean(rec.result);
  const errorCode = rec.status === "error" ? (rec.error?.code ?? rec.support.code) : null;

  const guard = useLeaveGuard((recording || ready) && send.phase !== "confirmed");

  // Cancelling frees the microphone and revokes any preview URL; see voiceRecorder.js.
  useEffect(() => () => recorder.cancel(), [recorder]);

  useEffect(() => {
    if (send.phase === "confirmed" && send.capture?.id) {
      navigate(captureDetailPath("voice", send.capture.id), { replace: true, state: { from: backTo } });
    }
  }, [send.phase, send.capture, navigate, backTo]);

  useEffect(() => {
    if (send.phase !== "idle" && send.phase !== "uploading" && send.phase !== "confirmed") outcomeRef.current?.focus();
  }, [send.phase]);

  const record = () => {
    send.reset();
    void recorder.start().catch(() => {});
  };

  const stop = () => {
    void recorder.stop().catch(() => {});
  };

  const discard = () => {
    setConfirmDiscard(false);
    send.reset();
    recorder.cancel();
  };

  const uploadNow = () => {
    if (!ready || send.uploading) return;
    send.upload(rec.result.blob, sessionWorkspace()?.id);
  };

  const settled = ["rejected", "unknown", "changed"].includes(send.phase);

  return (
    <section className="sm-page" data-sm-screen="voice-new" data-sm-phase={rec.status}>
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("captures.back")}</span>
      </Link>
      <div className="sm-card">
        <h2 className="sm-card-title">{t("captures.voiceTitle")}</h2>
        <p className="sm-text sm-muted">{t("captures.voiceIntro")}</p>
        <p className="sm-text sm-muted sm-fine">{t("captures.voiceRules", { max: VOICE_RECORDING_POLICY.maxDurationSeconds })}</p>

        {recording ? (
          <div className="sm-recording" role="status" aria-live="polite" data-sm-recording="true">
            <span className="sm-recording-dot" aria-hidden="true" />
            <span className="sm-text">{t("captures.recording")}</span>
            <bdi dir="ltr" className="sm-recording-clock" aria-label={t("captures.elapsed", { time: clock(rec.elapsedMs) })}>{clock(rec.elapsedMs)} / {clock(VOICE_RECORDING_POLICY.maxDurationSeconds * 1000)}</bdi>
          </div>
        ) : (
          <p className="sm-text" role="status" aria-live="polite" data-sm-status={errorCode ?? undefined}>
            {errorCode ? t(`captures.voiceError.${errorCode}`, { defaultValue: t("captures.voiceError.VOICE_RECORDING_FAILED") }) : busy ? t(rec.status === "processing" ? "captures.voicePhase.processing" : "captures.voicePhase.asking") : ""}
          </p>
        )}

        <div className="sm-actions">
          {recording ? (
            <button type="button" className="sm-button" onClick={stop} data-sm-action="stop">{t("captures.stop")}</button>
          ) : (
            <button type="button" className="sm-button" onClick={record} disabled={busy || !rec.support.supported} data-sm-action="record">{t(ready ? "captures.recordAgain" : "captures.record")}</button>
          )}
          {ready && !recording && <button type="button" ref={discardRef} className="sm-button sm-button-quiet" onClick={() => setConfirmDiscard(true)} data-sm-action="discard-recording">{t("captures.discardRecording")}</button>}
        </div>
      </div>

      {ready && (
        <div className="sm-card" data-sm-clip="recorded">
          <h2 className="sm-card-title">{t("captures.yourRecording")}</h2>
          <audio className="sm-audio" controls src={rec.result.previewUrl} aria-label={t("captures.playback")} />
          <p className="sm-text sm-muted"><bdi dir="ltr">{clock(rec.result.durationMs)}</bdi></p>
          {rec.stopReason === "limit" && <p className="sm-text" role="note" data-sm-note="limit">{t("captures.limitReached", { max: VOICE_RECORDING_POLICY.maxDurationSeconds })}</p>}
          {rec.stopReason === "background" && <p className="sm-text" role="note" data-sm-note="interrupted">{t("captures.interrupted")}</p>}
        </div>
      )}

      {!open && (
        <div className="sm-card" role="note" data-sm-note="write-closed" data-sm-write="voice.upload">
          <h2 className="sm-card-title">{t("captures.nextTitle")}</h2>
          <p className="sm-text sm-muted">{t("captures.voiceNext")}</p>
          <button type="button" className="sm-button" disabled data-sm-action="upload">{t("captures.sendRecording")}</button>
          <p className="sm-text sm-muted sm-fine">{t("captures.voiceUploadClosed")}</p>
          <Link className="sm-link-row" to={PATH.USER.FINANCIAL_OPERATIONS}>
            <span>{t("captures.voiceFull")}</span>
            <Chevron />
          </Link>
        </div>
      )}

      {open && ready && !settled && (
        <div className="sm-card" data-sm-write="voice.upload">
          <h2 className="sm-card-title">{t("captures.nextTitle")}</h2>
          <p className="sm-text sm-muted">{t("captures.voiceNextOpen")}</p>
          <div className="sm-actions">
            <button type="button" className="sm-button" onClick={uploadNow} disabled={send.uploading} aria-busy={send.uploading ? "true" : undefined} data-sm-action="upload" data-sm-open="true">
              {send.uploading ? t("captures.uploading") : t("captures.sendRecording")}
            </button>
            {send.uploading && (
              <button type="button" className="sm-button sm-button-quiet" onClick={send.cancel} data-sm-action="cancel-upload">{t("captures.uploadCancel")}</button>
            )}
          </div>
        </div>
      )}

      {open && settled && (
        <>
          <WriteOutcome outcome={send} outcomeRef={outcomeRef} backTo={MOBILE_CAPTURES} t={t} />
          {send.phase === "unknown" && (
            <div className="sm-actions sm-form-actions">
              <button type="button" className="sm-button" onClick={send.retry} data-sm-action="retry-upload">{t("captures.uploadRetry")}</button>
            </div>
          )}
        </>
      )}

      <MobileSheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} titleId={`${ids}-discard`} title={t("captures.discardRecordingTitle")} returnFocusRef={discardRef}>
        <p className="sm-text">{t("captures.discardRecordingBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={() => setConfirmDiscard(false)} data-sm-action="keep-recording">{t("captures.keepRecording")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={discard} data-sm-action="confirm-discard">{t("captures.discardRecording")}</button>
        </div>
      </MobileSheet>

      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("captures.discardRecordingTitle")}>
        <p className="sm-text">{t("captures.discardRecordingBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("captures.keepRecording")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </section>
  );
}
