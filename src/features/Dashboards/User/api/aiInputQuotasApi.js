import { apiRequest } from "./apiClient.js";

/** @typedef {{limit: number, used: number, remaining: number, reset_at: string}} AiInputQuota */

const CHANNELS = ["voice", "receipt"];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasTimestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

export const aiInputQuotasApi = {
  get: (options = {}) => apiRequest("/ai/input-quotas", { signal: options.signal }),
};

/** Invalid/missing quotas remain unknown; never assume a fresh ten attempts. */
export function parseAiInputQuota(value) {
  if (!isRecord(value) || !hasTimestamp(value.reset_at)) return null;
  const { limit, used, remaining, reset_at } = value;
  if (!Number.isSafeInteger(limit) || limit < 1 ||
      !Number.isSafeInteger(used) || used < 0 || used > limit ||
      !Number.isSafeInteger(remaining) || remaining !== limit - used) return null;

  return { limit, used, remaining, reset_at };
}

/** @returns {{voice: AiInputQuota, receipt: AiInputQuota} | null} */
export function parseAiInputQuotas(response) {
  if (response?.status !== true) return null;
  const voice = parseAiInputQuota(response.data?.quotas?.voice);
  const receipt = parseAiInputQuota(response.data?.quotas?.receipt);
  return voice && receipt ? { voice, receipt } : null;
}

/** Read the backend's machine code, not its translated message or generic 429. */
export function getAiInputLimitError(error) {
  if (error?.status !== 429) return null;
  const payload = error.payload;
  const kind = payload?.code === "ai_daily_limit_reached" ? "daily"
    : payload?.code === "ai_minute_limit_reached" ? "minute" : null;
  if (!kind || !CHANNELS.includes(payload.channel)) return null;
  const retry = typeof error.retryAfter === "number" ? error.retryAfter
    : typeof error.retryAfter === "string" && /^\d+$/.test(error.retryAfter)
      ? Number(error.retryAfter) : null;

  return {
    kind,
    channel: payload.channel,
    resetAt: hasTimestamp(payload.reset_at) ? payload.reset_at : null,
    retryAfterSeconds: Number.isSafeInteger(retry) && retry > 0 ? retry : null,
  };
}
