import { ApiError } from "./apiClient.js";
import { aiInputQuotasApi, getAiInputLimitError, parseAiInputQuota, parseAiInputQuotas } from "./aiInputQuotasApi.js";

/** Per mounted signed-in screen. No guessed limits, local deductions or cross-user cache. */
export function createAiInputQuotaStore({ api = aiInputQuotasApi, now = () => Date.now() } = {}) {
  let state = Object.freeze({ quotas: null, loading: false, error: null, minuteUntil: { voice: 0, receipt: 0 } });
  const listeners = new Set(); let generation = 0, pending = null;
  const publish = (changes) => { state = Object.freeze({ ...state, ...changes }); listeners.forEach((fn) => fn()); };
  const invalidate = () => { generation += 1; pending?.controller.abort(); pending = null; };
  const quota = (channel) => { const value = state.quotas?.[channel]; return value && Date.parse(value.reset_at) > now() ? value : null; };
  const canUse = (channel) => Boolean(quota(channel)?.remaining > 0 && (state.minuteUntil[channel] ?? 0) <= now());
  const refresh = () => {
    if (pending) return pending.promise;
    const id = ++generation, controller = new AbortController();
    publish({ loading: true, error: null });
    const promise = Promise.resolve().then(() => api.get({ signal: controller.signal })).then((response) => {
      const quotas = parseAiInputQuotas(response);
      if (!quotas) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      if (id === generation && !controller.signal.aborted) publish({ quotas, loading: false, error: null,
        minuteUntil: Object.fromEntries(Object.entries(state.minuteUntil).map(([channel, until]) => [channel, until <= now() ? 0 : until])) });
      return quotas;
    }).catch((error) => {
      if (id === generation && !controller.signal.aborted) publish({ loading: false, error });
      return null; // Read-only refresh errors live in the store, never unhandled promises.
    }).finally(() => { if (pending?.id === id) pending = null; });
    pending = { id, controller, promise }; return promise;
  };
  return Object.freeze({
    getSnapshot: () => state, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    quota, canUse, refresh,
    needsRefresh: () => !quota("voice") || !quota("receipt"),
    applyResponse: (response) => {
      const voice = parseAiInputQuota(response?.data?.voice_quota);
      const receipt = parseAiInputQuota(response?.data?.receipt_quota);
      if (!voice && !receipt) return;
      invalidate(); publish({ quotas: { ...state.quotas, ...(voice ? { voice } : {}), ...(receipt ? { receipt } : {}) }, loading: false });
    },
    handleError: (error) => {
      const limit = getAiInputLimitError(error); if (!limit) return null;
      invalidate();
      if (limit.kind === "daily") {
        const old = quota(limit.channel);
        const reset = limit.resetAt ?? old?.reset_at;
        const exhausted = old && reset ? { limit: old.limit, used: old.limit, remaining: 0, reset_at: reset } : null;
        publish({ quotas: { ...state.quotas, [limit.channel]: exhausted }, loading: false });
      } else publish({ loading: false, minuteUntil: { ...state.minuteUntil, [limit.channel]: now() + (limit.retryAfterSeconds ?? 60) * 1000 } });
      return limit;
    },
    cancel: () => { invalidate(); publish({ loading: false }); },
  });
}
