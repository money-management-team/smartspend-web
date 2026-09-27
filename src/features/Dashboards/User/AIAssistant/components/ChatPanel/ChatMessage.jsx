import { LuSparkles } from "react-icons/lu";
import ChatErrorCard from "./ChatErrorCard";
import ChatForecastSkeleton from "./ChatForecastSkeleton";
import ChatProgressCard from "./ChatProgressCard";

import "./ChatMessage.css";

export default function ChatMessage({
  message,
  userInitials = "LH",
  onRetry,
}) {
  const isAssistant = message.role === "assistant";

  return (
    <article
      className={`ai-chat-message ai-chat-message--${message.role}`}
    >
      {isAssistant && (
        <span className="ai-chat-message__avatar ai-chat-message__avatar--assistant">
          <LuSparkles />
        </span>
      )}

      <div className="ai-chat-message__content">
        {message.type === "error" ? (
          <ChatErrorCard onRetry={onRetry} />
        ) : message.type === "skeleton" ? (
          <ChatForecastSkeleton />
        ) : message.type === "progress" ? (
          <ChatProgressCard
            progress={message.progress || 58}
            customDetails={message.details}
          />
        ) : (
          <div className="ai-chat-message__bubble">
            {message.content}
          </div>
        )}

        {message.role === "user" && message.timestamp && (
          <div className="ai-chat-message__meta">
            <span className="ai-chat-message__time">{message.timestamp}</span>
            <span className="ai-chat-message__check">✓</span>
          </div>
        )}
      </div>

      {!isAssistant && (
        <span className="ai-chat-message__avatar ai-chat-message__avatar--user">
          {userInitials}
        </span>
      )}
    </article>
  );
}
