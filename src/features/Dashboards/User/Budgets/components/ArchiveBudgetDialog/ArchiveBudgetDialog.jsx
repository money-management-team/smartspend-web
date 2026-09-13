import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getBudgetErrorMessage } from "../../budgetHelpers";

// Same modal shell as the other dashboard dialogs.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./ArchiveBudgetDialog.css";

/*
 * Confirms archiving (DELETE /budgets/{id}). The copy is explicit that this is
 * not a permanent deletion: the budget's history is kept and it becomes
 * read-only. `onConfirm` performs the request and throws on failure.
 */
export default function ArchiveBudgetDialog({ budget, onConfirm, onClose }) {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [message, setMessage] = useState("");

  const close = () => {
    if (!pendingRef.current) onClose();
  };

  const handleConfirm = async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsArchiving(true);
    setMessage("");

    try {
      await onConfirm();
    } catch (error) {
      // 401 is handled by apiClient's session-expired flow.
      if (error?.code !== "UNAUTHENTICATED") {
        setMessage(getBudgetErrorMessage(error, t, "archive"));
      }
    } finally {
      pendingRef.current = false;
      setIsArchiving(false);
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
        className="account-form-modal__dialog archive-budget-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-budget-title"
        aria-describedby="archive-budget-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="archive-budget-title" dir="auto">
            {t("dashboard.budgets.archiveDialog.title", { name: budget.name })}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={isArchiving}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <div id="archive-budget-description" className="archive-budget-dialog__body">
          <p>{t("dashboard.budgets.archiveDialog.description")}</p>

          <ul>
            <li>{t("dashboard.budgets.archiveDialog.keepsHistory")}</li>
            <li>{t("dashboard.budgets.archiveDialog.keepsTransactions")}</li>
            <li>{t("dashboard.budgets.archiveDialog.noEdits")}</li>
          </ul>
        </div>

        {message && (
          <p className="account-form-modal__error" role="alert" dir="auto">
            {message}
          </p>
        )}

        <footer>
          <button type="button" onClick={close} disabled={isArchiving} autoFocus>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleConfirm}
            disabled={isArchiving}
            aria-busy={isArchiving || undefined}
          >
            {t(
              isArchiving
                ? "dashboard.budgets.archiveDialog.archiving"
                : "dashboard.budgets.archiveDialog.confirm",
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
