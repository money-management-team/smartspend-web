import { useTranslation } from "react-i18next";
import { LuRotateCw } from "react-icons/lu";

import "./ChatProgressCard.css";

export default function ChatProgressCard({ progress = 58, customDetails }) {
  const { t } = useTranslation();

  return (
    <div className="ai-progress-card">
      <div className="ai-progress-card__header">
        <span className="ai-progress-card__pulse-dot" />
        <span className="ai-progress-card__title">
          {t("dashboard.aiAssistant.progressState.title")}
        </span>
        <span className="ai-progress-card__typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>

      <div className="ai-progress-card__box">
        <div className="ai-progress-card__info-row">
          <LuRotateCw className="ai-progress-card__spinner" />
          <span className="ai-progress-card__details">
            {customDetails || t("dashboard.aiAssistant.progressState.details")}
          </span>
        </div>

        <div
          className="ai-progress-card__bar-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="ai-progress-card__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
