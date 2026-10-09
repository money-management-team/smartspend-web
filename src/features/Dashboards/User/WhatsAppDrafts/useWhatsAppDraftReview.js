import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { whatsappApi } from "../api/whatsappApi.js";
import {
  classifyWhatsAppError,
  createWhatsAppConfirmAttempt,
  isOutcomeUncertain,
  parseConfirmResponse,
  parseDraftResponse,
  resolveConfirmationOutcome,
} from "../FinancialOperations/whatsappContract.js";
import {
  canConfirmDraft,
  changedFields,
  formToChanges,
  initialReviewState,
  reviewReducer,
  serverFieldErrors,
  validateForm,
} from "./draftReview.js";

/*
 * The review screen's state and its three write operations.
 *
 * Mount it under a `key` made of the session and the draft id: a different
 * user or draft is a new instance, so no attempt, edit or answer can carry
 * over (see WhatsAppDraftDetails). Results arriving after unmount are
 * dropped; nothing here touches browser storage.
 *
 * MONEY SAFETY
 * - One write at a time (`writeRef`): a double click or a second code path
 *   cannot start another save/confirm/discard while one is pending.
 * - Confirming sends only {review_version} and an Idempotency-Key. The
 *   logical attempt (draft id, review_version, key) lives in `attemptRef`
 *   and is created ONLY by an explicit user confirmation. It is reused, never
 *   regenerated, for every retry of that same confirmation.
 * - After a timeout, a dropped connection, a 5xx or an unreadable answer the
 *   outcome is UNKNOWN. We then read the draft (GET, no side effects):
 *     confirmed       -> done (the backend's transaction is shown);
 *     still reviewable-> "uncertain": the user may check again or retry with
 *                        the SAME key (the backend replays the original
 *                        transaction for a repeated key, it cannot post twice).
 * - A page reload drops `attemptRef`. The first thing a reload does is read
 *   the draft; a confirmed draft is shown as recorded, and only a still
 *   reviewable one can be confirmed again, by a new explicit user action.
 */
export function useWhatsAppDraftReview({ api = whatsappApi, draftId, onChanged }) {
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState);
  const [reloadKey, setReloadKey] = useState(0);
  const mountedRef = useRef(true);
  const writeRef = useRef(null); // "save" | "confirm" | "discard" while pending
  const attemptRef = useRef(null); // { draftId, reviewVersion, idempotencyKey }
  const draftRef = useRef(null);
  const formRef = useRef(null);
  const changedRef = useRef(onChanged);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    draftRef.current = state.draft;
    formRef.current = state;
    changedRef.current = onChanged;
  });

  // Only ever called with the instance still mounted.
  const apply = useCallback((action) => {
    if (mountedRef.current) dispatch(action);
    // The draft left the review queue: whoever shows the pending count must re-read it.
    // (Also when this screen was closed meanwhile: the count is global, not this screen's.)
    if (action.type === "confirm-done" || action.type === "discard-done") changedRef.current?.();
  }, []);

  /* ---------------------------------------------------------------- load */

  useEffect(() => {
    const controller = new AbortController();

    api
      .getDraft(draftId, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        dispatch({ type: "loaded", draft: parseDraftResponse(response) });
      })
      .catch((error) => {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        dispatch({ type: "load-failed", error });
      });

    return () => controller.abort();
  }, [api, draftId, reloadKey]);

  const reload = useCallback(() => {
    attemptRef.current = null; // an explicit reload starts the review over
    setReloadKey((key) => key + 1);
  }, []);

  /** A GET of the draft that never throws; null when it could not be read. */
  const readDraft = useCallback(async () => {
    try {
      return parseDraftResponse(await api.getDraft(draftId));
    } catch {
      return null;
    }
  }, [api, draftId]);

  /* ---------------------------------------------------------------- form */

  const setField = useCallback((field, value) => dispatch({ type: "field", field, value }), []);
  const resetForm = useCallback(() => dispatch({ type: "reset-form" }), []);

  const dirtyFields = useMemo(
    () => (state.saved && state.form ? changedFields(state.saved, state.form) : []),
    [state.saved, state.form],
  );

  /* ---------------------------------------------------------------- save */

  const save = useCallback(async () => {
    const current = formRef.current;
    const draft = draftRef.current;
    if (writeRef.current || !draft || !current?.form) return;

    const clientErrors = validateForm(current.form);
    if (Object.keys(clientErrors).length) {
      dispatch({ type: "field-errors", errors: clientErrors });
      return;
    }

    const changes = formToChanges(current.saved, current.form);
    if (!Object.keys(changes).length) return; // nothing to save: no request

    writeRef.current = "save";
    dispatch({ type: "save-start" });

    try {
      const response = await api.updateDraft(draft.id, changes, draft.review_version);
      apply({ type: "saved", draft: parseDraftResponse(response) });
    } catch (error) {
      if (!mountedRef.current) return;
      const kind = classifyWhatsAppError(error);

      if (kind === "conflict") {
        // Stale review_version. Show the server's latest, keep the user's edits aside.
        const latest = await readDraft();
        if (latest) apply({ type: "conflict", draft: latest, mine: changes });
        else apply({ type: "save-failed", error });
      } else if (isOutcomeUncertain(error)) {
        // The save may have been applied. If the latest draft already holds
        // the edits, treat it as saved; otherwise keep the form and report.
        const latest = await readDraft();
        if (latest && sameValues(latest, current.form)) {
          apply({ type: "saved", draft: latest });
        } else {
          apply({ type: "save-failed", error });
        }
      } else {
        apply({ type: "save-failed", error, fieldErrors: serverFieldErrors(error) });
      }
    } finally {
      writeRef.current = null;
    }
  }, [api, apply, readDraft]);

  const resolveConflict = useCallback((mode) => {
    dispatch({ type: mode === "reapply" ? "conflict-reapply" : "conflict-dismiss" });
  }, []);

  /* ------------------------------------------------------------- confirm */

  /** Reads the draft after an unknown outcome. Returns true when it settled the matter. */
  const reconcileConfirmation = useCallback(async () => {
    const latest = await readDraft();
    if (!mountedRef.current) return true;
    if (!latest) {
      apply({ type: "confirm-uncertain", note: "unreadable" });
      return false;
    }

    const outcome = resolveConfirmationOutcome(latest);
    if (outcome === "confirmed") {
      attemptRef.current = null;
      apply({ type: "confirm-done", draft: latest, note: "reconciled" });
      return true;
    }

    const attempt = attemptRef.current;
    if (outcome === "still_open" && attempt && latest.review_version === attempt.reviewVersion) {
      apply({ type: "refreshed", draft: latest });
      apply({ type: "confirm-uncertain", note: "not_recorded_yet" });
      return false;
    }

    // The draft changed or closed in another way: the old attempt no longer applies.
    attemptRef.current = null;
    apply({ type: "refreshed", draft: latest });
    apply({ type: "conflict", draft: latest, mine: {} });
    apply({ type: "confirm-clear" });
    return true;
  }, [apply, readDraft]);

  const runConfirmation = useCallback(async (attempt) => {
    writeRef.current = "confirm";
    dispatch({ type: "confirm-start" });

    try {
      const response = await api.confirmDraft(attempt.draftId, {
        reviewVersion: attempt.reviewVersion,
        idempotencyKey: attempt.idempotencyKey,
      });
      const result = parseConfirmResponse(response);
      attemptRef.current = null;
      apply({ type: "confirm-done", draft: result.draft, transaction: result.transaction });
    } catch (error) {
      if (!mountedRef.current) return;
      const kind = classifyWhatsAppError(error);

      if (kind === "aborted") {
        apply({ type: "confirm-uncertain", error });
      } else if (isOutcomeUncertain(error)) {
        // Unknown outcome: keep the attempt (same key), then look at the draft.
        apply({ type: "confirm-uncertain", error });
        apply({ type: "confirm-checking" });
        await reconcileConfirmation();
      } else if (kind === "conflict") {
        // Stale version, a key used elsewhere, or already confirmed: ask the server.
        const latest = await readDraft();
        if (latest && resolveConfirmationOutcome(latest) === "confirmed") {
          attemptRef.current = null;
          apply({ type: "confirm-done", draft: latest, note: "reconciled" });
        } else if (latest && latest.review_version !== attempt.reviewVersion) {
          attemptRef.current = null;
          apply({ type: "conflict", draft: latest, mine: {} });
          apply({ type: "confirm-clear" });
        } else {
          attemptRef.current = null;
          if (latest) apply({ type: "refreshed", draft: latest });
          apply({ type: "confirm-rejected", error });
        }
      } else {
        // A definitive refusal records nothing; the draft is re-read for fresh readiness.
        attemptRef.current = null;
        apply({ type: "confirm-rejected", error });
        const latest = await readDraft();
        if (latest) apply({ type: "refreshed", draft: latest });
      }
    } finally {
      writeRef.current = null;
    }
  }, [api, apply, readDraft, reconcileConfirmation]);

  /**
   * Explicit user confirmation (from the dialog). Starts a NEW logical attempt
   * only when none is outstanding for this draft version.
   */
  const confirm = useCallback(() => {
    const current = formRef.current;
    const draft = draftRef.current;
    if (writeRef.current || !draft || !canConfirmDraft(current)) return;

    const outstanding = attemptRef.current;
    const attempt = outstanding && outstanding.draftId === draft.id && outstanding.reviewVersion === draft.review_version
      ? outstanding
      : createWhatsAppConfirmAttempt(draft.id, draft.review_version);
    attemptRef.current = attempt;
    return runConfirmation(attempt);
  }, [runConfirmation]);

  /** Retry of the SAME attempt (same key, same review_version) after an unknown outcome. */
  const retryConfirmation = useCallback(async () => {
    const attempt = attemptRef.current;
    if (writeRef.current || !attempt || formRef.current.confirm.phase !== "uncertain") return;

    // Settle what can be settled first: it may already be confirmed.
    writeRef.current = "confirm";
    dispatch({ type: "confirm-checking" });
    const settled = await reconcileConfirmation();
    writeRef.current = null;

    if (!settled && attemptRef.current === attempt && mountedRef.current) await runConfirmation(attempt);
  }, [reconcileConfirmation, runConfirmation]);

  /** Read-only: look at the draft again after an unknown outcome. */
  const checkConfirmation = useCallback(async () => {
    if (writeRef.current) return;
    writeRef.current = "confirm";
    dispatch({ type: "confirm-checking" });
    try {
      await reconcileConfirmation();
    } finally {
      writeRef.current = null;
    }
  }, [reconcileConfirmation]);

  /* ------------------------------------------------------------- discard */

  const reconcileDiscard = useCallback(async () => {
    const latest = await readDraft();
    if (!mountedRef.current) return;
    if (!latest) {
      apply({ type: "discard-uncertain" });
    } else if (latest.status === "discarded") {
      apply({ type: "discard-done", draft: latest });
    } else {
      apply({ type: "refreshed", draft: latest });
      apply({ type: "discard-rejected", error: null });
    }
  }, [apply, readDraft]);

  const discard = useCallback(async () => {
    const draft = draftRef.current;
    if (writeRef.current || !draft || draft.status !== "ready_for_review" || draft.can_discard !== true) return;

    writeRef.current = "discard";
    dispatch({ type: "discard-start" });

    try {
      const response = await api.discardDraft(draft.id);
      apply({ type: "discard-done", draft: parseDraftResponse(response) });
    } catch (error) {
      if (!mountedRef.current) return;
      if (isOutcomeUncertain(error)) {
        // Never assume a timed-out DELETE failed: read the draft first.
        apply({ type: "discard-uncertain", error });
        apply({ type: "discard-checking" });
        await reconcileDiscard();
      } else {
        apply({ type: "discard-rejected", error });
        const latest = await readDraft();
        if (latest) apply({ type: "refreshed", draft: latest });
      }
    } finally {
      writeRef.current = null;
    }
  }, [api, apply, readDraft, reconcileDiscard]);

  const checkDiscard = useCallback(async () => {
    if (writeRef.current) return;
    writeRef.current = "discard";
    dispatch({ type: "discard-checking" });
    try {
      await reconcileDiscard();
    } finally {
      writeRef.current = null;
    }
  }, [reconcileDiscard]);

  const busy = state.save.phase === "saving"
    || ["confirming", "checking"].includes(state.confirm.phase)
    || ["discarding", "checking"].includes(state.discard.phase);

  return {
    state,
    dirtyFields,
    isDirty: dirtyFields.length > 0,
    busy,
    canConfirm: canConfirmDraft(state),
    setField,
    resetForm,
    save,
    resolveConflict,
    confirm,
    retryConfirmation,
    checkConfirmation,
    discard,
    checkDiscard,
    clearDiscard: () => dispatch({ type: "discard-clear" }),
    clearConfirm: () => dispatch({ type: "confirm-clear" }),
    reload,
  };
}

/* Whether a draft's saved values equal what the form holds (string comparison). */
function sameValues(draft, form) {
  const values = draft.review_values;
  const norm = (value) => String(value ?? "").trim();
  return norm(values.account_id) === norm(form.account_id)
    && norm(values.category_id) === norm(form.category_id)
    && norm(values.description) === norm(form.description)
    && norm(values.transaction_date) === norm(form.transaction_date)
    && norm((values.transaction_time ?? "").slice(0, 5)) === norm(form.transaction_time)
    && amountsEqual(values.amount, form.amount);
}

function amountsEqual(a, b) {
  const clean = (value) => {
    const text = String(value ?? "").trim();
    if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
    const [integer, fraction = ""] = text.split(".");
    return `${integer.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
  };
  return clean(a) === clean(b);
}
