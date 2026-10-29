/*
 * The full version's limits for a receipt photo (AiExpenseCaptures/captureConstants.js)
 * and a voice recording (FinancialOperations/voiceCaptureContract.js), restated
 * here because Mobile does not import the full version's feature code;
 * tests/mobileCaptures.test.mjs keeps them equal.
 */
export const RECEIPT_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp", "image/heic"]);
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MIN_MS = 500;
export const VOICE_MAX_BYTES = 4 * 1024 * 1024;

const BY_EXTENSION = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };

/** "empty" | "type" | "size" | null. A file with no type (some phones send HEIC like that) is judged by its extension. */
export function receiptFileError(file) {
  if (!file || file.size < 1) return "empty";
  const type = file.type || BY_EXTENSION[String(file.name ?? "").split(".").pop()?.toLowerCase()] || "";
  if (!RECEIPT_TYPES.includes(type)) return "type";
  return file.size > RECEIPT_MAX_BYTES ? "size" : null;
}

/** A local address for a file or recording on this device, or null when the browser can't make one (no preview, never a crash). */
export function localUrl(blob) {
  try {
    return typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export function releaseUrl(url) {
  try {
    if (url) URL.revokeObjectURL(url);
  } catch {
    /* Nothing to release. */
  }
}
