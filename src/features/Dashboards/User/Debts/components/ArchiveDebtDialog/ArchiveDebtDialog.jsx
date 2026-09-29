import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTriangleAlert } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import { getDebtActions, getDebtErrorMessage } from "../../debtHelpers";

// Same modal shell as the other dashboard dialogs; the body and error block
// come from the reverse dialog's stylesheet.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "../../../FinancialOperations/components/ReverseTransactionDialog/ReverseTransactionDialog.css";
import "./ArchiveDebtDialog.css";

const POINTS = ["notDeleted", "keepsHistory", "readOnly", "mustBeSettled"];

/*
 * Confirms DELETE /debts/{id}, which ARCHIVES the debt: it becomes read-only
 * and its payments and ledger history are kept. Nothing is deleted.
 *
 * An open debt that already has payments can't be archived before it is
 * settled: the confirm button is disabled and the dialog says why. The
 * backend still rejects it with 409, shown here. `onConfirm` performs the
 * request and throws on failure.
 */
export default function ArchiveDebtDialog({ debt, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const pendingRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");
  const isBlocked = getDebtActions(debt).mustSettleFirst;

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleConfirm = async () => {
    if (pendingRef.current || isBlocked) return;

    pendingRef.current = true;
    setIsRunning(true);
    setMessage("");

    try {
      await onConfirm();
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") setMessage(getDebtErrorMessage(error, t, "archive"));
    } finally {
      pendingRef.current = false;
      setIsRunning(false);
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
        className="account-form-modal__dialog archive-debt-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-debt-title"
        aria-describedby="archive-debt-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="archive-debt-title" dir="auto">
            {t("dashboard.debts.archiveDialog.title", { name: debt.counterparty_name ?? `#${debt.id}` })}
          </h2>
          <button type="button" onClick={close} disabled={isRunning} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div id="archive-debt-description" className="reverse-transaction-dialog__body">
          <p>{t("dashboard.debts.archiveDialog.description")}</p>

          <ul>
            {POINTS.map((point) => (
              <li key={point}>{t(`dashboard.debts.archiveDialog.${point}`)}</li>
            ))}
          </ul>
        </div>

        {isBlocked && (
          <div className="archive-debt-dialog__blocked" role="note">
            <LuTriangleAlert aria-hidden="true" />
            <p>
              {t("dashboard.debts.archiveDialog.hasPayments", {
                amount: formatMoney(debt.remaining_amount, debt.currency_code, locale),
              })}
            </p>
          </div>
        )}

        {message && (
          <div className="account-form-modal__error archive-debt-dialog__error" role="alert">
            <p dir="auto">{message}</p>
          </div>
        )}

        <footer>
          <button type="button" onClick={close} disabled={isRunning} autoFocus>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleConfirm}
            disabled={isRunning || isBlocked}
            aria-busy={isRunning || undefined}
          >
            {t(isRunning ? "dashboard.debts.archiveDialog.running" : "dashboard.debts.archiveDialog.confirm")}
          </button>
        </footer>
      </section>
    </div>
  );
}
