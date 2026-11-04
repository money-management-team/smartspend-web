/*
 * Keeps a financial write's Idempotency-Key alive across a reload, so an
 * "unknown outcome" (timeout, network error, 5xx, a still-processing 409 —
 * transactionHelpers.js's DEFINITIVE_REJECTIONS) can be safely retried after
 * the page comes back, instead of minting a fresh key that could record the
 * same money twice if the first request actually went through.
 *
 * What is stored, and why it is safe to:
 *   - the Idempotency-Key itself: already sent as a plain HTTP header on
 *     every request; createIdempotencyKey names nothing about the money.
 *   - a non-reversible HASH of the request's canonical fingerprint (cyrb53,
 *     the same algorithm Mobile's identity guard already uses to compare a
 *     token without storing it — src/mobile/identity/guard.js) — never the
 *     fingerprint itself. The amount, account, category, description and
 *     every other field stay in createIdempotentAttempt's memory only; a
 *     hash collision is not a safety problem either, since the backend hashes
 *     the real payload itself and answers a mismatch with 409.
 *   - the operation's prefix label (e.g. "operation", "debt-payment") — a
 *     category name, not a value.
 *   - when it was written, for expiry.
 *
 * What is never stored here: the bearer token, the payload, any amount,
 * account id, category, description or reference text.
 *
 * Scope: one entry per (signed-in user, workspace, prefix) — the same "one
 * attempt" createIdempotentAttempt already keeps per component, so one
 * storage slot matches it exactly. A different user or workspace reads a
 * completely different key, never this one; see entryKey().
 *
 * Expiry: 24 hours, matching the backend's own idempotency reservation
 * window (App\Domain\Finance\Services\IdempotencyService:
 * "expires_at => now()->addDay()"). Past that point the backend's own
 * handling of a replayed key is no longer the thing this was protecting
 * against, so a fresh key is strictly safer than holding on to an old one.
 *
 * localStorage only, never sessionStorage: a PWA (and some mobile browsers)
 * can be torn down and relaunched by the OS between a tap and its answer,
 * which sessionStorage would not survive.
 */

const VERSION = "v1";
const TTL_MS = 24 * 60 * 60 * 1000;

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** cyrb53: the exact algorithm src/mobile/identity/guard.js uses, kept as its own copy (Desktop and Mobile never import each other's modules). */
export function hashFingerprint(text) {
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

const entryKey = (userId, workspaceId, prefix) =>
  `smartspend:pending-write:${VERSION}:u:${userId}:w:${workspaceId ?? "none"}:${prefix}`;

/**
 * The still-valid entry for this exact slot and fingerprint hash, or null —
 * for a missing entry, a corrupted one, an expired one, or one whose hash
 * does not match (a different logical request; the caller mints a fresh key
 * for it instead of reusing this slot's).
 */
export function readPendingWrite({ userId, workspaceId, prefix, hash }) {
  const storage = getStorage();
  if (!storage || userId == null) return null;

  let raw;
  try {
    raw = storage.getItem(entryKey(userId, workspaceId, prefix));
  } catch {
    return null;
  }
  if (!raw) return null;

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !record ||
    typeof record !== "object" ||
    record.v !== VERSION ||
    typeof record.key !== "string" ||
    typeof record.hash !== "string" ||
    !Number.isFinite(record.createdAt)
  ) {
    return null;
  }

  if (Date.now() - record.createdAt > TTL_MS) return null;
  if (record.hash !== hash) return null;

  return { key: record.key };
}

/** Writes the entry; returns whether it actually landed in storage. */
export function writePendingWrite({ userId, workspaceId, prefix, key, hash }) {
  const storage = getStorage();
  if (!storage || userId == null) return false;

  try {
    storage.setItem(
      entryKey(userId, workspaceId, prefix),
      JSON.stringify({ v: VERSION, key, hash, createdAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Best-effort removal of one slot (a confirmed success or a definitive rejection: nothing left to protect). */
export function clearPendingWrite({ userId, workspaceId, prefix }) {
  const storage = getStorage();
  if (!storage || userId == null) return;

  try {
    storage.removeItem(entryKey(userId, workspaceId, prefix));
  } catch {
    // Nothing more to do: the entry will simply expire on its own.
  }
}

/** Every pending write for this user, across every workspace and prefix — called on sign-out (api/apiClient.js's clearAuthSession). */
export function clearPendingWritesForUser(userId) {
  const storage = getStorage();
  if (!storage || userId == null) return;

  const prefix = `smartspend:pending-write:${VERSION}:u:${userId}:`;
  let keys;
  try {
    keys = Object.keys(storage).filter((name) => name.startsWith(prefix));
  } catch {
    return;
  }

  keys.forEach((name) => {
    try {
      storage.removeItem(name);
    } catch {
      // Best effort; an entry left behind still expires within TTL_MS.
    }
  });
}
