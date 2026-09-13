import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getAccountErrorMessage } from "../../accountHelpers";

// Same modal shell as the account form.
import "../AccountForm/AccountForm.css";
import "./ArchiveAccountDialog.css";

/*
 * Confirms archiving (POST /accounts/{id}/archive). The copy is explicit
 * that this is not a deletion: history and balances are kept.
 * `onConfirm` performs the request and throws on failure.
 */
export default function ArchiveAccountDialog({ account, onConfirm, onClose }) {
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
        setMessage(getAccountErrorMessage(error, t));
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
        className="account-form-modal__dialog archive-account-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-account-title"
        aria-describedby="archive-account-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="archive-account-title">
            {t("dashboard.accounts.archiveDialog.title", { name: account.name })}
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

        <div id="archive-account-description" className="archive-account-dialog__body">
          <p>{t("dashboard.accounts.archiveDialog.description")}</p>

          <ul>
            <li>{t("dashboard.accounts.archiveDialog.keepsHistory")}</li>
            <li>{t("dashboard.accounts.archiveDialog.noNewActivity")}</li>
            <li>{t("dashboard.accounts.archiveDialog.notDeleted")}</li>
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
                ? "dashboard.accounts.archiveDialog.archiving"
                : "dashboard.accounts.archiveDialog.confirm",
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
