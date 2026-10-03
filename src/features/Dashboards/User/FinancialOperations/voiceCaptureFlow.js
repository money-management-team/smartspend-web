import { ApiError } from "../api/apiClient.js";
import { aiVoiceExpenseCapturesApi } from "../api/aiVoiceExpenseCapturesApi.js";
import { buildVoiceReviewPayload, createVoiceAttempt, getVoiceCapabilities, parseVoiceCaptureResponse, parseVoiceCapturesPage, requireVoiceId } from "./voiceCaptureContract.js";

export const VOICE_REVIEW_FIELDS = Object.freeze(["account_id", "category_id", "amount", "currency_code", "transaction_date", "transaction_time", "merchant_name", "reference_number", "description"]);
export const isVoiceOutcomeUncertain = (error) => ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "MALFORMED_RESPONSE", "CONFLICT"].includes(error?.code);
export const toVoiceReviewDraft = (capture) => Object.fromEntries(VOICE_REVIEW_FIELDS.map((field) => [field, capture?.review_values?.[field] == null ? "" : String(capture.review_values[field])]));
export function isVoiceDraftDirty(draft, capture) {
  if (!getVoiceCapabilities(capture).canEdit) return false;
  try { return JSON.stringify(buildVoiceReviewPayload(draft, capture.review_version)) !== JSON.stringify(buildVoiceReviewPayload(toVoiceReviewDraft(capture), capture.review_version)); }
  catch { return true; }
}
export function voiceReviewOptions(accounts, categories, workspaceId) {
  return {
    accounts: (accounts ?? []).filter((account) => String(account.workspace_id) === String(workspaceId) && account.status === "active" && !account.savings_goal),
    categories: (categories ?? []).filter((category) => category.type === "expense" && category.is_active !== false && category.is_active !== 0 && (category.workspace_id == null || String(category.workspace_id) === String(workspaceId))),
  };
}

/** Serial operations + one immutable intent per uncertain paid admission/confirmation. */
export function createVoiceCaptureFlow({ workspaceId, preferredAccountId, api = aiVoiceExpenseCapturesApi, quotas,
  onConfirmed = () => {}, setTimeout: later = globalThis.setTimeout.bind(globalThis), clearTimeout: clear = globalThis.clearTimeout.bind(globalThis) } = {}) {
  const workspace = workspaceId == null ? null : requireVoiceId(workspaceId, "workspace_id");
  const listeners = new Set(), notified = new Set();
  let state = Object.freeze({ capture: null, draft: null, busy: null, error: null, uncertain: null, needsReload: false, history: null, historyError: null, pollStopped: false });
  let generation = 0, running = null, timer = null, polls = 0, paused = false;
  let uploadIntent = null, retryIntent = null, confirmIntent = null;
  const publish = (changes) => { state = Object.freeze({ ...state, ...changes }); listeners.forEach((fn) => fn()); };
  const stopPoll = () => { if (timer !== null) clear(timer); timer = null; };
  const invalid = (field = "status") => new ApiError("", { code: "VOICE_INPUT_INVALID", errors: { [field]: ["Review the current draft before continuing."] } });
  const accept = (response, expectedId, reseed = true) => {
    const capture = parseVoiceCaptureResponse(response, expectedId);
    if (!capture || String(capture.workspace_id) !== String(workspace)) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
    quotas?.applyResponse(response);
    let draft = reseed ? toVoiceReviewDraft(capture) : state.draft;
    if (reseed && capture.status === "ready_for_review" && !draft.account_id && preferredAccountId) draft.account_id = String(preferredAccountId);
    const confirmed = capture.status === "confirmed" && Number.isSafeInteger(capture.confirmed_transaction_id) && capture.confirmed_transaction_id > 0;
    if (confirmed) { confirmIntent = null; if (!notified.has(capture.id)) { notified.add(capture.id); try { onConfirmed(capture); } catch { /* A refresh callback must not invalidate a committed expense. */ } } }
    publish({ capture, draft, error: null, needsReload: false, uncertain: confirmed ? null : state.uncertain, pollStopped: false });
    return capture;
  };
  const schedule = (delay) => {
    stopPoll(); if (paused || !getVoiceCapabilities(state.capture).isProcessing) return;
    if (polls >= 40) { publish({ pollStopped: true }); return; }
    timer = later(() => {
      timer = null; if (running) { schedule(2000); return; }
      polls += 1; void check(false).catch(() => {});
    }, delay ?? Math.min(15000, 2000 + polls * 500));
  };
  const run = (action, operation) => {
    if (running) return running.action === action ? running.promise : Promise.reject(invalid());
    stopPoll(); const id = generation, controller = new AbortController();
    publish({ busy: action, error: null });
    const promise = Promise.resolve().then(() => operation(controller.signal, () => generation === id && !controller.signal.aborted)).catch((error) => {
      if (id === generation && !controller.signal.aborted) {
        quotas?.handleError(error);
        const uncertain = isVoiceOutcomeUncertain(error) && ["upload", "retry", "confirm"].includes(action) ? action : state.uncertain;
        const stale = Boolean(error?.errors?.review_version);
        publish({ error, uncertain, ...(action === "history" ? { historyError: error } : {}), needsReload: state.needsReload || stale || action === "save" && isVoiceOutcomeUncertain(error) });
        if (!isVoiceOutcomeUncertain(error) && ["upload", "retry", "confirm"].includes(action)) {
          if (action === "upload") uploadIntent = null;
          if (action === "retry") retryIntent = null;
          if (action === "confirm") confirmIntent = null;
          publish({ uncertain: null });
        }
        if (action === "check" && ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND"].includes(error?.code)) polls = 40;
      }
      throw error;
    }).finally(() => {
      if (running?.controller === controller) {
        running = null; publish({ busy: null });
        const retry = Number(state.error?.retryAfter);
        schedule(state.error?.status === 429 ? Math.max(2000, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60000) : undefined);
      }
    });
    running = { action, promise, controller }; return promise;
  };
  const check = (explicit = true) => {
    if (!state.capture) return Promise.reject(invalid());
    if (explicit) polls = 0;
    const id = state.capture.id;
    return run("check", async (signal, live) => { const response = await api.get(id, { signal }); if (live()) return accept(response, id); });
  };
  const upload = (recording, replay = false) => {
    if (running) return running.action === "upload" ? running.promise : Promise.reject(invalid());
    if (workspace === null) return Promise.reject(invalid("workspace_id"));
    if (!replay && state.uncertain === "upload") return Promise.reject(invalid());
    if (!uploadIntent || !replay && uploadIntent.file !== recording?.blob) uploadIntent = { ...createVoiceAttempt("upload"), file: recording?.blob };
    if (!uploadIntent.file) return Promise.reject(invalid("file"));
    if (!replay && quotas && !quotas.canUse("voice")) return Promise.reject(invalid("quota"));
    const intent = uploadIntent;
    return run("upload", async (signal, live) => {
      const response = await api.create(intent.file, { workspaceId: workspace, idempotencyKey: intent.idempotencyKey, signal });
      if (!live()) return;
      const capture = accept(response); uploadIntent = null; polls = 0; publish({ uncertain: null }); void quotas?.refresh(); return capture;
    });
  };
  const flow = {
    getSnapshot: () => state, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    upload, replayUpload: () => upload(null, true),
    loadHistory: (page = 1) => run("history", async (signal, live) => {
      if (workspace === null) return;
      const response = await api.list({ workspace_id: workspace, page, per_page: 10, sort_dir: "desc" }, { signal });
      const parsed = parseVoiceCapturesPage(response);
      if (!parsed || parsed.items.some((capture) => String(capture.workspace_id) !== String(workspace))) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
      if (live()) { quotas?.applyResponse(response); publish({ history: parsed, historyError: null }); }
      return parsed;
    }),
    open: (id) => {
      if (state.uncertain === "confirm") return Promise.reject(invalid());
      return run("open", async (signal, live) => { const response = await api.get(requireVoiceId(id), { signal }); if (live()) { retryIntent = null; confirmIntent = null; polls = 0; publish({ uncertain: null }); return accept(response, id); } });
    },
    setDraft: (field, value) => {
      if (!running && getVoiceCapabilities(state.capture).canEdit && !state.needsReload && state.uncertain !== "confirm" && VOICE_REVIEW_FIELDS.includes(field)) publish({ draft: { ...state.draft, [field]: value }, error: null });
    },
    save: () => {
      if (!getVoiceCapabilities(state.capture).canEdit || state.needsReload || state.uncertain) return Promise.reject(invalid());
      let payload; try { payload = buildVoiceReviewPayload(state.draft, state.capture.review_version); } catch (error) { publish({ error }); return Promise.reject(error); }
      const id = state.capture.id;
      return run("save", async (signal, live) => { const response = await api.update(id, payload, { signal }); if (live()) return accept(response, id); });
    },
    confirm: () => {
      const capture = state.capture;
      if (!confirmIntent && (!getVoiceCapabilities(capture).canConfirm || isVoiceDraftDirty(state.draft, capture) || state.needsReload)) return Promise.reject(invalid());
      if (!confirmIntent) confirmIntent = { ...createVoiceAttempt("confirm"), captureId: capture.id, version: capture.review_version };
      const intent = confirmIntent;
      return run("confirm", async (signal, live) => {
        const response = await api.confirm(intent.captureId, { review_version: intent.version }, { idempotencyKey: intent.idempotencyKey, signal });
        const confirmed = parseVoiceCaptureResponse(response, intent.captureId);
        if (!confirmed || confirmed.status !== "confirmed" || !Number.isSafeInteger(confirmed.confirmed_transaction_id) || confirmed.confirmed_transaction_id < 1) throw new ApiError("", { code: "MALFORMED_RESPONSE" });
        if (live()) { const result = accept(response, intent.captureId); confirmIntent = null; publish({ uncertain: null }); return result; }
      });
    },
    retry: () => {
      if (!retryIntent && (!getVoiceCapabilities(state.capture).canRetry || quotas && !quotas.canUse("voice"))) return Promise.reject(invalid("quota"));
      if (!retryIntent) retryIntent = { ...createVoiceAttempt("retry"), captureId: state.capture.id };
      const intent = retryIntent;
      return run("retry", async (signal, live) => {
        const response = await api.retry(intent.captureId, { idempotencyKey: intent.idempotencyKey, signal });
        if (live()) { const result = accept(response, intent.captureId); retryIntent = null; polls = 0; publish({ uncertain: null }); void quotas?.refresh(); return result; }
      });
    },
    discard: () => {
      if (!getVoiceCapabilities(state.capture).canDiscard || state.uncertain) return Promise.reject(invalid());
      const id = state.capture.id;
      return run("discard", async (signal, live) => { const response = await api.discard(id, { signal }); if (live()) return accept(response, id); });
    },
    check,
    newRecording: () => { if (running || state.uncertain) return false; stopPoll(); uploadIntent = null; retryIntent = null; confirmIntent = null; polls = 0; publish({ capture: null, draft: null, error: null, needsReload: false, pollStopped: false }); return true; },
    pause: () => { paused = true; stopPoll(); }, resume: () => { paused = false; schedule(100); },
    cancel: () => { generation += 1; running?.controller.abort(); running = null; stopPoll(); publish({ busy: null }); },
  };
  return Object.freeze(flow);
}
