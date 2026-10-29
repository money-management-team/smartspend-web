import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { MOBILE_CAPTURES, backPathFrom } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import { VOICE_MAX_BYTES, VOICE_MAX_SECONDS, VOICE_MIN_MS, localUrl, releaseUrl } from "./captureRules.js";

const browserMedia = () => ({
  getUserMedia: typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia ? (constraints) => navigator.mediaDevices.getUserMedia(constraints) : null,
  MediaRecorder: typeof window !== "undefined" ? window.MediaRecorder ?? null : null,
});

const clock = (ms) => {
  const seconds = Math.min(VOICE_MAX_SECONDS, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(1, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

/*
 * Recording an expense by voice, on this device only.
 *
 *   idle -> asking -> recording -> recorded
 *                \-> denied | unsupported | failed
 *
 * The microphone is asked for only when Record is tapped. A recording stops at
 * 60 seconds (the full version's limit; there is no pause, as there is none
 * there), when Stop is tapped, when the microphone goes away, and when the page
 * is hidden (an interrupted recording is kept and marked). It can be played back
 * here, recorded again or discarded. Sending it for transcription is a write
 * (POST /ai/voice-expense-captures) that Mobile does not make: Upload is
 * disabled and says why. Nothing is stored, and a recording never becomes an
 * expense by itself.
 *
 * `media` replaces the browser's microphone API in tests.
 */
export default function MobileVoiceNew({ media: injected }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const location = useLocation();
  const backTo = backPathFrom(location.state, MOBILE_CAPTURES);
  const media = useMemo(() => injected ?? browserMedia(), [injected]);
  const [phase, setPhase] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState(null); // { url, size, ms, interrupted, limit }
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const recorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const started = useRef(0);
  const reason = useRef(null);
  const timer = useRef(null);
  const discardRef = useRef(null);
  const guard = useLeaveGuard(phase === "recording" || clip !== null);
  const supported = Boolean(media.getUserMedia && media.MediaRecorder);

  const release = useCallback(() => {
    clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks?.().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback((why = "stopped") => {
    if (recorder.current?.state === "recording") {
      reason.current = why;
      recorder.current.stop();
    }
  }, []);

  // Leaving the page, or the page closing, ends the recording and frees the microphone.
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
  }, [release]);

  useEffect(() => () => releaseUrl(clip?.url), [clip]);

  useEffect(() => {
    if (phase !== "recording") return undefined;
    const hidden = () => document.visibilityState === "hidden" && stop("interrupted");
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [phase, stop]);

  const record = async () => {
    if (!supported) {
      setPhase("unsupported");
      return;
    }
    setPhase("asking");
    try {
      stream.current = await media.getUserMedia({ audio: true });
    } catch (error) {
      setPhase(error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "denied" : "failed");
      return;
    }
    chunks.current = [];
    reason.current = null;
    const next = new media.MediaRecorder(stream.current);
    recorder.current = next;
    next.ondataavailable = (event) => event.data?.size && chunks.current.push(event.data);
    next.onstop = () => {
      const ms = Date.now() - started.current;
      release();
      const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
      if (ms < VOICE_MIN_MS || blob.size < 1) {
        setClip(null);
        setPhase("tooShort");
        return;
      }
      setClip({ url: localUrl(blob), size: blob.size, ms, interrupted: reason.current === "interrupted", limit: reason.current === "limit", tooLarge: blob.size > VOICE_MAX_BYTES });
      setPhase("recorded");
    };
    stream.current.getTracks?.().forEach((track) => track.addEventListener?.("ended", () => stop("interrupted")));
    started.current = Date.now();
    setElapsed(0);
    next.start(250);
    setPhase("recording");
    timer.current = setInterval(() => {
      const ms = Date.now() - started.current;
      setElapsed(ms);
      if (ms >= VOICE_MAX_SECONDS * 1000) stop("limit");
    }, 250);
  };

  const discard = () => {
    setConfirmDiscard(false);
    setClip(null);
    setPhase("idle");
  };

  return (
    <section className="sm-page" data-sm-screen="voice-new" data-sm-phase={phase}>
      <Link className="sm-link-row sm-back" to={backTo}>
        <Chevron back />
        <span>{t("captures.back")}</span>
      </Link>
      <div className="sm-card">
        <h2 className="sm-card-title">{t("captures.voiceTitle")}</h2>
        <p className="sm-text sm-muted">{t("captures.voiceIntro")}</p>
        <p className="sm-text sm-muted sm-fine">{t("captures.voiceRules", { max: VOICE_MAX_SECONDS })}</p>

        {phase === "recording" ? (
          <div className="sm-recording" role="status" aria-live="polite" data-sm-recording="true">
            <span className="sm-recording-dot" aria-hidden="true" />
            <span className="sm-text">{t("captures.recording")}</span>
            <bdi dir="ltr" className="sm-recording-clock" aria-label={t("captures.elapsed", { time: clock(elapsed) })}>{clock(elapsed)} / {clock(VOICE_MAX_SECONDS * 1000)}</bdi>
          </div>
        ) : (
          <p className="sm-text" role="status" aria-live="polite" data-sm-status={phase}>{phase === "idle" || phase === "recorded" ? "" : t(`captures.voicePhase.${phase}`)}</p>
        )}

        <div className="sm-actions">
          {phase === "recording" ? (
            <button type="button" className="sm-button" onClick={() => stop("stopped")} data-sm-action="stop">{t("captures.stop")}</button>
          ) : (
            <button type="button" className="sm-button" onClick={record} disabled={phase === "asking" || phase === "unsupported"} data-sm-action="record">{t(clip ? "captures.recordAgain" : "captures.record")}</button>
          )}
          {clip && phase !== "recording" && <button type="button" ref={discardRef} className="sm-button sm-button-quiet" onClick={() => setConfirmDiscard(true)} data-sm-action="discard-recording">{t("captures.discardRecording")}</button>}
        </div>
      </div>

      {clip && (
        <div className="sm-card" data-sm-clip="recorded">
          <h2 className="sm-card-title">{t("captures.yourRecording")}</h2>
          {clip.url && <audio className="sm-audio" controls src={clip.url} aria-label={t("captures.playback")} />}
          <p className="sm-text sm-muted"><bdi dir="ltr">{clock(clip.ms)}</bdi></p>
          {clip.limit && <p className="sm-text" role="note" data-sm-note="limit">{t("captures.limitReached", { max: VOICE_MAX_SECONDS })}</p>}
          {clip.interrupted && <p className="sm-text" role="note" data-sm-note="interrupted">{t("captures.interrupted")}</p>}
          {clip.tooLarge && <p className="sm-text sm-form-error" role="note" data-sm-note="too-large">{t("captures.tooLarge")}</p>}
        </div>
      )}

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
