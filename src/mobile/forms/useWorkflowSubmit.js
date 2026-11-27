import { useCallback, useEffect, useRef, useState } from "react";

import { isPossibleDuplicateError, possibleDuplicateMatch } from "../data/possibleDuplicate.js";
import { clearPendingWrite, hashFingerprint, readPendingWrite, writePendingWrite } from "../data/pendingWriteStorage.js";
import { newWriteKey, sendWorkflowWrite } from "../data/writeApi.js";
import { sessionWorkspace } from "../data/readApi.js";
import { useIdentityGuard } from "../identity/guardContext.js";
import { useResourceStore } from "../identity/storeContext.js";

const IDLE = Object.freeze({ phase: "idle", code: null, error: null, data: null, matched: null });

/** Thrown instead of sending when a brand-new key could not be written to storage. */
function storageUnavailableError() {
  return Object.assign(
    new Error("This device can't remember that a request is in progress right now, so it can't be sent safely."),
    { code: "STORAGE_UNAVAILABLE" },
  );
}

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
 *
 * STORAGE_UNAVAILABLE (data/pendingWriteStorage.js: the key could not be
 * written to localStorage) belongs with the refusals: nothing was sent when
 * it fires — submit() refuses the request before it exists — so a retry is
 * exactly as safe as a fresh start.
 */
/*
 * Which cached reads a write may have changed, for the writes whose effect is known and narrow. Everything else drops every read (below),
 * because a write that may have happened makes everything read before it unreliable. The assistant's writes touch little: feedback changes
 * nothing Mobile shows, queuing an insight refresh changes nothing until the job runs, a dismissal changes only the insights, and a
 * message only its conversation and the conversation list. Dropping more would also remount the screen the person is on (the feedback sheet,
 * the "refresh queued" note, the box a question is typed in).
 */
const READS_CHANGED_BY = Object.freeze({
  "ai.messageFeedback": () => false,
  "ai.insightFeedback": () => false,
  "ai.insightsRefresh": () => false,
  "ai.insightDismiss": (key) => key.startsWith("ai:insights:"),
  "ai.message": (key) => key.startsWith("ai:conversation"),
});

const REJECTED = new Set(["VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "RATE_LIMITED", "WRITE_CLOSED", "NO_WORKSPACE", "STORAGE_UNAVAILABLE"]);

// A 409 whose machine-readable code says nothing was done: archiving an account that an active savings plan is funded
// from (ArchiveAccountAction refuses before it changes anything), and a recurring confirm or skip that names an occurrence
// that is no longer the rule's earliest open one (RecurringOccurrenceConflictException, raised before anything is posted).
// Any other 409 stays unknown.
const STALE_OCCURRENCE = new Set(["recurring_occurrence_not_next", "recurring_occurrence_not_open"]);
const CERTAIN_409 = new Set(["account_funds_active_savings_plan", ...STALE_OCCURRENCE]);

/*
 * The assistant answers a provider failure with { status: false, message, error: { code, retryable } } and a 429, 502 or 503
 * (AiMessageController). By then the attempt is already stored as a FAILED answer (AiChatService::failAssistant), so the request is
 * finished: it is a certain outcome, not an unknown one. A deliberate retry needs a new client_request_id, because the same one
 * would replay the stored failure; the hook releases the key on "rejected", so the next send mints a new one.
 */
const isAiFailure = (error) => [429, 502, 503].includes(error?.status) && typeof error?.payload?.error?.code === "string";

const NO_CODES = Object.freeze(new Set());

/*
 * `certain409`: the caller's own 409 codes that the backend raises before it changes anything (a Smart Savings
 * version conflict, for one: planning/smart/InstallmentReview.jsx). Only exact machine-readable codes count; a 409
 * with no code, or any other, stays unknown, and no message text is ever read to decide.
 */
export function classifyWriteOutcome(error, certain409 = NO_CODES) {
  const code = error?.code ?? error?.name ?? "UNKNOWN";
  if (code === "UNAUTHENTICATED") return { kind: "identity", code };
  if (isAiFailure(error)) return { kind: "rejected", code: "AI_FAILED", error };
  if (error?.status === 409 && typeof error?.serverCode === "string" && (CERTAIN_409.has(error.serverCode) || certain409.has(error.serverCode))) return { kind: "rejected", code: "CONFLICT", error };
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
 *   - That key now survives a reload too (data/pendingWriteStorage.js: a
 *     hash of {operation, ids, input} and the key itself only, never the
 *     input, never the bearer token). The hash is checked before the key is
 *     ever reused, so a reload followed by a DIFFERENT entry of the same
 *     operation never inherits an old key; it mints and persists its own,
 *     exactly as any other change in this hook already has. A key that
 *     cannot be written to storage is never sent at all
 *     (storageUnavailableError(), classified as "rejected" above): a reload
 *     right after would leave no way to recognize a retry.
 *   - A possible-duplicate 409 keeps the key too, for the same reason an
 *     unknown outcome does, but for the opposite reason: the backend's own
 *     posting transaction rolled back before anything was written, so the key
 *     is certainly still good, not merely unconfirmed. confirmSeparate()
 *     resends the SAME write this hook already holds, over that SAME key,
 *     adding only the flag the backend documents for this exact case — never
 *     a write built fresh from whatever the form shows by then.
 *   - Nothing is ever sent again by itself: no retry, no queue, no replay.
 *     The input never leaves this hook's memory; only the key and a hash of
 *     the input are ever written to storage.
 *   - After "unknown" this form sends nothing more: the person checks the record.
 *   - The identity guard is asserted in the turn the request leaves and again
 *     when the answer arrives; a different workspace by then is "changed".
 *   - Whatever may have been written makes everything read before it unreliable,
 *     so the cached reads are dropped (not after a certain refusal, and not
 *     while a possible-duplicate is still being decided: nothing was written).
 */
/*
 * Options, for a write sent from a flag-gated facade (the defaults are the forms' own):
 *   send          the facade function (sendWorkflowWrite unless given); it must check the gate first
 *   certain409    exact 409 codes that are certain refusals for this write (see classifyWriteOutcome)
 *   refreshAfter  (outcome) => true for a certain refusal after which the screen's reads are out of date, so they are
 *                 dropped and read again (a version conflict: the review is about a state that no longer exists)
 *   readsChanged  (key) => true for the cached reads this write may have changed (instead of READS_CHANGED_BY, else all);
 *                 a write sent from inside a record's page leaves that record's own read, which it cannot change, in place
 * Each must be stable (a module function or constant, or memoised on its inputs).
 */
const NEVER = () => false;

export function useWorkflowSubmit({ send = sendWorkflowWrite, certain409 = NO_CODES, refreshAfter = NEVER, readsChanged = null } = {}) {
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
      // A new account refused for its name: the first copy of a create whose answer was lost may be the one that is there
      // (there is no replay, only a unique name), so the lists are read again to show it.
      const nameTaken = outcome.kind === "rejected" && pendingWrite.current?.operation === "account.create" && Array.isArray(outcome.error?.errors?.name);
      // The assistant's failed attempt is stored in the conversation (AiChatService::failAssistant), so it is read again like a write that happened.
      const storedFailure = outcome.kind === "rejected" && outcome.code === "AI_FAILED";
      // The occurrence the review showed is out of date: the cached rule still names it, so every read is taken again (nothing is resent).
      const staleOccurrence = outcome.kind === "rejected" && STALE_OCCURRENCE.has(outcome.error?.serverCode);
      const staleReview = outcome.kind === "rejected" && refreshAfter(outcome);
      if ((nameTaken || storedFailure || staleOccurrence || staleReview || (outcome.kind !== "rejected" && outcome.kind !== "possibleDuplicate")) && !store.isDisposed()) store.drop(readsChanged ?? READS_CHANGED_BY[pendingWrite.current?.operation] ?? (() => true));
      if (outcome.kind === "confirmed" || outcome.kind === "rejected") {
        // Read before clearing: nothing left to protect either way.
        if (pendingWrite.current) clearPendingWrite(pendingWrite.current.operation);
        key.current = null;
        pendingWrite.current = null;
      }
      if (outcome.kind === "rejected") busy.current = false;
      if (!alive.current) return;

      setState({ phase: outcome.kind, code: outcome.code ?? null, error: outcome.error ?? null, data: outcome.data ?? null, matched: outcome.matched ?? null });
    },
    [store, refreshAfter, readsChanged],
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
        if (!key.current) {
          // The full write, not just the operation name: a stored key from
          // an unrelated earlier entry of the same operation must never be
          // handed to a genuinely different one just because both reload
          // into an empty key.current.
          const hash = hashFingerprint(JSON.stringify({ operation: write.operation, ids: write.ids, input: write.input }));
          const stored = readPendingWrite(write.operation, hash);
          if (stored) {
            key.current = stored.key;
          } else {
            const minted = newWriteKey(write.operation);
            if (!writePendingWrite(write.operation, minted, hash)) throw storageUnavailableError();
            key.current = minted;
          }
        }
        pendingWrite.current = write;
        guard.assert();
        const response = await send(write, key.current);
        guard.assert();
        outcome = (sessionWorkspace()?.id ?? null) !== workspace ? { kind: "changed", code: "WORKSPACE_CHANGED" } : { kind: "confirmed", data: response?.data ?? null };
      } catch (error) {
        outcome = guard.check() ? classifyWriteOutcome(error, certain409) : { kind: "identity" };
      }

      settle(outcome);
      return outcome;
    },
    [guard, settle, send, certain409],
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
      const response = await send(write, key.current);
      guard.assert();
      outcome = (sessionWorkspace()?.id ?? null) !== workspace ? { kind: "changed", code: "WORKSPACE_CHANGED" } : { kind: "confirmed", data: response?.data ?? null };
    } catch (error) {
      outcome = guard.check() ? classifyWriteOutcome(error, certain409) : { kind: "identity" };
    }

    confirming.current = false;
    settle(outcome);
  }, [guard, settle, state.phase, send, certain409]);

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
