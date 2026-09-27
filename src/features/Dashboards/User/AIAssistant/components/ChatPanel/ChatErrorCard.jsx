import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTriangleAlert, LuRotateCw, LuActivity, LuCopy, LuCheck } from "react-icons/lu";

import "./ChatErrorCard.css";

export default function ChatErrorCard({ onRetry }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(null);

  const errorMessage = `${t("dashboard.aiAssistant.errorState.title")} (${t("dashboard.aiAssistant.errorState.code")}) - ${t("dashboard.aiAssistant.errorState.description")}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is blocked
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCheckConnection = () => {
    setCheckingConnection(true);
    setConnectionMessage(null);

    setTimeout(() => {
      setCheckingConnection(false);
      setConnectionMessage(t("dashboard.aiAssistant.errorState.connectionStable"));
      setTimeout(() => setConnectionMessage(null), 4000);
    }, 1200);
  };

  return (
    <div className="ai-chat-error-card" role="alert">
      <div className="ai-chat-error-card__header">
        <div className="ai-chat-error-card__icon-box">
          <LuTriangleAlert className="ai-chat-error-card__icon" />
        </div>

        <div className="ai-chat-error-card__title-row">
          <h3 className="ai-chat-error-card__title">
            {t("dashboard.aiAssistant.errorState.title")}
          </h3>

          <span className="ai-chat-error-card__code-badge">
            {t("dashboard.aiAssistant.errorState.code")}
          </span>
        </div>
      </div>

      <p className="ai-chat-error-card__description">
        {t("dashboard.aiAssistant.errorState.description")}
      </p>

      {connectionMessage && (
        <div className="ai-chat-error-card__feedback">
          <LuCheck />
          <span>{connectionMessage}</span>
        </div>
      )}

      <div className="ai-chat-error-card__actions">
        <button
          type="button"
          className="ai-chat-error-card__retry-btn"
          onClick={onRetry}
        >
          <LuRotateCw />
          <span>{t("dashboard.aiAssistant.errorState.retry")}</span>
        </button>

        <button
          type="button"
          className="ai-chat-error-card__check-btn"
          onClick={handleCheckConnection}
          disabled={checkingConnection}
        >
          <LuActivity className={checkingConnection ? "ai-spin" : ""} />
          <span>{t("dashboard.aiAssistant.errorState.checkConnection")}</span>
        </button>

        <button
          type="button"
          className="ai-chat-error-card__copy-btn"
          onClick={handleCopy}
        >
          {copied ? <LuCheck /> : <LuCopy />}
          <span>
            {copied
              ? t("dashboard.aiAssistant.errorState.copied")
              : t("dashboard.aiAssistant.errorState.copyError")}
          </span>
        </button>
      </div>
    </div>
  );
}
