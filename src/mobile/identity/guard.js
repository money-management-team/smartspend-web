import { getStoredAuthSession } from "../../features/Dashboards/User/api/apiClient";

/*
 * Mobile's own identity check. It exists because the app's session lives in
 * two places that can disagree:
 *
 *   - the AuthProvider keeps "who is signed in" in memory, from when this tab
 *     loaded (or last signed in);
 *   - every API request reads its token from browser storage at the moment it
 *     is sent (apiClient.getAuthToken: localStorage first, then sessionStorage).
 *
 * Another tab can change storage underneath this one (sign out, or sign in as
 * someone else with "remember me"; the localStorage entry wins over this tab's
 * own sessionStorage). Then a screen still showing User A's figures would be
 * refreshing them with User B's token. Desktop does not guard against that and
 * is not changed here; Mobile refuses to continue instead.
 *
 * The guard is created for one identity (a fingerprint of its token plus the
 * user id, never the token) and compares it with what storage says now:
 *
 *   storage-unavailable   the browser blocks storage, so requests carry no token
 *   signed-out-elsewhere  storage holds no session any more
 *   changed-elsewhere     storage holds a different token or user
 *
 * Once it fails it stays failed (a latch). Nothing recovers it quietly: the
 * person reloads, and the app starts again from whatever storage says.
 */

export const IDENTITY_REASONS = Object.freeze(["storage-unavailable", "signed-out-elsewhere", "changed-elsewhere"]);

export class IdentityError extends Error {
  constructor(reason) {
    super(`The signed-in identity is no longer consistent (${reason}).`);
    this.name = "IdentityError";
    this.code = "IDENTITY_CHANGED";
    this.reason = reason;
  }
}

/*
 * A short non-cryptographic fingerprint (cyrb53), so Mobile can tell two
 * sessions apart and key its in-memory data by session without holding the
 * access token. It is compared locally and never stored or sent anywhere.
 */
export function fingerprint(text) {
  const value = String(text ?? "");
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}.${value.length}`;
}

function storageWorks(name) {
  try {
    globalThis[name].getItem("smartspend:storage-probe");
    return true;
  } catch {
    return false;
  }
}

/** What storage says right now, read the way the API client reads it. */
export function readStoredIdentity() {
  const available = storageWorks("localStorage") || storageWorks("sessionStorage");
  if (!available) return { available: false, token: null, userId: null };

  const { token, user } = getStoredAuthSession();

  return { available: true, token: token ?? null, userId: user?.id ?? null };
}

/** The identity of the session the Mobile tree was started for. */
export const identityOf = (token, userId) => ({ fingerprint: fingerprint(token), userId: userId ?? null });

export function createIdentityGuard(identity, { read = readStoredIdentity } = {}) {
  const listeners = new Set();
  let status = Object.freeze({ ok: true, reason: null });

  const failure = () => {
    const stored = read();

    if (!stored.available) return "storage-unavailable";
    if (!stored.token) return "signed-out-elsewhere";
    if (fingerprint(stored.token) !== identity.fingerprint) return "changed-elsewhere";
    if (identity.userId != null && stored.userId != null && String(stored.userId) !== String(identity.userId)) return "changed-elsewhere";

    return null;
  };

  const latch = (reason) => {
    if (!status.ok) return;
    status = Object.freeze({ ok: false, reason });
    listeners.forEach((listener) => listener());
  };

  const guard = {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Looks at storage now; fails the guard (for good) when it disagrees. */
    check() {
      if (status.ok) {
        const reason = failure();
        if (reason) latch(reason);
      }

      return status.ok;
    },
    /** Like check(), but throws: called right before a request is sent and right after its response. */
    assert() {
      if (!guard.check()) throw new IdentityError(status.reason);
    },
  };

  return guard;
}
