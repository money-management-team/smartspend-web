import { apiRequest, pickQuery } from "./apiClient.js";
import {
  VOICE_RECORDING_POLICY, buildVoiceConfirmPayload, buildVoiceReviewPayload,
  requireVoiceId, voiceInputError,
} from "../FinancialOperations/voiceCaptureContract.js";

const ROOT = "/ai/voice-expense-captures";
const LIST_KEYS = ["workspace_id", "status", "per_page", "sort_dir", "page"];
const path = (id) => `${ROOT}/${requireVoiceId(id)}`;

function idempotencyHeaders(key) {
  if (typeof key !== "string" || key !== key.trim() || !/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw voiceInputError("idempotency_key", "Keep one valid Idempotency-Key per logical operation.");
  }
  return { "Idempotency-Key": key };
}

/** All paths are relative to the existing API base ending in /api. No automatic retries. */
export const aiVoiceExpenseCapturesApi = {
  async create(file, options = {}) {
    const headers = idempotencyHeaders(options.idempotencyKey);
    if (!(file instanceof Blob) || file.size < 1 || file.size > VOICE_RECORDING_POLICY.maxBytes) {
      throw voiceInputError("file", "Upload a non-empty WAV recording no larger than 4 MiB.");
    }
    const body = new FormData();
    body.append("file", file, "voice.wav");
    if (options.workspaceId !== undefined && options.workspaceId !== null) {
      body.append("workspace_id", String(requireVoiceId(options.workspaceId, "workspace_id")));
    }
    // Do not set Content-Type: the browser adds the multipart boundary.
    // The backend verifies WAV bytes; filename/MIME are never security checks.
    return apiRequest(ROOT, { method: "POST", body, headers, signal: options.signal, timeoutMs: 60_000 });
  },

  async list(query = {}, options = {}) {
    return apiRequest(ROOT, { query: pickQuery(query, LIST_KEYS), signal: options.signal });
  },

  async get(captureId, options = {}) {
    return apiRequest(path(captureId), { signal: options.signal });
  },

  async update(captureId, payload, options = {}) {
    const body = buildVoiceReviewPayload(payload, payload?.review_version);
    return apiRequest(path(captureId), { method: "PATCH", body, signal: options.signal });
  },

  async retry(captureId, options = {}) {
    return apiRequest(`${path(captureId)}/retry`, {
      method: "POST", headers: idempotencyHeaders(options.idempotencyKey), signal: options.signal,
    });
  },

  async confirm(captureId, payload, options = {}) {
    const body = buildVoiceConfirmPayload(payload?.review_version);
    return apiRequest(`${path(captureId)}/confirm`, {
      method: "POST", body, headers: idempotencyHeaders(options.idempotencyKey), signal: options.signal,
    });
  },

  async discard(captureId, options = {}) {
    return apiRequest(path(captureId), { method: "DELETE", signal: options.signal });
  },
};
