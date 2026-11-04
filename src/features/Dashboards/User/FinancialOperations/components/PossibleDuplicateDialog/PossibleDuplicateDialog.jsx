import { useRef } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDateTime, formatMoney } from "../../../utils/formatters";
import { getTransactionErrorMessage } from "../../transactionHelpers";

// Same modal shell as the other dashboard dialogs.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./PossibleDuplicateDialog.css";

/*
 * Shown instead of the normal success/error outcome when income, expense or
 * a correction answers 409 `possible_duplicate` (smartspend-backend
 * PossibleDuplicateTransactionException; off unless config/finance.php's
 * manual_duplicate_guard is on). Nothing was recorded by the request that got
 * this answer — the account's own posting transaction rolled back before any
 * ledger entry existed — so the Idempotency-Key the caller already holds is
 * still good.
 *
 * `onConfirm()` resends the ORIGINAL payload with the SAME key plus
 * `confirm_possible_duplicate: true` (the caller adds the flag and reuses the
 * key; this component never builds a request). `onCancel()` sends nothing: the
 * caller goes back to showing the review/correction form it replaced, with
 * the same draft, so editing or truly cancelling is still one tap away.
 *
 * `isConfirming` disables both buttons and blocks Escape, so a second tap (or
 * closing the dialog) can't start a second resend while the first is still in
 * flight. `error` is anything the resend itself failed with (not another
 * possible-duplicate 409 — the backend never asks again once confirmed),
 * shown inline so the person can retry the SAME decision without losing it.
 */
export default function PossibleDuplicateDialog({ matched, isConfirming, error, onCancel, onConfirm }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);

  const cancel = () => {
    if (!isConfirming) onCancel();
  };

  const confirm = async () => {
    // Synchronous guard: a double click fires twice before React re-renders,
    // and `isConfirming` (the caller's state) may not have updated yet either.
    if (pendingRef.current || isConfirming) return;
    pendingRef.current = true;
    try {
      await onConfirm();
    } finally {
      pendingRef.current = false;
    }
  };

  const typeLabel = t(`dashboard.transactions.types.${matched.type}`, { defaultValue: matched.type });
  const amount = formatMoney(matched.amount, matched.currency_code, locale);

  const row = (label, value) =>
    value ? (
      <div className="possible-duplicate-dialog__row">
        <span>{label}</span>
        <b dir="auto">{value}</b>
      </div>
    ) : null;

  return (
    <div
      className="account-form-modal"
      role="presentation"
      onMouseDown={cancel}
      onKeyDown={(event) => event.key === "Escape" && cancel()}
    >
      <section
        className="account-form-modal__dialog possible-duplicate-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="possible-duplicate-title"
        aria-describedby="possible-duplicate-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="possible-duplicate-title">
            <LuTriangleAlert aria-hidden="true" className="possible-duplicate-dialog__icon" />
            {t("dashboard.transactions.possibleDuplicateDialog.title")}
          </h2>
          <button type="button" onClick={cancel} disabled={isConfirming} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <p id="possible-duplicate-description" className="possible-duplicate-dialog__body">
          {t("dashboard.transactions.possibleDuplicateDialog.description")}
        </p>

        <div className="possible-duplicate-dialog__match">
          <h3>{t("dashboard.transactions.possibleDuplicateDialog.matchedHeading")}</h3>
          {row(typeLabel, amount)}
          {row(t("dashboard.transactions.fields.date"), formatDateTime(matched.occurred_at, locale))}
          {row(t("dashboard.transactions.fields.description"), matched.description)}
          {row(t("dashboard.transactions.fields.referenceNumber"), matched.reference_number)}
          {row(
            t("dashboard.transactions.possibleDuplicateDialog.recordedAt"),
            formatDateTime(matched.created_at, locale),
          )}
        </div>

        {error && (
          <div className="account-form-modal__error" role="alert">
            <p dir="auto">{getTransactionErrorMessage(error, t, "create")}</p>
          </div>
        )}

        <footer>
          <button type="button" onClick={cancel} disabled={isConfirming}>
            {t("dashboard.transactions.possibleDuplicateDialog.cancel")}
          </button>
          <button type="button" onClick={confirm} disabled={isConfirming} aria-busy={isConfirming || undefined}>
            {t(
              isConfirming
                ? "dashboard.transactions.possibleDuplicateDialog.confirming"
                : "dashboard.transactions.possibleDuplicateDialog.confirm",
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
