import { useId } from "react";
import { createPortal } from "react-dom";

import "./ConfirmDialog.css";

/*
 * Small confirmation prompt (role="alertdialog"). The safe choice,
 * `cancelLabel`, takes the initial focus. Escape and a click on the backdrop
 * cancel. It renders in a portal and its events stop here, so a prompt opened
 * from inside another dialog never also closes that dialog.
 *
 * Optional `children` render below the message (a summary, for example) and
 * `busy` disables both buttons while the confirmed action is running.
 *
 * Focus trapping, the inert background and focus restoration come from
 * ModalAccessibility, which treats this like every other dialog.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
  children,
  busy = false,
}) {
  const id = useId();

  return createPortal(
    <div
      className="confirm-dialog"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <section
        className="confirm-dialog__surface"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-message`}>{message}</p>
        {children}

        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog__button confirm-dialog__button--${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
