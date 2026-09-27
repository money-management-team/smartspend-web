import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuSparkles,
  LuUtensils,
  LuTv,
  LuX,
  LuCheck,
} from "react-icons/lu";
import "./SavingsSuggestionsModal.css";

export default function SavingsSuggestionsModal({
  isOpen,
  onClose,
  onApplyAll,
}) {
  const { t } = useTranslation();
  const applyAllRef = useRef(null);

  const [appliedCards, setAppliedCards] = useState({
    card1: false,
    card2: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    applyAllRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApplySingle = (cardKey) => {
    setAppliedCards((prev) => ({
      ...prev,
      [cardKey]: true,
    }));
  };

  const handleApplyAllClick = () => {
    setAppliedCards({ card1: true, card2: true });
    onApplyAll?.();
  };

  return (
    <div
      className="savings-modal__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="savings-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="savings-modal__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <LuX />
        </button>

        {/* Modal Header */}
        <div className="savings-modal__header">
          <div className="savings-modal__icon-title-line">
            <div className="savings-modal__icon-wrap">
              <LuSparkles />
            </div>
            <div className="savings-modal__title-group">
              <div className="savings-modal__title-badge-row">
                <h3 id="savings-modal-title" className="savings-modal__title">
                  {t("dashboard.smartInsights.savingsModal.title")}
                </h3>
                <span className="savings-modal__total-badge">
                  {t("dashboard.smartInsights.savingsModal.badge")}
                </span>
              </div>
              <p className="savings-modal__subtitle">
                {t("dashboard.smartInsights.savingsModal.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Suggestions Cards List */}
        <div className="savings-modal__cards-list">
          {/* Card 1: Dining & Cafes Rationalization */}
          <div
            className={`savings-suggestion-card ${
              appliedCards.card1 ? "savings-suggestion-card--applied" : ""
            }`}
          >
            <div className="savings-suggestion-card__top">
              <div className="savings-suggestion-card__tags">
                <span className="savings-tag savings-tag--orange">
                  {t("dashboard.smartInsights.savingsModal.card1.badgePriority")}
                </span>
                <span className="savings-tag">
                  {t("dashboard.smartInsights.savingsModal.card1.badgeCategory")}
                </span>
              </div>
              <span className="savings-badge-val savings-badge-val--green">
                {t("dashboard.smartInsights.savingsModal.card1.badgeSaving")}
              </span>
            </div>

            <div className="savings-suggestion-card__heading-row">
              <div className="savings-suggestion-card__icon-box savings-suggestion-card__icon-box--orange">
                <LuUtensils />
              </div>
              <h4 className="savings-suggestion-card__title">
                {t("dashboard.smartInsights.savingsModal.card1.title")}
              </h4>
            </div>

            <p className="savings-suggestion-card__desc">
              {t("dashboard.smartInsights.savingsModal.card1.desc")}
            </p>

            {/* Goal Impact Box */}
            <div className="savings-suggestion-card__impact-box">
              <div className="savings-suggestion-card__impact-left">
                <span className="savings-impact-dot" />
                <span className="savings-impact-text">
                  {t("dashboard.smartInsights.savingsModal.card1.impact")}
                </span>
              </div>
              <span className="savings-success-rate">
                {t("dashboard.smartInsights.savingsModal.card1.successRate")}
              </span>
            </div>

            {/* Actions */}
            <div className="savings-suggestion-card__actions">
              <button
                type="button"
                className={`savings-card-btn-apply savings-card-btn-apply--emerald ${
                  appliedCards.card1 ? "savings-card-btn-apply--done" : ""
                }`}
                onClick={() => handleApplySingle("card1")}
                disabled={appliedCards.card1}
              >
                {appliedCards.card1 && <LuCheck className="savings-btn-icon" />}
                <span>
                  {appliedCards.card1
                    ? t("dashboard.smartInsights.cards.dining.applied")
                    : t("dashboard.smartInsights.savingsModal.card1.applyBtn")}
                </span>
              </button>

              <button type="button" className="savings-card-btn-outline">
                {t("dashboard.smartInsights.savingsModal.card1.editBtn")}
              </button>

              <button
                type="button"
                className="savings-card-btn-skip"
                onClick={() => handleApplySingle("card1")}
              >
                {t("dashboard.smartInsights.savingsModal.card1.skipBtn")}
              </button>
            </div>
          </div>

          {/* Card 2: Reschedule Unused Subscriptions */}
          <div
            className={`savings-suggestion-card ${
              appliedCards.card2 ? "savings-suggestion-card--applied" : ""
            }`}
          >
            <div className="savings-suggestion-card__top">
              <div className="savings-suggestion-card__tags">
                <span className="savings-tag savings-tag--blue">
                  {t("dashboard.smartInsights.savingsModal.card2.badgeDigital")}
                </span>
                <span className="savings-tag">
                  {t("dashboard.smartInsights.savingsModal.card2.badgeRenewal")}
                </span>
              </div>
              <span className="savings-badge-val savings-badge-val--blue">
                {t("dashboard.smartInsights.savingsModal.card2.badgeSaving")}
              </span>
            </div>

            <div className="savings-suggestion-card__heading-row">
              <div className="savings-suggestion-card__icon-box savings-suggestion-card__icon-box--blue">
                <LuTv />
              </div>
              <h4 className="savings-suggestion-card__title">
                {t("dashboard.smartInsights.savingsModal.card2.title")}
              </h4>
            </div>

            <p className="savings-suggestion-card__desc">
              {t("dashboard.smartInsights.savingsModal.card2.desc")}
            </p>

            {/* Identified Services Detail Box */}
            <div className="savings-suggestion-card__subs-box">
              <span className="savings-subs-box__text">
                {t("dashboard.smartInsights.savingsModal.card2.details")}
              </span>
              <span className="savings-subs-box__badge">
                {t("dashboard.smartInsights.savingsModal.card2.idleBadge")}
              </span>
            </div>

            {/* Actions */}
            <div className="savings-suggestion-card__actions">
              <button
                type="button"
                className={`savings-card-btn-apply savings-card-btn-apply--blue ${
                  appliedCards.card2 ? "savings-card-btn-apply--done" : ""
                }`}
                onClick={() => handleApplySingle("card2")}
                disabled={appliedCards.card2}
              >
                {appliedCards.card2 && <LuCheck className="savings-btn-icon" />}
                <span>
                  {appliedCards.card2
                    ? t("dashboard.smartInsights.cards.dining.applied")
                    : t("dashboard.smartInsights.savingsModal.card2.applyBtn")}
                </span>
              </button>

              <button type="button" className="savings-card-btn-outline">
                {t("dashboard.smartInsights.savingsModal.card2.editBtn")}
              </button>

              <button
                type="button"
                className="savings-card-btn-skip"
                onClick={() => handleApplySingle("card2")}
              >
                {t("dashboard.smartInsights.savingsModal.card2.skipBtn")}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Savings Goal Progress Tracker */}
        <div className="savings-modal__progress-section">
          <div className="savings-modal__progress-header">
            <span className="savings-modal__progress-title">
              {t("dashboard.smartInsights.savingsModal.progress.title")}
            </span>
            <span className="savings-modal__progress-boost">
              {t("dashboard.smartInsights.savingsModal.progress.boost")}
            </span>
          </div>

          <div className="savings-modal__progress-track">
            <div
              className="savings-modal__progress-fill--current"
              style={{ width: "52%" }}
            />
            <div
              className="savings-modal__progress-fill--projected"
              style={{ width: "10%" }}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="savings-modal__footer">
          <div className="savings-modal__footer-btns">
            <button
              ref={applyAllRef}
              type="button"
              className="savings-modal__btn-apply-all"
              onClick={handleApplyAllClick}
            >
              {t("dashboard.smartInsights.savingsModal.applyAllBtn")}
            </button>

            <button
              type="button"
              className="savings-modal__btn-close"
              onClick={onClose}
            >
              {t("dashboard.smartInsights.savingsModal.closeBtn")}
            </button>
          </div>

          <span className="savings-modal__revert-note">
            {t("dashboard.smartInsights.savingsModal.revertNote")}
          </span>
        </div>
      </div>
    </div>
  );
}
