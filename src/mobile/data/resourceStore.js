import { IdentityError } from "../identity/guard.js";

/*
 * Mobile's in-memory copy of what it has read, for one identity scope.
 *
 * Memory only: nothing here is written to storage, a cache or a service
 * worker, and the whole store is dropped when the scope ends (sign-out, a
 * different session, leaving Mobile). Each entry is one GET, keyed by the
 * caller ("dashboard", "account:12", ...), in one of these states:
 *
 *   loading     first read, nothing to show yet
 *   refreshing  a read is running and the previous figures are still shown
 *   ready       the last read succeeded
 *   stale       the last read failed, and the figures shown are from an earlier
 *               successful read in this session (marked as such by the UI)
 *   error       the last read failed and there is nothing safe to show
 *
 * Identity: before each request is sent, and again when its response arrives,
 * the identity guard is asked whether storage still belongs to this scope. If
 * it does not, the response is thrown away, never stored, and the guard has
 * already taken the screen down. A response can therefore only ever be shown
 * to the identity whose token sent it.
 */

const IDLE = Object.freeze({ status: "idle", data: undefined, error: null, updatedAt: null });

// Errors after which an earlier read must not stay on screen: access is gone.
const DROP_DATA_CODES = new Set(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "WORKSPACE_UNAVAILABLE"]);

export function createResourceStore(guard, { now = Date.now } = {}) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Set();
  let disposed = false;
  let version = 0;

  const emit = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  const set = (key, entry) => {
    entries.set(key, Object.freeze(entry));
    emit();
  };

  function abortAll() {
    for (const { controller } of inflight.values()) controller.abort();
    inflight.clear();
  }

  function load(key, loader) {
    if (disposed) return Promise.resolve();
    if (inflight.has(key)) return inflight.get(key).promise;

    const previous = entries.get(key);
    const hasPrevious = previous?.data !== undefined && (previous.status === "ready" || previous.status === "stale");
    const controller = new AbortController();
    const record = { controller };

    set(
      key,
      hasPrevious
        ? { status: "refreshing", data: previous.data, error: null, updatedAt: previous.updatedAt }
        : { status: "loading", data: undefined, error: null, updatedAt: null },
    );

    record.promise = (async () => {
      try {
        guard.assert();
        const data = await loader(controller.signal);
        guard.assert();

        if (disposed || controller.signal.aborted) return;
        set(key, { status: "ready", data, error: null, updatedAt: now() });
      } catch (error) {
        // Aborted or dropped with the scope; and an identity failure has
        // already latched the guard, whose boundary removes the screen.
        if (disposed || controller.signal.aborted || error?.name === "AbortError" || error instanceof IdentityError) return;

        set(
          key,
          hasPrevious && !DROP_DATA_CODES.has(error?.code)
            ? { status: "stale", data: previous.data, error, updatedAt: previous.updatedAt }
            : { status: "error", data: undefined, error, updatedAt: null },
        );
      } finally {
        if (inflight.get(key) === record) inflight.delete(key);
      }
    })();

    inflight.set(key, record);
    return record.promise;
  }

  return {
    get: (key) => entries.get(key) ?? IDLE,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    /** Drops everything and cancels what is running; the store stays usable (React may replay effects). */
    clear() {
      abortAll();
      entries.clear();
      emit();
    },
    /** Like clear(), for good: the identity changed, so this store is never used again. */
    dispose() {
      disposed = true;
      abortAll();
      entries.clear();
      emit();
    },
    isDisposed: () => disposed,
    /** Changes whenever any entry does, for screens that read several keys at once. */
    getVersion: () => version,
    /** Forgets entries whose key passes the test (and cancels their reads): a refresh that must not reuse older pages. */
    drop(test) {
      for (const [key, record] of [...inflight]) {
        if (test(key)) {
          record.controller.abort();
          inflight.delete(key);
        }
      }

      let changed = false;
      for (const key of [...entries.keys()]) {
        if (test(key)) {
          entries.delete(key);
          changed = true;
        }
      }
      if (changed) emit();
    },
    /** Stops a read that has not produced anything yet (its screen moved on); finished entries stay. */
    cancel(key) {
      const record = inflight.get(key);
      const entry = entries.get(key);
      if (!record) return;

      record.controller.abort();
      inflight.delete(key);
      if (entry?.status === "loading") {
        entries.delete(key);
        emit();
      } else if (entry?.status === "refreshing") {
        set(key, { status: "ready", data: entry.data, error: null, updatedAt: entry.updatedAt });
      }
    },
  };
}
