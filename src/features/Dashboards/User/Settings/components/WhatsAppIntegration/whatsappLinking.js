import { getApiErrorMessage } from "../../../api/apiClient.js";
import {
  classifyWhatsAppError,
  parseChallengeStatusResponse,
  shouldStopChallengePolling,
} from "../../../FinancialOperations/whatsappContract.js";

/*
 * Linking flow logic, kept free of React so it can be tested directly.
 *
 * The raw link token lives only in the reducer state below (component
 * memory). Nothing here stores, logs or puts it in a URL.
 */

/* The backend allows 120 requests a minute per client; this is ~15. */
export const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_INTERVAL_MS = 30_000;
const MAX_TRANSIENT_FAILURES = 5;
const MAX_POLL_DURATION_MS = 20 * 60_000;
const EXPIRY_GRACE_MS = 10_000;

/* Errors that end polling because retrying cannot help. */
const FATAL_KINDS = ["disabled", "unauthenticated", "forbidden", "not_found"];

const defaultTimers = {
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (id) => clearTimeout(id),
  now: () => Date.now(),
};

/**
 * Cancellable challenge poller. One request at a time, one timer at a time,
 * bounded in duration, and silent after `stop()`.
 *
 * `fetchChallenge(token, { signal })` resolves to the API envelope.
 * Callbacks: `onUpdate(challenge)` for every successful read,
 * `onStop(reason, error?)` exactly once, with reason `settled | deadline |
 * fatal | transient | cancelled`... except `cancelled`, which is silent.
 */
export function createChallengePoller({
  fetchChallenge,
  onUpdate,
  onStop,
  intervalMs = POLL_INTERVAL_MS,
  maxDurationMs = MAX_POLL_DURATION_MS,
  timers = defaultTimers,
}) {
  let token = null;
  let timer = null;
  let controller = null;
  let running = false;
  let startedAt = 0;
  let expiresAt = null;
  let failures = 0;
  let delay = intervalMs;

  const clear = () => {
    if (timer !== null) timers.clearTimer(timer);
    timer = null;
  };

  const finish = (reason, error) => {
    if (!running) return;
    running = false;
    clear();
    controller?.abort();
    controller = null;
    token = null;
    onStop?.(reason, error);
  };

  const pastDeadline = () => {
    const elapsed = timers.now() - startedAt;
    if (elapsed >= maxDurationMs) return true;
    return expiresAt !== null && timers.now() >= expiresAt + EXPIRY_GRACE_MS;
  };

  const schedule = (ms) => {
    clear();
    if (!running) return;
    timer = timers.setTimer(tick, ms);
  };

  async function tick() {
    timer = null;
    if (!running || controller) return; // never two requests at once

    // Past the deadline the server still gets the last word: one final read,
    // so a fast local clock can never declare a live link expired.
    const last = pastDeadline();

    const own = new AbortController();
    controller = own;

    try {
      const response = await fetchChallenge(token, { signal: own.signal });
      if (!running || controller !== own) return;
      controller = null;

      const challenge = parseChallengeStatusResponse(response);
      failures = 0;
      delay = intervalMs;
      onUpdate?.(challenge);

      if (!running) return; // onUpdate may have stopped us
      if (shouldStopChallengePolling(challenge)) finish("settled");
      else if (last) finish("deadline");
      else schedule(delay);
    } catch (error) {
      if (!running || controller !== own) return;
      controller = null;

      const kind = classifyWhatsAppError(error);
      if (kind === "aborted") return;
      if (FATAL_KINDS.includes(kind)) {
        finish("fatal", error);
        return;
      }

      failures += 1;
      if (last) {
        finish("deadline");
        return;
      }
      if (failures >= MAX_TRANSIENT_FAILURES) {
        finish("transient", error);
        return;
      }

      const retryAfter = Number(error?.retryAfter);
      delay = kind === "rate_limited" && Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, POLL_MAX_INTERVAL_MS)
        : Math.min(delay * 2, POLL_MAX_INTERVAL_MS);
      schedule(delay);
    }
  }

  return {
    start(newToken, { expiresAt: expiry = null } = {}) {
      finish("cancelled"); // never two pollers
      token = newToken;
      running = true;
      startedAt = timers.now();
      const parsed = expiry ? Date.parse(expiry) : NaN;
      expiresAt = Number.isFinite(parsed) ? parsed : null;
      failures = 0;
      delay = intervalMs;
      schedule(intervalMs);
    },
    stop() {
      finish("cancelled");
    },
    get active() {
      return running;
    },
  };
}

/* ------------------------------------------------------------- reducer */

export const initialLinkState = Object.freeze({
  phase: "idle", // idle | creating | waiting | verified | confirming | expired | cancelled | failed
  challenge: null,
  linking: null, // { token, public_number, message } - memory only
  error: null, // { kind, message-less } - see getLinkErrorMessage
});

export function linkReducer(state, action) {
  switch (action.type) {
    case "create":
      return { ...initialLinkState, phase: "creating" };
    case "created":
      return {
        phase: action.challenge.sender_verified ? "verified" : "waiting",
        challenge: action.challenge,
        linking: action.linking,
        error: null,
      };
    case "challenge":
      return phaseFromChallenge(state, action.challenge);
    case "confirm":
      return state.phase === "verified" ? { ...state, phase: "confirming", error: null } : state;
    case "confirm-failed":
      // Back to verified so the user can retry, unless the challenge is gone.
      return { ...state, phase: "verified", error: action.error };
    case "failed":
      return { ...state, phase: "failed", error: action.error };
    case "deadline":
      return state.phase === "waiting" || state.phase === "verified"
        ? { ...state, phase: "expired", linking: null }
        : state;
    case "reset":
      return initialLinkState;
    default:
      return state;
  }
}

function phaseFromChallenge(state, challenge) {
  if (state.phase === "idle" || state.phase === "creating" || state.phase === "confirming") {
    return { ...state, challenge };
  }
  switch (challenge.status) {
    case "sender_verified":
      return { ...state, phase: "verified", challenge, error: null };
    case "expired":
      return { ...state, phase: "expired", challenge, linking: null };
    case "cancelled":
      return { ...state, phase: "cancelled", challenge, linking: null };
    default:
      return { ...state, challenge };
  }
}

/* -------------------------------------------------------------- helpers */

/** wa.me link for the official service number; null when it is not a plain phone number. */
export function buildWhatsAppDeepLink(publicNumber, message) {
  const digits = typeof publicNumber === "string" ? publicNumber.replace(/[\s()-]/g, "") : "";
  if (!/^\+?\d{7,15}$/.test(digits) || typeof message !== "string" || !message) return null;
  return `https://wa.me/${digits.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}

/**
 * Copies text. Resolves true on success. On failure the caller shows the
 * text for manual selection; nothing is stored.
 */
export async function copyTextToClipboard(text, nav = globalThis.navigator) {
  try {
    if (!nav?.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Language values the backend accepts (UpdateWhatsAppPreferencesRequest: in:ar,en). */
export const WHATSAPP_PREFERENCE_LANGUAGES = ["ar", "en"];

/** Accounts the backend accepts as a default: active, not a savings-goal pot. */
export function isEligibleDefaultAccount(account, workspaceId) {
  return Boolean(account)
    && account.status === "active"
    && !account.savings_goal
    && (workspaceId == null || Number(account.workspace_id) === Number(workspaceId));
}

/**
 * User-facing text for a failed WhatsApp call. Never uses the request, the
 * token or the backend's English message for the cases the UI can explain.
 * `context`: "load" | "create" | "poll" | "confirm" | "preferences" | "unlink".
 */
export function getWhatsAppErrorMessage(error, t, context) {
  const key = "dashboard.settings.whatsapp.errors";

  switch (classifyWhatsAppError(error)) {
    case "disabled": return t(`${key}.disabled`);
    case "forbidden": return t(`${key}.forbidden`);
    case "not_found": return context === "poll" || context === "confirm"
      ? t(`${key}.challengeNotFound`)
      : getApiErrorMessage(error, t);
    case "conflict":
      if (context === "create") return t(`${key}.createConflict`);
      if (context === "confirm") return t(`${key}.confirmConflict`);
      if (context === "preferences") return t(`${key}.notLinked`);
      if (context === "unlink") return t(`${key}.alreadyUnlinked`);
      return t(`${key}.conflict`);
    case "validation":
      if (error?.errors?.default_account_id) return t(`${key}.invalidAccount`);
      if (error?.errors?.language) return t(`${key}.invalidLanguage`);
      return t(`${key}.validation`);
    default:
      return getApiErrorMessage(error, t);
  }
}
