/*
 * The limits for a receipt photo and a voice recording, restated here because
 * Mobile does not import the full version's feature code (AiExpenseCaptures/
 * captureConstants.js, FinancialOperations/voiceCaptureContract.js);
 * tests/mobileAssist.test.mjs keeps them in step.
 *
 * Receipt types are what the backend accepts, not what the full version's picker
 * lists: AiCaptureFileGuard (fix/financial-idempotency-p0 @ 6b696d72) allows only
 * jpeg, png and webp, so a HEIC/HEIF photo would be refused after the upload.
 * Mobile refuses it before anything is sent, with its own message
 * (receiptFileError "heic").
 */
export const RECEIPT_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MIN_MS = 500;
export const VOICE_MAX_BYTES = 4 * 1024 * 1024;

const BY_EXTENSION = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const HEIC_TYPE = /^image\/hei[cf](?:-sequence)?$/;
const HEIC_EXTENSION = /\.hei[cf]$/i;

/** A HEIC/HEIF photo, by its type or by its name (some phones send it with no type, or a generic one). */
export const isHeic = (file) => HEIC_TYPE.test(String(file?.type ?? "").toLowerCase()) || HEIC_EXTENSION.test(String(file?.name ?? ""));

/** "empty" | "heic" | "type" | "size" | null. A file with no type is judged by its extension. */
export function receiptFileError(file) {
  if (!file || file.size < 1) return "empty";
  if (isHeic(file)) return "heic";
  const type = (file.type || BY_EXTENSION[String(file.name ?? "").split(".").pop()?.toLowerCase()] || "").toLowerCase();
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
