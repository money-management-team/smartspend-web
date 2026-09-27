import { LuPlus, LuClock, LuLightbulb } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./ConversationsSidebar.css";

export default function ConversationsSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isNewChatActive = false,
  tipType,
}) {
  const { t } = useTranslation();

  return (
    <aside className="ai-conversations-wrapper">
      <div className="ai-conversations">
        <header className="ai-conversations__header">
          <h2>{t("dashboard.aiAssistant.conversations.title")}</h2>

          <button
            type="button"
            className={`ai-conversations__new ${
              isNewChatActive ? "ai-conversations__new--active" : ""
            }`}
            onClick={onNewChat}
          >
            <LuPlus />
            <span>{t("dashboard.aiAssistant.conversations.newChat")}</span>
          </button>
        </header>

        <nav
          className="ai-conversations__list"
          aria-label={t("dashboard.aiAssistant.conversations.title")}
        >
          {conversations.map((conversation) => {
            const isActive = activeConversationId === conversation.id;
            return (
              <button
                type="button"
                key={conversation.id}
                className={`ai-conversations__item ${
                  isActive ? "ai-conversations__item--active" : ""
                } ${
                  conversation.hasError ? "ai-conversations__item--error" : ""
                }`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                {conversation.hasError && (
                  <span
                    className="ai-conversations__error-dot"
                    aria-label="Error in conversation"
                  />
                )}
                {isActive && !conversation.hasError && (
                  <span className="ai-conversations__active-dot" />
                )}
                <span className="ai-conversations__item-title">
                  {conversation.title}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {tipType === "forecast" && (
        <div className="ai-smart-tip-card ai-smart-tip-card--forecast">
          <div className="ai-smart-tip-card__icon-wrapper">
            <LuClock className="ai-smart-tip-card__icon" />
          </div>
          <p className="ai-smart-tip-card__text">
            {t("dashboard.aiAssistant.tips.continuousLearning")}
          </p>
        </div>
      )}

      {tipType === "analysis" && (
        <div className="ai-smart-tip-card ai-smart-tip-card--info">
          <div className="ai-smart-tip-card__header">
            <LuLightbulb className="ai-smart-tip-card__bulb" />
            <span className="ai-smart-tip-card__title">
              {t("dashboard.aiAssistant.tips.smartInfoTitle")}
            </span>
          </div>
          <p className="ai-smart-tip-card__text">
            {t("dashboard.aiAssistant.tips.smartInfoText")}
          </p>
        </div>
      )}
    </aside>
  );
}