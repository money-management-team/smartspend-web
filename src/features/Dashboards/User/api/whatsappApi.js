import { ApiError, apiRequest } from "./apiClient.js";
import {
  buildDraftConfirmPayload, buildDraftListQuery, buildDraftUpdatePayload, buildPreferencesPayload,
  requireChallengeToken, requireIdempotencyKey, requireReviewVersion, requireWhatsAppId,
} from "../FinancialOperations/whatsappContract.js";

const ROOT = "/integrations/whatsapp";
const DRAFTS = `${ROOT}/expense-drafts`;
const challengePath = (token) => `${ROOT}/link-challenges/${requireChallengeToken(token)}`;
const draftPath = (id) => `${DRAFTS}/${requireWhatsAppId(id)}`;

// One confirmation per draft at a time; see confirmDraft.
const confirmationsInFlight = new Map();

/*
 * WhatsApp integration, against smartspend-backend
 * `feature/whatsapp-availability-contract` @ b7ca549 (not yet on develop).
 * Paths are relative to the API base, which already ends in /api.
 *
 * Every function returns the backend envelope, like the other API modules;
 * parse it with the matching `parse*Response` in whatsappContract.js.
 * Nothing here retries, caches, stores or logs; workspace scoping is the
 * backend's, so no `workspace_id` is ever sent.
 *
 * Availability: the draft endpoints work while WhatsApp is disabled. The
 * link endpoints answer 409 `whatsapp_disabled` (see isWhatsAppDisabledError).
 * Reads and link calls take `options.signal` so a UI can cancel or stop polling.
 */
const operations = {
  getIntegration: (options = {}) => apiRequest(ROOT, { signal: options.signal }),

  // The response carries the plaintext link token once: keep it in memory only.
  createLinkChallenge: (options = {}) =>
    apiRequest(`${ROOT}/link-challenges`, { method: "POST", signal: options.signal }),

  getLinkChallenge: (token, options = {}) =>
    apiRequest(challengePath(token), { signal: options.signal }),

  // Explicit user action only; the backend never activates a link by itself.
  confirmLinkChallenge: (token, options = {}) =>
    apiRequest(`${challengePath(token)}/confirm`, { method: "POST", signal: options.signal }),

  updatePreferences: (values, options = {}) =>
    apiRequest(`${ROOT}/preferences`, {
      method: "PATCH", body: buildPreferencesPayload(values), signal: options.signal,
    }),

  unlink: (options = {}) => apiRequest(`${ROOT}/link`, { method: "DELETE", signal: options.signal }),

  // Filters: status, date (YYYY-MM-DD), account, per_page (1..100), page.
  listDrafts: (query = {}, options = {}) =>
    apiRequest(DRAFTS, { query: buildDraftListQuery(query), signal: options.signal }),

  getDraftSummary: (options = {}) => apiRequest(`${DRAFTS}/summary`, { signal: options.signal }),

  getDraft: (draftId, options = {}) => apiRequest(draftPath(draftId), { signal: options.signal }),

  // Saves review values only. It never confirms and creates no transaction.
  updateDraft: (draftId, values, reviewVersion, options = {}) =>
    apiRequest(draftPath(draftId), {
      method: "PATCH", body: buildDraftUpdatePayload(values, reviewVersion), signal: options.signal,
    }),

  discardDraft: (draftId, options = {}) =>
    apiRequest(draftPath(draftId), { method: "DELETE", signal: options.signal }),

  /*
   * The only call here that moves money. The caller supplies ONE stable
   * `idempotencyKey` per logical confirmation (createWhatsAppConfirmAttempt)
   * and reuses it after any uncertain outcome. There is no automatic retry:
   * after a timeout, re-read with getDraft instead of resending blindly.
   * A second call for the same draft while one is in flight shares that
   * request when key and version match, and is refused otherwise.
   */
  confirmDraft(draftId, { reviewVersion, idempotencyKey, signal } = {}) {
    const id = requireWhatsAppId(draftId);
    const version = requireReviewVersion(reviewVersion);
    const key = requireIdempotencyKey(idempotencyKey);

    const active = confirmationsInFlight.get(id);
    if (active) {
      if (active.key === key && active.version === version) return active.promise;
      throw new ApiError("A confirmation for this draft is already in progress.", {
        code: "WHATSAPP_CONFIRM_IN_FLIGHT",
      });
    }

    const promise = apiRequest(`${DRAFTS}/${id}/confirm`, {
      method: "POST",
      body: buildDraftConfirmPayload(version),
      headers: { "Idempotency-Key": key },
      signal,
    }).finally(() => confirmationsInFlight.delete(id));

    confirmationsInFlight.set(id, { key, version, promise });
    return promise;
  },
};

// Invalid input rejects the returned promise instead of throwing synchronously.
export const whatsappApi = Object.freeze(
  Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [name, async (...args) => operation(...args)]),
  ),
);
