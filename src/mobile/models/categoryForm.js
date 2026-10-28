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
 * What an error means for the write that caused it.
 *
 *   identity   the signed-in identity changed: the screen is gone, nothing is claimed
 *   rejected   the server answered with a 4xx: it looked at the request and refused it,
 *              so the write did not happen (401 session ended, 403, 404, 409, 422, 429, ...)
 *   unknown    everything else: no answer (network, timeout, the user left), a 5xx, an
 *              answer that is not the documented envelope, an envelope that says
 *              failure with a success status. The server may have done it.
 *
 * "Unknown" is never shown as a failure and never retried by itself.
 */
export function classifyOutcome(error) {
  if (error?.code === "IDENTITY_CHANGED") return { kind: "identity" };

  const status = Number.isInteger(error?.status) ? error.status : 0;
  if (error?.name === "ApiError" && status >= 400 && status < 500) return { kind: "rejected", code: error.code, error };

  return { kind: "unknown", code: error?.code ?? "UNKNOWN" };
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
