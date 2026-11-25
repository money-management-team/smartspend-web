import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

/*
 * Phase 6D: a financial write's Idempotency-Key survives a reload, so an
 * "unknown outcome" (timeout, network error, 5xx, a still-processing 409)
 * can be retried safely after the page comes back, instead of minting a
 * fresh key that could record the same money twice.
 *
 * What is persisted (features/Dashboards/User/FinancialOperations/
 * pendingWriteStorage.js): the Idempotency-Key itself, a non-reversible HASH
 * of the request, the operation's prefix label, and a timestamp. Never the
 * payload, never the bearer token — tests/mobileReadOnly.test.mjs's own
 * scanner proves the Mobile copy the same way; this file proves it by
 * exercising the Desktop one directly (unit tests) and through
 * createIdempotentAttempt / createSubmissionAttempt / createPaymentAttempt
 * (the shared primitives every Desktop financial form already uses, since
 * Phase 6A and 6C).
 */

const pendingWriteStorage = await import(
  "../src/features/Dashboards/User/FinancialOperations/pendingWriteStorage.js"
);
const { clearPendingWrite, clearPendingWritesForUser, hashFingerprint, readPendingWrite, writePendingWrite } = pendingWriteStorage;
const { createIdempotentAttempt, createSubmissionAttempt } = await import(
  "../src/features/Dashboards/User/FinancialOperations/transactionHelpers.js"
);
const { createPaymentAttempt } = await import("../src/features/Dashboards/User/Debts/debtHelpers.js");

/* ------------------------------------------------------------- a fake localStorage */

// `failWrites`: a RegExp of the keys whose setItem() should throw (default:
// none ever fail). Lets a test keep "user"/"workspace"/"ACCESS_TOKEN"
// writable while only the pending-write entry itself fails, matching what a
// real quota-exceeded error would do (existing, smaller keys still write
// fine; a new, larger one does not).
function fakeStorage({ failWrites = /^$/ } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failWrites.test(k)) throw new Error("quota exceeded");
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    // Object.keys(storage) (clearPendingWritesForUser) reads enumerable own
    // properties; a Proxy makes the Map's keys appear as such without a
    // real Storage implementation.
    raw: map,
  };
}

function installFakeLocalStorage(options) {
  const storage = fakeStorage(options);
  const proxy = new Proxy(storage, {
    ownKeys: (target) => [...target.raw.keys()],
    getOwnPropertyDescriptor: (target, prop) =>
      target.raw.has(prop) ? { value: target.raw.get(prop), enumerable: true, configurable: true, writable: true } : undefined,
  });
  Object.defineProperty(globalThis, "localStorage", { value: proxy, configurable: true, writable: true });
  return proxy;
}

beforeEach(() => installFakeLocalStorage());

/* ------------------------------------------------------------- unit: pendingWriteStorage.js */

describe("pendingWriteStorage.js", () => {
  it("round-trips a write and finds it only under the exact same hash", () => {
    const scope = { userId: 1, workspaceId: 1, prefix: "operation" };
    const hash = hashFingerprint(JSON.stringify({ type: "income", amount: "100" }));
    assert.equal(writePendingWrite({ ...scope, key: "operation-abc", hash }), true);
    assert.deepEqual(readPendingWrite({ ...scope, hash }), { key: "operation-abc" });

    const differentHash = hashFingerprint(JSON.stringify({ type: "income", amount: "200" }));
    assert.equal(readPendingWrite({ ...scope, hash: differentHash }), null, "a different payload's hash never matches");
  });

  it("scopes strictly by user and workspace: never read across either", () => {
    const hash = hashFingerprint("x");
    writePendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", key: "k1", hash });

    assert.equal(readPendingWrite({ userId: 2, workspaceId: 1, prefix: "operation", hash }), null, "a different user");
    assert.equal(readPendingWrite({ userId: 1, workspaceId: 2, prefix: "operation", hash }), null, "a different workspace");
    assert.deepEqual(readPendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", hash }), { key: "k1" }, "the same user and workspace");
  });

  it("expires after 24 hours", () => {
    const scope = { userId: 1, workspaceId: 1, prefix: "operation" };
    const hash = hashFingerprint("x");
    writePendingWrite({ ...scope, key: "k1", hash });

    const raw = JSON.parse(globalThis.localStorage.getItem("smartspend:pending-write:v1:u:1:w:1:operation"));
    raw.createdAt = Date.now() - 25 * 60 * 60 * 1000;
    globalThis.localStorage.setItem("smartspend:pending-write:v1:u:1:w:1:operation", JSON.stringify(raw));

    assert.equal(readPendingWrite({ ...scope, hash }), null);
  });

  it("treats corrupted or malformed storage as nothing stored, never a crash", () => {
    const scope = { userId: 1, workspaceId: 1, prefix: "operation" };
    const hash = hashFingerprint("x");
    const entryKey = "smartspend:pending-write:v1:u:1:w:1:operation";

    for (const malformed of ["not json at all", "{}", JSON.stringify({ v: "v1" }), JSON.stringify({ v: "v1", key: 5, hash: "h", createdAt: Date.now() })]) {
      globalThis.localStorage.setItem(entryKey, malformed);
      assert.equal(readPendingWrite({ ...scope, hash }), null, malformed);
    }
  });

  it("writePendingWrite returns false, and nothing is left behind, when storage itself fails", () => {
    installFakeLocalStorage({ failWrites: /./ });
    const hash = hashFingerprint("x");
    assert.equal(writePendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", key: "k1", hash }), false);
    assert.equal(readPendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", hash }), null);
  });

  it("clearPendingWrite removes one slot; clearPendingWritesForUser removes every slot for that user only", () => {
    const hash = hashFingerprint("x");
    writePendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", key: "k1", hash });
    writePendingWrite({ userId: 1, workspaceId: 2, prefix: "debt-payment", key: "k2", hash });
    writePendingWrite({ userId: 2, workspaceId: 1, prefix: "operation", key: "k3", hash });

    clearPendingWrite({ userId: 1, workspaceId: 1, prefix: "operation" });
    assert.equal(readPendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", hash }), null);
    assert.deepEqual(readPendingWrite({ userId: 1, workspaceId: 2, prefix: "debt-payment", hash }), { key: "k2" }, "a different slot, untouched");

    clearPendingWritesForUser(1);
    assert.equal(readPendingWrite({ userId: 1, workspaceId: 2, prefix: "debt-payment", hash }), null);
    assert.deepEqual(readPendingWrite({ userId: 2, workspaceId: 1, prefix: "operation", hash }), { key: "k3" }, "a different user, untouched by clearing user 1");
  });

  it("never writes the payload, an amount, or the bearer token — only the key, a hash, and a timestamp", () => {
    writePendingWrite({ userId: 1, workspaceId: 1, prefix: "operation", key: "operation-abc", hash: hashFingerprint(JSON.stringify({ amount: "999.0000", account_id: 42 })) });
    const raw = globalThis.localStorage.getItem("smartspend:pending-write:v1:u:1:w:1:operation");
    // Parsed, field by field: a substring check would also match the clock (createdAt is Date.now()).
    const stored = JSON.parse(raw);
    assert.deepEqual(Object.keys(stored).sort(), ["createdAt", "hash", "key", "v"]);
    assert.equal(stored.v, "v1");
    assert.equal(stored.key, "operation-abc");
    assert.equal(stored.hash, hashFingerprint(JSON.stringify({ amount: "999.0000", account_id: 42 })), "only the fingerprint, not the payload");
    assert.ok(!/999\.0000|account_id/.test(stored.hash) && !/999\.0000|account_id/.test(stored.key), "no amount or field name inside the fingerprint or the key");
    assert.ok(Number.isSafeInteger(stored.createdAt) && stored.createdAt > 0);
    assert.ok(!/token|ACCESS_TOKEN/i.test(stored.key + stored.hash), "never the bearer token");
  });
});

/* ------------------------------------------------------------- integration: createIdempotentAttempt */

describe("createIdempotentAttempt: surviving a reload", () => {
  const identityPayload = { user: { id: 1 }, workspace: { id: 1 } };

  // getStoredAuthSession() / getStoredWorkspace() (api/apiClient.js) read
  // these exact keys; every test here runs as this one identity unless it
  // overwrites them itself.
  beforeEach(() => {
    globalThis.localStorage.setItem("ACCESS_TOKEN", "t");
    globalThis.localStorage.setItem("user", JSON.stringify(identityPayload.user));
    globalThis.localStorage.setItem("workspace", JSON.stringify(identityPayload.workspace));
  });

  it("an unknown outcome, then a reload: the SAME key is reused for the SAME payload", () => {
    const payload = { type: "income", amount: "100" };
    const before1 = createIdempotentAttempt("operation");
    const first = before1.keyFor(payload);
    before1.settle({ code: "SERVER_ERROR" }); // unknown: not cleared

    // "Reload": a brand-new instance, nothing carried over in memory.
    const after1 = createIdempotentAttempt("operation");
    assert.equal(after1.keyFor(payload), first, "the exact same request is a deliberate retry, not a new intent");
  });

  it("a changed payload after reload mints a new key, never reusing the stored one", () => {
    const before1 = createIdempotentAttempt("operation");
    const first = before1.keyFor({ type: "income", amount: "100" });
    before1.settle({ code: "TIMEOUT" });

    const after1 = createIdempotentAttempt("operation");
    const second = after1.keyFor({ type: "income", amount: "250" });
    assert.notEqual(second, first, "a different entry — submitting it is the acknowledgment that it is a new one");
    assert.equal(after1.isProtected(), true);
  });

  it("settle(null) (confirmed success) clears the stored entry: a later reload mints fresh", () => {
    const payload = { type: "income", amount: "100" };
    const attempt = createIdempotentAttempt("operation");
    const first = attempt.keyFor(payload);
    attempt.settle(null);

    const after1 = createIdempotentAttempt("operation");
    assert.notEqual(after1.keyFor(payload), first, "nothing left to restore after a confirmed success");
  });

  it("a definitive rejection clears the stored entry too", () => {
    const payload = { type: "income", amount: "100" };
    const attempt = createIdempotentAttempt("operation");
    const first = attempt.keyFor(payload);
    attempt.settle({ code: "VALIDATION_ERROR" });

    const after1 = createIdempotentAttempt("operation");
    assert.notEqual(after1.keyFor(payload), first, "nothing left to restore after a certain refusal");
  });

  it("a possible-duplicate 409 does NOT clear the entry: the SAME key survives a reload for the confirm-resend", () => {
    // PossibleDuplicateDialog's confirmSeparateTransaction reuses the
    // ORIGINAL key directly (never calls keyFor again); this proves that
    // key would still be recoverable even if the page reloaded first.
    const payload = { type: "income", amount: "100" };
    const attempt = createIdempotentAttempt("operation");
    const first = attempt.keyFor(payload);
    // attempt.settle() is deliberately NOT called here: FinancialOperations.jsx's
    // recordOperation() does not settle on a possible-duplicate interception either.

    const after1 = createIdempotentAttempt("operation");
    assert.equal(after1.keyFor(payload), first, "still exactly what a resend must carry");
  });

  it("isProtected() is false when storage cannot be written, and a caller must refuse to send", () => {
    // The identity is already written (this test's own beforeEach); only
    // the pending-write entry itself now fails to write — the same shape a
    // real quota-exceeded error takes (existing, smaller keys keep working).
    installFakeLocalStorage({ failWrites: /^smartspend:pending-write:/ });
    globalThis.localStorage.setItem("user", JSON.stringify(identityPayload.user));
    globalThis.localStorage.setItem("workspace", JSON.stringify(identityPayload.workspace));
    const attempt = createIdempotentAttempt("operation");
    attempt.keyFor({ type: "income", amount: "100" });
    assert.equal(attempt.isProtected(), false);
  });

  it("createSubmissionAttempt (debt/goal/recurring create): same payload survives a reload, a different one never inherits the old key", () => {
    const payload = { name: "Trip", target_amount: "900" };
    const before1 = createSubmissionAttempt("savings-goal-create");
    const first = before1.key(payload);
    before1.settle({ code: "NETWORK_ERROR" });

    const after1 = createSubmissionAttempt("savings-goal-create");
    assert.equal(after1.key(payload), first, "the exact same goal, retried after reload");

    const unrelated = createSubmissionAttempt("savings-goal-create");
    assert.notEqual(unrelated.key({ name: "A different goal", target_amount: "1" }), first, "never handed to an unrelated later entry");
  });

  it("createPaymentAttempt (debt payment): same amount survives a reload, scoped to the debt AND the payload", () => {
    const payload = { account_id: 1, amount: "50" };
    const before1 = createPaymentAttempt(7);
    const first = before1.key(payload);
    before1.settle({ code: "SERVER_ERROR" });

    const after1 = createPaymentAttempt(7);
    assert.equal(after1.key(payload), first);

    const differentAmount = createPaymentAttempt(7);
    assert.notEqual(differentAmount.key({ account_id: 1, amount: "999" }), first, "a different payment on the same debt is a different entry");
  });

  it("a different signed-in identity never reuses another one's stored key", () => {
    const payload = { type: "income", amount: "100" };
    const asUser1 = createIdempotentAttempt("operation");
    const first = asUser1.keyFor(payload);
    asUser1.settle({ code: "TIMEOUT" });

    globalThis.localStorage.setItem("user", JSON.stringify({ id: 2 }));
    const asUser2 = createIdempotentAttempt("operation");
    assert.notEqual(asUser2.keyFor(payload), first);

    globalThis.localStorage.setItem("user", JSON.stringify({ id: 1 }));
    globalThis.localStorage.setItem("workspace", JSON.stringify({ id: 9 }));
    const workspace9 = createIdempotentAttempt("operation");
    assert.notEqual(workspace9.keyFor(payload), first, "nor another workspace's");
  });
});

/* ------------------------------------------------------------- source audit: sign-out clears it */

describe("sign-out clears pending writes (source audit)", () => {
  it("authProvider.jsx's clearAuth reads the outgoing user before clearAuthSession() removes it, then clears their pending writes", () => {
    const source = readFileSync(new URL("../src/contexts/auth/authProvider.jsx", import.meta.url), "utf8");
    const clearAuthBody = source.match(/const clearAuth = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/)?.[1] ?? "";
    assert.match(clearAuthBody, /clearPendingWritesForUser\(getStoredAuthSession\(\)\.user\?\.id\)/);
    assert.match(clearAuthBody, /clearPendingWritesForUser\(getStoredAuthSession\(\)\.user\?\.id\);\s*\n\s*clearAuthSession\(\);/);
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
});
