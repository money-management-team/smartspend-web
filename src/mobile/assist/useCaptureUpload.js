import { useCallback, useEffect, useRef, useState } from "react";

import { sessionWorkspace } from "../data/readApi.js";
import { newWriteKey, sendWorkflowWrite } from "../data/writeApi.js";
import { classifyWriteOutcome } from "../forms/useWorkflowSubmit.js";
import { useIdentityGuard } from "../identity/guardContext.js";

const IDLE = Object.freeze({ phase: "idle", code: null, error: null, capture: null });

/*
 * One receipt photo or one voice recording: `operation` is "receipt.upload" or
 * "voice.upload" (data/writeGate.js, data/writeApi.js). Closed either way
 * while data/writeGate.js's APPROVED stays empty — upload() then rejects with
 * WriteClosedError before anything is sent, exactly like every other Mobile
 * write (classifyWriteOutcome reports it as "rejected"/"WRITE_CLOSED").
 *
 * A browser reload loses the chosen file or the in-memory recording outright
 * — unlike forms/useWorkflowSubmit.js's JSON drafts, there is nothing here
 * that data/pendingWriteStorage.js could usefully persist across one. What
 * this hook protects is the narrower, still real case: the request is sent,
 * the page stays open, and the answer is slow, dropped or a 5xx/409. The key
 * is held in memory (a ref) and reused only for a retry of the EXACT same
 * file reference already passed to upload(); a different file always mints a
 * fresh one. This mirrors the full version's own two answers to the identical
 * problem — FinancialOperations/components/ReceiptCapture.jsx's `intentRef`
 * and voiceCaptureFlow.js's `uploadIntent` — rather than inventing a third.
 *
 * The backend ties the key to the file's own content hash (AiCaptureUploadService
 * for the receipt, AiVoiceCaptureAdmissionService for the recording, both via
 * the shared IdempotencyService on fix/financial-idempotency-p0 @ 6b696d72), so
 * even a wrongly-reused key with a genuinely different file is refused with a
 * 409 rather than silently accepted — this hook's own ref check is a UX
 * convenience, never the only safety net.
 *
 *   idle -> uploading -> confirmed (a capture now exists; caller navigates to it)
 *                      -> rejected (422/403/404/429/closed: certainly nothing was created)
 *                      -> unknown (timeout/network/5xx/409: retry() resends the SAME key)
 *                      -> changed (the workspace changed mid-flight)
 *
 * Cancelling an in-flight upload (cancel()) aborts the request and returns to
 * idle without classifying anything: nothing was decided, so nothing is shown.
 */
export function useCaptureUpload(operation) {
  const guard = useIdentityGuard();
  const busy = useRef(false);
  const key = useRef(null);
  const file = useRef(null);
  const controller = useRef(null);
  const alive = useRef(true);
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (chosenFile, workspaceId) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: "uploading", code: null, error: null, capture: null });

      if (file.current !== chosenFile) {
        file.current = chosenFile;
        key.current = newWriteKey(operation);
      }

      const workspace = sessionWorkspace()?.id ?? null;
      const ownController = new AbortController();
      controller.current = ownController;
      let outcome;

      try {
        guard.assert();
        const response = await sendWorkflowWrite(
          { operation, ids: {}, input: { file: chosenFile, workspaceId, signal: ownController.signal } },
          key.current,
        );
        guard.assert();
        outcome = (sessionWorkspace()?.id ?? null) !== workspace
          ? { kind: "changed", code: "WORKSPACE_CHANGED" }
          : { kind: "confirmed", data: response?.data ?? null };
      } catch (error) {
        if (ownController.signal.aborted) {
          busy.current = false;
          return;
        }
        outcome = guard.check() ? classifyWriteOutcome(error) : { kind: "identity" };
      }

      busy.current = false;
      if (controller.current === ownController) controller.current = null;
      if (outcome.kind === "identity") return;
      if (outcome.kind === "confirmed" || outcome.kind === "rejected") {
        key.current = null;
        file.current = null;
      }
      if (!alive.current) return;
      setState({ phase: outcome.kind, code: outcome.code ?? null, error: outcome.error ?? null, capture: outcome.data?.capture ?? null });
    },
    [guard, operation],
  );

  const upload = useCallback((chosenFile, workspaceId) => run(chosenFile, workspaceId), [run]);

  // Deliberately resends the SAME chosen file and key: for "unknown" only, never "changed" (the
  // workspace that produced the file is no longer the one a resend would land in).
  const retry = useCallback(() => {
    if (busy.current || state.phase !== "unknown" || !file.current) return;
    void run(file.current, sessionWorkspace()?.id ?? null);
  }, [run, state.phase]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => {
    if (busy.current) return;
    key.current = null;
    file.current = null;
    setState(IDLE);
  }, []);

  return { ...state, uploading: state.phase === "uploading", upload, retry, cancel, reset };
}
