import PrivateMoney from "../../../Experience/PrivateMoney";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowUp,
  LuCircleAlert,
  LuCoins,
  LuHistory,
  LuLandmark,
  LuListChecks,
  LuPiggyBank,
  LuShieldCheck,
  LuSparkles,
  LuTarget,
} from "react-icons/lu";

import { aiLocale, formatAiDate, formatAiMoney } from "../../aiFormat";
import {
  FeedbackButtons,
  SourceChips,
  SuggestedContribution,
} from "../AiShared/AiShared";

import "./ChatPanel.css";

const x = "dashboard.aiAssistant.extra";
const MAX_LENGTH = 4000;
const SUGGESTIONS = [
  { icon: LuCoins, key: "safeSavings" },
  { icon: LuLandmark, key: "monthlySpending" },
  { icon: LuPiggyBank, key: "diningBudget" },
  { icon: LuTarget, key: "emergencyFund" },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function AssistantMessage({ item, onFeedback, onSuggestedAction }) {
  const { t, i18n } = useTranslation();
  const locale = aiLocale(i18n);
  const response = item.response ?? {};
  const note =
    response.status && response.status !== "answered"
      ? t(`${x}.responseStatuses.${response.status}`, {
          defaultValue: response.status,
        })
      : null;

  return (
    <article className="ai-message ai-message--assistant">
      <span className="ai-message__avatar" aria-hidden="true">
        <LuSparkles />
      </span>

      <div className="ai-message__body">
        <div className="ai-message__content" dir="auto">
          <PrivateMoney>{item.content}</PrivateMoney>
        </div>

        {note && (
          <p className="ai-message__note" role="status">
            <LuCircleAlert aria-hidden="true" />
            <span>{note}</span>
          </p>
        )}

        <SuggestedContribution
          action={response.suggested_action}
          onOpen={onSuggestedAction}
        />

        <SourceChips sources={item.sources} />

        {response.claims?.length > 0 && (
          <details className="ai-message__facts">
            <summary>
              <LuListChecks aria-hidden="true" />
              {t(`${x}.groundedFacts`)}
            </summary>
            <dl>
              {response.claims.map((claim, index) => (
                <div key={`${claim.fact_key}-${index}`}>
                  <dt>
                    <bdi>{claim.fact_key}</bdi>
                  </dt>
                  <dd>
                    <bdi dir="ltr">
                      <PrivateMoney>
                        {claim.currency_code
                          ? formatAiMoney(
                              claim.value,
                              claim.currency_code,
                              locale,
                            )
                          : claim.value}
                      </PrivateMoney>
                    </bdi>
                  </dd>
                </div>
              ))}
            </dl>
            {response.period?.start && (
              <small>
                <bdi>
                  {formatAiDate(response.period.start, locale)} –{" "}
                  {formatAiDate(response.period.end, locale)}
                </bdi>
              </small>
            )}
          </details>
        )}

        <div className="ai-message__actions">
          <FeedbackButtons onRate={(rating) => onFeedback(item.id, rating)} />
        </div>
      </div>
    </article>
  );
}

/*
 * The conversation column: toolbar, message log, composer. Only the message
 * log scrolls (never the page), and it follows new messages. Enter sends,
 * Shift+Enter adds a line; the composer grows with its text.
 */
export default function ChatPanel({
  title,
  messages,
  message,
  setMessage,
  onSend,
  onSuggestionClick,
  isSending,
  isBusy,
  loadingChat,
  hasOlder,
  onLoadOlder,
  onFeedback,
  onSuggestedAction,
  onOpenHistory,
  historyId,
  isHistoryOpen,
}) {
  const { t } = useTranslation();
  const log = useRef(null);
  const input = useRef(null);
  const lastId = messages.at(-1)?.id;

  // Follow the newest message inside the log only.
  useEffect(() => {
    const node = log.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [lastId, isSending]);

  // Auto-grow the composer up to its CSS max-height.
  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [message]);

  const pickSuggestion = (key) => {
    onSuggestionClick(t(`dashboard.aiAssistant.suggestions.${key}`));
    input.current?.focus();
  };

  const canSend = Boolean(message.trim()) && !isBusy && !loadingChat;

  return (
    <section className="ai-chat" aria-label={t(`${x}.chat`)}>
      <header className="ai-chat__toolbar">
        <button
          type="button"
          className="ai-icon-button ai-chat__history"
          data-ai-history-toggle
          onClick={onOpenHistory}
          aria-label={t(`${x}.historyToggle`)}
          aria-expanded={isHistoryOpen}
          aria-controls={historyId}
        >
          <LuHistory aria-hidden="true" />
        </button>

        <h2 className="ai-chat__title">
          <bdi>{title}</bdi>
        </h2>

        <span className="ai-chat__private">
          <LuShieldCheck aria-hidden="true" />
          <span>{t(`${x}.privateLabel`)}</span>
        </span>
      </header>

      <div
        ref={log}
        className="ai-chat__log"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loadingChat}
      >
        <div className="ai-chat__column">
          {hasOlder && !loadingChat && (
            <button
              type="button"
              className="ai-chat__older"
              disabled={isBusy}
              onClick={onLoadOlder}
            >
              {t(`${x}.moreMessages`)}
            </button>
          )}

          {loadingChat ? (
            <div className="ai-chat__skeleton" role="status">
              <span className="ai-visually-hidden">{t(`${x}.loading`)}</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </div>
          ) : !messages.length ? (
            <div className="ai-chat__welcome">
              <span className="ai-chat__welcome-mark" aria-hidden="true">
                <LuSparkles />
              </span>
              <h3>{t(`${x}.welcomeTitle`)}</h3>
              <p>{t(`${x}.welcomeDescription`)}</p>

              <div className="ai-chat__prompts">
                {SUGGESTIONS.map(({ icon: Icon, key }) => (
                  <button
                    type="button"
                    key={key}
                    className="ai-chat__prompt"
                    onClick={() => pickSuggestion(key)}
                  >
                    <span className="ai-chat__prompt-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span>{t(`dashboard.aiAssistant.suggestions.${key}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item) =>
              item.role === "assistant" ? (
                <AssistantMessage
                  key={item.id}
                  item={item}
                  onFeedback={onFeedback}
                  onSuggestedAction={onSuggestedAction}
                />
              ) : (
                <article key={item.id} className="ai-message ai-message--user">
                  <div className="ai-message__bubble" dir="auto">
                    <PrivateMoney>{item.content}</PrivateMoney>
                  </div>
                </article>
              ),
            )
          )}

          {isSending && (
            <div className="ai-chat__thinking" role="status">
              <span className="ai-message__avatar" aria-hidden="true">
                <LuSparkles />
              </span>
              <span>{t(`${x}.thinking`)}</span>
              <span className="ai-chat__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="ai-chat__composer">
        <div className="ai-chat__column">
          {messages.length > 0 && (
            <div className="ai-chat__quick">
              {SUGGESTIONS.slice(0, 2).map(({ key }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => pickSuggestion(key)}
                >
                  {t(`dashboard.aiAssistant.suggestions.${key}`)}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-chat__input"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <textarea
              ref={input}
              value={message}
              maxLength={MAX_LENGTH}
              rows={1}
              dir="auto"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  onSend();
                }
              }}
              placeholder={t("dashboard.aiAssistant.input.placeholder")}
              aria-label={t("dashboard.aiAssistant.input.placeholder")}
              aria-describedby="ai-chat-hint"
            />
            <button
              type="submit"
              aria-label={t("dashboard.aiAssistant.input.send")}
              disabled={!canSend}
            >
              <LuArrowUp aria-hidden="true" />
            </button>
          </form>

          <div className="ai-chat__foot" id="ai-chat-hint">
            <span>{t(`${x}.assistantCaution`)}</span>
            <span
              className={
                message.length > MAX_LENGTH * 0.9
                  ? "ai-chat__count ai-chat__count--near"
                  : "ai-chat__count"
              }
            >
              <bdi dir="ltr">
                {message.length}/{MAX_LENGTH}
              </bdi>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
