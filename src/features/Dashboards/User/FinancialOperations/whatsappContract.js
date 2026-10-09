import { ApiError, createIdempotencyKey } from "../api/apiClient.js";

/*
 * WhatsApp integration contract, verified against smartspend-backend
 * `feature/whatsapp-availability-contract` @ b7ca549. Pure helpers only: no
 * network, no storage, no module state. See docs/whatsapp/.
 */

export const WHATSAPP_DISABLED_CODE = "whatsapp_disabled";
export const WHATSAPP_STATES = Object.freeze(["disabled", "not_linked", "linked"]);
export const WHATSAPP_DRAFT_STATUSES = Object.freeze([
  "collecting", "ready_for_review", "confirmed", "discarded", "expired",
]);
export const WHATSAPP_CHALLENGE_STATUSES = Object.freeze([
  "pending", "sender_verified", "confirmed", "expired", "cancelled",
]);
export const WHATSAPP_LANGUAGES = Object.freeze(["ar", "en"]);

const DRAFT_LIST_KEYS = ["status", "date", "account", "per_page", "page"];
const DRAFT_EDITABLE_FIELDS = [
  "account_id", "category_id", "amount", "description", "transaction_date", "transaction_time",
];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function whatsappInputError(field, message) {
  return new ApiError("Invalid WhatsApp request.", {
    code: "WHATSAPP_INPUT_INVALID", errors: { [field]: [message] },
  });
}

// Never carries the response body: a creation response holds a link token.
const malformed = () => new ApiError("", { code: "MALFORMED_RESPONSE" });

/* ---------------------------------------------------------------- errors */

/** Backend 409 `whatsapp_disabled`: feature off. Not a network error, never retried. */
export function isWhatsAppDisabledError(error) {
  return error?.status === 409 && error?.serverCode === WHATSAPP_DISABLED_CODE;
}

export const isAbortError = (error) => error?.name === "AbortError";

/**
 * Whether the request may have been applied although no answer arrived.
 * A confirmation in this state must be re-read, never blindly resent.
 */
export function isOutcomeUncertain(error) {
  return ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR", "MALFORMED_RESPONSE"].includes(error?.code);
}

/**
 * One stable class for UI code. A 409 that is not `whatsapp_disabled` is
 * "conflict": for draft writes that is a stale `review_version` or a
 * reused Idempotency-Key, and the caller must re-read the draft.
 */
export function classifyWhatsAppError(error) {
  if (isAbortError(error)) return "aborted";
  if (isWhatsAppDisabledError(error)) return "disabled";

  switch (error?.code) {
    case "UNAUTHENTICATED": return "unauthenticated";
    case "FORBIDDEN": return "forbidden";
    case "NOT_FOUND": return "not_found";
    case "CONFLICT": return "conflict";
    case "VALIDATION_ERROR":
    case "WHATSAPP_INPUT_INVALID": return "validation";
    case "RATE_LIMITED": return "rate_limited";
    case "TIMEOUT": return "timeout";
    case "NETWORK_ERROR": return "network";
    case "MALFORMED_RESPONSE": return "malformed";
    case "SERVER_ERROR": return "server";
    default: return "unknown";
  }
}

/** Polling a challenge must stop on these errors, or on a settled challenge. */
export function shouldStopChallengePolling(errorOrChallenge) {
  if (errorOrChallenge instanceof Error) {
    const kind = classifyWhatsAppError(errorOrChallenge);
    return ["disabled", "unauthenticated", "forbidden", "not_found", "aborted"].includes(kind);
  }

  return ["sender_verified", "confirmed", "expired", "cancelled"].includes(errorOrChallenge.status);
}

/* ------------------------------------------------------------ identifiers */

export function requireWhatsAppId(value, field = "draft_id") {
  const number = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 1) {
    throw whatsappInputError(field, "A positive integer identifier is required.");
  }
  return number;
}

/** The temporary link token (hex today); only characters safe inside a URL path. */
export function requireChallengeToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    throw whatsappInputError("token", "A valid link token is required.");
  }
  return token;
}

/** Same rule as the backend's ReadsIdempotencyKey (8..255 of A-Za-z0-9._:-). */
export function requireIdempotencyKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,255}$/.test(value)) {
    throw whatsappInputError("idempotency_key", "Keep one valid Idempotency-Key per logical confirmation.");
  }
  return value;
}

export function requireReviewVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw whatsappInputError("review_version", "Use the review version returned by the server.");
  }
  return value;
}

/** Create ONCE per logical confirmation and keep it across retries and uncertain outcomes. */
export function createWhatsAppConfirmAttempt(draftId, reviewVersion) {
  return Object.freeze({
    draftId: requireWhatsAppId(draftId),
    reviewVersion: requireReviewVersion(reviewVersion),
    idempotencyKey: createIdempotencyKey(`wa-draft-${draftId}-confirm`),
  });
}

/* --------------------------------------------------------------- requests */

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Exact decimal string, at most 4 places; never touches Number. */
export function normalizeWhatsAppAmount(value) {
  if (typeof value !== "string") {
    throw whatsappInputError("amount", "The amount must be a decimal string.");
  }
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) {
    throw whatsappInputError("amount", "Use a positive decimal with at most four decimal places.");
  }
  const [rawInteger, fraction = ""] = text.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  if (integer.length > 15 || !/[1-9]/.test(integer + fraction)) {
    throw whatsappInputError("amount", "The amount must be positive and fit DECIMAL(19,4).");
  }
  return `${integer}.${fraction.padEnd(4, "0")}`;
}

/** Only the filters the backend documents; unknown keys (other modules' names) are dropped. */
export function buildDraftListQuery(query = {}) {
  const source = isRecord(query) ? query : {};
  const picked = {};

  for (const key of DRAFT_LIST_KEYS) {
    const value = source[key];
    if (value === undefined || value === null || value === "") continue;

    if (key === "status") {
      if (!WHATSAPP_DRAFT_STATUSES.includes(value)) throw whatsappInputError(key, "Unknown draft status.");
      picked.status = value;
    } else if (key === "date") {
      if (typeof value !== "string" || !validDate(value)) throw whatsappInputError(key, "Use YYYY-MM-DD.");
      picked.date = value;
    } else if (key === "per_page") {
      const number = requireWhatsAppId(value, key);
      if (number > 100) throw whatsappInputError(key, "per_page must be between 1 and 100.");
      picked.per_page = number;
    } else {
      picked[key] = requireWhatsAppId(value, key);
    }
  }

  return picked;
}

function editableValue(field, value) {
  if (field === "transaction_date") {
    if (typeof value !== "string" || !validDate(value.trim())) {
      throw whatsappInputError(field, "A valid YYYY-MM-DD date is required; it cannot be cleared.");
    }
    return value.trim();
  }

  if (value === null || value === "") return null;

  if (field === "account_id" || field === "category_id") return requireWhatsAppId(value, field);
  if (field === "amount") return normalizeWhatsAppAmount(value);

  if (typeof value !== "string") throw whatsappInputError(field, "Use text or null for this field.");
  const text = value.trim();

  if (field === "transaction_time") {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) {
      throw whatsappInputError(field, "Use a valid local time in HH:MM or HH:MM:SS format.");
    }
    return text;
  }

  if ([...text].length > 500) throw whatsappInputError(field, "This field exceeds 500 characters.");
  return text || null;
}

/**
 * Partial PATCH body. Omitted fields stay omitted. `currency_code` and every
 * other server-owned field are refused: currency follows the account.
 */
export function buildDraftUpdatePayload(values, reviewVersion) {
  if (!isRecord(values)) throw whatsappInputError("draft", "A field object is required.");

  const version = requireReviewVersion(reviewVersion);
  const unknown = Object.keys(values).filter((key) => !DRAFT_EDITABLE_FIELDS.includes(key));
  if (unknown.length) throw whatsappInputError(unknown[0], "This field cannot be edited.");

  const payload = { review_version: version };
  for (const field of DRAFT_EDITABLE_FIELDS) {
    if (Object.hasOwn(values, field) && values[field] !== undefined) {
      payload[field] = editableValue(field, values[field]);
    }
  }

  if (Object.keys(payload).length === 1) throw whatsappInputError("draft", "There is nothing to save.");
  return payload;
}

/** Confirmation reads the saved draft; it never carries edited values. */
export const buildDraftConfirmPayload = (reviewVersion) => ({
  review_version: requireReviewVersion(reviewVersion),
});

export function buildPreferencesPayload(values) {
  if (!isRecord(values)) throw whatsappInputError("preferences", "A preferences object is required.");

  const payload = {};
  if (Object.hasOwn(values, "language") && values.language !== undefined) {
    const language = typeof values.language === "string" ? values.language.trim().toLowerCase() : "";
    if (!WHATSAPP_LANGUAGES.includes(language)) throw whatsappInputError("language", "Use ar or en.");
    payload.language = language;
  }
  if (Object.hasOwn(values, "default_account_id") && values.default_account_id !== undefined) {
    payload.default_account_id = values.default_account_id === null
      ? null
      : requireWhatsAppId(values.default_account_id, "default_account_id");
  }

  const extra = Object.keys(values).filter((key) => !["language", "default_account_id"].includes(key));
  if (extra.length) throw whatsappInputError(extra[0], "This preference cannot be changed.");
  if (!Object.keys(payload).length) throw whatsappInputError("preferences", "There is nothing to save.");
  return payload;
}

/* -------------------------------------------------------------- responses */

const dataOf = (response) => {
  if (!isRecord(response?.data)) throw malformed();
  return response.data;
};
const nullableString = (value) => (typeof value === "string" ? value : null);

function parseAccount(account) {
  if (!isRecord(account)) return null;
  return {
    ...account,
    // Exact string or null. A missing balance is never turned into zero.
    current_balance: typeof account.current_balance === "string" ? account.current_balance : null,
  };
}

function parseIntegration(integration) {
  if (integration === null || integration === undefined) return null;
  if (!isRecord(integration) || typeof integration.linked !== "boolean") throw malformed();

  // Whitelist: nothing the backend might add later (identifiers, hashes) is passed on.
  return {
    linked: integration.linked,
    status: nullableString(integration.status),
    workspace_id: integration.workspace_id ?? null,
    phone_last_digits: nullableString(integration.phone_last_digits),
    language: nullableString(integration.language),
    generation: integration.generation ?? null,
    default_account_id: integration.default_account_id ?? null,
    default_account: parseAccount(integration.default_account),
    linked_at: nullableString(integration.linked_at),
    revoked_at: nullableString(integration.revoked_at),
  };
}

/**
 * GET /integrations/whatsapp. Availability comes only from `enabled`, `state`
 * and `capabilities`; a present `integration` says nothing about it (a
 * disabled feature keeps its old link visible).
 */
export function parseWhatsAppAvailability(response) {
  const data = dataOf(response);
  const { capabilities } = data;

  if (typeof data.enabled !== "boolean" || !WHATSAPP_STATES.includes(data.state) || !isRecord(capabilities)) {
    throw malformed();
  }
  const flags = ["can_link", "can_manage_link", "can_review_drafts"];
  if (flags.some((flag) => typeof capabilities[flag] !== "boolean")) throw malformed();

  return {
    enabled: data.enabled,
    state: data.state,
    capabilities: {
      can_link: capabilities.can_link,
      can_manage_link: capabilities.can_manage_link,
      can_review_drafts: capabilities.can_review_drafts,
    },
    integration: parseIntegration(data.integration),
  };
}

export function parseIntegrationResponse(response) {
  const integration = parseIntegration(dataOf(response).integration);
  if (!integration) throw malformed();
  return integration;
}

function parseChallenge(challenge) {
  if (!isRecord(challenge) || !WHATSAPP_CHALLENGE_STATUSES.includes(challenge.status)) throw malformed();
  return {
    status: challenge.status,
    sender_verified: challenge.sender_verified === true,
    phone_last_digits: nullableString(challenge.phone_last_digits),
    expires_at: nullableString(challenge.expires_at),
    sender_verified_at: nullableString(challenge.sender_verified_at),
    confirmed_at: nullableString(challenge.confirmed_at),
    cancelled_at: nullableString(challenge.cancelled_at),
  };
}

export const parseChallengeStatusResponse = (response) => parseChallenge(dataOf(response).challenge);

/**
 * Creation response. `linking.token` exists only here: hold it in component
 * state for display, never in storage, logs or analytics.
 */
export function parseCreatedChallengeResponse(response) {
  const data = dataOf(response);
  const { linking } = data;
  if (!isRecord(linking) || typeof linking.token !== "string" || !linking.token) throw malformed();

  return {
    challenge: parseChallenge(data.challenge),
    linking: {
      token: linking.token,
      public_number: nullableString(linking.public_number),
      message: nullableString(linking.message),
    },
  };
}

function parseIssues(confirmation) {
  if (!isRecord(confirmation) || typeof confirmation.ready !== "boolean" || !Array.isArray(confirmation.issues)) {
    throw malformed();
  }
  // Unknown codes and extra keys are kept as sent.
  return confirmation.issues.map((issue) => {
    if (!isRecord(issue) || typeof issue.code !== "string") throw malformed();
    return { ...issue };
  });
}

export function parseWhatsAppDraft(draft) {
  if (
    !isRecord(draft) || !Number.isSafeInteger(draft.id) || !isRecord(draft.review_values)
    || !WHATSAPP_DRAFT_STATUSES.includes(draft.status) || !Number.isSafeInteger(draft.review_version)
  ) {
    throw malformed();
  }

  const values = draft.review_values;
  if (values.amount !== null && values.amount !== undefined && typeof values.amount !== "string") throw malformed();

  const issues = parseIssues(draft.confirmation);
  const canConfirm = draft.can_confirm === true;

  return {
    ...draft,
    can_edit: draft.can_edit === true,
    can_confirm: canConfirm,
    can_discard: draft.can_discard === true,
    review_values: {
      ...values,
      amount: values.amount ?? null,
      // A missing date stays missing; it is never replaced by today.
      transaction_date: values.transaction_date ?? null,
      transaction_time: values.transaction_time ?? null,
    },
    confirmation: { ready: draft.confirmation.ready, issues },
    // The only condition for enabling Confirm. The backend still re-checks.
    canConfirmNow: canConfirm && draft.confirmation.ready === true,
    account: parseAccount(draft.account),
  };
}

export const parseDraftResponse = (response) => parseWhatsAppDraft(dataOf(response).draft);

export function parseDraftsPageResponse(response) {
  const page = dataOf(response).drafts;
  if (!isRecord(page) || !Array.isArray(page.data)) throw malformed();

  return {
    items: page.data.map(parseWhatsAppDraft),
    pagination: {
      currentPage: page.current_page ?? 1,
      perPage: page.per_page ?? page.data.length,
      total: page.total ?? page.data.length,
      lastPage: page.last_page ?? 1,
      from: page.from ?? null,
      to: page.to ?? null,
    },
  };
}

export function parseDraftSummaryResponse(response) {
  const count = dataOf(response).pending_review_count;
  if (!Number.isSafeInteger(count) || count < 0) throw malformed();
  return { pendingReviewCount: count };
}

/** Confirmation response: the updated draft plus the Backend transaction, untouched. */
export function parseConfirmResponse(response) {
  const data = dataOf(response);
  if (!isRecord(data.transaction)) throw malformed();
  return { draft: parseWhatsAppDraft(data.draft), transaction: data.transaction };
}

/** After an uncertain confirmation: what a re-read draft says happened. */
export function resolveConfirmationOutcome(draft) {
  if (draft?.status === "confirmed") return "confirmed";
  if (draft?.status === "ready_for_review") return "still_open";
  return "closed";
}
