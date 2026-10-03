import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import ChatPanel from "../ChatPanel/ChatPanel";
import ConversationsSidebar from "../ConversationsSidebar/ConversationsSidebar";

import "./ChatWorkspace.css";

/*
 * The chat as one app-like surface with a fixed height: conversation rail
 * and chat column side by side on desktop; below the desktop breakpoint the
 * rail becomes a drawer over the chat (opened from the chat toolbar, closed
 * by the backdrop, Escape, its close button, or picking a conversation).
 * All data and actions come from AIAssistant; only the drawer state is here.
 */
export default function ChatWorkspace({
  conversations,
  activeId,
  hasMoreChats,
  onLoadMoreChats,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  busy,
  ...chat
}) {
  const { t } = useTranslation();
  const historyId = useId();
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!historyOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  const active = conversations.find((conversation) => conversation.id === activeId);
  const title = active?.title || t("dashboard.aiAssistant.conversations.newChat");

  return (
    <div className="ai-chat-workspace">
      <ConversationsSidebar
        id={historyId}
        conversations={conversations}
        activeConversationId={activeId}
        hasMore={hasMoreChats}
        onLoadMore={onLoadMoreChats}
        busy={busy}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNewChat={() => {
          setHistoryOpen(false);
          onNewChat();
        }}
        onSelectConversation={(id) => {
          setHistoryOpen(false);
          onSelectConversation(id);
        }}
        onDeleteConversation={onDeleteConversation}
      />

      {historyOpen && (
        <button
          type="button"
          className="ai-chat-workspace__backdrop"
          aria-label={t("dashboard.aiAssistant.extra.closeHistory")}
          onClick={() => setHistoryOpen(false)}
        />
      )}

      <ChatPanel
        {...chat}
        title={title}
        isBusy={busy}
        historyId={historyId}
        isHistoryOpen={historyOpen}
        onOpenHistory={() => setHistoryOpen(true)}
      />
    </div>
  );
}
