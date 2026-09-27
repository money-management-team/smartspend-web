import { useRef, useEffect } from "react";
import { LuSend, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import ChatMessage from "./ChatMessage";
import ChatWelcomeCard from "./ChatWelcomeCard";
import "./ChatPanel.css";

export default function ChatPanel({
  messages = [],
  message,
  setMessage,
  onSend,
  onSuggestionClick,
  onRetry,
  isSending = false,
  isDisabled = false,
  isWelcome = false,
  onStartNewChat,
  userInitials = "LH",
  showDisclaimer = true,
}) {
  const { t } = useTranslation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = [
    t("dashboard.aiAssistant.suggestions.julySpending"),
    t("dashboard.aiAssistant.suggestions.diningBudget"),
    t("dashboard.aiAssistant.suggestions.emergencyFund"),
    t("dashboard.aiAssistant.suggestions.safeSavings"),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isDisabled || isSending) return;
    onSend();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isDisabled || isSending) return;
      onSend();
    }
  };

  const handleClear = () => {
    setMessage("");
    inputRef.current?.focus();
  };

  const placeholderText = isDisabled
    ? t("dashboard.aiAssistant.input.placeholderDisabled")
    : t("dashboard.aiAssistant.input.placeholder");

  if (isWelcome) {
    return (
      <section className="ai-chat-panel ai-chat-panel--welcome">
        <div className="ai-chat-panel__welcome-container">
          <ChatWelcomeCard
            onStartNewChat={onStartNewChat}
            onSelectSuggestion={onSuggestionClick}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="ai-chat-panel">
      {/* Messages Scroll Area */}
      <div className="ai-chat-panel__messages">
        {messages.map((item) => (
          <ChatMessage
            key={item.id}
            message={item}
            userInitials={userInitials}
            onRetry={onRetry}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer & Suggestions */}
      <div className="ai-chat-panel__composer">
        {/* Suggestion Chips */}
        <div className="ai-chat-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              key={index}
              className="ai-chat-suggestions__chip"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form className="ai-chat-input-form" onSubmit={handleSubmit}>
          <div className="ai-chat-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={isDisabled || isSending}
              autoComplete="off"
            />

            {message.length > 0 && !isDisabled && !isSending && (
              <button
                type="button"
                className="ai-chat-input__clear-btn"
                onClick={handleClear}
                aria-label={t("dashboard.aiAssistant.input.clear")}
              >
                <LuX />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="ai-chat-input__send-btn"
            disabled={!message.trim() || isSending || isDisabled}
          >
            <span>
              {isSending
                ? t("dashboard.aiAssistant.input.sending")
                : t("dashboard.aiAssistant.input.send")}
            </span>
            <LuSend />
          </button>
        </form>

        {showDisclaimer && (
          <p className="ai-chat-panel__disclaimer">
            {t("dashboard.aiAssistant.progressState.disclaimer")}
          </p>
        )}
      </div>
    </section>
  );
}