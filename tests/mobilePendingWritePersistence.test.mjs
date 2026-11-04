import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, beforeEach, describe, it } from "node:test";

import { change, click, submit } from "./helpers/dom.mjs";
import { FORM_WRITES, account, envelope, installFakeApi } from "./helpers/mobileApi.mjs";
import { TOKEN_A, USER_A, dom, mountMobile, q, resetEnvironment, settle, storeSession, window } from "./helpers/mobileHarness.mjs";

const pendingWriteStorage = await import("../src/mobile/data/pendingWriteStorage.js");
const { clearPendingWrite, clearPendingWritesForUser, hashFingerprint, readPendingWrite, writePendingWrite } = pendingWriteStorage;
const gate = await import("../src/mobile/data/writeGate.js");

/*
 * Phase 6D, Mobile's half: forms/useWorkflowSubmit.js's Idempotency-Key now
 * survives a reload too, through data/pendingWriteStorage.js (a hash of
 * {operation, ids, input} and the key itself only — never the input, never
 * the bearer token; tests/mobileReadOnly.test.mjs's own money-safety scanner
 * proves that by reading the source directly). Writes stay closed either
 * way (data/writeGate.js); the last describe block below reconfirms that
 * directly, exactly as before this phase.
 *
 * A Desktop and a Mobile jsdom render in the same process collide (two
 * React roots fighting over the same shared document), so this stays its
 * own file, like tests/mobilePossibleDuplicate.test.mjs already does.
 */

after(() => dom.window.close());

/* ------------------------------------------------------------- unit: data/pendingWriteStorage.js */

describe("data/pendingWriteStorage.js", () => {
  beforeEach(async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
  });

  it("round-trips a write and finds it only under the exact same hash", () => {
    const hash = hashFingerprint(JSON.stringify({ operation: "transaction.expense", ids: {}, input: { amount: "40.0000" } }));
    assert.equal(writePendingWrite("transaction.expense", "mobile-transaction-expense-abc", hash), true);
    assert.deepEqual(readPendingWrite("transaction.expense", hash), { key: "mobile-transaction-expense-abc" });

    const differentHash = hashFingerprint(JSON.stringify({ operation: "transaction.expense", ids: {}, input: { amount: "99.0000" } }));
    assert.equal(readPendingWrite("transaction.expense", differentHash), null, "a different input's hash never matches");
  });

  it("scopes strictly by user and workspace: a different one of either reads nothing", () => {
    const hash = hashFingerprint("x");
    writePendingWrite("transaction.expense", "k1", hash);

    storeSession({ token: TOKEN_A, user: { id: 999 }, workspace: { id: 1 } });
    assert.equal(readPendingWrite("transaction.expense", hash), null, "a different user");

    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    assert.deepEqual(readPendingWrite("transaction.expense", hash), { key: "k1" }, "back to the original identity");

    window.localStorage.setItem("workspace", JSON.stringify({ id: 2 }));
    assert.equal(readPendingWrite("transaction.expense", hash), null, "a different workspace");
  });

  it("expires after 24 hours", () => {
    const hash = hashFingerprint("x");
    writePendingWrite("transaction.expense", "k1", hash);

    const entryKey = `smartspend:mobile:pending-write:v1:u:${USER_A.id}:w:1:transaction.expense`;
    const raw = JSON.parse(window.localStorage.getItem(entryKey));
    raw.createdAt = Date.now() - 25 * 60 * 60 * 1000;
    window.localStorage.setItem(entryKey, JSON.stringify(raw));

    assert.equal(readPendingWrite("transaction.expense", hash), null);
  });

  it("treats corrupted or malformed storage as nothing stored, never a crash", () => {
    const hash = hashFingerprint("x");
    const entryKey = `smartspend:mobile:pending-write:v1:u:${USER_A.id}:w:1:transaction.expense`;

    for (const malformed of ["not json", "{}", JSON.stringify({ v: "v1" }), JSON.stringify({ v: "v1", key: 5, hash: "h", createdAt: Date.now() })]) {
      window.localStorage.setItem(entryKey, malformed);
      assert.equal(readPendingWrite("transaction.expense", hash), null, malformed);
    }
  });

  it("writePendingWrite returns false, and nothing is left behind, when storage itself fails", () => {
    // jsdom's real Storage is a legacy platform object: `storage.setItem = fn`
    // is itself a setItem("setItem", fn) call, not a method override, so the
    // only way to make a write fail is to swap out globalThis.localStorage
    // (what getStorage() in pendingWriteStorage.js actually reads) entirely.
    const hash = hashFingerprint("x");
    const real = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    });
    try {
      assert.equal(writePendingWrite("transaction.expense", "k1", hash), false);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: real, configurable: true, writable: true });
    }
    assert.equal(readPendingWrite("transaction.expense", hash), null);
  });

  it("returns null (never throws) when storage is entirely unavailable (no signed-in identity)", async () => {
    await resetEnvironment();
    // No storeSession(): readStoredIdentity() reports no token/user at all.
    assert.equal(readPendingWrite("transaction.expense", hashFingerprint("x")), null);
    assert.equal(writePendingWrite("transaction.expense", "k1", hashFingerprint("x")), false);
  });

  it("clearPendingWrite removes one operation's slot only; clearPendingWritesForUser removes every slot for that user", () => {
    const hash = hashFingerprint("x");
    writePendingWrite("transaction.expense", "k1", hash);
    writePendingWrite("transaction.income", "k2", hash);

    clearPendingWrite("transaction.expense");
    assert.equal(readPendingWrite("transaction.expense", hash), null);
    assert.deepEqual(readPendingWrite("transaction.income", hash), { key: "k2" }, "a different operation, untouched");

    clearPendingWritesForUser(USER_A.id);
    assert.equal(readPendingWrite("transaction.income", hash), null);
  });

  it("never writes the input, an amount, or the bearer token — only the key, a hash, and a timestamp", () => {
    writePendingWrite("transaction.expense", "mobile-transaction-expense-abc", hashFingerprint(JSON.stringify({ input: { amount: "999.0000", account_id: 42 } })));
    const raw = window.localStorage.getItem(`smartspend:mobile:pending-write:v1:u:${USER_A.id}:w:1:transaction.expense`);
    assert.doesNotMatch(raw, /999|42|token-for-user-a/i);
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["createdAt", "hash", "key", "v"]);
  });
});

/* ------------------------------------------------------------- integration: a reload, through the real form */

describe("useWorkflowSubmit.js: surviving a reload (through forms/DraftForm.jsx)", () => {
  let api;
  let view;

  const backendAccounts = [account({ id: 1, name: "Wallet", currency_code: "ILS" })];
  const backendCategories = [{ id: 4, name: "Food", type: "expense", is_system: false, is_active: true }];

  function backend(onWrite) {
    return (call) => {
      if (call.method !== "GET") return onWrite(call);
      if (call.path === "/accounts") return { body: envelope({ accounts: backendAccounts }) };
      if (call.path === "/categories") return { body: envelope({ categories: backendCategories }) };
      return { status: 404, body: { status: false, message: "not found" } };
    };
  }

  const field = (name) => q(`[data-sm-field='${name}'] input, [data-sm-field='${name}'] select, [data-sm-field='${name}'] textarea`);
  const action = (name) => q(`[data-sm-action='${name}']`);
  const writes = () => api.calls.filter((call) => call.method !== "GET");

  async function openAndFillExpense(onWrite, amount = "40") {
    api = installFakeApi(backend(onWrite), { allowWrites: [FORM_WRITES.expense] });
    view = await mountMobile({ entry: "/m/add/expense" });
    await change(field("account_id"), "1");
    await change(field("category_id"), "4");
    await change(field("amount"), amount);
    await submit(q("form.sm-draft-form"));
    assert.ok(q("[data-sm-step='review']"));
  }

  /** Unmounts this view and mounts a brand-new one: a fresh useWorkflowSubmit() instance, nothing carried over in memory — exactly what a reload leaves behind. */
  async function reload() {
    await view.unmount();
    view = await mountMobile({ entry: "/m/add/expense" });
    await change(field("account_id"), "1");
    await change(field("category_id"), "4");
  }

  beforeEach(async () => {
    await resetEnvironment();
    storeSession({ token: TOKEN_A, user: USER_A, workspace: { id: 1 } });
    gate.setWriteApprovalsForTests(["transaction.expense"]);
  });

  afterEach(async () => {
    await view?.unmount();
    view = null;
    gate.setWriteApprovalsForTests(null);
    assert.deepEqual(api?.violations ?? [], [], "only the opened write");
    api?.restore();
    api = null;
  });

  it("an unknown outcome, then a reload and the SAME entry retyped: the SAME key is reused, and only one record is ever created", async () => {
    let calls = 0;
    await openAndFillExpense((call) => {
      calls += 1;
      if (calls === 1) return new Promise(() => {}); // never resolves: the page "reloads" before any answer arrives
      return { status: 201, body: envelope({ transaction: { id: 900, status: "posted" } }) };
    });

    await click(action("send"));
    await settle();
    const firstKey = writes()[0]?.headers["Idempotency-Key"];
    assert.ok(firstKey, "the first attempt carried a key");

    await reload();
    await change(field("amount"), "40"); // the exact same entry, retyped
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();

    assert.ok(q("[data-sm-outcome='confirmed']"));
    const [, retry] = writes();
    assert.equal(retry.headers["Idempotency-Key"], firstKey, "the exact same key, never a fresh one");
  });

  it("a reload followed by a DIFFERENT entry mints its own key, never the stale one", async () => {
    await openAndFillExpense(() => new Promise(() => {}));
    await click(action("send"));
    await settle();
    const firstKey = writes()[0]?.headers["Idempotency-Key"];

    await reload();
    await change(field("amount"), "999"); // a different, unrelated entry
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();

    const [, second] = writes();
    assert.notEqual(second.headers["Idempotency-Key"], firstKey, "never handed to an unrelated later entry");
  });

  it("a confirmed success clears the stored entry: a later reload, even retyping the same amount, mints fresh", async () => {
    await openAndFillExpense(() => ({ status: 201, body: envelope({ transaction: { id: 901, status: "posted" } }) }));
    await click(action("send"));
    await settle();
    const firstKey = writes()[0]?.headers["Idempotency-Key"];
    assert.ok(q("[data-sm-outcome='confirmed']"));

    // The exact same amount as before, after a fresh reload: with nothing
    // left in storage to restore (settle() cleared it on the confirmed
    // send above), this is a brand-new intent, not a retry of the old one.
    await reload();
    await change(field("amount"), "40");
    await submit(q("form.sm-draft-form"));
    await click(action("send"));
    await settle();

    const [, second] = writes();
    assert.notEqual(second.headers["Idempotency-Key"], firstKey, "nothing left to restore after a confirmed success");
  });
});

/* ------------------------------------------------------------- Mobile write gate: unchanged */

describe("Mobile write gate: Phase 6D opens nothing", () => {
  it("transaction.expense, transaction.income and transaction.correct (and every other write) stay closed by default", () => {
    for (const operation of Object.keys(gate.MOBILE_WRITES)) {
      assert.equal(gate.isWriteOpen(operation), false, operation);
    }
  });

  it("the shipped APPROVED list is still empty (source audit)", () => {
    const source = readFileSync(new URL("../src/mobile/data/writeGate.js", import.meta.url), "utf8");
    assert.match(source, /const APPROVED = Object\.freeze\(\[\]\);/);
  });
});
