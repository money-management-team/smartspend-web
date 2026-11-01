import { useCallback, useEffect, useRef, useState } from "react";

import { newWriteKey, sendWorkflowWrite } from "../data/writeApi.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";

const IDLE = Object.freeze({ phase: "idle", code: null, error: null, data: null });

/*
 * What an error means for a form's write. "rejected" only where the server
 * certainly did nothing (backend source, develop @ fd87531 / c18d4ea):
 *
 *   422  validation or a financial rule: refused before posting; a money key is
 *        released or rolled back with the posting (IdempotencyService)
 *   403  a workspace that isn't yours        404  a record that isn't (or isn't yours)
 *   429  the throttle runs before the controller, so nothing was done
 *   the write gate refused before anything was sent
 *
 * Everything else is "unknown": a timeout, the network, a 5xx, an answer that is
 * not the envelope, and a 409 (a key still processing, a key reused with other
 * values, or a record already reversed: the request alone doesn't say which).
 */
const REJECTED = new Set(["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "WRITE_CLOSED", "NO_WORKSPACE"]);

export function classifyWriteOutcome(error) {
  const code = error?.code ?? error?.name ?? "UNKNOWN";
  if (code === "UNAUTHENTICATED") return { kind: "identity", code };
  if (error?.name === "WriteClosedError") return { kind: "rejected", code: "WRITE_CLOSED", error };
  if (REJECTED.has(code)) return { kind: "rejected", code, error };
  return { kind: "unknown", code, status: Number.isInteger(error?.status) ? error.status : 0 };
}

/*
 * The life of one form's write:  idle -> sending -> confirmed | rejected | unknown | changed
 *
 *   - ONE request per logical submission: `busy` is set before anything is
 *     awaited, so a second tap in the same turn does nothing.
 *   - ONE Idempotency-Key per submission intent (like the full version's debt
 *     payment form): it is created on the first send and kept until a confirmed or
 *     certainly-refused answer. It is not renewed when the details change, so
 *     after an unknown outcome the server either replays the first result or
 *     refuses different values; it can't record the money twice.
 *   - Nothing is ever sent again by itself: no retry, no queue, no storage. The
 *     payload and the key live in this hook's memory only.
 *   - After "unknown" this form sends nothing more: the person checks the record.
 *   - The identity guard is asserted in the turn the request leaves and again
 *     when the answer arrives; a different workspace by then is "changed".
 *   - Whatever may have been written makes everything read before it unreliable,
 *     so the cached reads are dropped (not after a certain refusal).
 */
export function useWorkflowSubmit() {
  const guard = useIdentityGuard();
  const store = useResourceStore();
  const busy = useRef(false);
  const key = useRef(null);
  const alive = useRef(true);
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = useCallback(
    async (write) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: "sending", code: null, error: null, data: null });

      const workspace = sessionWorkspace()?.id ?? null;
      let outcome;
      try {
        if (Object.hasOwn(write.input ?? {}, "workspace_id") && !Number.isSafeInteger(write.input.workspace_id)) {
          throw Object.assign(new Error("No workspace to record this in."), { code: "NO_WORKSPACE" });
        }
        key.current ??= newWriteKey(write.operation);
        guard.assert();
        const response = await sendWorkflowWrite(write, key.current);
        guard.assert();
        outcome = (sessionWorkspace()?.id ?? null) !== workspace ? { kind: "changed", code: "WORKSPACE_CHANGED" } : { kind: "confirmed", data: response?.data ?? null };
      } catch (error) {
        outcome = guard.check() ? classifyWriteOutcome(error) : { kind: "identity" };
      }

      if (outcome.kind === "identity") return;
      if (outcome.kind !== "rejected" && !store.isDisposed()) store.drop(() => true);
      if (outcome.kind === "confirmed" || outcome.kind === "rejected") key.current = null;
      if (outcome.kind === "rejected") busy.current = false;
      if (!alive.current) return;

      setState({ phase: outcome.kind, code: outcome.code ?? null, error: outcome.error ?? null, data: outcome.data ?? null });
    },
    [guard, store],
  );

  const reset = useCallback(() => {
    if (state.phase === "rejected") setState(IDLE);
  }, [state.phase]);

  return { ...state, sending: state.phase === "sending", submit, reset };
}
