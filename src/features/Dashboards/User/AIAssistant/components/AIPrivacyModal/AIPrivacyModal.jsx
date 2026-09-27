import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuShieldCheck,
  LuCheck,
  LuX,
  LuArrowLeft,
  LuArrowRight,
} from "react-icons/lu";

import "./AIPrivacyModal.css";

const STORAGE_KEY_AI_PRIVACY = "smartspend_ai_privacy_consent";

const getInitialConsent = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AI_PRIVACY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        analysis:
          typeof parsed.consentAnalysis === "boolean"
            ? parsed.consentAnalysis
            : true,
        history:
          typeof parsed.consentHistory === "boolean"
            ? parsed.consentHistory
            : true,
      };
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return { analysis: true, history: true };
};

export default function AIPrivacyModal({ isOpen, onClose, onAccept }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  const [consentAnalysis, setConsentAnalysis] = useState(
    () => getInitialConsent().analysis,
  );
  const [consentHistory, setConsentHistory] = useState(
    () => getInitialConsent().history,
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY_AI_PRIVACY,
        JSON.stringify({
          consentAnalysis,
          consentHistory,
          acceptedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Ignore localStorage write errors
    }
    onAccept?.({ consentAnalysis, consentHistory });
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="ai-privacy-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-privacy-title"
    >
      <div className="ai-privacy-modal">
        <div className="ai-privacy-modal__top-accent" />

        <button
          type="button"
          className="ai-privacy-modal__close-btn"
          onClick={onClose}
          aria-label={t("dashboard.aiAssistant.privacyModal.close")}
        >
          <LuX />
        </button>

        <div className="ai-privacy-modal__icon-badge">
          <LuShieldCheck className="ai-privacy-modal__shield-icon" />
          <span className="ai-privacy-modal__badge-plus">+</span>
        </div>

        <h2 id="ai-privacy-title" className="ai-privacy-modal__title">
          {t("dashboard.aiAssistant.privacyModal.title")}
        </h2>

        <div className="ai-privacy-modal__security-pill">
          <LuCheck className="ai-privacy-modal__security-check" />
          <span>{t("dashboard.aiAssistant.privacyModal.badge")}</span>
        </div>

        <p className="ai-privacy-modal__intro">
          {t("dashboard.aiAssistant.privacyModal.intro")}
        </p>

        <div className="ai-privacy-modal__features-box">
          <ul className="ai-privacy-modal__features-list">
            <li>
              <span className="ai-privacy-modal__feature-bullet" />
              <span>{t("dashboard.aiAssistant.privacyModal.point1")}</span>
            </li>
            <li>
              <span className="ai-privacy-modal__feature-bullet" />
              <span>{t("dashboard.aiAssistant.privacyModal.point2")}</span>
            </li>
            <li>
              <span className="ai-privacy-modal__feature-bullet" />
              <span>{t("dashboard.aiAssistant.privacyModal.point3")}</span>
            </li>
          </ul>
        </div>

        <div className="ai-privacy-modal__options">
          <label
            className={`ai-privacy-option ${
              consentAnalysis ? "ai-privacy-option--checked" : ""
            }`}
          >
            <div className="ai-privacy-option__checkbox-wrapper">
              <input
                type="checkbox"
                checked={consentAnalysis}
                onChange={(e) => setConsentAnalysis(e.target.checked)}
                className="ai-privacy-option__native-checkbox"
              />
              <span className="ai-privacy-option__custom-checkbox">
                {consentAnalysis && <LuCheck />}
              </span>
            </div>
            <div className="ai-privacy-option__text">
              <span className="ai-privacy-option__title">
                {t("dashboard.aiAssistant.privacyModal.consentAnalysisTitle")}
              </span>
              <span className="ai-privacy-option__desc">
                {t("dashboard.aiAssistant.privacyModal.consentAnalysisDesc")}
              </span>
            </div>
          </label>

          <label
            className={`ai-privacy-option ${
              consentHistory ? "ai-privacy-option--checked" : ""
            }`}
          >
            <div className="ai-privacy-option__checkbox-wrapper">
              <input
                type="checkbox"
                checked={consentHistory}
                onChange={(e) => setConsentHistory(e.target.checked)}
                className="ai-privacy-option__native-checkbox"
              />
              <span className="ai-privacy-option__custom-checkbox">
                {consentHistory && <LuCheck />}
              </span>
            </div>
            <div className="ai-privacy-option__text">
              <span className="ai-privacy-option__title">
                {t("dashboard.aiAssistant.privacyModal.consentHistoryTitle")}
              </span>
              <span className="ai-privacy-option__desc">
                {t("dashboard.aiAssistant.privacyModal.consentHistoryDesc")}
              </span>
            </div>
          </label>
        </div>

        <div className="ai-privacy-modal__actions">
          <button
            type="button"
            className="ai-privacy-modal__submit-btn"
            onClick={handleSave}
          >
            <span>
              {t("dashboard.aiAssistant.privacyModal.acceptAndContinue")}
            </span>
            {isRtl ? <LuArrowLeft /> : <LuArrowRight />}
          </button>

          <button
            type="button"
            className="ai-privacy-modal__cancel-btn"
            onClick={onClose}
          >
            {t("dashboard.aiAssistant.privacyModal.declineLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
