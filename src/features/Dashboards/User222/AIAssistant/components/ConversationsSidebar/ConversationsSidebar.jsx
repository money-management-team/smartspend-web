import {
  LuPlus,
} from "react-icons/lu";

import {
  useTranslation,
} from "react-i18next";

import "./ConversationsSidebar.css";

export default function ConversationsSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
}) {
  const { t } =
    useTranslation();

  return (
    <aside className="ai-conversations">
      <header className="ai-conversations__header">
        <h2>
          {t(
            "dashboard.aiAssistant.conversations.title",
          )}
        </h2>

        <button
          type="button"
          className="ai-conversations__new"
          onClick={onNewChat}
        >
          <LuPlus />

          <span>
            {t(
              "dashboard.aiAssistant.conversations.newChat",
            )}
          </span>
        </button>
      </header>

      <nav
        className="ai-conversations__list"
        aria-label={t(
          "dashboard.aiAssistant.conversations.title",
        )}
      >
        {conversations.map(
          (
            conversation,
          ) => (
            <button
              type="button"
              key={
                conversation.id
              }
              className={`ai-conversations__item ${
                activeConversationId ===
                conversation.id
                  ? "ai-conversations__item--active"
                  : ""
              }`}
              onClick={() =>
                onSelectConversation(
                  conversation.id,
                )
              }
            >
              {
                conversation.title
              }
            </button>
          ),
        )}
      </nav>
    </aside>
  );
}