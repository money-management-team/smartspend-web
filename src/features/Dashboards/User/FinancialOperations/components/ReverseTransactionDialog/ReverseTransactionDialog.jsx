import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  REASON_MAX,
  REASON_MIN,
  getTransactionErrorMessage,
  getTransactionTitle,
  isInsufficientBalanceError,
} from "../../transactionHelpers";

// Same modal shell as the other dashboard dialogs.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./ReverseTransactionDialog.css";

/*
 * Confirms POST /transactions/{id}/reverse. Reversal posts compensating
 * ledger entries; the original stays in history as "reversed". It is never
 * described as a deletion. `onConfirm(reason)` performs the request and
 * throws on failure; errors stay in the dialog.
 */
export default function ReverseTransactionDialog({ transaction, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const pendingRef = useRef(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [message, setMessage] = useState("");
  const [showBalanceHint, setShowBalanceHint] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
    setShowBalanceHint(false);

    try {
      await onConfirm(trimmed);
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        const fieldError = error?.errors?.reason?.[0];
        if (fieldError) setReasonError(fieldError);
        setMessage(getTransactionErrorMessage(error, t, "reverse"));
        setShowBalanceHint(isInsufficientBalanceError(error));
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
        aria-labelledby="reverse-transaction-title"
        aria-describedby="reverse-transaction-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="reverse-transaction-title" dir="auto">
            {t("dashboard.transactions.reverseDialog.title", {
              name: getTransactionTitle(transaction, t, i18n),
            })}
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

        <div id="reverse-transaction-description" className="reverse-transaction-dialog__body">
          <p>{t("dashboard.transactions.reverseDialog.description")}</p>

          <ul>
            <li>{t("dashboard.transactions.reverseDialog.compensates")}</li>
            <li>{t("dashboard.transactions.reverseDialog.keepsHistory")}</li>
            <li>{t("dashboard.transactions.reverseDialog.once")}</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.transactions.reverseDialog.reason")}</span>
            <textarea
              name="reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
                setMessage("");
              }}
              disabled={isReversing}
              maxLength={REASON_MAX}
              rows={3}
              placeholder={t("dashboard.transactions.reverseDialog.reasonPlaceholder")}
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
              {showBalanceHint && <p>{t("dashboard.transactions.errors.insufficientBalanceHint")}</p>}
            </div>
          )}

          <footer>
            <button type="button" onClick={close} disabled={isReversing}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isReversing} aria-busy={isReversing || undefined}>
              {t(
                isReversing
                  ? "dashboard.transactions.reverseDialog.reversing"
                  : "dashboard.transactions.reverseDialog.confirm",
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
