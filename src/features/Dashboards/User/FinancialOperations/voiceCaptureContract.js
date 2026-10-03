import { ApiError, createIdempotencyKey } from "../api/apiClient.js";
import { parseAiInputQuota } from "../api/aiInputQuotasApi.js";

// Server input policy: the recording adapter added next must produce this WAV.
export const VOICE_RECORDING_POLICY = Object.freeze({
  maxDurationSeconds: 60, minDurationMs: 500, maxBytes: 4 * 1024 * 1024,
  sampleRate: 24_000, channels: 1, bitsPerSample: 16,
});

export const VOICE_CAPTURE_STATUSES = Object.freeze([
  "uploaded", "queued", "processing", "ready_for_review", "confirmed", "failed", "discarded",
]);
const EDITABLE_FIELDS = [
  "account_id", "category_id", "merchant_name", "amount", "currency_code",
  "transaction_date", "transaction_time", "reference_number", "description",
];
const TEXT_LIMITS = { merchant_name: 191, reference_number: 120, description: 500 };
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function voiceInputError(field, message) {
  return new ApiError("Invalid voice capture request.", {
    code: "VOICE_INPUT_INVALID", errors: { [field]: [message] },
  });
}

export function requireVoiceId(value, field = "capture_id") {
  const number = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 1) {
    throw voiceInputError(field, "A positive integer identifier is required.");
  }
  return number;
}

function reviewVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw voiceInputError("review_version", "Use the review version returned by the server.");
  }
  return value;
}

/** Create ONCE per logical upload/retry/confirmation; keep it after uncertain results. */
export function createVoiceAttempt(action) {
  if (!["upload", "retry", "confirm"].includes(action)) {
    throw voiceInputError("action", "Unknown voice capture action.");
  }
  return Object.freeze({ action, idempotencyKey: createIdempotencyKey(`voice-${action}`) });
}

/** Exact decimal normalization, including Arabic/Persian digits; never uses floats. */
export function normalizeVoiceAmount(value) {
  if (typeof value !== "string") {
    throw voiceInputError("amount", "The amount must be a decimal string.");
  }
  const text = value.trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) {
    throw voiceInputError("amount", "Use a positive decimal with at most four decimal places.");
  }
  const [rawInteger, fraction = ""] = text.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  if (integer.length > 15 || !/[1-9]/.test(integer + fraction)) {
    throw voiceInputError("amount", "The amount must be positive and fit DECIMAL(19,4).");
  }
  return `${integer}.${fraction.padEnd(4, "0")}`;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function editableValue(field, value) {
  if (value === null || value === "") return null;
  if (field === "account_id" || field === "category_id") return requireVoiceId(value, field);
  if (field === "amount") return normalizeVoiceAmount(value);
  if (typeof value !== "string") throw voiceInputError(field, "Use text or null for this field.");
  const text = value.trim();
  if (!text) return null;
  if (field === "currency_code") {
    if (!/^[A-Za-z]{3}$/.test(text)) throw voiceInputError(field, "Use a three-letter currency code.");
    return text.toUpperCase();
  }
  if (field === "transaction_date" && !validDate(text)) {
    throw voiceInputError(field, "Use a valid calendar date in YYYY-MM-DD format.");
  }
  if (field === "transaction_time" && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) {
    throw voiceInputError(field, "Use a valid local time in HH:MM or HH:MM:SS format.");
  }
  if (TEXT_LIMITS[field] && [...text].length > TEXT_LIMITS[field]) {
    throw voiceInputError(field, `This field exceeds ${TEXT_LIMITS[field]} characters.`);
  }
  return text;
}

/** Partial PATCH: omitted fields stay omitted; ownership/speech/state never travel. */
export function buildVoiceReviewPayload(values, version) {
  if (!isRecord(values)) throw voiceInputError("draft", "A review field object is required.");
  const payload = { review_version: reviewVersion(version) };
  for (const field of EDITABLE_FIELDS) {
    if (Object.hasOwn(values, field) && values[field] !== undefined) {
      payload[field] = editableValue(field, values[field]);
    }
  }
  return payload;
}

// Saving and confirming are separate calls. The backend reads the saved draft.
export function buildVoiceConfirmPayload(version) {
  return { review_version: reviewVersion(version) };
}

/** Captures from list responses intentionally do not contain the transcript. */
export function isVoiceCapture(value, expectedId) {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || value.id < 1 ||
      value.source_type !== "voice" || !VOICE_CAPTURE_STATUSES.includes(value.status) ||
      !Number.isSafeInteger(value.review_version) || value.review_version < 0 ||
      !isRecord(value.review_values)) return false;
  // The backend starts at version 0 and increments only after successful extraction.
  // Accept that lifecycle snapshot, but never admit an unversioned review/confirmation.
  if (["ready_for_review", "confirmed"].includes(value.status) && value.review_version < 1) return false;
  if (expectedId !== undefined && String(value.id) !== String(expectedId)) return false;
  const amount = value.review_values.amount;
  if (amount !== null && amount !== undefined &&
      (typeof amount !== "string" || !/^(?:0|[1-9]\d{0,14})\.\d{4}$/.test(amount) || !/[1-9]/.test(amount))) return false;
  return true;
}

export function parseVoiceCaptureResponse(response, expectedId) {
  const capture = response?.data?.capture;
  return response?.status === true && isVoiceCapture(capture, expectedId) ? capture : null;
}

export function parseVoiceCapturesPage(response) {
  const page = response?.data?.captures;
  const quota = parseAiInputQuota(response?.data?.voice_quota);
  if (response?.status !== true || !isRecord(page) || !quota || !Array.isArray(page.data) ||
      !page.data.every((capture) => isVoiceCapture(capture)) ||
      !Number.isSafeInteger(page.current_page) || page.current_page < 1 ||
      !Number.isSafeInteger(page.last_page) || page.last_page < 1 ||
      !Number.isSafeInteger(page.per_page) || page.per_page < 1 || page.per_page > 100 ||
      !Number.isSafeInteger(page.total) || page.total < 0 ||
      (page.from !== null && (!Number.isSafeInteger(page.from) || page.from < 1)) ||
      (page.to !== null && (!Number.isSafeInteger(page.to) || page.to < 1))) return null;
  return {
    items: page.data, page: page.current_page, lastPage: page.last_page, perPage: page.per_page,
    total: page.total, from: page.from ?? 0, to: page.to ?? 0, quota,
  };
}

/** Backend flags AND lifecycle gate UI actions; the backend rechecks every call. */
export function getVoiceCapabilities(capture) {
  const valid = isVoiceCapture(capture);
  const ready = valid && capture.status === "ready_for_review";
  const flags = capture?.capabilities;
  const values = capture?.review_values;
  const complete = Number.isSafeInteger(values?.account_id) && values.account_id > 0 &&
    Number.isSafeInteger(values?.category_id) && values.category_id > 0 &&
    typeof values?.amount === "string" &&
    typeof values?.currency_code === "string" && /^[A-Z]{3}$/.test(values.currency_code) &&
    typeof values?.transaction_date === "string" && validDate(values.transaction_date);
  return {
    canEdit: ready && flags?.can_edit === true,
    canConfirm: ready && flags?.can_confirm === true && complete,
    canRetry: valid && capture.status === "failed" && flags?.can_retry === true,
    canDiscard: valid && ["uploaded", "queued", "ready_for_review", "failed", "discarded"].includes(capture.status) && flags?.can_discard === true,
    isProcessing: valid && ["uploaded", "queued", "processing"].includes(capture.status),
  };
}

/** Display only phases supported by the current request or the authorized server snapshot. */
export function getVoiceCaptureProgress(capture, action) {
  if (action === "upload" || action === "retry") {
    return { stage: 0, phase: action === "retry" ? "retrying" : "uploading" };
  }
  if (!getVoiceCapabilities(capture).isProcessing) return null;
  if (capture.status !== "processing") return { stage: 1, phase: "queued" };
  const transcribed = typeof capture.transcript === "string" && capture.transcript.trim().length > 0;
  return transcribed ? { stage: 3, phase: "extracting" } : { stage: 2, phase: "transcribing" };
}
