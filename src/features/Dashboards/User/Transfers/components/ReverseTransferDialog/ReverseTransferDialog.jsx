import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  REASON_MAX,
  REASON_MIN,
} from "../../../FinancialOperations/transactionHelpers";
import {
  getTransferErrorHint,
  getTransferErrorMessage,
  hasTransferFee,
} from "../../transferHelpers";

// Same modal shell as the other dashboard dialogs; the body and textarea
// styles come from the transaction reverse dialog.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";

/*
 * Confirms POST /transfers/{id}/reverse. Reversing posts compensating ledger
 * entries for the whole transfer — the movement and the fee together — and the
 * transfer stays in history as "reversed". It is never described as a
 * deletion. `onConfirm(reason)` performs the request and throws on failure;
 * errors stay in the dialog.
 */
export default function ReverseTransferDialog({ transfer, onConfirm, onClose }) {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Synchronous guard: a double click fires twice before React re-renders.
    if (pendingRef.current) return;

    const trimmed = reason.trim();

    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setReasonError(
        t("dashboard.transactions.validation.reasonLength", {
          min: REASON_MIN,
          max: REASON_MAX,
        }),
      );
      return;
    }

    pendingRef.current = true;
    setIsReversing(true);
    setReasonError("");
    setMessage("");
    setHint("");

    try {
      await onConfirm(trimmed);
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        const fieldError = error?.errors?.reason?.[0];
        if (fieldError) setReasonError(fieldError);
        setMessage(getTransferErrorMessage(error, t, "reverse"));
        setHint(getTransferErrorHint(error, t, "reverse"));
      }
    } finally {
      pendingRef.current = false;
      setIsReversing(false);
    }
  };

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog reverse-transaction-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reverse-transfer-title"
        aria-describedby="reverse-transfer-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="reverse-transfer-title">
            {t("dashboard.transfers.reverseDialog.title", { id: transfer.id })}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={isReversing}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <div id="reverse-transfer-description" className="reverse-transaction-dialog__body">
          <p>{t("dashboard.transfers.reverseDialog.description")}</p>

          <ul>
            <li>{t("dashboard.transfers.reverseDialog.compensates")}</li>
            {hasTransferFee(transfer) && (
              <li>{t("dashboard.transfers.reverseDialog.includesFee")}</li>
            )}
            <li>{t("dashboard.transfers.reverseDialog.keepsHistory")}</li>
            <li>{t("dashboard.transfers.reverseDialog.once")}</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.transfers.reverseDialog.reason")}</span>
            <textarea
              name="reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
                setMessage("");
                setHint("");
              }}
              disabled={isReversing}
              maxLength={REASON_MAX}
              rows={3}
              placeholder={t("dashboard.transfers.reverseDialog.reasonPlaceholder")}
              aria-invalid={reasonError ? true : undefined}
              dir="auto"
              required
              autoFocus
            />
            <em className="account-form-modal__hint">
              {t("dashboard.transactions.validation.reasonHint", {
                length: reason.trim().length,
                min: REASON_MIN,
                max: REASON_MAX,
              })}
            </em>
            {reasonError && <small>{reasonError}</small>}
          </label>

          {message && (
            <div className="account-form-modal__error" role="alert">
              <p dir="auto">{message}</p>
              {hint && <p>{hint}</p>}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isReversing}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isReversing} aria-busy={isReversing || undefined}>
              {t(
                isReversing
                  ? "dashboard.transfers.reverseDialog.reversing"
                  : "dashboard.transfers.reverseDialog.confirm",
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
