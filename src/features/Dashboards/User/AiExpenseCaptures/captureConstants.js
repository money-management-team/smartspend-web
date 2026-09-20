/*
 * AI Expense Capture — the domain vocabulary (Sprint 7).
 *
 * The one rule this whole feature exists to protect:
 * NO Transaction and NO ledger entry exists until the user confirms a
 * reviewed capture. Every status below except `confirmed` means "no money has
 * moved". Confirm is the only money-moving action in Sprint 7.
 *
 * Only values the backend documents live here. Nothing is invented, and no
 * spelling variant of a status is accepted "just in case": an unknown status
 * is shown as it came rather than reinterpreted (same rule as
 * ImportStatusBadge).
 */

/*
 * The seven documented statuses. `ready_for_review` is the canonical value —
 * the Sprint 7 guide phrases it differently in one prose section, but only
 * this form is treated as real. The Imports feature happens to use a status
 * with the same name for an unrelated lifecycle; the two are separate
 * vocabularies and must not be shared.
 */
export const AI_CAPTURE_STATUS = {
  UPLOADED: "uploaded",
  QUEUED: "queued",
  PROCESSING: "processing",
  READY_FOR_REVIEW: "ready_for_review",
  FAILED: "failed",
  CONFIRMED: "confirmed",
  DISCARDED: "discarded",
};

// In lifecycle order, for ordering UI and for validating a backend value.
export const AI_CAPTURE_STATUSES = [
  AI_CAPTURE_STATUS.UPLOADED,
  AI_CAPTURE_STATUS.QUEUED,
  AI_CAPTURE_STATUS.PROCESSING,
  AI_CAPTURE_STATUS.READY_FOR_REVIEW,
  AI_CAPTURE_STATUS.FAILED,
  AI_CAPTURE_STATUS.CONFIRMED,
  AI_CAPTURE_STATUS.DISCARDED,
];

/*
 * The backend still owes a result: the capture changes on its own, so the UI
 * shows a pending state and (from Task 2) polls. `uploaded` is included
 * because nothing in the UI can advance it — only the backend queues it.
 */
export const PROCESSING_STATUSES = [
  AI_CAPTURE_STATUS.UPLOADED,
  AI_CAPTURE_STATUS.QUEUED,
  AI_CAPTURE_STATUS.PROCESSING,
];

/*
 * Nothing will change any more and the draft is read-only. `failed` is
 * deliberately NOT final: retry may bring it back to processing.
 */
export const FINAL_STATUSES = [
  AI_CAPTURE_STATUS.CONFIRMED,
  AI_CAPTURE_STATUS.DISCARDED,
];

/*
 * Discard abandons a draft that never created anything. `processing` is left
 * out: the backend is mid-flight, so the UI waits instead of racing it.
 */
export const DISCARDABLE_STATUSES = [
  AI_CAPTURE_STATUS.UPLOADED,
  AI_CAPTURE_STATUS.QUEUED,
  AI_CAPTURE_STATUS.READY_FOR_REVIEW,
  AI_CAPTURE_STATUS.FAILED,
];

/*
 * The fields of `review_values`: the user's draft, and what the backend
 * records on confirm. It is also the display and form order.
 *
 * `ai_suggested_values` deliberately has NO such list — its keys are the
 * AI's own and need not match these (the contract pairs the suggestion
 * `total_amount` with the review field `amount`). That is one more reason
 * the two objects are never merged.
 */
export const CAPTURE_REVIEW_FIELDS = [
  "account_id",
  "category_id",
  "merchant_name",
  "amount",
  "currency_code",
  "transaction_date",
  "transaction_time",
  "reference_number",
  "tax_amount",
  "fee_amount",
  "description",
];

/*
 * Money fields. These stay the backend's decimal strings ("25.0000") end to
 * end — never parsed into a float for arithmetic or storage. Format for
 * display with `formatMoney`, total with `sumMoney` / `subtractMoney`
 * (utils/formatters.js) and send with `toMoneyString` (api/apiClient.js).
 */
export const CAPTURE_MONEY_FIELDS = ["amount", "tax_amount", "fee_amount"];

/*
 * `currency_code` is not a closed set of its own: the project already defines
 * the supported currencies as `ACCOUNT_CURRENCIES` in
 * `Accounts/accountHelpers.js` (which Budgets, Savings goals and Reports all
 * reuse). Sprint 7 reuses it too instead of hard-coding ILS / USD.
 */

/* ---------- Original receipt (GET /ai/expense-captures/{id}/source) ---------- */

/*
 * Where a signed source URL would be read from on a capture.
 *
 * NOT CONFIRMED. The `/source` route needs a signed URL
 * (`?expires=…&signature=…`) that only the backend can produce, but the
 * documented Show response carries no field holding one — it has
 * `source_type` and nothing else about the file. These are the candidate key
 * names to read *if* the backend starts sending one; none is invented into
 * existence, and while none is present the receipt section stays hidden
 * rather than offering a link that cannot work.
 *
 * When the backend confirms the real field, keep only that one.
 */
export const CAPTURE_SOURCE_URL_FIELDS = [
  "source_url",
  "signed_source_url",
  "source_download_url",
];

// MIME types the browser can show inline. Anything else is offered as a
// download instead of being forced into a viewer.
export const PREVIEWABLE_IMAGE_TYPE = /^image\//i;
export const PDF_TYPE = /^application\/pdf$/i;

/* ---------- List query (GET /ai/expense-captures) ---------- */

/*
 * The documented list parameters are `status`, `per_page` and `sort_dir`,
 * plus Laravel's `page` for navigating the paginator. Nothing else is sent:
 * no `workspace_id`, `account_id`, date range or search, and never a
 * `user_id` — the backend scopes captures to the signed-in user itself.
 */

// Matches the list page sizes used elsewhere in the dashboard.
export const CAPTURES_PER_PAGE = 20;

// Offered page sizes. The backend accepts 1–100, so nothing above it.
export const CAPTURES_PER_PAGE_OPTIONS = [10, 20, 50];
export const MAX_CAPTURES_PER_PAGE = 100;

// `sort_dir` is the only documented sort parameter: there is no sort field,
// so none is invented.
export const CAPTURE_SORT_DIRECTIONS = ["desc", "asc"];
export const DEFAULT_CAPTURE_SORT_DIR = "desc";

/*
 * Prefix for the Idempotency-Key of a confirmation, passed to the
 * existing `createIdempotentAttempt()` (FinancialOperations/
 * transactionHelpers.js). One attempt per logical confirm, so a retry after a
 * timeout or an uncertain server answer reuses the same key and cannot create
 * two transactions. Mandatory here, unlike everywhere else in Sprint 7: this
 * is the request that spends money. Same convention as `import-confirm`.
 */
export const CONFIRM_ATTEMPT_PREFIX = "ai-capture-confirm";

/* ---------- Reviewed draft (PATCH /ai/expense-captures/{id}) ---------- */

/*
 * The fields PATCH accepts, and the only ones the payload builder may send.
 * `review_version` is added separately and is always required.
 *
 * Today this is exactly `CAPTURE_REVIEW_FIELDS`, and it is derived from it so
 * the two cannot drift apart by accident. It still has its own name because
 * "what the backend shows" and "what the backend accepts" are different
 * questions: if a review field ever becomes read-only, only this list changes.
 *
 * Nothing outside it is ever sent — not `status`, not `ai_suggested_values`,
 * not `confirmed_transaction_id`, not a source URL, not a confidence value,
 * and never `user_id` or `workspace_id`.
 */
export const CAPTURE_EDITABLE_FIELDS = [...CAPTURE_REVIEW_FIELDS];

// Documented maximums for the two free-text fields.
export const REFERENCE_NUMBER_MAX = 120;
export const CAPTURE_DESCRIPTION_MAX = 500;

/*
 * `merchant_name` has no documented maximum, so none is invented here: the
 * input is left unbounded and the backend stays the authority on its length.
 */

/* ---------- Retry (POST /ai/expense-captures/{id}/retry) ---------- */

/*
 * Prefix for the Idempotency-Key of a retry, passed to the same
 * `createIdempotentAttempt()` the rest of the project uses. Sprint 7 lists a
 * key as recommended for writes but does NOT require one here, and retry
 * creates nothing — so this is belt-and-braces, not a dependency: the call
 * works whether or not the backend acts on the header.
 *
 * What it buys is the ambiguous case. After a timeout or a dropped
 * connection the attempt keeps its key, so pressing Retry again replays the
 * original request instead of queuing the capture twice. A success or a
 * definitive rejection retires the key, so a genuinely new retry later is a
 * new operation. Same convention as `ai-capture-confirm` and `import-confirm`.
 */
export const RETRY_ATTEMPT_PREFIX = "ai-capture-retry";

/* ---------- Confirm (POST /ai/expense-captures/{id}/confirm) ---------- */

/*
 * What the saved draft must contain before an expense can be created from it.
 *
 * These are not new rules invented for Sprint 7: they are what every
 * expense-creating path in this app already requires (see `NewOperation` and
 * `ReviewOperationDialog`) — an account to book against, an amount, the
 * currency it is in, the day it happened, and the category an expense is
 * filed under. Without them there is no expense to create.
 *
 * Saving a draft and confirming an expense are different operations:
 * `PATCH` documents every field as optional and the draft form requires
 * none, while Confirm needs a complete one. The backend stays the authority
 * and may still refuse what passes here.
 */
export const CAPTURE_CONFIRM_REQUIRED_FIELDS = [
  "account_id",
  "category_id",
  "amount",
  "currency_code",
  "transaction_date",
];

/*
 * The fields the confirmation summary shows, in the order it shows them.
 * They come from the reviewed draft — never from `ai_suggested_values`, which
 * is what the AI guessed rather than what the user is about to record.
 */
export const CAPTURE_CONFIRM_SUMMARY_FIELDS = [
  "account_id",
  "category_id",
  "merchant_name",
  "amount",
  "currency_code",
  "transaction_date",
  "description",
];

/* ---------- Discard (DELETE /ai/expense-captures/{id}) ---------- */

/*
 * Prefix for the Idempotency-Key of a discard, passed to the same shared
 * `createIdempotentAttempt()`. Sprint 7 recommends a key for writes without
 * requiring one here, and discard creates nothing, so this is belt-and-braces
 * rather than a dependency: the call works whether or not the backend acts on
 * the header.
 *
 * What it buys is the ambiguous case. After a timeout the attempt keeps its
 * key, so pressing Discard again is the same request rather than a second
 * destructive one. Same convention as `ai-capture-retry` and
 * `ai-capture-confirm`.
 *
 * Note what discard is NOT: it abandons an AI draft. It never deletes or
 * reverses a Transaction, never removes a Ledger Entry, and never touches a
 * balance or a budget — which is exactly why `confirmed` is not in
 * `DISCARDABLE_STATUSES`.
 */
export const DISCARD_ATTEMPT_PREFIX = "ai-capture-discard";

/* ---------- Upload (POST /ai/expense-captures) ---------- */

/*
 * ⚠ NOT CONFIRMED BY THE BACKEND CONTRACT.
 *
 * Sprint 7 documents seven endpoints and this is not one of them; the create
 * route came from the product flow diagram, not from a contract or from
 * backend code. Everything in this block is therefore a documented guess,
 * deliberately collected in one place so a single edit fixes it once the real
 * contract arrives.
 *
 * What each value rests on:
 * - path            → the flow diagram (`POST /api/ai/expense-captures`)
 * - file field name → `importsApi.upload`, the project's only multipart
 *                     precedent, which posts the file as `file`
 * - accepted types  → what the UI already offers (`accept="image/*"`)
 * - size limit      → a conservative local guard, NOT a mirror of a backend
 *                     rule. The backend stays the authority and may refuse
 *                     something smaller.
 *
 * If the route does not exist, the upload answers 404/405 and the UI says so
 * plainly rather than blaming the file — see `isMissingUploadRoute`.
 */
export const CAPTURE_UPLOAD_PATH = "/ai/expense-captures";
export const CAPTURE_UPLOAD_FILE_FIELD = "file";

// Kept in step with the file picker's `accept` attribute.
export const CAPTURE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const CAPTURE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/*
 * Prefix for the Idempotency-Key of an upload. Optional like retry's and
 * discard's — the contract requires none — but it means a second press after
 * a timeout is the same upload rather than a second capture of the same
 * receipt. Nothing financial is created either way.
 */
export const UPLOAD_ATTEMPT_PREFIX = "ai-capture-upload";
