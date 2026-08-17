import {
  LuSend,
  LuSparkles,
} from "react-icons/lu";

import {
  useTranslation,
} from "react-i18next";

import "./ChatPanel.css";

export default function ChatPanel({
  messages,
  message,
  setMessage,
  onSend,
  onSuggestionClick,
  isSending,
}) {
  const { t } =
    useTranslation();

  const suggestions = [
    t(
      "dashboard.aiAssistant.suggestions.safeSavings",
    ),

    t(
      "dashboard.aiAssistant.suggestions.julySpending",
    ),

    t(
      "dashboard.aiAssistant.suggestions.diningBudget",
    ),

    t(
      "dashboard.aiAssistant.suggestions.emergencyFund",
    ),
  ];

  const handleSubmit = (
    event,
  ) => {
    event.preventDefault();

    onSend();
  };

  const handleKeyDown = (
    event,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      onSend();
    }
  };

  return (
    <section className="ai-chat-panel">
      {/* =================================
          MESSAGES
      ================================= */}

      <div className="ai-chat-panel__messages">
        {messages.map(
          (item) => (
            <article
              key={item.id}
              className={`ai-chat-message ai-chat-message--${item.role}`}
            >
              {item.role ===
                "assistant" && (
                <span className="ai-chat-message__avatar">
                  <LuSparkles />
                </span>
              )}

              <div className="ai-chat-message__bubble">
                {item.content}
              </div>
            </article>
          ),
        )}
      </div>

      {/* =================================
          COMPOSER AREA
      ================================= */}

      <div className="ai-chat-panel__composer">
        {/* Suggestions */}

        <div className="ai-chat-suggestions">
          {suggestions.map(
            (
              suggestion,
              index,
            ) => (
              <button
                type="button"
                key={index}
                onClick={() =>
                  onSuggestionClick(
                    suggestion,
                  )
                }
              >
                {suggestion}
              </button>
            ),
          )}
        </div>

        {/* Input */}

        <form
          className="ai-chat-input"
          onSubmit={
            handleSubmit
          }
        >
          <input
            type="text"
            value={message}
            onChange={(event) =>
              setMessage(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder={t(
              "dashboard.aiAssistant.input.placeholder",
            )}
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={
              !message.trim() ||
              isSending
            }
          >
            <LuSend />

            <span>
              {isSending
                ? t(
                    "dashboard.aiAssistant.input.sending",
                  )
                : t(
                    "dashboard.aiAssistant.input.send",
                  )}
            </span>
          </button>
        </form>
      </div>
    </section>
  );
}