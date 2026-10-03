import test from "node:test";
import assert from "node:assert/strict";
import { encodeVoiceWav, recordingToVoiceWav } from "../src/features/Dashboards/User/FinancialOperations/voiceAudioWav.js";
import { createVoiceRecorder, getVoiceRecordingSupport } from "../src/features/Dashboards/User/FinancialOperations/voiceRecorder.js";

const code = (expected) => (error) => error?.code === expected;
const raw = () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 16; i += 1) await Promise.resolve(); };
const textAt = (bytes, offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));

function conversionHarness({ sampleRate = 48000, length = 48000, channels = 2, decodeError, decodeWait, renderWait, renderedRate = 24000 } = {}) {
  const inputs = Array.from({ length: channels }, (_, i) => new Float32Array(length).fill(i === 0 ? 0.75 : -0.25));
  const decoded = { sampleRate, length, numberOfChannels: channels, getChannelData: (i) => inputs[i] };
  const contexts = [], offlines = [];
  class AudioContext {
    constructor() { this.state = "running"; this.closes = 0; contexts.push(this); }
    async decodeAudioData() { if (decodeError) throw decodeError; if (decodeWait) await decodeWait.promise; return decoded; }
    async close() { this.state = "closed"; this.closes += 1; }
  }
  class OfflineAudioContext {
    constructor(count, frames, rate) { Object.assign(this, { count, frames, rate, destination: {} }); offlines.push(this); }
    createBuffer(count, frames, rate) { this.input = { count, frames, rate, values: new Float32Array(frames), getChannelData() { return this.values; } }; return this.input; }
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() {
      if (renderWait) await renderWait.promise;
      const output = new Float32Array(this.frames);
      for (let i = 0; i < output.length; i += 1) output[i] = this.input.values[Math.min(this.input.frames - 1, Math.floor(i * this.input.rate / this.rate))];
      return { sampleRate: renderedRate, numberOfChannels: this.count, length: this.frames, getChannelData: () => output };
    }
  }
  return { AudioContext, OfflineAudioContext, inputs, decoded, contexts, offlines };
}

class Clock {
  time = 0; sequence = 0; tasks = new Map();
  add(fn, milliseconds, repeat = false) { const id = ++this.sequence; this.tasks.set(id, { fn, delay: milliseconds, at: this.time + milliseconds, repeat }); return id; }
  clear(id) { this.tasks.delete(id); }
  advance(milliseconds) {
    const end = this.time + milliseconds;
    for (;;) {
      const next = [...this.tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, task] = next; this.time = task.at;
      if (task.repeat) task.at += task.delay; else this.tasks.delete(id);
      task.fn();
    }
    this.time = end;
  }
}
function recorderHarness(options = {}) {
  const clock = new Clock(), records = [], contexts = [], urls = [], revoked = [], conversions = [], constraints = [];
  let permissions = 0;
  class Track extends EventTarget { readyState = "live"; stop() { this.readyState = "ended"; } }
  const track = new Track();
  const stream = { getTracks: () => [track], getAudioTracks: () => options.noTracks ? [] : [track] };
  class Document extends EventTarget { hidden = false; }
  const document = new Document();
  class AudioContext {
    constructor() { this.state = "running"; contexts.push(this); }
    async resume() {}
    async close() { this.state = "closed"; }
    createMediaStreamSource() { if (options.noMeter) throw new Error("private device detail"); return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 1024, disconnect() {}, getFloatTimeDomainData: (buffer) => buffer.fill(options.meterValue ?? 0.125) }; }
  }
  class MediaRecorder {
    static isTypeSupported(type) { return options.mime ? type === options.mime : type === "audio/webm;codecs=opus"; }
    constructor(source, settings) { this.stream = source; this.settings = settings; this.mimeType = settings.mimeType || "audio/webm"; this.state = "inactive"; this.starts = 0; this.stops = 0; records.push(this); }
    start(timeslice) { this.timeslice = timeslice; this.state = "recording"; this.starts += 1; }
    stop() {
      this.stops += 1; this.state = "inactive";
      if (options.noFinalEvent) return;
      queueMicrotask(() => { if (!options.noData) this.ondataavailable?.({ data: raw() }); this.onstop?.(); });
    }
  }
  const env = {
    isSecureContext: options.secure ?? true,
    getUserMedia: (value) => { permissions += 1; constraints.push(value); return options.permission ? options.permission.promise : Promise.resolve(stream); },
    MediaRecorder, AudioContext, OfflineAudioContext: class {}, document,
    now: () => clock.time,
    setTimeout: (fn, delay) => clock.add(fn, delay), clearTimeout: (id) => clock.clear(id),
    setInterval: (fn, delay) => clock.add(fn, delay, true), clearInterval: (id) => clock.clear(id),
    createObjectURL: (blob) => { const url = `blob:local-${urls.length + 1}`; urls.push({ blob, url }); return url; },
    revokeObjectURL: (url) => revoked.push(url),
    convert: async (blob, settings) => {
      conversions.push({ blob, settings, trackState: track.readyState });
      if (options.conversion) await options.conversion.promise;
      if (options.convertError) throw options.convertError;
      const output = new Blob([encodeVoiceWav(new Float32Array(24000))], { type: "audio/wav" });
      return { blob: output, durationMs: 1000, byteLength: output.size, wasTrimmed: false };
    },
  };
  if (options.unsupported) delete env[options.unsupported];
  const recorder = createVoiceRecorder(env);
  return { recorder, env, clock, records, contexts, urls, revoked, conversions, constraints, track, stream, document, get permissions() { return permissions; } };
}

// Bytes checked against the backend's strict WAV policy, including actual frame duration.
test("WAV has one PCM16 mono 24000 Hz data chunk with no trailing bytes", () => {
  const bytes = encodeVoiceWav(new Float32Array(24000));
  const view = new DataView(bytes.buffer);
  assert.equal(textAt(bytes, 0, 4), "RIFF"); assert.equal(textAt(bytes, 8, 4), "WAVE");
  assert.equal(textAt(bytes, 12, 4), "fmt "); assert.equal(textAt(bytes, 36, 4), "data");
  assert.equal(view.getUint32(4, true) + 8, bytes.length);
  assert.equal(view.getUint32(16, true), 16); assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1); assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint32(28, true), 48000); assert.equal(view.getUint16(32, true), 2);
  assert.equal(view.getUint16(34, true), 16); assert.equal(view.getUint32(40, true) + 44, bytes.length);
  assert.equal(Math.ceil(view.getUint32(40, true) * 1000 / 48000), 1000);
});
test("exactly half a second and exactly sixty seconds fit the server limits", () => {
  assert.equal(encodeVoiceWav(new Float32Array(12000)).length, 24044);
  assert.equal(encodeVoiceWav(new Float32Array(1440000)).length, 2880044);
});
test("one frame outside either duration boundary is refused", () => {
  assert.throws(() => encodeVoiceWav(new Float32Array(11999)), code("VOICE_TOO_SHORT"));
  assert.throws(() => encodeVoiceWav(new Float32Array(1440001)), code("VOICE_TOO_LONG"));
});
test("samples are clipped and encoded as signed little endian PCM", () => {
  const input = new Float32Array(12000); input.set([-2, -1, -0.5, 0, 0.5, 1, 2]);
  const view = new DataView(encodeVoiceWav(input).buffer);
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => view.getInt16(44 + 2 * i, true)), [-32768, -32768, -16384, 0, 16384, 32767, 32767]);
});
test("nonfinite samples and non float buffers cannot enter a WAV", () => {
  const input = new Float32Array(12000); input[7] = NaN;
  assert.throws(() => encodeVoiceWav(input), code("VOICE_CONVERSION_FAILED"));
  input[7] = Infinity; assert.throws(() => encodeVoiceWav(input), code("VOICE_CONVERSION_FAILED"));
  assert.throws(() => encodeVoiceWav(new Uint8Array(12000)), code("VOICE_CONVERSION_FAILED"));
});
test("stereo is explicitly averaged before conversion to mono 24000 Hz", async () => {
  const harness = conversionHarness(); const result = await recordingToVoiceWav(raw(), harness);
  assert.equal(harness.offlines[0].count, 1); assert.equal(harness.offlines[0].rate, 24000);
  assert.equal(harness.offlines[0].input.rate, 48000); assert.equal(harness.offlines[0].input.values[100], 0.25);
  assert.equal(result.blob.type, "audio/wav"); assert.equal(result.durationMs, 1000); assert.equal(result.wasTrimmed, false);
  assert.equal(harness.contexts[0].closes, 1);
});
test("44100 Hz duration is based on resampled frames rather than a timer", async () => {
  const result = await recordingToVoiceWav(raw(), conversionHarness({ sampleRate: 44100, length: 44101, channels: 1 }));
  assert.equal(result.byteLength, 48044); assert.equal(result.durationMs, 1000);
});
test("encoder padding is trimmed to sixty seconds of actual samples", async () => {
  const result = await recordingToVoiceWav(raw(), conversionHarness({ sampleRate: 24000, length: 1441200, channels: 1 }));
  assert.equal(result.wasTrimmed, true); assert.equal(result.durationMs, 60000); assert.equal(result.byteLength, 2880044);
});
test("too short decoded audio is refused even if a timer indicated a longer recording", async () => {
  await assert.rejects(recordingToVoiceWav(raw(), conversionHarness({ length: 23999, channels: 1 })), code("VOICE_TOO_SHORT"));
});
test("empty and oversized containers are refused before decoding", async () => {
  await assert.rejects(recordingToVoiceWav(new Blob(), conversionHarness()), code("VOICE_TOO_SHORT"));
  const h = conversionHarness(); await assert.rejects(recordingToVoiceWav(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]), h), code("VOICE_TOO_LARGE"));
  assert.equal(h.contexts.length, 0);
});
test("invalid decoded rate channel count and samples are refused", async () => {
  for (const settings of [{ sampleRate: 7999 }, { channels: 9 }]) {
    await assert.rejects(recordingToVoiceWav(raw(), conversionHarness(settings)), code("VOICE_CONVERSION_FAILED"));
  }
  const h = conversionHarness(); h.inputs[0][0] = Infinity;
  await assert.rejects(recordingToVoiceWav(raw(), h), code("VOICE_CONVERSION_FAILED"));
});
test("a decoder exception is sanitized and an owned context is still closed", async () => {
  const h = conversionHarness({ decodeError: new Error("private device detail") });
  await assert.rejects(recordingToVoiceWav(raw(), h), (error) => error.code === "VOICE_CONVERSION_FAILED" && !error.message.includes("private"));
  assert.equal(h.contexts[0].closes, 1);
});
test("the recorder owns its supplied context and the converter does not close it", async () => {
  const h = conversionHarness(); const context = new h.AudioContext();
  await recordingToVoiceWav(raw(), { ...h, audioContext: context }); assert.equal(context.closes, 0);
});
test("cancellation before decoding prevents work and cancellation after decoding closes resources", async () => {
  const abort = new AbortController(); abort.abort(); const first = conversionHarness();
  await assert.rejects(recordingToVoiceWav(raw(), { ...first, signal: abort.signal }), code("VOICE_CANCELLED")); assert.equal(first.contexts.length, 0);
  const wait = deferred(), second = conversionHarness({ decodeWait: wait }), secondAbort = new AbortController();
  const pending = recordingToVoiceWav(raw(), { ...second, signal: secondAbort.signal }); const rejection = assert.rejects(pending, code("VOICE_CANCELLED"));
  await flush(); secondAbort.abort(); wait.resolve(); await rejection;
  assert.equal(second.offlines.length, 0); assert.equal(second.contexts[0].closes, 1);
});
test("cancellation after offline rendering cannot create a result", async () => {
  const wait = deferred(), h = conversionHarness({ renderWait: wait }), abort = new AbortController();
  const pending = recordingToVoiceWav(raw(), { ...h, signal: abort.signal }); const rejected = assert.rejects(pending, code("VOICE_CANCELLED"));
  await flush(); abort.abort(); wait.resolve(); await rejected; assert.equal(h.contexts[0].closes, 1);
});
test("an unexpected offline output rate is rejected", async () => {
  await assert.rejects(recordingToVoiceWav(raw(), conversionHarness({ renderedRate: 44100 })), code("VOICE_CONVERSION_FAILED"));
});

// Deterministic device/timer tests: no network, OpenAI call, account balance or quota mutation.
test("insecure and unsupported environments never request the microphone", async () => {
  for (const options of [{ secure: false }, { unsupported: "MediaRecorder" }, { unsupported: "OfflineAudioContext" }]) {
    const h = recorderHarness(options); const expected = options.secure === false ? "VOICE_INSECURE" : "VOICE_UNSUPPORTED";
    assert.equal(getVoiceRecordingSupport(h.env).supported, false); await assert.rejects(h.recorder.start(), code(expected)); assert.equal(h.permissions, 0);
  }
});
test("duplicate starts share one microphone request and one recorder", async () => {
  const permission = deferred(), h = recorderHarness({ permission });
  const a = h.recorder.start(), b = h.recorder.start(); assert.equal(a, b); permission.resolve(h.stream); await a;
  assert.equal(h.permissions, 1); assert.equal(h.records.length, 1); assert.equal(h.records[0].starts, 1);
  assert.equal(h.records[0].timeslice, 250); assert.equal(h.constraints[0].video, false); h.recorder.cancel();
});
test("cancelled permission cannot reactivate a late microphone", async () => {
  const permission = deferred(), h = recorderHarness({ permission }); const rejected = assert.rejects(h.recorder.start(), code("VOICE_CANCELLED"));
  h.recorder.cancel(); await rejected; permission.resolve(h.stream); await flush();
  assert.equal(h.track.readyState, "ended"); assert.equal(h.records.length, 0); assert.equal(h.recorder.getSnapshot().status, "idle"); assert.equal(h.clock.tasks.size, 0);
});
test("permission timeout also closes a stream that arrives later", async () => {
  const permission = deferred(), h = recorderHarness({ permission }); const rejected = assert.rejects(h.recorder.start(), code("VOICE_PERMISSION_TIMEOUT"));
  h.clock.advance(30000); await rejected; permission.resolve(h.stream); await flush();
  assert.equal(h.track.readyState, "ended"); assert.equal(h.recorder.getSnapshot().error.code, "VOICE_PERMISSION_TIMEOUT");
});
test("permission device and busy failures use safe messages", async () => {
  for (const [name, expected] of [["NotAllowedError", "VOICE_PERMISSION_DENIED"], ["NotFoundError", "VOICE_MIC_NOT_FOUND"], ["NotReadableError", "VOICE_MIC_BUSY"], ["Unknown", "VOICE_RECORDING_FAILED"]]) {
    const permission = deferred(), h = recorderHarness({ permission }); const rejected = assert.rejects(h.recorder.start(), code(expected));
    permission.reject(Object.assign(new Error("private system path"), { name })); await rejected;
    assert.equal(h.contexts[0].state, "closed"); assert.equal(h.clock.tasks.size, 0); assert.equal(h.recorder.getSnapshot().error.message.includes("private"), false);
  }
});
test("stopping closes the microphone before conversion and duplicate stops share one result", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.clock.advance(1200);
  const a = h.recorder.stop(), b = h.recorder.stop(); assert.equal(a, b); assert.equal(h.track.readyState, "ended");
  const result = await a; assert.equal(h.conversions[0].trackState, "ended"); assert.equal(h.records[0].stops, 1);
  assert.equal(h.conversions.length, 1); assert.equal(result.blob.type, "audio/wav"); assert.equal(result.previewUrl, "blob:local-1");
  assert.equal(h.recorder.getSnapshot().status, "ready"); assert.equal(h.contexts[0].state, "closed"); assert.equal(h.clock.tasks.size, 0);
});
test("sixty seconds stops automatically and never exposes an elapsed value above the limit", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.clock.advance(60000);
  assert.equal(h.track.readyState, "ended"); assert.equal(h.recorder.getSnapshot().elapsedMs, 60000);
  await flush(); assert.equal(h.recorder.getSnapshot().status, "ready"); assert.equal(h.recorder.getSnapshot().stopReason, "limit"); assert.equal(h.records[0].stops, 1);
});
test("hiding the document stops recording and removes its listener", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.clock.advance(1500); h.document.hidden = true; h.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(h.track.readyState, "ended"); await flush(); assert.equal(h.recorder.getSnapshot().stopReason, "background");
  h.document.dispatchEvent(new Event("visibilitychange")); assert.equal(h.records[0].stops, 1);
});
test("a device ending unexpectedly releases all recording resources", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.track.dispatchEvent(new Event("ended"));
  assert.equal(h.recorder.getSnapshot().error.code, "VOICE_MIC_INTERRUPTED"); assert.equal(h.track.readyState, "ended"); assert.equal(h.clock.tasks.size, 0);
});
test("cancel during conversion fences a late result and releases the decoder", async () => {
  const conversion = deferred(), h = recorderHarness({ conversion }); await h.recorder.start(); h.clock.advance(1000);
  const rejected = assert.rejects(h.recorder.stop(), code("VOICE_CANCELLED")); await flush(); h.recorder.cancel(); await rejected;
  conversion.resolve(); await flush(); assert.equal(h.recorder.getSnapshot().status, "idle"); assert.equal(h.urls.length, 0);
  assert.equal(h.conversions[0].settings.signal.aborted, true); assert.equal(h.contexts[0].state, "closed");
});
test("a conversion timeout cannot be overwritten by a late result", async () => {
  const conversion = deferred(), h = recorderHarness({ conversion }); await h.recorder.start(); h.clock.advance(1000);
  const rejected = assert.rejects(h.recorder.stop(), code("VOICE_CONVERSION_FAILED")); await flush(); h.clock.advance(30000); await rejected;
  conversion.resolve(); await flush(); assert.equal(h.urls.length, 0); assert.equal(h.recorder.getSnapshot().status, "error");
});
test("a new session stays active when an old cancelled permission resolves", async () => {
  const permission = deferred(), h = recorderHarness({ permission }); const rejected = assert.rejects(h.recorder.start(), code("VOICE_CANCELLED"));
  h.recorder.cancel(); await rejected; h.env.getUserMedia = () => Promise.resolve(h.stream); await h.recorder.start();
  const oldTrack = { stopped: false, stop() { this.stopped = true; } }; permission.resolve({ getTracks: () => [oldTrack] }); await flush();
  assert.equal(oldTrack.stopped, true); assert.equal(h.recorder.getSnapshot().status, "recording"); assert.equal(h.track.readyState, "live"); h.recorder.cancel();
});
test("cancel and restart support StrictMode cleanup without making the engine unusable", async () => {
  const h = recorderHarness(); h.recorder.cancel(); h.recorder.cancel(); await h.recorder.start(); assert.equal(h.recorder.getSnapshot().status, "recording"); h.recorder.cancel();
  assert.equal(h.track.readyState, "ended"); assert.equal(h.recorder.getSnapshot().status, "idle"); assert.equal(h.clock.tasks.size, 0);
});
test("playback object URLs are revoked on deletion and before a new recording", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.clock.advance(1000); await h.recorder.stop(); h.recorder.cancel();
  assert.deepEqual(h.revoked, ["blob:local-1"]);
  const second = recorderHarness(); await second.recorder.start(); second.clock.advance(1000); await second.recorder.stop();
  // A fresh device stream represents the next permission grant.
  second.env.getUserMedia = () => Promise.resolve({ getTracks: () => [], getAudioTracks: () => [] });
  await assert.rejects(second.recorder.start(), code("VOICE_MIC_NOT_FOUND")); assert.deepEqual(second.revoked, ["blob:local-1"]);
});
test("too short recordings and missing final audio never invoke conversion", async () => {
  for (const options of [{}, { noData: true }]) {
    const h = recorderHarness(options); await h.recorder.start(); h.clock.advance(options.noData ? 1000 : 499);
    await assert.rejects(h.recorder.stop(), code("VOICE_TOO_SHORT")); assert.equal(h.conversions.length, 0); assert.equal(h.clock.tasks.size, 0);
  }
});
test("missing final recorder events time out with the microphone already stopped", async () => {
  const h = recorderHarness({ noFinalEvent: true }); await h.recorder.start(); h.clock.advance(1000);
  const rejected = assert.rejects(h.recorder.stop(), code("VOICE_RECORDING_FAILED")); assert.equal(h.track.readyState, "ended");
  h.clock.advance(15000); await rejected; assert.equal(h.clock.tasks.size, 0);
});
test("raw browser chunks are bounded before conversion", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.records[0].ondataavailable({ data: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]) });
  assert.equal(h.recorder.getSnapshot().error.code, "VOICE_TOO_LARGE"); assert.equal(h.track.readyState, "ended"); assert.equal(h.conversions.length, 0);
});
test("MP4 is selected when the browser does not offer WebM", async () => {
  const h = recorderHarness({ mime: "audio/mp4" }); await h.recorder.start(); assert.equal(h.records[0].settings.mimeType, "audio/mp4"); h.recorder.cancel();
});
test("live volume uses microphone data and invalid meter data stays finite", async () => {
  const h = recorderHarness(); await h.recorder.start(); h.clock.advance(100); assert.equal(h.recorder.getSnapshot().level, 0.5); h.recorder.cancel();
  const bad = recorderHarness({ meterValue: NaN }); await bad.recorder.start(); bad.clock.advance(100); assert.equal(bad.recorder.getSnapshot().level, 0); bad.recorder.cancel();
});
test("a missing sound meter does not prevent recording", async () => {
  const h = recorderHarness({ noMeter: true }); await h.recorder.start(); h.clock.advance(1000); assert.equal(h.recorder.getSnapshot().level, 0); await h.recorder.stop(); assert.equal(h.recorder.getSnapshot().status, "ready");
});
test("subscribers receive stable snapshots and can unsubscribe", async () => {
  const h = recorderHarness(); let calls = 0; const initial = h.recorder.getSnapshot(); const unsubscribe = h.recorder.subscribe(() => { calls += 1; });
  assert.equal(initial, h.recorder.getSnapshot()); await h.recorder.start(); assert.equal(Object.isFrozen(h.recorder.getSnapshot()), true); assert.equal(calls, 2);
  unsubscribe(); h.recorder.cancel(); assert.equal(calls, 2);
});
test("a second start during conversion is rejected without replacing the current session", async () => {
  const conversion = deferred(), h = recorderHarness({ conversion }); await h.recorder.start(); h.clock.advance(1000); const stopping = h.recorder.stop();
  await assert.rejects(h.recorder.start(), code("VOICE_RECORDING_BUSY")); assert.equal(h.permissions, 1); conversion.resolve(); await stopping;
});
