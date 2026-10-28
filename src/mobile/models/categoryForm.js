import { CATEGORY_TYPES, NAME_MAX, normalizeCategory } from "./categories.js";
import { idText, isRecord } from "./values.js";

/*
 * What a category write may say, what counts as proof it happened, and what an
 * answer (or the lack of one) means. Pure: no React, no requests, no storage.
 *
 * Fields (docs/categories/api.md): POST sends workspace_id, name, type (color and
 * icon are optional there and are not offered in Mobile); PATCH sends only the
 * fields that changed, and Mobile changes only `name`. The type is chosen when a
 * category is created and is NOT editable here: changing it changes what the
 * category's existing transactions mean, and Mobile does not take that decision
 * (the full version asks for an explicit confirmation of it). `is_active` is never
 * sent, and there is no archive or delete.
 */

/** "required" | "tooLong" | null. The name is trimmed first; its length is counted in characters, like the backend's max of 255. */
export function validateName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) return "required";
  return [...name].length > NAME_MAX ? "tooLong" : null;
}

export const validateType = (value) => (CATEGORY_TYPES.includes(value) ? null : "required");

/** The session workspace as the backend expects it in the body, or null when it is not a plain id (then nothing is sent). */
export function workspaceIdForBody(workspace) {
  const value = workspace?.id;
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !idText(value)) return null;

  const parsed = parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function buildCreatePayload({ workspaceId, name, type }) {
  return { workspace_id: workspaceId, name: String(name).trim(), type };
}

export const buildUpdatePayload = ({ name }) => ({ name: String(name).trim() });

/*
 * Proof that a create happened: the answer carries a category with an id, the
 * name and type that were sent, that is not a system category, and (when it says)
 * in the workspace it was sent for. Anything less is not "created": the request
 * may well have been processed, so the caller treats it as unknown. Returns the
 * server's category, or null.
 */
export function confirmCreate(data, sent) {
  const category = normalizeCategory(isRecord(data) ? data.category : null);

  if (!category) return null;
  if (category.name !== sent.name.trim() || category.type !== sent.type) return null;
  if (category.system !== false || category.active === false) return null;
  if (category.workspaceId && String(category.workspaceId) !== String(sent.workspaceId)) return null;

  return category;
}

/** Proof that an edit happened: the same category, now with the name that was sent. */
export function confirmUpdate(data, categoryId, sentName) {
  const category = normalizeCategory(isRecord(data) ? data.category : null);
  return category && category.id === String(categoryId) && category.name === String(sentName).trim() ? category : null;
}

/*
 * What an error means for the write that caused it, for each operation.
 *
 * "rejected" is claimed only where the documented contract says the server
 * refused the request (docs/categories/api.md): a 422 is its validation of the
 * fields (name, type), a 403 is "system category, or one you can't manage", and,
 * for a rename only, a 404 is "doesn't exist or isn't yours". The backend source
 * was not available, so even these rest on the documentation, not on the code.
 *
 * Everything else is "unknown", because nothing documented says the write did not
 * happen: 400, 408, 409 (no category meaning is documented), 429 (a rate limit may
 * sit before or after the work), 401 (where the token is checked is not verified),
 * a 404 for a create, 5xx, no answer (network, timeout, abort), an answer that is
 * not the envelope, a failure envelope with a success status.
 *
 *   identity   the signed-in identity changed: the screen is gone, nothing is claimed
 *   rejected   the server refused it, by the contract: the person may change and send again
 *   unknown    it may or may not have happened: shown as such, never sent again by itself
 */
const REJECTED_BY_CONTRACT = {
  create: { 403: "FORBIDDEN", 422: "VALIDATION_ERROR" },
  update: { 403: "FORBIDDEN", 404: "NOT_FOUND", 422: "VALIDATION_ERROR" },
};

export function classifyOutcome(error, operation) {
  if (error?.code === "IDENTITY_CHANGED") return { kind: "identity" };
  // The write gate refused before anything was sent (data/writeGate.js): certainly not applied.
  if (error?.name === "WriteClosedError") return { kind: "rejected", code: "WRITE_CLOSED", error };

  const status = Number.isInteger(error?.status) ? error.status : 0;
  const code = REJECTED_BY_CONTRACT[operation]?.[status];
  if (error?.name === "ApiError" && code && error.code === code) return { kind: "rejected", code, error };

  return { kind: "unknown", code: error?.code ?? error?.name ?? "UNKNOWN", status };
}

/** Field messages from a 422: the first message of each field Mobile has an input for. */
export function fieldErrorsOf(error) {
  const errors = isRecord(error?.errors) ? error.errors : {};
  const pick = (field) => {
    const value = errors[field];
    const text = Array.isArray(value) ? value.find((item) => typeof item === "string") : typeof value === "string" ? value : null;
    return text ? text.slice(0, 300) : null;
  };

  return { name: pick("name"), type: pick("type") };
}
