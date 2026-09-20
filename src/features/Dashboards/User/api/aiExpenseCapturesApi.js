import { ApiError, apiDownload, apiRequest, pickQuery, toApiRelativeUrl } from "./apiClient";
import {
  CAPTURE_UPLOAD_FILE_FIELD,
  CAPTURE_UPLOAD_PATH,
} from "../AiExpenseCaptures/captureConstants";

// A receipt can be large and the connection slow; the default request
// timeout is written for JSON, not for an upload.
const UPLOAD_TIMEOUT_MS = 60_000;

/*
 * The documented list parameters, and nothing else. `pickQuery` drops
 * anything a caller adds by mistake, so an invented filter can never reach
 * the backend as a 422.
 *
 * `user_id` is deliberately absent: the backend scopes captures to the
 * signed-in user from the bearer token. Sending an owner from the frontend
 * would be both useless and a way to ask for someone else's receipts.
 */
const LIST_QUERY_KEYS = ["status", "per_page", "sort_dir", "page"];

const capturePath = (captureId) => `/ai/expense-captures/${encodeURIComponent(captureId)}`;

/*
 * AI expense captures — receipts read by the backend's AI and waiting for the
 * user to review and confirm them.
 *
 * Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api`, so
 * the endpoint is `/ai/expense-captures` (never `/api/ai/expense-captures`).
 *
 * Envelopes:
 * - list → `data.captures` is a Laravel paginator; the rows are in
 *   `data.captures.data`. Parse it with `parseCapturesPage`.
 * - get → `data.capture` is the capture itself, never `data`. Parse it with
 *   `parseCaptureResponse`.
 *
 * All seven documented Sprint 7 endpoints are integrated, plus `create`,
 * which is NOT part of the documented contract — see its own comment.
 */
export const aiExpenseCapturesApi = {
  /*
   * Uploads a receipt and creates the capture the AI will read.
   *
   * ⚠ **This endpoint is not in the documented Sprint 7 contract.** The path,
   * the multipart field name and the response shape all come from
   * `captureConstants` and are assumptions, not verified backend facts —
   * see the block comment there. If the route does not exist the request
   * answers 404/405, which `isMissingUploadRoute` reports as "the service
   * isn't available" rather than as a bad file.
   *
   * The body is a `FormData` carrying the file and nothing else. No
   * `account_id`, `workspace_id` or `user_id` is attached: the account is
   * chosen later, during review, and ownership is the backend's from the
   * bearer token. `apiRequest` leaves a FormData body alone so the browser
   * writes the multipart Content-Type with its own boundary.
   *
   * Creating a capture moves no money — nothing is recorded until the
   * reviewed draft is confirmed. `idempotencyKey` is optional and simply
   * stops a retry after a timeout from producing a second capture of the same
   * receipt.
   *
   * → expected `data.capture`, parsed with `parseCaptureResponse`.
   */
  create: (file, options = {}) => {
    const formData = new FormData();
    formData.append(CAPTURE_UPLOAD_FILE_FIELD, file);

    return apiRequest(CAPTURE_UPLOAD_PATH, {
      method: "POST",
      body: formData,
      headers: options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {},
      signal: options.signal,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },

  // Query: status (one of AI_CAPTURE_STATUSES; omit for all), per_page
  // (1–100), sort_dir (asc | desc), page.
  list: (query = {}, options = {}) =>
    apiRequest("/ai/expense-captures", {
      query: pickQuery(query, LIST_QUERY_KEYS),
      signal: options.signal,
    }),

  /*
   * One capture, with its AI suggestions, review draft, warnings and — once
   * confirmed — the id of the transaction it created.
   *
   * No query at all: authorization and workspace scoping are the backend's,
   * so neither `user_id` nor `workspace_id` is sent. A capture that isn't the
   * caller's comes back as 403 or 404.
   */
  get: (captureId, options = {}) =>
    apiRequest(capturePath(captureId), { signal: options.signal }),

  /*
   * Saves the reviewed draft. This edits `review_values` and nothing else:
   * it creates no transaction, no ledger entry, and moves no money — that
   * happens only when the capture is confirmed.
   *
   * The body is built by `buildCaptureUpdatePayload`: the mandatory
   * `review_version` exactly as the backend last sent it, plus only the
   * documented fields the user actually changed. Nothing else is accepted
   * into it, so `status`, `ai_suggested_values`, `user_id` and
   * `workspace_id` can never be sent.
   *
   * No Idempotency-Key: the project reserves those for money-moving writes,
   * and Sprint 7 documents one as recommended-but-not-required here. Nothing
   * new was built for it. Confirm is the call that will need one.
   *
   * → `data.capture`, which may be partial; merge it with
   * `mergeCaptureUpdate` rather than replacing the capture wholesale.
   */
  update: (captureId, payload, options = {}) =>
    apiRequest(capturePath(captureId), {
      method: "PATCH",
      body: payload,
      signal: options.signal,
    }),

  /*
   * Asks the backend to run the AI over this receipt again. Valid only from
   * `failed`; anything else is refused with a 422.
   *
   * It requeues processing and nothing more: no transaction, no ledger entry,
   * no balance or budget change, and no edit to the reviewed draft. The
   * backend owns every status from here on.
   *
   * **No request body.** The contract documents none, so none is invented and
   * `body` is left undefined — which also keeps `Content-Type` off the
   * request. The capture is identified by the path alone.
   *
   * `idempotencyKey` is optional: Sprint 7 recommends one for writes without
   * requiring it here. When the caller supplies one (from the shared
   * `createIdempotentAttempt`) it rides along, so pressing Retry again after
   * an uncertain network result cannot queue the capture twice.
   *
   * → `data.capture`, which may hold only `id` and `status`; merge it with
   * `mergeCaptureUpdate` rather than replacing the capture wholesale. Success
   * is documented as 202 as well as 200 — `apiRequest` accepts any 2xx, so
   * neither is special-cased.
   */
  retry: (captureId, options = {}) =>
    apiRequest(`${capturePath(captureId)}/retry`, {
      method: "POST",
      headers: options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {},
      signal: options.signal,
    }),

  /*
   * Creates the expense from the reviewed draft. **The only money-moving
   * call in Sprint 7**: the backend runs its normal posting pipeline, so a
   * Transaction and its Ledger Entries appear, the account balance moves and
   * budgets are affected. Nothing before this point creates any of that.
   *
   * The body is built by `buildCaptureConfirmPayload` and holds
   * **`review_version` alone**. Every financial field is read by the backend
   * from the draft it already saved, which is why the caller must PATCH any
   * unsaved edits first and confirm against the version that PATCH returned.
   *
   * `idempotencyKey` is **mandatory** — this is the request that must never
   * post twice — so a missing one is refused here rather than sent. It comes
   * from the shared `createIdempotentAttempt`, which keeps one key per
   * logical confirmation: a timeout or a 5xx reuses it, so replaying the same
   * intent replays the same result instead of creating a second expense.
   *
   * → `data.capture` (which may be partial) and `data.transaction`. Success
   * is documented as 201; `apiRequest` accepts any 2xx, so it is not
   * special-cased.
   */
  confirm: (captureId, payload, options = {}) => {
    if (!options.idempotencyKey) {
      return Promise.reject(new ApiError("", { code: "MALFORMED_RESPONSE" }));
    }

    return apiRequest(`${capturePath(captureId)}/confirm`, {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": options.idempotencyKey },
      signal: options.signal,
    });
  },

  /*
   * Abandons the AI draft (DELETE /ai/expense-captures/{id}).
   *
   * What it does: moves the capture to `discarded`. What it does **not** do,
   * ever: delete or reverse a Transaction, remove a Ledger Entry, change an
   * account balance, or touch a budget. There is nothing financial to undo,
   * because a capture creates nothing until it is confirmed — which is why a
   * `confirmed` capture is not discardable at all.
   *
   * The record is not removed. `discarded` is a final lifecycle state the
   * list can still filter on, so the capture stays auditable with its
   * suggestions, review values and warnings intact.
   *
   * **No request body.** The contract documents none, so none is invented and
   * `body` is left undefined — no `reason`, no `review_version`, no review
   * values, no `user_id` and no `workspace_id`.
   *
   * `idempotencyKey` is optional, exactly as for retry: recommended for
   * writes, not required here. When supplied it rides along so a discard
   * pressed again after a timeout is the same request rather than a second
   * destructive one.
   *
   * → `data.capture`, which may hold only `id` and `status`; merge it with
   * `mergeCaptureUpdate` rather than replacing the capture wholesale.
   */
  discard: (captureId, options = {}) =>
    apiRequest(capturePath(captureId), {
      method: "DELETE",
      headers: options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {},
      signal: options.signal,
    }),

  /*
   * The original receipt file from GET /ai/expense-captures/{id}/source.
   *
   * The route needs a **signed** URL (`?expires=…&signature=…`) on top of the
   * bearer token, and only the backend can sign one. So this takes the signed
   * URL the backend supplied and never builds the path itself: no `expires`,
   * `signature`, storage path or disk name is produced here, and the query is
   * carried through exactly as received (`toApiRelativeUrl`) so the signature
   * still matches.
   *
   * Resolves to { blob, filename, contentType } — a file, never the JSON
   * envelope. `apiDownload` is the same binary path the report exports use.
   */
  downloadSource: (signedUrl, options = {}) => {
    const endpoint = toApiRelativeUrl(signedUrl);

    // No usable URL (missing, malformed, or pointing at another origin, which
    // must never receive this app's bearer token).
    if (!endpoint) {
      return Promise.reject(new ApiError("", { code: "MALFORMED_RESPONSE" }));
    }

    return apiDownload(endpoint, { signal: options.signal });
  },
};
