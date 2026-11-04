import { useCallback, useEffect, useRef, useState } from "react";

import { isPossibleDuplicateError, possibleDuplicateMatch } from "../data/possibleDuplicate.js";
import { newWriteKey, sendWorkflowWrite } from "../data/writeApi.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";

const IDLE = Object.freeze({ phase: "idle", code: null, error: null, data: null, matched: null });

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
 * "possibleDuplicate" is its own case, named by the backend's own
 * machine-readable `code` on the body (never guessed from the 409 alone):
 * nothing was recorded either (see submit()'s comment), but unlike "rejected"
 * this is not a refusal to fix and resend differently — it is a question,
 * answered by data/possibleDuplicate.js's matched transaction.
 *
 * Everything else is "unknown": a timeout, the network, a 5xx, an answer that is
 * not the envelope, and any OTHER 409 (a key still processing, a key reused with
 * other values, or a record already reversed: the request alone doesn't say which).
 */
const REJECTED = new Set(["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "WRITE_CLOSED", "NO_WORKSPACE"]);

export function classifyWriteOutcome(error) {
  const code = error?.code ?? error?.name ?? "UNKNOWN";
  if (code === "UNAUTHENTICATED") return { kind: "identity", code };
  if (error?.name === "WriteClosedError") return { kind: "rejected", code: "WRITE_CLOSED", error };
  if (isPossibleDuplicateError(error)) {
    const matched = possibleDuplicateMatch(error);
    if (matched) return { kind: "possibleDuplicate", code: "possible_duplicate", error, matched };
  }
  if (REJECTED.has(code)) return { kind: "rejected", code, error };
  return { kind: "unknown", code, status: Number.isInteger(error?.status) ? error.status : 0 };
}

/*
 * The life of one form's write:
 *
 *   idle -> sending -> confirmed | rejected | unknown | changed
 *                    -> possibleDuplicate -> sending -> confirmed | rejected | unknown | changed
 *                                         -> idle (Cancel; see cancelPossibleDuplicate)
 *
 *   - ONE request per logical submission: `busy` is set before anything is
 *     awaited, so a second tap in the same turn does nothing. It stays set
 *     through "possibleDuplicate" too: nothing new may be sent while that
 *     question is open, only confirmSeparate() or cancelPossibleDuplicate().
 *   - ONE Idempotency-Key per submission intent (like the full version's debt
 *     payment form): it is created on the first send and kept until a confirmed or
 *     certainly-refused answer. It is not renewed when the details change, so
 *     after an unknown outcome the server either replays the first result or
 *     refuses different values; it can't record the money twice.
 *   - A possible-duplicate 409 keeps the key too, for the same reason an
 *     unknown outcome does, but for the opposite reason: the backend's own
 *     posting transaction rolled back before anything was written, so the key
 *     is certainly still good, not merely unconfirmed. confirmSeparate()
 *     resends the SAME write this hook already holds, over that SAME key,
 *     adding only the flag the backend documents for this exact case — never
 *     a write built fresh from whatever the form shows by then.
 *   - Nothing is ever sent again by itself: no retry, no queue, no storage. The
 *     payload and the key live in this hook's memory only.
 *   - After "unknown" this form sends nothing more: the person checks the record.
 *   - The identity guard is asserted in the turn the request leaves and again
 *     when the answer arrives; a different workspace by then is "changed".
 *   - Whatever may have been written makes everything read before it unreliable,
 *     so the cached reads are dropped (not after a certain refusal, and not
 *     while a possible-duplicate is still being decided: nothing was written).
 */
export function useWorkflowSubmit() {
  const guard = useIdentityGuard();
  const store = useResourceStore();
  const busy = useRef(false);
  const key = useRef(null);
  // The write whose key is still held, for a possible-duplicate's resend.
  const pendingWrite = useRef(null);
  // A second, separate guard for confirmSeparate() only: `busy` alone would
  // also be true immediately after submit() moves into "possibleDuplicate",
  // which is correct (nothing new may be sent) but doesn't distinguish "a
  // decision is pending" from "a resend is already in flight".
  const confirming = useRef(false);
  const alive = useRef(true);
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const settle = useCallback(
    (outcome) => {
      if (outcome.kind === "identity") return;
      if (outcome.kind !== "rejected" && outcome.kind !== "possibleDuplicate" && !store.isDisposed()) store.drop(() => true);
      if (outcome.kind === "confirmed" || outcome.kind === "rejected") {
        key.current = null;
        pendingWrite.current = null;
      }
      if (outcome.kind === "rejected") busy.current = false;
      if (!alive.current) return;

      setState({ phase: outcome.kind, code: outcome.code ?? null, error: outcome.error ?? null, data: outcome.data ?? null, matched: outcome.matched ?? null });
    },
    [store],
  );

  const submit = useCallback(
    async (write) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: "sending", code: null, error: null, data: null, matched: null });

      const workspace = sessionWorkspace()?.id ?? null;
      let outcome;
      try {
        if (Object.hasOwn(write.input ?? {}, "workspace_id") && !Number.isSafeInteger(write.input.workspace_id)) {
          throw Object.assign(new Error("No workspace to record this in."), { code: "NO_WORKSPACE" });
        }
        key.current ??= newWriteKey(write.operation);
        pendingWrite.current = write;
        guard.assert();
        const response = await sendWorkflowWrite(write, key.current);
        guard.assert();
        outcome = (sessionWorkspace()?.id ?? null) !== workspace ? { kind: "changed", code: "WORKSPACE_CHANGED" } : { kind: "confirmed", data: response?.data ?? null };
      } catch (error) {
        outcome = guard.check() ? classifyWriteOutcome(error) : { kind: "identity" };
      }

      settle(outcome);
    },
    [guard, settle],
  );

  // Called by the form's Confirm (separate transaction): resends
  // pendingWrite with the SAME key, plus confirm_possible_duplicate.
  const confirmSeparate = useCallback(async () => {
    if (confirming.current || state.phase !== "possibleDuplicate" || !pendingWrite.current || !key.current) return;
    confirming.current = true;
    setState((current) => ({ ...current, phase: "sending" }));

    const write = { ...pendingWrite.current, input: { ...pendingWrite.current.input, confirm_possible_duplicate: true } };
    const workspace = sessionWorkspace()?.id ?? null;
    let outcome;

    try {
      guard.assert();
      const response = await sendWorkflowWrite(write, key.current);
      guard.assert();
      outcome = (sessionWorkspace()?.id ?? null) !== workspace ? { kind: "changed", code: "WORKSPACE_CHANGED" } : { kind: "confirmed", data: response?.data ?? null };
    } catch (error) {
      outcome = guard.check() ? classifyWriteOutcome(error) : { kind: "identity" };
    }

    confirming.current = false;
    settle(outcome);
  }, [guard, settle, state.phase]);

  // Called by the form's Cancel: nothing is sent. The key and pendingWrite
  // are kept (see the hook's own comment above), so an unedited resubmission
  // still carries the same Idempotency-Key; `busy` is released so submit()
  // may run again at all.
  const cancelPossibleDuplicate = useCallback(() => {
    if (state.phase !== "possibleDuplicate") return;
    busy.current = false;
    setState(IDLE);
  }, [state.phase]);

  const reset = useCallback(() => {
    if (state.phase === "rejected") setState(IDLE);
  }, [state.phase]);

  return {
    ...state,
    sending: state.phase === "sending",
    possibleDuplicate: state.phase === "possibleDuplicate",
    submit,
    confirmSeparate,
    cancelPossibleDuplicate,
    reset,
  };
}
