import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSparkles, LuTrash2, LuCheck } from "react-icons/lu";

import DeleteChatHistoryModal from "./DeleteChatHistoryModal";
import "./AISettings.css";

const AI_SETTINGS_STORAGE_KEY = "smartspend_ai_settings";

const getSavedAiSettings = () => {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    proactiveAlerts: true,
    autoSavings: true,
    privacyAnalysis: true,
  };
};

export default function AISettings() {
  const { t } = useTranslation();

  const [savedSettings, setSavedSettings] = useState(getSavedAiSettings);

  const [proactiveAlerts, setProactiveAlerts] = useState(
    () => savedSettings.proactiveAlerts ?? true,
  );
  const [autoSavings, setAutoSavings] = useState(
    () => savedSettings.autoSavings ?? true,
  );
  const [privacyAnalysis, setPrivacyAnalysis] = useState(
    () => savedSettings.privacyAnalysis ?? true,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);

    const updated = {
      proactiveAlerts,
      autoSavings,
      privacyAnalysis,
    };

    try {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      setSavedSettings(updated);
      setStatusMessage(t("dashboard.settings.ai.saved"));
    } catch {
      // storage error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProactiveAlerts(savedSettings.proactiveAlerts ?? true);
    setAutoSavings(savedSettings.autoSavings ?? true);
    setPrivacyAnalysis(savedSettings.privacyAnalysis ?? true);
    setStatusMessage("");
  };

  const handleConfirmDeleteHistory = () => {
    setIsDeleting(true);
    setTimeout(() => {
      try {
        localStorage.removeItem("smartspend_ai_chat");
        localStorage.removeItem("ai_chat_history");
        localStorage.removeItem("smartspend_ai_assistant_state");
      } catch {
        // ignore
      }
      setIsDeleting(false);
      setIsModalOpen(false);
      setStatusMessage(t("dashboard.settings.ai.modal.deletedSuccess"));
    }, 400);
  };

  return (
    <section className="ai-settings" aria-labelledby="ai-settings-heading">
      {/* Header */}
      <header className="ai-settings__header">
        <div className="ai-settings__header-icon-box">
          <LuSparkles />
        </div>
        <div className="ai-settings__header-text">
          <h2 id="ai-settings-heading">{t("dashboard.settings.ai.title")}</h2>
          <p>{t("dashboard.settings.ai.headerSubtitle")}</p>
        </div>
      </header>

      <form className="ai-settings__form" onSubmit={handleSave}>
        <div className="ai-settings__cards-list">
          {/* Item 1: Proactive Spending Alerts */}
          <div className="ai-setting-card">
            <div className="ai-setting-card__text">
              <h3 className="ai-setting-card__title">
                {t("dashboard.settings.ai.proactiveAlerts.title")}
              </h3>
              <p className="ai-setting-card__desc">
                {t("dashboard.settings.ai.proactiveAlerts.subtitle")}
              </p>
            </div>
            <label
              className="ai-switch"
              aria-label={t("dashboard.settings.ai.proactiveAlerts.title")}
            >
              <input
                type="checkbox"
                checked={proactiveAlerts}
                onChange={(e) => {
                  setProactiveAlerts(e.target.checked);
                  setStatusMessage("");
                }}
              />
              <span className="ai-switch__slider" />
            </label>
          </div>

          {/* Item 2: Automatic Savings Suggestions */}
          <div className="ai-setting-card">
            <div className="ai-setting-card__text">
              <h3 className="ai-setting-card__title">
                {t("dashboard.settings.ai.autoSavings.title")}
              </h3>
              <p className="ai-setting-card__desc">
                {t("dashboard.settings.ai.autoSavings.subtitle")}
              </p>
            </div>
            <label
              className="ai-switch"
              aria-label={t("dashboard.settings.ai.autoSavings.title")}
            >
              <input
                type="checkbox"
                checked={autoSavings}
                onChange={(e) => {
                  setAutoSavings(e.target.checked);
                  setStatusMessage("");
                }}
              />
              <span className="ai-switch__slider" />
            </label>
          </div>

          {/* Item 3: Privacy & Transaction Analysis */}
          <div className="ai-setting-card">
            <div className="ai-setting-card__text">
              <div className="ai-setting-card__title-row">
                <h3 className="ai-setting-card__title">
                  {t("dashboard.settings.ai.privacy.title")}
                </h3>
                <span className="ai-setting-card__badge">
                  {t("dashboard.settings.ai.privacy.badge")}
                </span>
              </div>
              <p className="ai-setting-card__desc">
                {t("dashboard.settings.ai.privacy.subtitle")}
              </p>
            </div>
            <label
              className="ai-switch"
              aria-label={t("dashboard.settings.ai.privacy.title")}
            >
              <input
                type="checkbox"
                checked={privacyAnalysis}
                onChange={(e) => {
                  setPrivacyAnalysis(e.target.checked);
                  setStatusMessage("");
                }}
              />
              <span className="ai-switch__slider" />
            </label>
          </div>

          {/* Item 4: Manage Chat History & Temporary Data */}
          <div className="ai-setting-card">
            <div className="ai-setting-card__text">
              <h3 className="ai-setting-card__title">
                {t("dashboard.settings.ai.manageHistory.title")}
              </h3>
              <p className="ai-setting-card__desc">
                {t("dashboard.settings.ai.manageHistory.subtitle")}
              </p>
            </div>
            <button
              type="button"
              className="ai-setting-card__clear-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <LuTrash2 className="ai-setting-card__clear-icon" />
              <span>{t("dashboard.settings.ai.manageHistory.clearBtn")}</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <p className="ai-settings__message" role="status">
            {statusMessage}
          </p>
        )}

        {/* Footer */}
        <div className="ai-settings__footer">
          <div className="ai-settings__synced-badge">
            <LuCheck className="ai-settings__synced-icon" />
            <span>{t("dashboard.settings.ai.syncedBadge")}</span>
          </div>

          <div className="ai-settings__btn-group">
            <button
              type="submit"
              className="ai-settings__save"
              disabled={isSaving}
            >
              {t("dashboard.settings.ai.save")}
            </button>
            <button
              type="button"
              className="ai-settings__cancel"
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t("dashboard.settings.ai.cancel")}
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      <DeleteChatHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDeleteHistory}
        isDeleting={isDeleting}
      />
    </section>
  );
}
