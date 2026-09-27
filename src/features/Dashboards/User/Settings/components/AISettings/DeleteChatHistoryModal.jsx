import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LuTrash2, LuTriangleAlert } from "react-icons/lu";
import "./DeleteChatHistoryModal.css";

export default function DeleteChatHistoryModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus confirmation button when opened
    confirmButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="delete-chat-modal__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="delete-chat-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-chat-modal-title"
        aria-describedby="delete-chat-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon Badge */}
        <div className="delete-chat-modal__icon-wrap">
          <LuTrash2 className="delete-chat-modal__icon" />
        </div>

        {/* Title & Description */}
        <h3 id="delete-chat-modal-title" className="delete-chat-modal__title">
          {t("dashboard.settings.ai.modal.title")}
        </h3>
        <p id="delete-chat-modal-desc" className="delete-chat-modal__desc">
          {t("dashboard.settings.ai.modal.subtitle")}
        </p>

        {/* Warning Box */}
        <div className="delete-chat-modal__warning-box">
          <LuTriangleAlert className="delete-chat-modal__warning-icon" />
          <span className="delete-chat-modal__warning-text">
            {t("dashboard.settings.ai.modal.warning")}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="delete-chat-modal__actions">
          <button
            ref={confirmButtonRef}
            type="button"
            className="delete-chat-modal__btn-confirm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "..." : t("dashboard.settings.ai.modal.confirm")}
          </button>
          <button
            type="button"
            className="delete-chat-modal__btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t("dashboard.settings.ai.modal.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
