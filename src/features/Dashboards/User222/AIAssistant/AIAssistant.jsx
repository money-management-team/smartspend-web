import {
  useMemo,
  useState,
} from "react";

import { useTranslation } from "react-i18next";

import AIAssistantHeader from "./components/AIAssistantHeader/AIAssistantHeader";
import ConversationsSidebar from "./components/ConversationsSidebar/ConversationsSidebar";
import ChatPanel from "./components/ChatPanel/ChatPanel";

import "./AIAssistant.css";

export default function AIAssistant() {
  const { t } = useTranslation();

  /*
   * لاحقاً هذه البيانات ستأتي من Backend:
   *
   * GET /api/ai-assistant/conversations
   */
  const conversations = useMemo(
    () => [
      {
        id: 1,
        title: t(
          "dashboard.aiAssistant.conversations.monthlyAnalysis",
        ),
      },

      {
        id: 2,
        title: t(
          "dashboard.aiAssistant.conversations.savingsTips",
        ),
      },

      {
        id: 3,
        title: t(
          "dashboard.aiAssistant.conversations.budgetSuggestions",
        ),
      },
    ],
    [t],
  );

  /*
   * المحادثة الحالية.
   *
   * مستقبلاً:
   * GET /api/ai-assistant/conversations/:id/messages
   */
  const [activeConversationId, setActiveConversationId] =
    useState(1);

  const [messages, setMessages] =
    useState([
      {
        id: 1,
        role: "assistant",
        content: t(
          "dashboard.aiAssistant.initialMessage",
        ),
      },
    ]);

  const [message, setMessage] =
    useState("");

  const [isSending, setIsSending] =
    useState(false);

  /*
   * ================================
   * SEND MESSAGE
   * ================================
   *
   * عندما يصبح الـ Backend جاهزاً،
   * نستبدل الجزء المؤقت الموجود هنا
   * باستدعاء API.
   */

  const handleSendMessage = async (
    customMessage,
  ) => {
    const content =
      (
        customMessage ??
        message
      ).trim();

    if (
      !content ||
      isSending
    ) {
      return;
    }

    const userMessage = {
      id:
        Date.now(),

      role:
        "user",

      content,
    };

    setMessages(
      (previous) => [
        ...previous,
        userMessage,
      ],
    );

    setMessage("");

    setIsSending(true);

    try {
      /*
       * ======================================
       * BACKEND INTEGRATION LATER
       * ======================================
       *
       * مثال:
       *
       * const response =
       *   await api.post(
       *     "/ai-assistant/messages",
       *     {
       *       conversation_id:
       *         activeConversationId,
       *
       *       message: content,
       *     },
       *   );
       *
       *
       * setMessages(
       *   (previous) => [
       *     ...previous,
       *
       *     {
       *       id:
       *         response.data.id,
       *
       *       role:
       *         "assistant",
       *
       *       content:
       *         response.data.message,
       *     },
       *   ],
       * );
       */

      /*
       * حالياً لا نضيف رد وهمي،
       * لأن الرد الحقيقي سيأتي
       * من Backend مستقبلاً.
       */
    } catch (error) {
      console.error(
        "Failed to send AI message:",
        error,
      );
    } finally {
      setIsSending(false);
    }
  };

  /*
   * ================================
   * SUGGESTION
   * ================================
   */

  const handleSuggestionClick = (
    suggestion,
  ) => {
    setMessage(
      suggestion,
    );
  };

  /*
   * ================================
   * NEW CHAT
   * ================================
   */

  const handleNewChat = () => {
    setActiveConversationId(
      null,
    );

    setMessage("");

    setMessages([
      {
        id:
          Date.now(),

        role:
          "assistant",

        content:
          t(
            "dashboard.aiAssistant.initialMessage",
          ),
      },
    ]);

    /*
     * مستقبلاً:
     *
     * POST /api/ai-assistant/conversations
     */
  };

  /*
   * ================================
   * SELECT CONVERSATION
   * ================================
   */

  const handleSelectConversation = (
    conversationId,
  ) => {
    setActiveConversationId(
      conversationId,
    );

    /*
     * مستقبلاً:
     *
     * GET
     * /api/ai-assistant/conversations/:id/messages
     *
     * ثم:
     *
     * setMessages(response.data)
     */
  };

  return (
    <div className="ai-assistant-page">
      <AIAssistantHeader />

      <div className="ai-assistant-page__layout">
        <ChatPanel
          messages={messages}
          message={message}
          setMessage={setMessage}
          onSend={handleSendMessage}
          onSuggestionClick={
            handleSuggestionClick
          }
          isSending={isSending}
        />

        <ConversationsSidebar
          conversations={
            conversations
          }
          activeConversationId={
            activeConversationId
          }
          onSelectConversation={
            handleSelectConversation
          }
          onNewChat={
            handleNewChat
          }
        />
      </div>
    </div>
  );
}