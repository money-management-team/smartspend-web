import { useTranslation } from "react-i18next";

// The dashboard's modal shell (backdrop, card, header and footer buttons).
import "../../../Accounts/components/AccountForm/AccountForm.css";
import "./PlanDialog.css";

/*
 * The frame of the installment dialogs (confirm, postpone, skip). While
 * `busy` (a request in flight) it can't be dismissed, so a write is never
 * abandoned half way. Footer buttons come from the caller; the first one
 * should carry `autoFocus`.
 */
export default function PlanDialog({ id, eyebrow, title, busy, onClose, children, footer, role = "dialog" }) {
  const { t } = useTranslation();

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <div
      className="account-form-modal plan-dialog-backdrop"
      role="presentation"
      onMouseDown={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
    >
      <section
        className="account-form-modal__dialog plan-dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        aria-busy={busy || undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="plan-dialog__header">
          <div>
            {eyebrow && <p className="plan-dialog__eyebrow">{eyebrow}</p>}
            <h2 id={`${id}-title`} dir="auto">
              {title}
            </h2>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <div id={`${id}-body`} className="plan-dialog__body">
          {children}
        </div>

        <footer className="plan-dialog__footer">{footer}</footer>
      </section>
    </div>
  );
}
