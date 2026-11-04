import { fingerprint, readStoredIdentity } from "../identity/guard.js";
import { sessionWorkspace } from "./readApi.js";

/*
 * Keeps a Mobile form's Idempotency-Key alive across a reload, so an
 * "unknown outcome" (the SAME meaning useWorkflowSubmit.js already gives
 * it: a timeout, the network, a 5xx, or any 409 other than
 * possible_duplicate) can be safely retried after the page comes back,
 * instead of minting a fresh key that could record the same money twice if
 * the first request actually went through. Writes stay closed either way
 * (data/writeGate.js); this only protects a key that WOULD be sent once a
 * write is opened.
 *
 * What is stored, and why it is safe to:
 *   - the Idempotency-Key itself: already sent as a plain HTTP header on
 *     every request (data/writeApi.js's newWriteKey); it names nothing
 *     about the money.
 *   - a non-reversible HASH of the write's canonical fingerprint —
 *     identity/guard.js's own fingerprint() (cyrb53), the SAME function this
 *     file already uses to compare a token without storing it — never the
 *     fingerprint itself. The amount, account, category, description and
 *     every other field stay in useWorkflowSubmit.js's memory only; a hash
 *     collision is not a safety problem either, since the backend hashes
 *     the real payload itself and answers a mismatch with 409.
 *   - the write's operation name (e.g. "transaction.expense") — a category
 *     label, not a value.
 *   - when it was written, for expiry.
 *
 * What is never stored here: the bearer token, the write's input, any
 * amount, account id, category, description or reference text.
 *
 * Scope: one entry per (signed-in user, workspace, operation) — the same
 * "one pending write" useWorkflowSubmit.js already keeps per mounted form,
 * so one storage slot matches it exactly (preferences/deviceStore.js uses
 * the identical u:/w: scoping for the same reason). A different user or
 * workspace reads a completely different key, never this one.
 *
 * Expiry: 24 hours, matching the backend's own idempotency reservation
 * window (App\Domain\Finance\Services\IdempotencyService:
 * "expires_at => now()->addDay()"). Past that point the backend's own
 * handling of a replayed key is no longer the thing this was protecting
 * against, so a fresh key is strictly safer than holding on to an old one.
 *
 * localStorage only, never sessionStorage: a PWA can be torn down and
 * relaunched by the OS between a tap and its answer, which sessionStorage
 * would not survive.
 */

const VERSION = "v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const ID = /^[1-9]\d{0,14}$/;

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The current signed-in identity to scope a slot by, or null while it can't be read safely. */
function identity() {
  const stored = readStoredIdentity();
  if (!stored.available || stored.userId == null) return null;

  const workspaceId = sessionWorkspace()?.id;
  if (!ID.test(String(stored.userId)) || !ID.test(String(workspaceId ?? ""))) return null;

  return { userId: stored.userId, workspaceId };
}

const entryKey = (userId, workspaceId, operation) =>
  `smartspend:mobile:pending-write:${VERSION}:u:${userId}:w:${workspaceId}:${operation}`;

/** cyrb53 of the write's canonical fingerprint; never stored or sent anywhere. */
export const hashFingerprint = fingerprint;

/**
 * The still-valid entry for the current identity's slot and fingerprint
 * hash, or null — for no signed-in identity, a missing entry, a corrupted
 * one, an expired one, or one whose hash does not match (a different
 * logical write; the caller mints a fresh key for it instead of reusing
 * this slot's).
 */
export function readPendingWrite(operation, hash) {
  const storage = getStorage();
  const who = identity();
  if (!storage || !who) return null;

  let raw;
  try {
    raw = storage.getItem(entryKey(who.userId, who.workspaceId, operation));
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
export function writePendingWrite(operation, key, hash) {
  const storage = getStorage();
  const who = identity();
  if (!storage || !who) return false;

  try {
    storage.setItem(
      entryKey(who.userId, who.workspaceId, operation),
      JSON.stringify({ v: VERSION, key, hash, createdAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Best-effort removal of one slot (a confirmed success or a definitive rejection: nothing left to protect). */
export function clearPendingWrite(operation) {
  const storage = getStorage();
  const who = identity();
  if (!storage || !who) return;

  try {
    storage.removeItem(entryKey(who.userId, who.workspaceId, operation));
  } catch {
    // Nothing more to do: the entry will simply expire on its own.
  }
}

/** Every pending write for this user, across every workspace and operation — called on sign-out (identity/guard.js's own moment, mirrored at the app's single sign-out path). */
export function clearPendingWritesForUser(userId) {
  const storage = getStorage();
  if (!storage || userId == null) return;

  const prefix = `smartspend:mobile:pending-write:${VERSION}:u:${userId}:`;
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
