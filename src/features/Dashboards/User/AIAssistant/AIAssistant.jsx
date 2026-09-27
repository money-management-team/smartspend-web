import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import AIAssistantHeader from "./components/AIAssistantHeader/AIAssistantHeader";
import ConversationsSidebar from "./components/ConversationsSidebar/ConversationsSidebar";
import ChatPanel from "./components/ChatPanel/ChatPanel";
import AIPrivacyModal from "./components/AIPrivacyModal/AIPrivacyModal";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH } from "../../../../routes/Path";

import "./AIAssistant.css";

const getUserInitials = (name) => {
  const nameParts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts.length === 0) return "LH";
  if (nameParts.length === 1) {
    return Array.from(nameParts[0]).slice(0, 2).join("").toLocaleUpperCase();
  }
  return `${Array.from(nameParts[0])[0]}${Array.from(nameParts.at(-1))[0]}`.toLocaleUpperCase();
};

const STORAGE_KEY_AI_ASSISTANT_PRIVACY_SHOWN = "smartspend_ai_assistant_privacy_shown";

const getInitialPrivacyModalOpen = () => {
  try {
    const alreadyShown = localStorage.getItem(STORAGE_KEY_AI_ASSISTANT_PRIVACY_SHOWN);
    const hasConsent = localStorage.getItem("smartspend_ai_privacy_consent");
    if (alreadyShown || hasConsent) {
      return false;
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return true;
};

export default function AIAssistant() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthContext();
  const userInitials = getUserInitials(user?.name);
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  // Privacy modal opens once on the user's first visit to AI assistant
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(() =>
    getInitialPrivacyModalOpen(),
  );

  // Initial conversations matching all user-requested screens
  const defaultConversations = useMemo(
    () => [
      {
        id: 1,
        title: t("dashboard.aiAssistant.conversations.monthlyAnalysis"),
        subtitle: t("dashboard.aiAssistant.subtitles.expenses"),
        tipType: "analysis",
        messages: [
          {
            id: 101,
            role: "assistant",
            content: t("dashboard.aiAssistant.initialMessage"),
          },
          {
            id: 102,
            role: "user",
            content: isArabic
              ? "حلل لي مصروفات شهر يوليو وقارنها مع ميزانية المطاعم والادخار المقترحة"
              : "Analyze my July expenses and compare them with dining and suggested savings budgets",
            timestamp: isArabic ? "10:42 ص" : "10:42 AM",
          },
          {
            id: 103,
            role: "assistant",
            type: "progress",
            progress: 58,
            details: t("dashboard.aiAssistant.progressState.details"),
          },
        ],
      },
      {
        id: 2,
        title: t("dashboard.aiAssistant.conversations.savingsTips"),
        subtitle: t("dashboard.aiAssistant.subtitles.default"),
        tipType: null,
        messages: [
          {
            id: 201,
            role: "assistant",
            content: t("dashboard.aiAssistant.initialMessage"),
          },
        ],
      },
      {
        id: 3,
        title: t("dashboard.aiAssistant.conversations.budgetSuggestions"),
        subtitle: t("dashboard.aiAssistant.subtitles.default"),
        tipType: null,
        messages: [
          {
            id: 301,
            role: "assistant",
            content: t("dashboard.aiAssistant.initialMessage"),
          },
        ],
      },
      {
        id: 4,
        title: t("dashboard.aiAssistant.conversations.subscriptionsAnalysis"),
        subtitle: t("dashboard.aiAssistant.subtitles.investments"),
        hasError: true,
        tipType: null,
        draftMessage: isArabic
          ? "كيف يمكنني تقليل نفقات الاشتراكات الرقمية لهذا الشهر؟"
          : "How can I reduce digital subscription expenses this month?",
        messages: [
          {
            id: 401,
            role: "assistant",
            content: isArabic
              ? t("dashboard.aiAssistant.initialMessageAr")
              : t("dashboard.aiAssistant.initialMessage"),
          },
          {
            id: 402,
            role: "user",
            content: isArabic
              ? "كيف يمكنني تقليل نفقات الاشتراكات الرقمية لهذا الشهر؟"
              : "How can I reduce digital subscription expenses this month?",
            timestamp: isArabic ? "منذ دقيقتين" : "2m ago",
          },
          {
            id: 403,
            role: "assistant",
            type: "error",
          },
        ],
      },
      {
        id: 5,
        title: t("dashboard.aiAssistant.conversations.forecastAndLiquidity"),
        subtitle: t("dashboard.aiAssistant.subtitles.forecast"),
        tipType: "forecast",
        isDisabled: true,
        messages: [
          {
            id: 501,
            role: "user",
            content: isArabic
              ? "اعرض لي ملخص التوقع المالي والتدفقات النقدية للأيام القادمة"
              : "Show me a summary of the financial forecast and cash flows for the coming days",
            timestamp: isArabic ? "الآن" : "Just now",
          },
          {
            id: 502,
            role: "assistant",
            type: "skeleton",
          },
        ],
      },
    ],
    [t, isArabic],
  );

  const [conversationsList, setConversationsList] = useState(defaultConversations);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // New chat fallback when activeConversationId is null (matches new chat state from user design)
  const newChatTemplate = useMemo(
    () => ({
      id: "new-chat",
      title: isArabic ? "محادثة جديدة" : "New Chat",
      subtitle: t("dashboard.aiAssistant.subtitle"),
      tipType: null,
      messages: [
        {
          id: 1001,
          role: "assistant",
          content: t("dashboard.aiAssistant.initialMessage"),
        },
      ],
    }),
    [t, isArabic],
  );

  // Active conversation object
  const activeConversation = useMemo(() => {
    if (activeConversationId === null) {
      return newChatTemplate;
    }
    return (
      conversationsList.find((c) => c.id === activeConversationId) ||
      newChatTemplate
    );
  }, [conversationsList, activeConversationId, newChatTemplate]);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback(
    (id) => {
      setActiveConversationId(id);
      const target = conversationsList.find((c) => c.id === id);
      if (target?.draftMessage) {
        setMessage(target.draftMessage);
      } else {
        setMessage("");
      }
    },
    [conversationsList],
  );

  // Handle clicking "+ محادثة جديدة" from sidebar -> shows the New Chat view
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessage("");
  }, []);

  // Handle sending a message
  const handleSendMessage = useCallback(
    (customText) => {
      const content = (customText ?? message).trim();
      if (!content || isSending) return;

      const now = new Date();
      const timeString = isArabic
        ? `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${
            now.getHours() >= 12 ? "م" : "ص"
          }`
        : `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${
            now.getHours() >= 12 ? "PM" : "AM"
          }`;

      const userMsg = {
        id: Date.now(),
        role: "user",
        content,
        timestamp: timeString,
      };

      if (activeConversationId === null) {
        const newId = Date.now();
        const newChat = {
          id: newId,
          title: content.length > 25 ? `${content.slice(0, 25)}...` : content,
          subtitle: t("dashboard.aiAssistant.subtitles.default"),
          tipType: null,
          messages: [
            ...newChatTemplate.messages,
            userMsg,
            {
              id: Date.now() + 1,
              role: "assistant",
              type: "progress",
              progress: 35,
              details: isArabic
                ? "يتم الآن تحليل طلبك ومراجعة البيانات المالية المقترنة..."
                : "Analyzing your request and reviewing associated financial data...",
            },
          ],
        };

        setConversationsList((prev) => [newChat, ...prev]);
        setActiveConversationId(newId);
        setMessage("");
        setIsSending(true);

        setTimeout(() => {
          setConversationsList((prev) =>
            prev.map((c) => {
              if (c.id === newId) {
                const filtered = c.messages.filter((m) => m.type !== "progress");
                return {
                  ...c,
                  messages: [
                    ...filtered,
                    {
                      id: Date.now() + 2,
                      role: "assistant",
                      content: isArabic
                        ? `بناءً على فحص سجلاتك: تم تحليل استفسارك حول "${content}"، ونقترح تخصيص ميزانية شهرية مرنة لضبط النفقات وتعزيز معدل الادخار.`
                        : `Based on your audited records: your query about "${content}" was analyzed. We suggest setting a flexible monthly budget to optimize savings.`,
                    },
                  ],
                };
              }
              return c;
            }),
          );
          setIsSending(false);
        }, 1800);
        return;
      }

      // Add user message and set temporary analyzing progress state
      setConversationsList((prev) =>
        prev.map((c) => {
          if (c.id === activeConversationId) {
            return {
              ...c,
              draftMessage: "",
              hasError: false,
              messages: [
                ...c.messages.filter((m) => m.type !== "error"),
                userMsg,
                {
                  id: Date.now() + 1,
                  role: "assistant",
                  type: "progress",
                  progress: 35,
                  details: isArabic
                    ? "يتم الآن تحليل طلبك ومراجعة البيانات المالية المقترنة..."
                    : "Analyzing your request and reviewing associated financial data...",
                },
              ],
            };
          }
          return c;
        }),
      );

      setMessage("");
      setIsSending(true);

      // Simulate completion of AI reasoning and generation
      setTimeout(() => {
        setConversationsList((prev) =>
          prev.map((c) => {
            if (c.id === activeConversationId) {
              const updatedMessages = c.messages.filter(
                (m) => m.type !== "progress",
              );
              return {
                ...c,
                messages: [
                  ...updatedMessages,
                  {
                    id: Date.now() + 2,
                    role: "assistant",
                    content: isArabic
                      ? `بناءً على تحليلي لبياناتك: تبين أنه بإمكانك توفير نحو 15% من خلال ضبط بنود الاشتراك غير المستخدمة، وإعادة توزيع الفائض لصندوق الطوارئ.`
                      : `Based on my analysis: you can save approximately 15% by reviewing unused subscriptions and redirecting the surplus to your emergency fund.`,
                  },
                ],
              };
            }
            return c;
          }),
        );
        setIsSending(false);
      }, 2200);
    },
    [message, isSending, activeConversationId, isArabic, t, newChatTemplate],
  );

  // Handle suggestion chip click
  const handleSuggestionClick = useCallback(
    (suggestion) => {
      handleSendMessage(suggestion);
    },
    [handleSendMessage],
  );

  // Handle retry in error state
  const handleRetry = useCallback(() => {
    // Switch from error state to analyzing progress, then success
    setConversationsList((prev) =>
      prev.map((c) => {
        if (c.id === activeConversationId) {
          const filtered = c.messages.filter((m) => m.type !== "error");
          return {
            ...c,
            hasError: false,
            messages: [
              ...filtered,
              {
                id: Date.now(),
                role: "assistant",
                type: "progress",
                progress: 62,
                details: isArabic
                  ? "جاري إعادة الاتصال وتدقيق نفقات الاشتراكات الرقمية..."
                  : "Reconnecting and auditing digital subscription expenses...",
              },
            ],
          };
        }
        return c;
      }),
    );

    setTimeout(() => {
      setConversationsList((prev) =>
        prev.map((c) => {
          if (c.id === activeConversationId) {
            const filtered = c.messages.filter((m) => m.type !== "progress");
            return {
              ...c,
              messages: [
                ...filtered,
                {
                  id: Date.now() + 1,
                  role: "assistant",
                  content: isArabic
                    ? "تم فحص اشتراكاتك الرقمية بنجاح: لديك 4 اشتراكات نشطة بإجمالي $64/شهر. بإمكانك إلغاء اشتراكين غير مستخدمين لتوفير $28 شهرياً فوراً."
                    : "Your digital subscriptions were inspected successfully: You have 4 active subscriptions totaling $64/mo. You can cancel 2 unused subscriptions to save $28/mo immediately.",
                },
              ],
            };
          }
          return c;
        }),
      );
    }, 2000);
  }, [activeConversationId, isArabic]);

  const handleClosePrivacyModal = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AI_ASSISTANT_PRIVACY_SHOWN, "true");
    } catch {
      // Ignore localStorage write errors
    }
    setIsPrivacyModalOpen(false);
  }, []);

  const handleAcceptPrivacyModal = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AI_ASSISTANT_PRIVACY_SHOWN, "true");
    } catch {
      // Ignore localStorage write errors
    }
    setIsPrivacyModalOpen(false);
  }, []);

  const currentSubtitle =
    activeConversation?.subtitle || t("dashboard.aiAssistant.subtitle");

  return (
    <div className="ai-assistant-page">
      <AIAssistantHeader
        subtitle={currentSubtitle}
        onOpenInsights={() => navigate(PATH.USER.SMART_INSIGHTS)}
      />

      <div className="ai-assistant-page__layout">
        <ChatPanel
          isWelcome={false}
          onStartNewChat={handleNewChat}
          messages={activeConversation?.messages || []}
          message={message}
          setMessage={setMessage}
          onSend={handleSendMessage}
          onSuggestionClick={handleSuggestionClick}
          onRetry={handleRetry}
          isSending={isSending}
          isDisabled={activeConversation?.isDisabled}
          userInitials={userInitials}
          showDisclaimer={false}
        />

        <ConversationsSidebar
          conversations={conversationsList}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          isNewChatActive={activeConversationId === null}
          tipType={activeConversation?.tipType}
        />
      </div>

      <AIPrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={handleClosePrivacyModal}
        onAccept={handleAcceptPrivacyModal}
      />
    </div>
  );
}