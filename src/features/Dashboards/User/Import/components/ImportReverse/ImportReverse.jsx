import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuUndo2 } from "react-icons/lu";

import { ApiError } from "../../../api/apiClient";
import { importsApi } from "../../../api/importsApi";
import { createIdempotentAttempt } from "../../../FinancialOperations/transactionHelpers";
import {
  REVERSE_REASON_MAX,
  getImportErrorMessage,
  isImportLifecycleConflict,
  parseImportResponse,
  validateReverseReason,
} from "../../importHelpers";

import "./ImportReverse.css";

/*
 * POST /imports/{id}/reverse — undoes a completed import.
 *
 * This is a reversal, not a deletion: the backend posts the opposing
 * transactions and the originals stay in the ledger, auditable. The wording
 * here says so, and the word "delete" is deliberately never used.
 *
 * A `reason` is required and travels with the reversal. Idempotency works
 * exactly as it does for confirmation: one attempt per mounted import, keyed
 * by the reason, so a retry of the same reversal cannot post it twice.
 */
export default function ImportReverse({ importRecord, onReversed }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);
  const [reverse, setReverse] = useState({ pending: false, error: null });
  const pendingRef = useRef(false);
  const attemptRef = useRef(null);
  attemptRef.current ??= createIdempotentAttempt("import-reverse");

  const close = () => {
    if (reverse.pending) return;
    setIsOpen(false);
    setReasonError(null);
    setReverse({ pending: false, error: null });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const problem = validateReverseReason(reason);
    if (problem) {
      setReasonError(problem);
      return;
    }

    pendingRef.current = true;
    setReasonError(null);
    setReverse({ pending: true, error: null });

    const trimmed = reason.trim();
    // The reason is part of the intent: editing it is a new reversal attempt.
    const idempotencyKey = attemptRef.current.keyFor({ import: importRecord.id, reason: trimmed });

    try {
      const reversed = parseImportResponse(await importsApi.reverse(importRecord.id, { reason: trimmed }, { idempotencyKey }));
      if (!reversed) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      attemptRef.current.settle(null);
      setReverse({ pending: false, error: null });
      setIsOpen(false);
      onReversed(reversed);
    } catch (error) {
      attemptRef.current.settle(error);
      setReverse({ pending: false, error });

      // Already reversed: take the backend's state, never reverse twice.
      if (isImportLifecycleConflict(error)) {
        importsApi
          .get(importRecord.id)
          .then((response) => {
            const current = response?.data?.import;
            if (current?.id != null) onReversed(current);
          })
          .catch(() => {});
      }
    } finally {
      pendingRef.current = false;
    }
  };

  if (!isOpen) {
    return (
      <button type="button" className="import-reverse__open" onClick={() => setIsOpen(true)}>
        <LuUndo2 aria-hidden="true" />
        {t("dashboard.importPage.reverse.action")}
      </button>
    );
  }

  return (
    <form className="import-reverse" onSubmit={handleSubmit} noValidate>
      <h3 className="import-reverse__title">{t("dashboard.importPage.reverse.title")}</h3>
      <p className="import-reverse__body">{t("dashboard.importPage.reverse.explain")}</p>
      <ul className="import-reverse__points">
        <li>{t("dashboard.importPage.reverse.keepsOriginals")}</li>
        <li>{t("dashboard.importPage.reverse.postsOpposing")}</li>
      </ul>

      <label className="import-reverse__field">
        <span>{t("dashboard.importPage.reverse.reasonLabel")}</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REVERSE_REASON_MAX}
          rows={3}
          dir="auto"
          disabled={reverse.pending}
          placeholder={t("dashboard.importPage.reverse.reasonPlaceholder")}
          aria-invalid={reasonError ? "true" : undefined}
        />
      </label>
      {reasonError && (
        <p className="import-reverse__error" role="alert">
          {t(`dashboard.importPage.reverse.reasonErrors.${reasonError}`, { max: REVERSE_REASON_MAX })}
        </p>
      )}

      {reverse.error && (
        <div className="import-panel__alert" role="alert">
          <p>{getImportErrorMessage(reverse.error, t, "reverse")}</p>
        </div>
      )}

      <div className="import-reverse__actions">
        <button type="submit" className="import-reverse__submit" disabled={reverse.pending} aria-busy={reverse.pending}>
          {reverse.pending ? t("dashboard.importPage.reverse.submitting") : t("dashboard.importPage.reverse.submit")}
        </button>
        <button type="button" className="import-panel__secondary" onClick={close} disabled={reverse.pending}>
          {t("dashboard.importPage.reverse.keep")}
        </button>
      </div>
    </form>
  );
}
