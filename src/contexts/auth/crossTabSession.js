/*
 * Whether another tab changed the identity this tab's requests use.
 *
 * apiRequest reads the token from storage on every call, so a sign-out, or a
 * sign-in as someone else, in another tab changes what this tab sends while its
 * screen still shows the earlier person. A `storage` event (fired only in the
 * OTHER tabs of the origin) is the signal; this file decides what it means.
 *
 * - "signed-out": the stored session is gone, this tab still shows one.
 * - "switched":   the stored token is not the one this tab shows (another person,
 *                 or a new sign-in), or another tab moved the session to a
 *                 different workspace id.
 * - null:         nothing that matters changed (a profile edit, the same
 *                 workspace written again, keys that are not the session's).
 *
 * The workspace is compared between the event's old and new value, not with
 * this tab's state: this tab's own pages write it to storage without telling the
 * provider (dashboardApi.resolveWorkspaceId), so the two can differ here without
 * any other tab being involved.
 */
export const SESSION_STORAGE_KEYS = Object.freeze(["ACCESS_TOKEN", "token", "token_type", "user", "workspace", "ROLE", "remember_login"]);

const idOf = (json) => {
  if (!json) return null;
  try {
    const id = JSON.parse(json)?.id;
    return id === undefined || id === null ? null : String(id);
  } catch {
    return null;
  }
};

/**
 * @param {{ key: string | null, oldValue: string | null, newValue: string | null }} event
 * @param {string | null} shownToken the token of the session this tab shows
 * @param {string | null} storedToken the token requests would send now
 */
export function crossTabChange(event, shownToken, storedToken) {
  if (event.key !== null && !SESSION_STORAGE_KEYS.includes(event.key)) return null;

  if (!shownToken && !storedToken) return null;
  if (shownToken && !storedToken) return "signed-out";
  if ((storedToken ?? null) !== (shownToken ?? null)) return "switched";
  if (event.key === "workspace" && idOf(event.oldValue) !== null && idOf(event.newValue) !== idOf(event.oldValue)) return "switched";

  return null;
}
