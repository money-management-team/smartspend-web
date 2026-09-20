import { toMoneyString } from "../api/apiClient";
import {
  getAmountError,
  isInsufficientBalanceError,
  toAmountInput,
} from "../FinancialOperations/transactionHelpers";
import { getEligibleAccounts } from "../Recurring/recurringHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import { parsePage, toDateOnly } from "../SavingsGoals/savingsGoalHelpers";
import {
  AI_CAPTURE_STATUS,
  AI_CAPTURE_STATUSES,
  CAPTURES_PER_PAGE,
  CAPTURES_PER_PAGE_OPTIONS,
  CAPTURE_CONFIRM_REQUIRED_FIELDS,
  CAPTURE_DESCRIPTION_MAX,
  CAPTURE_UPLOAD_MAX_BYTES,
  CAPTURE_UPLOAD_TYPES,
  CAPTURE_EDITABLE_FIELDS,
  CAPTURE_MONEY_FIELDS,
  CAPTURE_REVIEW_FIELDS,
  CAPTURE_SORT_DIRECTIONS,
  CAPTURE_SOURCE_URL_FIELDS,
  PDF_TYPE,
  PREVIEWABLE_IMAGE_TYPE,
  DEFAULT_CAPTURE_SORT_DIR,
  DISCARDABLE_STATUSES,
  FINAL_STATUSES,
  PROCESSING_STATUSES,
  REFERENCE_NUMBER_MAX,
} from "./captureConstants";

/*
 * AI Expense Capture — lifecycle and review-draft helpers (Sprint 7).
 *
 * Everything the UI is allowed to decide about a capture lives here, so no
 * component compares status strings on its own. All of it is derived from the
 * backend's record: the frontend never advances a status itself, and the
 * backend stays the final authority on every transition. A helper returning
 * true only means "offer this action" — the backend may still refuse it.
 *
 * Deliberately not a state machine: seven statuses and six predicates are
 * easier to read and to change than a transition table.
 */

const isObject = (value) =>
  value != null && typeof value === "object" && !Array.isArray(value);

/* ---------- Entities ---------- */

export const isCaptureEntity = (value) => isObject(value) && value.id != null;

export const getCaptureStatus = (capture) => capture?.status ?? null;

// True only for a status the backend documents. Anything else is displayed
// as it came rather than guessed at.
export const isKnownCaptureStatus = (status) => AI_CAPTURE_STATUSES.includes(status);

/* ---------- List response ---------- */

/*
 * GET /ai/expense-captures → `data.captures` is a Laravel paginator, so the
 * rows are in `data.captures.data` and `data.captures` itself is never an
 * array of captures. `parsePage` (shared with the other paginated lists)
 * reads the standard fields defensively and returns
 * { items, page, lastPage, total, from, to }; anything else is a malformed
 * response rather than something to guess at.
 *
 * Records are handed on exactly as the backend sent them — never mutated,
 * never filled in with fields the list contract doesn't promise.
 */
export const parseCapturesPage = (response) => parsePage(response, "captures");

/*
 * GET /ai/expense-captures/{id} → the capture is at `data.capture`, not at
 * `data` itself. Anything else is a malformed response rather than something
 * to guess at, and the record is handed on exactly as it arrived.
 */
export function parseCaptureResponse(response) {
  const capture = response?.data?.capture;
  return isCaptureEntity(capture) ? capture : null;
}

/* ---------- Display-safe values ---------- */

// Anything the backend sends, as something React can render. Objects are
// stringified rather than dropped, so an unexpected shape is visible instead
// of silently missing (and never crashes the page).
function toText(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

const hasValue = (value) => value != null && value !== "";

// A field name the UI has no translation for, e.g. an AI suggestion the
// contract doesn't list. Same fallback idea as `translateEnum`.
export const humanizeCaptureField = (field) =>
  String(field ?? "")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

/* ---------- List filters (kept in the URL) ---------- */

/*
 * Filters live in the query string, like the other dashboard lists: a reload
 * keeps them, back / forward work, and a filtered list can be shared.
 * Anything unknown in the URL is dropped before a request is built, so a
 * hand-edited link can't send a status the backend would reject with a 422.
 */
export function readCaptureFilters(searchParams) {
  const status = searchParams.get("status") ?? "";
  const sortDir = searchParams.get("sort_dir") ?? "";
  const perPage = Number(searchParams.get("per_page"));
  const page = Number(searchParams.get("page"));

  return {
    // "" is the All option: no status parameter is sent at all.
    status: isKnownCaptureStatus(status) ? status : "",
    sort_dir: CAPTURE_SORT_DIRECTIONS.includes(sortDir) ? sortDir : DEFAULT_CAPTURE_SORT_DIR,
    per_page: CAPTURES_PER_PAGE_OPTIONS.includes(perPage) ? perPage : CAPTURES_PER_PAGE,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

// Defaults are left out so the URL stays short and shareable.
export function captureFiltersToSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.sort_dir !== DEFAULT_CAPTURE_SORT_DIR) params.set("sort_dir", filters.sort_dir);
  if (filters.per_page !== CAPTURES_PER_PAGE) params.set("per_page", String(filters.per_page));
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
}

// The request query. `status: undefined` is dropped by the client, which is
// exactly what the All option needs.
export const captureFiltersToQuery = (filters) => ({
  status: filters.status || undefined,
  sort_dir: filters.sort_dir,
  per_page: filters.per_page,
  page: filters.page > 1 ? filters.page : undefined,
});

/*
 * Only the status narrows the result set; sort direction and page size change
 * how the same captures are shown. So an empty list is "nothing matches this
 * status" only when a status is chosen.
 */
export const hasActiveCaptureFilters = (filters) => Boolean(filters.status);

/* ---------- Lifecycle ---------- */

/*
 * The backend still owes a result (`uploaded`, `queued`, `processing`): show
 * a pending state and, from Task 2, poll. No action is offered except a
 * possible discard before processing starts.
 */
export const isCaptureProcessing = (status) => PROCESSING_STATUSES.includes(status);

/*
 * Read-only for good (`confirmed`, `discarded`). `failed` is NOT final: a
 * retry may put it back into processing.
 */
export const isCaptureFinal = (status) => FINAL_STATUSES.includes(status);

// The AI finished and the draft may be edited.
export const canReviewCapture = (status) => status === AI_CAPTURE_STATUS.READY_FOR_REVIEW;

// Processing failed; ask the backend to try again.
export const canRetryCapture = (status) => status === AI_CAPTURE_STATUS.FAILED;

// Abandons a draft that never created anything. Never while processing, and
// never once confirmed or already discarded.
export const canDiscardCapture = (status) => DISCARDABLE_STATUSES.includes(status);

/*
 * The only money-moving action in Sprint 7: it asks the backend to create the
 * expense transaction from `review_values`. Offered only from
 * `ready_for_review`, and it must carry an Idempotency-Key.
 */
export const canConfirmCapture = (status) => status === AI_CAPTURE_STATUS.READY_FOR_REVIEW;

/*
 * The core business rule, as one check: a transaction exists only after
 * confirmation. Everything before `confirmed` is a draft, however complete it
 * looks, and discarding never creates one.
 */
export const captureHasTransaction = (capture) =>
  getCaptureStatus(capture) === AI_CAPTURE_STATUS.CONFIRMED;

/*
 * The draft was abandoned. A final state, and an auditable one: the record
 * stays, with its suggestions, review values and warnings intact. Nothing
 * financial exists to undo, because nothing financial was ever created.
 */
export const isCaptureDiscarded = (capture) =>
  getCaptureStatus(capture) === AI_CAPTURE_STATUS.DISCARDED;

// The transaction the backend created on confirm, for a "View transaction"
// link. Null while the capture is still a draft.
export const getConfirmedTransactionId = (capture) =>
  captureHasTransaction(capture) ? (capture?.confirmed_transaction_id ?? null) : null;

/* ---------- AI suggestions vs review values ---------- */

/*
 * Two objects that must stay separate:
 *
 * - `ai_suggested_values` is what the AI read off the receipt. Hints only.
 *   Never edited, never sent back, never the source of what gets recorded.
 * - `review_values` is the user's editable draft and the only thing the
 *   backend records on confirm.
 *
 * There is intentionally no helper that merges them into one object: the
 * review form seeds from `review_values`, and a suggestion is shown beside
 * the field it belongs to so the user can compare the two.
 */

export const getAiSuggestedValues = (capture) =>
  isObject(capture?.ai_suggested_values) ? capture.ai_suggested_values : {};

export const getReviewValues = (capture) =>
  isObject(capture?.review_values) ? capture.review_values : {};

// One AI hint, for showing next to its input. `undefined` when the AI had
// nothing to say about that field.
export const getSuggestedValue = (capture, field) => getAiSuggestedValues(capture)[field];

export const getReviewValue = (capture, field) => getReviewValues(capture)[field];

/*
 * The AI's hints, ready to render.
 *
 * The documented shape is `{ field: { value, confidence } }`, and the field
 * names are the AI's own — they do NOT have to match the review fields (the
 * contract's example pairs the suggestion `total_amount` with the review
 * field `amount`). That is exactly why the two objects are never merged: the
 * same receipt line can be called different things on each side.
 *
 * A bare scalar instead of a `{ value, confidence }` object is accepted, and
 * fields the contract never listed come through untouched, so a new
 * suggestion type shows up rather than breaking the page.
 */
export function getSuggestionEntries(capture) {
  return Object.entries(getAiSuggestedValues(capture))
    .map(([field, raw]) => {
      const suggestion = isObject(raw) ? raw : { value: raw };

      return {
        field,
        value: toText(suggestion.value),
        confidence: toConfidence(suggestion.confidence),
      };
    })
    .filter((entry) => entry.value !== "");
}

/*
 * Confidence as a 0–1 number, or null when the backend sent nothing usable.
 * A value outside that range is dropped rather than rescaled: guessing that
 * `95` meant `0.95` would be inventing precision the contract doesn't give.
 *
 * It is a hint about how sure the model was, never a verdict that a value is
 * correct, approved or safe — nothing in the UI may act on it.
 */
export function toConfidence(value) {
  const number = Number(value);
  if (value == null || value === "" || !Number.isFinite(number)) return null;
  return number >= 0 && number <= 1 ? number : null;
}

/*
 * The review draft, ready to render: the documented fields in their
 * documented order first, then anything else the backend sent, so a field the
 * contract doesn't list is still shown. Values stay raw — money keeps its
 * decimal string, ids stay ids — because the caller decides how each is
 * formatted.
 */
export function getReviewValueEntries(capture) {
  const values = getReviewValues(capture);
  const documented = CAPTURE_REVIEW_FIELDS.filter((field) => hasValue(values[field]));
  const extra = Object.keys(values).filter(
    (field) => !CAPTURE_REVIEW_FIELDS.includes(field) && hasValue(values[field]),
  );

  return [...documented, ...extra].map((field) => ({ field, value: values[field] }));
}

/*
 * Backend warnings about the capture, as plain text. They are informational:
 * nothing here turns one into a validation error or blocks an action, because
 * the contract doesn't say they do.
 */
export function getCaptureWarnings(capture) {
  const warnings = capture?.warnings;
  if (!Array.isArray(warnings)) return [];

  return warnings
    .map((warning) => (isObject(warning) ? (warning.message ?? warning.code ?? toText(warning)) : toText(warning)))
    .filter((text) => typeof text === "string" && text !== "");
}

/* ---------- Original receipt (source file) ---------- */

/*
 * The signed URL for this capture's receipt, or null when the backend hasn't
 * sent one.
 *
 * The `/source` route needs `?expires=…&signature=…`, and only the backend
 * can sign that. Nothing here builds, guesses or repairs a signed URL: it
 * only reads one the response already contains. Null means the receipt
 * section is not offered at all, which is the honest outcome while the
 * contract has no field for it (see `CAPTURE_SOURCE_URL_FIELDS`).
 *
 * Kept ephemeral by everything that uses it: never stored in localStorage or
 * sessionStorage, never logged, never put in a URL the app owns.
 */
export function getCaptureSourceUrl(capture) {
  for (const field of CAPTURE_SOURCE_URL_FIELDS) {
    const value = capture?.[field];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }

  // A nested `source: { url }` object, if one ever arrives that way.
  const nested = capture?.source;
  if (isObject(nested)) {
    for (const field of ["url", "download_url", "signed_url"]) {
      const value = nested[field];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
  }

  return null;
}

// What the backend actually streamed decides how it is shown — never the
// file extension, and never an assumption that a receipt is an image.
export const isImageSource = (contentType) =>
  PREVIEWABLE_IMAGE_TYPE.test(String(contentType ?? ""));

export const isPdfSource = (contentType) => PDF_TYPE.test(String(contentType ?? ""));

/*
 * A signed link the backend will no longer accept. It answers 403 for a
 * signature that has expired or doesn't match, so the fix is a fresh capture
 * fetch (which carries a newly signed URL) rather than retrying the same one.
 *
 * 401 is a dead session, handled globally, and is deliberately not treated as
 * an expired link.
 */
export const isSourceLinkExpired = (error) => error?.code === "FORBIDDEN";

/* ---------- Optimistic concurrency (review_version) ---------- */

/*
 * `review_version` guards the draft against concurrent edits. It is not a UI
 * counter: it belongs to the record.
 *
 * The rule the later tasks must follow — every successful update can return a
 * NEWER `review_version`, and the next PATCH or Confirm must send the newest
 * one the frontend has seen. A stale version is what the backend rejects, so
 * the version is always re-read from the response, never incremented locally.
 */
export const getReviewVersion = (capture) => {
  const raw = capture?.review_version;

  /*
   * Deliberately not `Number(raw)`: that reads `null`, `""`, `false` and
   * `[]` as 0, which would invent a version the backend never sent and then
   * submit it as fact. Only an actual integer counts.
   */
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) return Number(raw.trim());

  return null;
};

/*
 * A stale `review_version` is rejected as a 422, not a 409: the backend
 * treats it as a failed validation of the submitted version, so it arrives
 * with `VALIDATION_ERROR` like any other field error.
 *
 * That makes the code alone useless as a signal — most 422s here are ordinary
 * field problems (a bad amount, a missing category) that the user fixes in
 * place, while a stale version means the draft must be reloaded. So this only
 * says yes when the backend actually points at `review_version`: the field
 * key when it names one, otherwise its own wording. Anything else stays a
 * normal validation error.
 */
export function isCaptureVersionConflict(error) {
  if (error?.code !== "VALIDATION_ERROR") return false;

  const fields = isObject(error.errors) ? error.errors : {};
  if (Object.hasOwn(fields, "review_version")) return true;

  const text = [error.message, ...Object.values(fields).flat()]
    .filter((item) => typeof item === "string")
    .join(" ");

  return /review[\s_-]?version/i.test(text);
}

/* ---------- Reviewed draft form (PATCH /ai/expense-captures/{id}) ---------- */

/*
 * Accounts a reviewed expense may be booked on: active, and never a
 * savings-goal container (a goal's money only moves through the goal's own
 * flow). That is exactly the Recurring rule, so it is re-used rather than
 * written a third time. The backend scopes the list to the workspace.
 */
export { getEligibleAccounts };

/*
 * Categories a reviewed expense may use: expense type and active. The list
 * endpoint is already asked for `type=expense`, so this is the second line of
 * defence rather than the only one — an income category must never be offered
 * as a valid expense selection.
 */
export const getExpenseCategories = (categories) =>
  (categories ?? []).filter(
    (category) =>
      category?.id != null && category.type === "expense" && category.is_active !== false,
  );

const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
// Format only: digits, an optional sign, at most four decimals.
const MONEY_FORMAT = /^[+-]?\d+(?:\.\d{1,4})?$/;

/*
 * A backend time as an `<input type="time">` value.
 *
 * The contract accepts `HH:mm` and `HH:mm:ss`, so neither form is rewritten
 * into the other: seconds are kept when they carry information and dropped
 * only when they are `:00`, which is the same instant. Nothing invents seconds
 * the user never typed, and no time zone is applied — these are wall-clock
 * times printed on a receipt, not instants.
 */
export function toTimeInput(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/);
  if (!match) return "";

  const [, hour, minute, second] = match;
  const base = `${hour.padStart(2, "0")}:${minute}`;

  return second && second !== "00" ? `${base}:${second}` : base;
}

/*
 * The form's starting values — seeded from `review_values` and from nothing
 * else.
 *
 * The AI's suggestions are NEVER used here, at any confidence: a suggestion
 * the user never looked at must not become the value that gets recorded. They
 * stay in their own section, for comparison.
 *
 * Every value is a string, so an input is always controlled and money never
 * becomes a float. Money is shown without its trailing zeros ("25.0000" →
 * "25") for editing, exactly as the transaction correction form does; the
 * 4-decimal string is restored at submission.
 */
export function toCaptureFormValues(capture) {
  const values = getReviewValues(capture);
  const text = (field) => (values[field] == null ? "" : String(values[field]));

  return {
    account_id: text("account_id"),
    category_id: text("category_id"),
    merchant_name: text("merchant_name"),
    amount: toAmountInput(text("amount")),
    currency_code: text("currency_code"),
    transaction_date: toDateOnly(text("transaction_date")),
    transaction_time: toTimeInput(text("transaction_time")),
    reference_number: text("reference_number"),
    tax_amount: toAmountInput(text("tax_amount")),
    fee_amount: toAmountInput(text("fee_amount")),
    description: text("description"),
  };
}

/*
 * One field in the form it will be compared and sent in. Comparing normalised
 * values is what stops "25" from looking like a change to a saved "25.0000",
 * which would otherwise make an untouched form dirty and resend values the
 * user never edited.
 */
function normalizeCaptureField(field, value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";

  // Money keeps the backend's 4-decimal string form; never a float.
  if (CAPTURE_MONEY_FIELDS.includes(field)) return toMoneyString(text) || text;
  if (field === "transaction_date") return toDateOnly(text);
  if (field === "transaction_time") return toTimeInput(text);
  if (field === "currency_code") return text.toUpperCase();

  return text;
}

/*
 * The fields whose value differs from the saved draft, and only those: PATCH
 * is a partial update, so an untouched field is not resent.
 *
 * A field the user emptied becomes `null` — the project's existing convention
 * for clearing an optional field (see `buildUpdatePayload` in
 * recurringHelpers). Omitting it instead would leave the UI showing an empty
 * field while the backend still held a value.
 */
export function getCaptureChanges(form, capture) {
  const saved = getReviewValues(capture);
  const changes = {};

  CAPTURE_EDITABLE_FIELDS.forEach((field) => {
    const next = normalizeCaptureField(field, form?.[field]);
    if (next === normalizeCaptureField(field, saved[field])) return;
    changes[field] = next === "" ? null : next;
  });

  return changes;
}

export const isCaptureFormDirty = (form, capture) =>
  Object.keys(getCaptureChanges(form, capture)).length > 0;

/*
 * The PATCH body, or `null` when there is nothing to save or no version to
 * save against.
 *
 * `review_version` is mandatory and is taken from the capture exactly as the
 * backend last sent it. A capture with no usable version produces no payload
 * at all: the version is never guessed, never defaulted to 0 and never
 * incremented here — the backend is its only author.
 *
 * Only `CAPTURE_EDITABLE_FIELDS` can appear, so `status`,
 * `ai_suggested_values`, `confirmed_transaction_id`, a source URL, a
 * confidence value, `user_id` and `workspace_id` cannot be sent even by
 * mistake.
 */
export function buildCaptureUpdatePayload(form, capture) {
  const reviewVersion = getReviewVersion(capture);
  if (reviewVersion == null) return null;

  const changes = getCaptureChanges(form, capture);
  if (Object.keys(changes).length === 0) return null;

  const payload = { review_version: reviewVersion };

  Object.entries(changes).forEach(([field, value]) => {
    const isId = field === "account_id" || field === "category_id";
    payload[field] = isId && value !== null ? Number(value) : value;
  });

  return payload;
}

/*
 * Client-side validation: fast feedback only — the backend stays the
 * authority, and its 422 is mapped onto these same fields.
 *
 * Every PATCH field is documented as optional, so an empty field is never an
 * error here: a draft may legitimately be incomplete, and inventing a required
 * field would block saving work in progress. What completeness Confirm demands
 * is Confirm's business, not this form's.
 *
 * Returns `{ field: [message] }`, the shape the other forms in this project
 * use for both client and backend errors.
 */
export function validateCaptureForm(form, { t, account } = {}) {
  const errors = {};
  const value = (field) => String(form?.[field] ?? "").trim();
  const add = (field, key, options) => {
    errors[field] = [t(`dashboard.aiCaptures.validation.${key}`, options)];
  };

  /*
   * The expense total is documented as a positive decimal, so the shared
   * `getAmountError` applies. Tax and fee are documented only as monetary
   * fields: whether either may be negative, or zero, is the backend's rule to
   * state, so only the format is checked here and nothing else is assumed.
   */
  const amount = value("amount");
  if (amount) {
    const amountError = getAmountError(amount);
    if (amountError) errors.amount = [t(`dashboard.transactions.validation.${amountError}`)];
  }

  ["tax_amount", "fee_amount"].forEach((field) => {
    const money = value(field);
    if (!money || MONEY_FORMAT.test(money)) return;

    errors[field] = [
      t(
        /^[+-]?\d+\.\d{5,}$/.test(money)
          ? "dashboard.transactions.validation.amountDecimals"
          : "dashboard.transactions.validation.amountInvalid",
      ),
    ];
  });

  const currency = value("currency_code").toUpperCase();

  if (currency && !CURRENCY.test(currency)) {
    add("currency_code", "currencyInvalid");
  } else if (currency && account?.currency_code && currency !== account.currency_code) {
    /*
     * The backend rejects a currency that isn't the account's. Choosing an
     * account already syncs it, so this only fires when the user then picks a
     * different one by hand — and it says so before the request is made.
     */
    add("currency_code", "currencyMismatch", { currency: account.currency_code });
  }

  const date = value("transaction_date");
  if (date && !DATE.test(date)) add("transaction_date", "dateInvalid");

  const time = value("transaction_time");
  if (time && !TIME.test(time)) add("transaction_time", "timeInvalid");

  if (value("reference_number").length > REFERENCE_NUMBER_MAX) {
    add("reference_number", "referenceTooLong", { max: REFERENCE_NUMBER_MAX });
  }

  if (value("description").length > CAPTURE_DESCRIPTION_MAX) {
    add("description", "descriptionTooLong", { max: CAPTURE_DESCRIPTION_MAX });
  }

  return errors;
}

/*
 * The capture after a successful PATCH or Retry.
 *
 * Both responses may be partial: PATCH documents `id`, `status`,
 * `review_version` and only the `review_values` that were sent, and Retry
 * documents `id` and `status` alone. Absence is not deletion, so what it returns is authoritative and
 * what it omits is kept — `ai_suggested_values`, `warnings`, source
 * information and every other GET-only field survive a save.
 *
 * `review_values` is merged key by key for the same reason. The two value
 * objects are never crossed: no suggestion is copied into the draft here, or
 * anywhere else.
 *
 * A full GET is a different case and is NOT merged: it is the whole record,
 * so the page replaces the capture with it. That is how a reprocessed capture
 * gets fresh `ai_suggested_values` and warnings rather than keeping stale
 * ones — see the poller in AiExpenseCaptureDetails.
 */
export function mergeCaptureUpdate(current, updated) {
  if (!isCaptureEntity(updated)) return current;

  const merged = { ...current, ...updated };

  if (Object.hasOwn(updated, "review_values")) {
    merged.review_values = { ...getReviewValues(current), ...getReviewValues(updated) };
  }

  return merged;
}

/* ---------- Retry and status polling ---------- */

/*
 * The backend still owes a result, so GET /ai/expense-captures/{id} is worth
 * repeating. This is exactly `PROCESSING_STATUSES` — `uploaded`, `queued`,
 * `processing` — which is the complement of the documented stopping set
 * (`ready_for_review`, `failed`, `confirmed`, `discarded`). `uploaded` is
 * included for the same reason it counts as processing everywhere else:
 * nothing in the UI can advance it, so leaving it unpolled would strand the
 * page on a state only the backend can change.
 */
export const isCaptureInFlight = (capture) => isCaptureProcessing(getCaptureStatus(capture));

/*
 * Delay before each status check, growing so a slow capture doesn't keep
 * asking at the same rate. The first check is deliberately seconds away, not
 * milliseconds: AI processing is not going to finish in 300ms, and hammering
 * the endpoint would cost the user a rate limit.
 */
const POLL_DELAYS_MS = [2500, 3000, 4000, 5000, 8000];
const POLL_STEADY_MS = 10_000;

/*
 * The cap. 5 growing delays plus 25 steady ones is roughly four and a half
 * minutes, after which the page stops on its own and offers a manual refresh.
 * Polling never runs forever, and stopping says nothing about the capture:
 * the backend's status remains the only truth.
 */
export const MAX_CAPTURE_POLLS = 30;

export const getCapturePollDelay = (count) => POLL_DELAYS_MS[count] ?? POLL_STEADY_MS;

// Codes where checking again cannot help. Same set the imports poller uses.
export const CAPTURE_FATAL_POLL_CODES = ["NOT_FOUND", "FORBIDDEN", "UNAUTHENTICATED"];

/*
 * A write the backend refused because the capture is in the wrong state —
 * a retry on something that is no longer `failed`, a discard on something
 * that can no longer be discarded.
 *
 * Neither request sends a body, so their 422 cannot be about a field: the
 * only thing left to validate is the capture's own state. The answer is one
 * fresh GET to see where the lifecycle actually is — never another write.
 *
 * A 409 is deliberately NOT treated this way: with an Idempotency-Key in
 * play it means "the same request is still being processed", which a refetch
 * would not explain.
 */
export const isLifecycleRejection = (error) => error?.code === "VALIDATION_ERROR";

/*
 * A write whose outcome is genuinely unknown — a timeout, a dead connection,
 * a 5xx or an unreadable body. The backend may or may not have acted, so
 * nothing may claim it did; the honest next step is a GET, not a second POST.
 *
 * It matters for Retry, and it matters far more for Confirm: there the
 * request that may or may not have landed creates real money.
 */
export const isUncertainOutcome = (error) => UNKNOWN_OUTCOME_CODES.includes(error?.code);

/* ---------- Confirm (POST /ai/expense-captures/{id}/confirm) ---------- */

/*
 * The confirm body, or `null` when there is no version to confirm against.
 *
 * It carries **`review_version` and nothing else**. Every financial field —
 * account, category, merchant, amount, currency, dates, tax, fee,
 * description — is read by the backend from the draft it already saved, so
 * sending any of them here would be a second, unreviewed source of truth for
 * money. `ai_suggested_values`, `review_values`, `status`,
 * `confirmed_transaction_id`, `user_id` and `workspace_id` are likewise
 * never sent.
 *
 * The version is the newest the backend gave us. It is never guessed, never
 * defaulted to 0 and never incremented locally.
 */
export function buildCaptureConfirmPayload(capture) {
  const reviewVersion = getReviewVersion(capture);
  return reviewVersion == null ? null : { review_version: reviewVersion };
}

/*
 * POST /ai/expense-captures/{id}/confirm → `data.capture` and
 * `data.transaction`. Neither is assumed to be at `data` itself, and the
 * transaction is optional: a replayed idempotent request or a leaner response
 * may carry only the capture, which still has `confirmed_transaction_id`.
 */
export function parseConfirmResponse(response) {
  const capture = response?.data?.capture;
  const transaction = response?.data?.transaction;

  return {
    capture: isCaptureEntity(capture) ? capture : null,
    transaction: isObject(transaction) && transaction.id != null ? transaction : null,
  };
}

/*
 * Whether the saved draft holds what an expense needs. Returns the field
 * names that are missing, so the UI can name them rather than saying "invalid".
 */
export const getConfirmBlockers = (values) =>
  CAPTURE_CONFIRM_REQUIRED_FIELDS.filter(
    (field) => String(values?.[field] ?? "").trim() === "",
  );

// A 422 that names one of the fields the review form actually renders.
const hasReviewFieldErrors = (error) =>
  isObject(error?.errors) &&
  Object.keys(error.errors).some((field) => CAPTURE_EDITABLE_FIELDS.includes(field));

/*
 * What a failed Confirm actually means, because a 422 arrives for several
 * very different reasons and each needs its own answer:
 *
 * - "version"   — a stale `review_version`. The draft moved underneath us:
 *                 reload it and let the user look again. Never resend.
 * - "balance"   — the documented insufficient-balance refusal. NOTHING was
 *                 created, so no financial state changed anywhere.
 * - "fields"    — ordinary validation of the saved draft. The messages go
 *                 back onto the review form's own controls.
 * - "lifecycle" — a 422 that names nothing we render: the capture is most
 *                 likely no longer `ready_for_review`. One GET to see where
 *                 it really is, never another POST.
 *
 * `null` for anything that is not a 422 — those are handled by code.
 */
export function getConfirmErrorKind(error) {
  if (error?.code !== "VALIDATION_ERROR") return null;
  if (isCaptureVersionConflict(error)) return "version";
  if (isInsufficientBalanceError(error)) return "balance";
  if (hasReviewFieldErrors(error)) return "fields";
  return "lifecycle";
}

// Only the review fields, so a backend error for something the form doesn't
// render is never silently attached to the wrong control.
export const getConfirmFieldErrors = (error) =>
  Object.fromEntries(
    Object.entries(isObject(error?.errors) ? error.errors : {}).filter(([field]) =>
      CAPTURE_EDITABLE_FIELDS.includes(field),
    ),
  );

/* ---------- Upload (POST /ai/expense-captures) ---------- */

/*
 * A local check before the bytes leave the browser, so an obviously wrong
 * file fails instantly instead of after a slow upload. It is a courtesy, not
 * a rule: the backend's own validation is the authority and may refuse a file
 * this accepts.
 *
 * Returns a validation key, or null when the file is worth sending.
 */
export function getCaptureUploadError(file) {
  if (!file) return "fileRequired";

  // An empty `type` happens on some platforms; the backend decides those.
  if (file.type && !CAPTURE_UPLOAD_TYPES.includes(file.type.toLowerCase())) {
    return "fileType";
  }

  return file.size > CAPTURE_UPLOAD_MAX_BYTES ? "fileTooLarge" : null;
}

/*
 * The upload route is not in the documented Sprint 7 contract, so it may
 * simply not exist on the backend. A 404 or a 405 means exactly that, and it
 * must not be reported as a problem with the receipt: the honest message is
 * that the service isn't available, which is also what tells us the contract
 * question is still open.
 */
export const isMissingUploadRoute = (error) =>
  error?.status === 404 || error?.status === 405;

/*
 * One stable fingerprint per chosen file, so retrying an upload whose outcome
 * is unknown reuses its Idempotency-Key instead of creating a second capture
 * of the same receipt. Picking a different file is a different upload.
 */
export const getUploadFingerprint = (file) => ({
  name: file?.name ?? "",
  size: file?.size ?? 0,
  modified: file?.lastModified ?? 0,
});
