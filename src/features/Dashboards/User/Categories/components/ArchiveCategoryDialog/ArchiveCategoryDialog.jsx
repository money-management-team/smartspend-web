import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCategoryErrorMessage } from "../../categoryHelpers";

// Same modal shell as the account form.
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./ArchiveCategoryDialog.css";

/*
 * Confirms archiving (POST /categories/{id}/archive). The copy is explicit
 * that this is not a deletion: existing transactions keep the category.
 * `onConfirm` performs the request and throws on failure.
 */
export default function ArchiveCategoryDialog({ category, onConfirm, onClose }) {
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
        setMessage(getCategoryErrorMessage(error, t));
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
        className="account-form-modal__dialog archive-category-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-category-title"
        aria-describedby="archive-category-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="archive-category-title" dir="auto">
            {t("dashboard.categories.archiveDialog.title", { name: category.name })}
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

        <div id="archive-category-description" className="archive-category-dialog__body">
          <p>{t("dashboard.categories.archiveDialog.description")}</p>

          <ul>
            <li>{t("dashboard.categories.archiveDialog.keepsTransactions")}</li>
            <li>{t("dashboard.categories.archiveDialog.notOffered")}</li>
            <li>{t("dashboard.categories.archiveDialog.notDeleted")}</li>
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
                ? "dashboard.categories.archiveDialog.archiving"
                : "dashboard.categories.archiveDialog.confirm",
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
