import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import logo from "../../assets/smart-spend-logo-pdf.png";
import "./accessMessages";
import "./AccessExperience.css";

// Mount only while open. Native showModal supplies the focus trap and makes
// the background inert; the portal keeps the dialog outside forms and grids.
export default function GlassDialog({
  title,
  hint,
  kicker,
  onClose,
  children,
  variant = "policy",
}) {
  const { t, i18n } = useTranslation("access");
  const ref = useRef(null),
    backdropPressed = useRef(false),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const active = document.activeElement,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector("[data-glass-focus]")?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
      if (active?.isConnected) active.focus?.({ preventScroll: true });
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`access-dialog access-dialog--${variant}`}
      dir={i18n.dir()}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPressed.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const outside =
          backdropPressed.current && event.target === event.currentTarget;
        backdropPressed.current = false;
        if (outside) onClose();
      }}
    >
      <div className="access-dialog__surface">
        <div className="access-dialog__glow" aria-hidden="true" />
        <header className="access-dialog__header">
          <div className="access-dialog__brand">
            <img src={logo} alt="SmartSpend" />
            <span>
              SmartSpend<small>{t("brand")}</small>
            </span>
          </div>
          <button
            type="button"
            className="access-dialog__close"
            aria-label={t("close")}
            onClick={onClose}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>
        <div className="access-dialog__intro">
          <span className="access-dialog__kicker">{kicker}</span>
          <h2 id={`${id}-title`} tabIndex={-1} data-glass-focus>
            {title}
          </h2>
          {hint && <p id={`${id}-hint`}>{hint}</p>}
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
