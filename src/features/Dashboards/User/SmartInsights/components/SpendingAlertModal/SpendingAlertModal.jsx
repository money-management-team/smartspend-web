import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  LuTriangleAlert,
  LuClock,
  LuUtensils,
  LuSparkles,
  LuX,
  LuCheck,
} from "react-icons/lu";
import "./SpendingAlertModal.css";

export default function SpendingAlertModal({
  isOpen,
  onClose,
  onApply,
  isApplied = false,
}) {
  const { t } = useTranslation();
  const applyButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    applyButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const transactions = [
    {
      id: 1,
      nameKey: "dashboard.smartInsights.spendingModal.tx1Name",
      metaKey: "dashboard.smartInsights.spendingModal.tx1Meta",
      amountKey: "dashboard.smartInsights.spendingModal.tx1Amount",
    },
    {
      id: 2,
      nameKey: "dashboard.smartInsights.spendingModal.tx2Name",
      metaKey: "dashboard.smartInsights.spendingModal.tx2Meta",
      amountKey: "dashboard.smartInsights.spendingModal.tx2Amount",
    },
    {
      id: 3,
      nameKey: "dashboard.smartInsights.spendingModal.tx3Name",
      metaKey: "dashboard.smartInsights.spendingModal.tx3Meta",
      amountKey: "dashboard.smartInsights.spendingModal.tx3Amount",
    },
    {
      id: 4,
      nameKey: "dashboard.smartInsights.spendingModal.tx4Name",
      metaKey: "dashboard.smartInsights.spendingModal.tx4Meta",
      amountKey: "dashboard.smartInsights.spendingModal.tx4Amount",
    },
  ];

  return (
    <div
      className="spending-modal__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="spending-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spending-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="spending-modal__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <LuX />
        </button>

        {/* Modal Header */}
        <div className="spending-modal__header">
          <div className="spending-modal__badge-line">
            <span className="spending-modal__ribbon">
              <LuTriangleAlert className="spending-modal__ribbon-icon" />
              <span>{t("dashboard.smartInsights.spendingModal.badge")}</span>
            </span>
          </div>

          <h3 id="spending-modal-title" className="spending-modal__title">
            {t("dashboard.smartInsights.spendingModal.title")}
          </h3>

          <p className="spending-modal__subtitle">
            {t("dashboard.smartInsights.spendingModal.subtitle")}
          </p>
        </div>

        {/* Spending Comparison Box */}
        <div className="spending-modal__compare-box">
          <div className="spending-modal__compare-labels">
            <span>{t("dashboard.smartInsights.spendingModal.avgLabel")}</span>
            <span className="spending-modal__current-tag">
              {t("dashboard.smartInsights.spendingModal.currentLabel")}
            </span>
          </div>

          <div className="spending-modal__track">
            <div
              className="spending-modal__fill-normal"
              style={{ width: "65%" }}
            />
            <div
              className="spending-modal__fill-excess"
              style={{ width: "35%" }}
            />
          </div>

          <div className="spending-modal__sub-labels">
            <span>{t("dashboard.smartInsights.spendingModal.safeLimit")}</span>
            <span className="spending-modal__excess-label">
              {t("dashboard.smartInsights.spendingModal.excess")}
            </span>
          </div>
        </div>

        {/* Callout Reason */}
        <div className="spending-modal__callout">
          <LuClock className="spending-modal__callout-icon" />
          <p className="spending-modal__callout-text">
            {t("dashboard.smartInsights.spendingModal.reason")}
          </p>
        </div>

        {/* Recent Transactions List */}
        <div className="spending-modal__tx-section">
          <h4 className="spending-modal__tx-title">
            {t("dashboard.smartInsights.spendingModal.recentTitle")}
          </h4>

          <div className="spending-modal__tx-list">
            {transactions.map((tx) => (
              <div key={tx.id} className="spending-modal__tx-item">
                <div className="spending-modal__tx-info">
                  <div className="spending-modal__tx-icon-wrap">
                    <LuUtensils />
                  </div>
                  <div className="spending-modal__tx-text">
                    <span className="spending-modal__tx-name">
                      {t(tx.nameKey)}
                    </span>
                    <span className="spending-modal__tx-meta">
                      {t(tx.metaKey)}
                    </span>
                  </div>
                </div>
                <span className="spending-modal__tx-amount">
                  {t(tx.amountKey)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation Card */}
        <div className="spending-modal__rec-box">
          <LuSparkles className="spending-modal__rec-icon" />
          <p className="spending-modal__rec-text">
            {t("dashboard.smartInsights.spendingModal.recommendation")}
          </p>
        </div>

        {/* Modal Actions */}
        <div className="spending-modal__actions">
          <button
            ref={applyButtonRef}
            type="button"
            className={`spending-modal__btn-apply ${
              isApplied ? "spending-modal__btn-apply--done" : ""
            }`}
            onClick={onApply}
            disabled={isApplied}
          >
            {isApplied && <LuCheck className="spending-btn-icon" />}
            <span>
              {isApplied
                ? t("dashboard.smartInsights.cards.dining.applied")
                : t("dashboard.smartInsights.spendingModal.applyBtn")}
            </span>
          </button>

          <button
            type="button"
            className="spending-modal__btn-outline"
            onClick={onClose}
          >
            {t("dashboard.smartInsights.spendingModal.editBtn")}
          </button>

          <button
            type="button"
            className="spending-modal__btn-dismiss"
            onClick={onClose}
          >
            {t("dashboard.smartInsights.spendingModal.dismissBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
