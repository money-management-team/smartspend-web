import { VOICE_RECORDING_POLICY as POLICY } from "./voiceCaptureContract.js";

const RAW_MAX_BYTES = 8 * 1024 * 1024;

export class VoiceRecorderError extends Error {
  constructor(code) {
    super("The voice recording could not complete.");
    this.name = "VoiceRecorderError";
    this.code = code;
  }
}

export const voiceRecorderError = (code) => new VoiceRecorderError(code);

function checkCancellation(signal) {
  if (signal?.aborted) throw voiceRecorderError("VOICE_CANCELLED");
}

/** Canonical RIFF/WAVE: one fmt chunk, one data chunk, PCM16 mono 24000 Hz. */
export function encodeVoiceWav(samples) {
  if (!(samples instanceof Float32Array)) throw voiceRecorderError("VOICE_CONVERSION_FAILED");
  const minimum = POLICY.sampleRate * POLICY.minDurationMs / 1000;
  const maximum = POLICY.sampleRate * POLICY.maxDurationSeconds;
  if (samples.length < minimum) throw voiceRecorderError("VOICE_TOO_SHORT");
  if (samples.length > maximum) throw voiceRecorderError("VOICE_TOO_LONG");
  const dataBytes = samples.length * 2;
  if (dataBytes + 44 > POLICY.maxBytes) throw voiceRecorderError("VOICE_TOO_LARGE");

  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const tag = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF"); view.setUint32(4, 36 + dataBytes, true); tag(8, "WAVE");
  tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, POLICY.sampleRate, true);
  view.setUint32(28, POLICY.sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    if (!Number.isFinite(samples[i])) throw voiceRecorderError("VOICE_CONVERSION_FAILED");
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

/** Decode the browser container, downmix explicitly, resample and bound actual frames. */
export async function recordingToVoiceWav(blob, {
  audioContext,
  AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  OfflineAudioContext = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext,
  signal,
} = {}) {
  checkCancellation(signal);
  if (!(blob instanceof Blob) || blob.size === 0) throw voiceRecorderError("VOICE_TOO_SHORT");
  if (blob.size > RAW_MAX_BYTES) throw voiceRecorderError("VOICE_TOO_LARGE");
  if (typeof OfflineAudioContext !== "function" || (!audioContext && typeof AudioContext !== "function")) {
    throw voiceRecorderError("VOICE_UNSUPPORTED");
  }
  let context = audioContext;
  try {
    context ??= new AudioContext();
    const buffer = await blob.arrayBuffer();
    checkCancellation(signal);
    const decoded = await context.decodeAudioData(buffer);
    checkCancellation(signal);
    const { sampleRate, length, numberOfChannels } = decoded;
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
        !Number.isSafeInteger(length) || length < 1 ||
        !Number.isSafeInteger(numberOfChannels) || numberOfChannels < 1 || numberOfChannels > 8) {
      throw voiceRecorderError("VOICE_CONVERSION_FAILED");
    }
    if (length * 1000 < POLICY.minDurationMs * sampleRate) throw voiceRecorderError("VOICE_TOO_SHORT");
    const frames = Math.min(length, Math.floor(sampleRate * POLICY.maxDurationSeconds));
    const outputFrames = Math.min(POLICY.sampleRate * POLICY.maxDurationSeconds, Math.floor(frames * POLICY.sampleRate / sampleRate));
    const mono = new Float32Array(frames);
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const input = decoded.getChannelData(channel);
      if (!(input instanceof Float32Array) || input.length < frames) throw voiceRecorderError("VOICE_CONVERSION_FAILED");
      for (let i = 0; i < frames; i += 1) {
        if (!Number.isFinite(input[i])) throw voiceRecorderError("VOICE_CONVERSION_FAILED");
        mono[i] += input[i] / numberOfChannels;
      }
    }
    checkCancellation(signal);
    const offline = new OfflineAudioContext(1, outputFrames, POLICY.sampleRate);
    const input = offline.createBuffer(1, frames, sampleRate);
    input.getChannelData(0).set(mono);
    const source = offline.createBufferSource();
    source.buffer = input;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    checkCancellation(signal);
    if (rendered.sampleRate !== POLICY.sampleRate || rendered.numberOfChannels !== 1 || rendered.length !== outputFrames) {
      throw voiceRecorderError("VOICE_CONVERSION_FAILED");
    }
    const bytes = encodeVoiceWav(rendered.getChannelData(0));
    return Object.freeze({
      blob: new Blob([bytes], { type: "audio/wav" }),
      durationMs: Math.ceil(outputFrames * 1000 / POLICY.sampleRate),
      byteLength: bytes.length,
      wasTrimmed: frames < length,
    });
  } catch (error) {
    if (signal?.aborted) throw voiceRecorderError("VOICE_CANCELLED");
    throw error instanceof VoiceRecorderError ? error : voiceRecorderError("VOICE_CONVERSION_FAILED");
  } finally {
    if (!audioContext && context?.state !== "closed") {
      try { await context?.close(); } catch { /* No device/provider details escape. */ }
    }
  }
}
