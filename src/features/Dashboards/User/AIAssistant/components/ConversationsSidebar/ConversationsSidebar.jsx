import { useTranslation } from "react-i18next";
import { LuMessageCircle, LuSquarePen, LuTrash2, LuX } from "react-icons/lu";

import "./ConversationsSidebar.css";

const x = "dashboard.aiAssistant.extra";

/*
 * Conversation history. A rail inside the chat workspace on desktop; below
 * the desktop breakpoint the workspace shows it as a drawer (`isOpen`), with
 * its own close button.
 */
export default function ConversationsSidebar({
  id,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  hasMore,
  onLoadMore,
  busy,
  isOpen,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <aside id={id} className={`ai-conversations ${isOpen ? "ai-conversations--open" : ""}`}>
      <header className="ai-conversations__header">
        <h2>{t("dashboard.aiAssistant.conversations.title")}</h2>

        <button
          type="button"
          className="ai-icon-button ai-conversations__close"
          onClick={onClose}
          aria-label={t(`${x}.closeHistory`)}
        >
          <LuX aria-hidden="true" />
        </button>
      </header>

      <div className="ai-conversations__new-wrap">
        <button type="button" className="ai-conversations__new" onClick={onNewChat}>
          <LuSquarePen aria-hidden="true" />
          <span>{t("dashboard.aiAssistant.conversations.newChat")}</span>
        </button>
      </div>

      <nav className="ai-conversations__list" aria-label={t("dashboard.aiAssistant.conversations.title")}>
        {!conversations.length && (
          <div className="ai-conversations__empty">
            <LuMessageCircle aria-hidden="true" />
            <p>{t(`${x}.noConversations`)}</p>
          </div>
        )}

        {conversations.length > 0 && (
          <ul>
            {conversations.map((conversation) => {
              const isActive = activeConversationId === conversation.id;
              const title = conversation.title || t("dashboard.aiAssistant.conversations.newChat");

              return (
                <li
                  key={conversation.id}
                  className={`ai-conversations__entry ${isActive ? "ai-conversations__entry--active" : ""}`}
                >
                  <button
                    type="button"
                    data-ai-conversation={conversation.id}
                    className="ai-conversations__item"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <LuMessageCircle aria-hidden="true" />
                    <bdi>{title}</bdi>
                  </button>

                  <button
                    type="button"
                    className="ai-icon-button ai-conversations__delete"
                    aria-label={`${t(`${x}.deleteChat`)}: ${conversation.title || ""}`}
                    title={t(`${x}.deleteChat`)}
                    onClick={() => onDeleteConversation(conversation.id)}
                  >
                    <LuTrash2 aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <button type="button" className="ai-conversations__more" disabled={busy} onClick={onLoadMore}>
            {t(`${x}.moreChats`)}
          </button>
        )}
      </nav>
    </aside>
  );
}
