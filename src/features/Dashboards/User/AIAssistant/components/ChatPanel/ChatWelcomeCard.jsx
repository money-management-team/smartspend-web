import { useTranslation } from "react-i18next";
import {
  LuStar,
  LuDollarSign,
  LuPlus,
  LuUtensils,
  LuShieldCheck,
  LuCircleHelp,
} from "react-icons/lu";

import "./ChatWelcomeCard.css";

export default function ChatWelcomeCard({ onStartNewChat, onSelectSuggestion }) {
  const { t } = useTranslation();

  return (
    <div className="ai-chat-welcome-card">
      {/* Center Illustration Badge */}
      <div className="ai-welcome-badge">
        <div className="ai-welcome-badge__glow" />

        <div className="ai-welcome-badge__square">
          <svg
            className="ai-welcome-badge__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <div className="ai-welcome-badge__star">
          <LuStar />
        </div>

        <div className="ai-welcome-badge__dollar">
          <LuDollarSign />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <h2 className="ai-welcome-card__title">
        {t("dashboard.aiAssistant.welcomeScreen.title")}
      </h2>

      <p className="ai-welcome-card__desc">
        {t("dashboard.aiAssistant.welcomeScreen.description")}
      </p>

      {/* Suggested Questions */}
      <span className="ai-welcome-card__suggestions-label">
        {t("dashboard.aiAssistant.welcomeScreen.orTrySuggestions")}
      </span>

      <div className="ai-welcome-card__chips">
        <div className="ai-welcome-card__chips-row">
          <button
            type="button"
            className="ai-welcome-chip"
            onClick={() =>
              onSelectSuggestion?.(
                t("dashboard.aiAssistant.suggestions.julySpending"),
              )
            }
          >
            <span>{t("dashboard.aiAssistant.suggestions.julySpending")}</span>
            <LuCircleHelp className="ai-welcome-chip__icon ai-welcome-chip__icon--help" />
          </button>

          <button
            type="button"
            className="ai-welcome-chip"
            onClick={() =>
              onSelectSuggestion?.(
                t("dashboard.aiAssistant.suggestions.diningBudget"),
              )
            }
          >
            <LuUtensils className="ai-welcome-chip__icon" />
            <span>{t("dashboard.aiAssistant.suggestions.diningBudget")}</span>
          </button>
        </div>

        <div className="ai-welcome-card__chips-row">
          <button
            type="button"
            className="ai-welcome-chip"
            onClick={() =>
              onSelectSuggestion?.(
                t("dashboard.aiAssistant.suggestions.safeSavings"),
              )
            }
          >
            <span className="ai-welcome-chip__emoji" role="img" aria-label="money">
              💰
            </span>
            <span>{t("dashboard.aiAssistant.suggestions.safeSavings")}</span>
          </button>
        </div>
      </div>

      {/* Primary Action Button */}
      <button
        type="button"
        className="ai-welcome-card__start-btn"
        onClick={onStartNewChat}
      >
        <LuPlus />
        <span>{t("dashboard.aiAssistant.welcomeScreen.startNewChat")}</span>
      </button>

      {/* Security Footer Badge */}
      <div className="ai-welcome-card__security">
        <LuShieldCheck className="ai-welcome-card__security-icon" />
        <span>{t("dashboard.aiAssistant.welcomeScreen.securedBadge")}</span>
      </div>
    </div>
  );
}
