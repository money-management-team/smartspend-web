import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { REASON_MAX, REASON_MIN } from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getDebtErrorMessage, getReverseErrorHint, toDateOnly } from "../../debtHelpers";

// Same modal shell and body styles as the transaction reverse dialog.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";

// What reversing does to the money, per debt direction.
const POINTS = ["keepsHistory", "restoresRemaining", "once"];

/*
 * Confirms POST /debt-payments/{paymentId}/reverse (the PAYMENT id). The
 * backend posts the compensating movement on the payment's account, marks
 * the payment "reversed" (it stays in the history) and restores the amount
 * into the debt's remaining amount. It is never described as a deletion.
 * `onConfirm(reason)` performs the request and throws on failure; errors stay
 * in the dialog.
 */
export default function ReverseDebtPaymentDialog({ payment, debt, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  const direction = debt.direction === "receivable" ? "receivable" : "payable";
  const amount = formatMoney(payment.amount, payment.currency_code || debt.currency_code, locale);

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;

    const trimmed = reason.trim();

    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setReasonError(t("dashboard.transactions.validation.reasonLength", { min: REASON_MIN, max: REASON_MAX }));
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
        setMessage(getDebtErrorMessage(error, t, "reverse"));
        setHint(getReverseErrorHint(error, t));
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
        aria-labelledby="reverse-debt-payment-title"
        aria-describedby="reverse-debt-payment-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="reverse-debt-payment-title">{t("dashboard.debts.reverseDialog.title")}</h2>
          <button type="button" onClick={close} disabled={isReversing} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div id="reverse-debt-payment-description" className="reverse-transaction-dialog__body">
          <p>
            {t("dashboard.debts.reverseDialog.summary", {
              date: formatDate(toDateOnly(payment.paid_at) || payment.created_at, locale),
              account: payment.account?.name ?? (payment.account?.id != null ? `#${payment.account.id}` : "—"),
            })}{" "}
            <bdi dir="ltr">{amount}</bdi>
          </p>

          <ul>
            <li>{t(`dashboard.debts.reverseDialog.effect.${direction}`)}</li>
            {POINTS.map((point) => (
              <li key={point}>{t(`dashboard.debts.reverseDialog.${point}`)}</li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t("dashboard.debts.reverseDialog.reason")}</span>
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
              placeholder={t("dashboard.debts.reverseDialog.reasonPlaceholder")}
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
              {t(isReversing ? "dashboard.debts.reverseDialog.reversing" : "dashboard.debts.reverseDialog.confirm")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
