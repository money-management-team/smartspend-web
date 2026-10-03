import { VOICE_RECORDING_POLICY as POLICY } from "./voiceCaptureContract.js";
import { VoiceRecorderError, recordingToVoiceWav, voiceRecorderError } from "./voiceAudioWav.js";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
const RAW_MAX_BYTES = 8 * 1024 * 1024;
const PERMISSION_TIMEOUT_MS = 30_000;
const FINAL_CHUNK_TIMEOUT_MS = 15_000;
const CONVERSION_TIMEOUT_MS = 30_000;

function browserEnvironment() {
  const devices = globalThis.navigator?.mediaDevices;
  const document = globalThis.document;
  return {
    isSecureContext: globalThis.isSecureContext,
    getUserMedia: devices?.getUserMedia?.bind(devices),
    MediaRecorder: globalThis.MediaRecorder,
    AudioContext: globalThis.AudioContext ?? globalThis.webkitAudioContext,
    OfflineAudioContext: globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext,
    now: () => globalThis.performance?.now() ?? Date.now(),
    setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis), clearInterval: globalThis.clearInterval.bind(globalThis),
    createObjectURL: globalThis.URL?.createObjectURL?.bind(globalThis.URL),
    revokeObjectURL: globalThis.URL?.revokeObjectURL?.bind(globalThis.URL),
    document,
    convert: recordingToVoiceWav,
  };
}

export function getVoiceRecordingSupport(environment = browserEnvironment()) {
  if (environment.isSecureContext === false) return { supported: false, code: "VOICE_INSECURE" };
  const supported = ["getUserMedia", "MediaRecorder", "AudioContext", "OfflineAudioContext", "createObjectURL", "revokeObjectURL"]
    .every((name) => typeof environment[name] === "function");
  return { supported, code: supported ? null : "VOICE_UNSUPPORTED" };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

function microphoneError(error) {
  if (error instanceof VoiceRecorderError) return error;
  const name = error?.name;
  if (["NotAllowedError", "SecurityError"].includes(name)) return voiceRecorderError("VOICE_PERMISSION_DENIED");
  if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name)) return voiceRecorderError("VOICE_MIC_NOT_FOUND");
  if (["NotReadableError", "TrackStartError"].includes(name)) return voiceRecorderError("VOICE_MIC_BUSY");
  return voiceRecorderError("VOICE_RECORDING_FAILED");
}

/** Local recorder only. Each session owns its tracks, decoder, timers and worker fence. */
export function createVoiceRecorder(environment = browserEnvironment()) {
  const support = Object.freeze(getVoiceRecordingSupport(environment));
  const listeners = new Set();
  let active = null;
  let snapshot = Object.freeze({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null, support });

  const publish = (changes) => {
    snapshot = Object.freeze({ ...snapshot, ...changes });
    listeners.forEach((listener) => listener());
  };
  const current = (session) => active === session && !session.cancelled;
  const clearTimer = (session, name, interval = false) => {
    if (session[name] !== undefined) {
      (interval ? environment.clearInterval : environment.clearTimeout)(session[name]);
      delete session[name];
    }
  };
  const stopTracks = (session) => {
    for (const [track, listener] of session.trackListeners ?? []) track.removeEventListener?.("ended", listener);
    session.trackListeners = [];
    for (const track of session.stream?.getTracks() ?? []) {
      try { track.stop(); } catch { /* Continue closing other tracks. */ }
    }
  };
  const cleanup = (session) => {
    clearTimer(session, "ticker", true);
    for (const timer of ["permissionTimer", "limitTimer", "finalTimer", "conversionTimer"]) clearTimer(session, timer);
    environment.document?.removeEventListener("visibilitychange", session.onVisibility);
    if (session.recorder) {
      session.recorder.ondataavailable = null;
      session.recorder.onerror = null;
      session.recorder.onstop = null;
      if (session.recorder.state !== "inactive") {
        try { session.recorder.stop(); } catch { /* State can change during shutdown. */ }
      }
    }
    stopTracks(session);
    try { session.source?.disconnect(); } catch { /* Device may already have ended. */ }
    try { session.analyser?.disconnect(); } catch { /* Device may already have ended. */ }
    if (session.context && session.context.state !== "closed") {
      try { session.context.close()?.catch(() => {}); } catch { /* No unsafe exception text is logged. */ }
    }
    session.chunks = [];
  };
  const releasePreview = () => {
    if (snapshot.result?.previewUrl) environment.revokeObjectURL(snapshot.result.previewUrl);
  };
  const fail = (session, error) => {
    if (!current(session)) return;
    const safe = microphoneError(error);
    active = null;
    session.cancelled = true;
    session.abort.abort();
    cleanup(session);
    publish({ status: "error", level: 0, result: null, error: safe });
    session.start.reject(safe);
    session.finish?.reject(safe);
  };
  const elapsed = (session) => Math.max(0, Math.min(POLICY.maxDurationSeconds * 1000, environment.now() - session.startedAt));

  const finish = async (session) => {
    if (!current(session)) return;
    clearTimer(session, "finalTimer");
    if (snapshot.status !== "processing") {
      fail(session, voiceRecorderError("VOICE_MIC_INTERRUPTED"));
      return;
    }
    if (snapshot.elapsedMs < POLICY.minDurationMs || session.chunks.length === 0) {
      fail(session, voiceRecorderError("VOICE_TOO_SHORT"));
      return;
    }
    try {
      session.conversionTimer = environment.setTimeout(() => fail(session, voiceRecorderError("VOICE_CONVERSION_FAILED")), CONVERSION_TIMEOUT_MS);
      const raw = new Blob(session.chunks, { type: session.recorder.mimeType || session.chunks[0].type || "audio/webm" });
      session.chunks = [];
      const result = await environment.convert(raw, {
        audioContext: session.context, OfflineAudioContext: environment.OfflineAudioContext, signal: session.abort.signal,
      });
      if (!current(session)) return;
      const previewUrl = environment.createObjectURL(result.blob);
      active = null;
      cleanup(session);
      const ready = Object.freeze({ ...result, previewUrl });
      publish({ status: "ready", level: 0, result: ready, error: null, elapsedMs: result.durationMs });
      session.finish?.resolve(ready);
    } catch (error) {
      fail(session, error instanceof VoiceRecorderError ? error : voiceRecorderError("VOICE_CONVERSION_FAILED"));
    }
  };

  const stop = (reason = "user") => {
    const session = active;
    if (!session) return snapshot.status === "ready" ? Promise.resolve(snapshot.result) : Promise.reject(voiceRecorderError("VOICE_CANCELLED"));
    if (session.finish) return session.finish.promise;
    if (snapshot.status !== "recording") return Promise.reject(voiceRecorderError("VOICE_CANCELLED"));
    session.finish = deferred();
    clearTimer(session, "ticker", true);
    clearTimer(session, "limitTimer");
    environment.document?.removeEventListener("visibilitychange", session.onVisibility);
    publish({ status: "processing", elapsedMs: elapsed(session), level: 0, stopReason: reason });
    session.finalTimer = environment.setTimeout(() => fail(session, voiceRecorderError("VOICE_RECORDING_FAILED")), FINAL_CHUNK_TIMEOUT_MS);
    try { session.recorder.stop(); } catch (error) { fail(session, error); }
    stopTracks(session);
    return session.finish.promise;
  };

  const runStart = async (session) => {
    try {
      session.context = new environment.AudioContext();
      // Resume in the original click gesture. Decoding still works if playback is restricted.
      session.context.resume?.()?.catch(() => {});
      session.permissionTimer = environment.setTimeout(() => fail(session, voiceRecorderError("VOICE_PERMISSION_TIMEOUT")), PERMISSION_TIMEOUT_MS);
      const stream = await environment.getUserMedia({ audio: {
        channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      }, video: false });
      session.stream = stream;
      if (!current(session)) { stopTracks(session); return; }
      clearTimer(session, "permissionTimer");
      if (environment.document?.hidden) throw voiceRecorderError("VOICE_MIC_INTERRUPTED");
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0 || tracks.every((track) => track.readyState === "ended")) throw voiceRecorderError("VOICE_MIC_NOT_FOUND");
      session.trackListeners = tracks.map((track) => {
        const listener = () => fail(session, voiceRecorderError("VOICE_MIC_INTERRUPTED"));
        track.addEventListener?.("ended", listener);
        return [track, listener];
      });
      let mimeType;
      for (const type of MIME_TYPES) {
        if (environment.MediaRecorder.isTypeSupported?.(type)) { mimeType = type; break; }
      }
      session.recorder = new environment.MediaRecorder(stream, { audioBitsPerSecond: 96_000, ...(mimeType ? { mimeType } : {}) });
      session.recorder.ondataavailable = (event) => {
        if (!current(session) || !event.data?.size) return;
        session.rawBytes += event.data.size;
        if (session.rawBytes > RAW_MAX_BYTES) { fail(session, voiceRecorderError("VOICE_TOO_LARGE")); return; }
        session.chunks.push(event.data);
      };
      session.recorder.onerror = () => fail(session, voiceRecorderError("VOICE_RECORDING_FAILED"));
      session.recorder.onstop = () => { void finish(session); };
      try {
        session.source = session.context.createMediaStreamSource(stream);
        session.analyser = session.context.createAnalyser();
        session.analyser.fftSize = 1024;
        session.source.connect(session.analyser); // Never connect the microphone to speakers.
        session.meter = new Float32Array(session.analyser.fftSize);
      } catch { /* A missing meter must not block otherwise supported recording. */ }
      session.startedAt = environment.now();
      session.recorder.start(250);
      if (!current(session)) return;
      publish({ status: "recording", elapsedMs: 0 });
      session.limitTimer = environment.setTimeout(() => { void stop("limit").catch(() => {}); }, POLICY.maxDurationSeconds * 1000);
      session.ticker = environment.setInterval(() => {
        if (!current(session) || snapshot.status !== "recording") return;
        const elapsedMs = elapsed(session);
        if (elapsedMs >= POLICY.maxDurationSeconds * 1000) { void stop("limit").catch(() => {}); return; }
        let level = 0;
        try {
          session.analyser?.getFloatTimeDomainData(session.meter);
          if (session.meter) {
            const squareSum = session.meter.reduce((sum, value) => sum + value * value, 0);
            const rms = Math.sqrt(squareSum / session.meter.length);
            level = Number.isFinite(rms) ? Math.min(1, rms * 4) : 0;
          }
        } catch { /* Meter updates are optional, never a recording failure. */ }
        publish({ elapsedMs, level });
      }, 100);
      session.onVisibility = () => {
        if (current(session) && snapshot.status === "recording" && environment.document.hidden) void stop("background").catch(() => {});
      };
      environment.document?.addEventListener("visibilitychange", session.onVisibility);
      session.start.resolve(snapshot);
    } catch (error) {
      fail(session, error);
    }
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    start: () => {
      if (!support.supported) {
        const error = voiceRecorderError(support.code);
        publish({ status: "error", error });
        return Promise.reject(error);
      }
      if (active) return snapshot.status === "requesting" || snapshot.status === "recording"
        ? active.start.promise : Promise.reject(voiceRecorderError("VOICE_RECORDING_BUSY"));
      releasePreview();
      const session = { start: deferred(), chunks: [], rawBytes: 0, abort: new AbortController(), cancelled: false };
      active = session;
      publish({ status: "requesting", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null });
      void runStart(session);
      return session.start.promise;
    },
    stop,
    cancel: () => {
      const session = active;
      active = null;
      if (session) {
        session.cancelled = true;
        session.abort.abort();
        cleanup(session);
        const error = voiceRecorderError("VOICE_CANCELLED");
        session.start.reject(error);
        session.finish?.reject(error);
      }
      releasePreview();
      publish({ status: "idle", elapsedMs: 0, level: 0, result: null, error: null, stopReason: null });
    },
  });
}
