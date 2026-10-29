import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { PATH } from "../../routes/Path.js";
import { assistKeys, conversationLoader, conversationsLoader, insightsLoader, loadAiSettings, loadForecast, loadInputQuotas } from "../data/assistLoaders.js";
import { isAccountId } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { useLeaveGuard } from "../categories/useLeaveGuard.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { buildAiSettings, buildForecast, buildPage, buildQuotas, normalizeConversation, normalizeInsight, normalizeMessage } from "../models/assist.js";
import { formatDay, formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_AI, aiConversationPath, mobileSubjectPath } from "../navigation.js";
import MobileSheet from "../shell/MobileSheet.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { DeleteConversation, FeedbackButton } from "./AiFeedback.jsx";
import PagedRead from "./PagedRead.jsx";

export const MESSAGE_MAX = 4000;
const PROMPTS = ["spending", "budgets", "saving", "upcoming"];

const buildConversations = (data) => buildPage(data, "conversations", normalizeConversation);
const buildInsights = (data) => buildPage(data, "insights", normalizeInsight);
const buildMessages = (data) => buildPage(data, "messages", normalizeMessage);
const localeOf = (i18n) => (i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en");

function AiLabel() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  return <span className="sm-chip sm-ai-chip" data-sm-ai="generated">{t("assist.generated")}</span>;
}

/* What the assistant cited: links only to records Mobile has a page for; anything else is named, not linked. */
function Sources({ sources }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  if (!sources.length) return null;
  return (
    <p className="sm-text sm-fine sm-ai-sources">
      <span className="sm-muted">{t("assist.sources")}: </span>
      {sources.map((source, index) => {
        const to = source.type === "report" ? null : mobileSubjectPath(source.type, source.id);
        const name = source.label ?? t("assist.source");
        return (
          <span key={`${source.type}:${source.id}:${index}`}>
            {index > 0 && ", "}
            {to ? <Link to={to}><bdi dir="auto">{name}</bdi></Link> : <bdi dir="auto">{name}</bdi>}
          </span>
        );
      })}
    </p>
  );
}

/*
 * The message box. It can be typed in and filled from a suggestion; Send is
 * disabled because sending a message is a write (POST …/messages) that Mobile
 * does not make. The text stays in this component only and is never stored.
 */
function Composer() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const ids = useId();
  const [text, setText] = useState("");
  const guard = useLeaveGuard(text.trim() !== "");
  const length = [...text].length;

  return (
    <section className="sm-card" aria-labelledby={`${ids}-title`} data-sm-section="composer">
      <h2 id={`${ids}-title`} className="sm-card-title">{t("assist.askTitle")}</h2>
      <div className="sm-chips-inline sm-prompts" role="group" aria-label={t("assist.suggestions")}>
        {PROMPTS.map((prompt) => (
          <button key={prompt} type="button" className="sm-chip sm-chip-button" onClick={() => setText(t(`assist.prompts.${prompt}`))} data-sm-prompt={prompt}>
            {t(`assist.prompts.${prompt}`)}
          </button>
        ))}
      </div>
      <label className="sm-label" htmlFor={`${ids}-message`}>{t("assist.message")}</label>
      <textarea id={`${ids}-message`} className="sm-input sm-textarea" dir="auto" rows={3} value={text} onChange={(event) => setText(event.target.value)} aria-describedby={`${ids}-count ${ids}-closed`} aria-invalid={length > MESSAGE_MAX ? "true" : undefined} />
      <p id={`${ids}-count`} className={`sm-text sm-fine ${length > MESSAGE_MAX ? "sm-form-error" : "sm-muted"}`}>{t("assist.count", { count: length, max: MESSAGE_MAX })}</p>
      <div className="sm-actions">
        <button type="button" className="sm-button" disabled data-sm-action="send-message">{t("assist.send")}</button>
      </div>
      <p id={`${ids}-closed`} className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="ai.message">{t("assist.sendClosed")}</p>
      <MobileSheet open={guard.blocked} onClose={guard.stay} titleId={`${ids}-leave`} title={t("forms.discardTitle")}>
        <p className="sm-text">{t("assist.discardBody")}</p>
        <div className="sm-actions sm-leave-actions">
          <button type="button" className="sm-button" onClick={guard.stay} data-sm-action="stay">{t("forms.keepEditing")}</button>
          <button type="button" className="sm-button sm-button-quiet" onClick={guard.leave} data-sm-action="discard">{t("forms.discard")}</button>
        </div>
      </MobileSheet>
    </section>
  );
}

function Forecast() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
  const [asked, setAsked] = useState(false);
  const resource = useResource(assistKeys.forecast, loadForecast, { enabled: asked });
  const forecast = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildForecast(resource.data);
    } catch {
      return null;
    }
  }, [resource.data]);

  return (
    <section className="sm-card" aria-labelledby="sm-ai-forecast" data-sm-section="forecast">
      <h2 id="sm-ai-forecast" className="sm-card-title">{t("assist.forecastTitle")}</h2>
      {!asked ? (
        <>
          <p className="sm-text sm-muted">{t("assist.forecastIntro")}</p>
          <button type="button" className="sm-button sm-button-quiet" onClick={() => setAsked(true)} data-sm-action="load-forecast">{t("assist.forecastLoad")}</button>
        </>
      ) : resource.loading ? (
        <Skeleton lines={4} label={t("assist.forecastLoading")} />
      ) : resource.status === "error" || !forecast ? (
        <ErrorPanel error={resource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={resource.reload} retrying={resource.refreshing} compact />
      ) : (
        <>
          <AiLabel />
          {forecast.start && forecast.end && <p className="sm-text sm-muted"><bdi>{formatDay(forecast.start, locale, "UTC")}</bdi> – <bdi>{formatDay(forecast.end, locale, "UTC")}</bdi></p>}
          {forecast.explanation && <p className="sm-text sm-user-text">{forecast.explanation}</p>}
          {forecast.currencies.length === 0 && <p className="sm-text sm-muted">{t("assist.forecastEmpty")}</p>}
          {forecast.currencies.map((row) => (
            <div key={row.currency} className="sm-ai-forecast" data-sm-currency={row.currency}>
              <h3 className="sm-row-title"><bdi dir="ltr">{row.currency}</bdi></h3>
              <dl className="sm-stats sm-stats-stacked">
                {Object.entries(row.figures).filter(([, value]) => value !== null).map(([key, value]) => (
                  <div key={key} className="sm-stat">
                    <dt>{t(`assist.figures.${key}`)}</dt>
                    <dd><Money plain value={value} currency={row.currency} /></dd>
                  </div>
                ))}
              </dl>
              {row.timeline.length > 0 && (
                <details className="sm-ai-timeline">
                  <summary>{t("assist.timeline", { count: row.timeline.length })}</summary>
                  <div className="sm-table-wrap">
                    <table className="sm-table">
                      <caption className="sm-sr">{t("assist.timelineCaption", { currency: row.currency })}</caption>
                      <thead><tr><th scope="col">{t("assist.day")}</th><th scope="col">{t("assist.figures.expected_inflow")}</th><th scope="col">{t("assist.figures.expected_outflow")}</th><th scope="col">{t("assist.closing")}</th></tr></thead>
                      <tbody>
                        {row.timeline.map((day) => (
                          <tr key={day.date} data-sm-pressure={row.pressureDays.includes(day.date) ? "true" : undefined}>
                            <th scope="row"><bdi>{formatDay(day.date, locale, "UTC")}</bdi></th>
                            <td>{day.inflow ? <Money plain value={day.inflow} currency={row.currency} /> : "—"}</td>
                            <td>{day.outflow ? <Money plain value={day.outflow} currency={row.currency} /> : "—"}</td>
                            <td>{day.closing ? <Money value={day.closing} currency={row.currency} /> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          ))}
          {forecast.assumptions.length > 0 && (
            <>
              <h3 className="sm-row-title">{t("assist.assumptions")}</h3>
              <ul className="sm-bullets">{forecast.assumptions.map((item) => <li key={item} className="sm-text sm-user-text">{item}</li>)}</ul>
            </>
          )}
          <p className="sm-text sm-muted sm-fine">{t("assist.estimate")}</p>
        </>
      )}
    </section>
  );
}

function Quotas() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const resource = useResource(assistKeys.quotas, loadInputQuotas);
  const quotas = useMemo(() => (resource.data === undefined ? null : buildQuotas(resource.data)), [resource.data]);
  if (resource.loading) return null;
  return (
    <section className="sm-card" aria-labelledby="sm-ai-quotas" data-sm-section="quotas">
      <h2 id="sm-ai-quotas" className="sm-card-title">{t("assist.quotasTitle")}</h2>
      {!quotas ? (
        <p className="sm-text sm-muted" data-sm-quota="unknown">{t("assist.quotaUnknown")}</p>
      ) : (
        <dl className="sm-stats sm-stats-stacked">
          {["voice", "receipt"].map((channel) => (
            <div key={channel} className="sm-stat" data-sm-quota={channel}>
              <dt>{t(`assist.quota.${channel}`)}</dt>
              <dd>{t("assist.quotaLeft", { remaining: quotas[channel].remaining, limit: quotas[channel].limit })} · <bdi>{formatMoment(quotas[channel].resetAt, localeOf(i18n)) ?? ""}</bdi></dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/*
 * The assistant on Mobile: reads only. Its settings are read first; insights,
 * the forecast and conversations are read only for someone who has turned the
 * assistant on (consent), exactly as the full version does, and each only when
 * its own switch is on. Everything the assistant says is labelled as generated,
 * and nothing it suggests changes money.
 */
export default function MobileAssistant() {
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = localeOf(i18n);
  const settingsResource = useResource(assistKeys.aiSettings, loadAiSettings);
  const settings = useMemo(() => {
    if (settingsResource.data === undefined) return null;
    try {
      return buildAiSettings(settingsResource.data);
    } catch {
      return null;
    }
  }, [settingsResource.data]);

  if (settingsResource.loading) return <section className="sm-page" data-sm-screen="assistant" data-sm-state="loading"><Skeleton lines={5} label={t("assist.loading")} /></section>;
  if (settingsResource.status === "error" || !settings) {
    return (
      <section className="sm-page" data-sm-screen="assistant" data-sm-state="error">
        <ErrorPanel error={settingsResource.error ?? { code: "MALFORMED_RESPONSE" }} onRetry={settingsResource.reload} retrying={settingsResource.refreshing} />
      </section>
    );
  }

  const on = settings.consent === true;

  return (
    <section className="sm-page" data-sm-screen="assistant" data-sm-state="ready" data-sm-consent={on ? "true" : "false"}>
      <div className="sm-card">
        <h2 className="sm-card-title">{t("assist.title")}</h2>
        <p className="sm-text sm-muted">{t(on ? "assist.intro" : "assist.off")}</p>
        {!on && (
          <Link className="sm-link-row" to={PATH.USER.AI_ASSISTANT}>
            <span>{t("assist.turnOnFull")}</span>
            <Chevron />
          </Link>
        )}
      </div>

      {on && <Composer />}

      {on && settings.insights === true && (
        <section className="sm-card" aria-labelledby="sm-ai-insights" data-sm-section="insights">
          <h2 id="sm-ai-insights" className="sm-card-title">{t("assist.insightsTitle")}</h2>
          <PagedRead
            name="insights"
            param="i"
            keyOf={assistKeys.insights}
            loaderOf={insightsLoader}
            build={buildInsights}
            label={t("assist.insightsTitle")}
            empty={t("assist.insightsEmpty")}
            renderItem={(insight) => (
              <article className="sm-row sm-ai-insight" data-sm-insight={insight.id}>
                <span className="sm-row-main">
                  <span className="sm-chips-inline"><AiLabel />{insight.type && <span className="sm-chip">{t(`assist.insightType.${insight.type}`, { defaultValue: t("assist.insightType.other") })}</span>}{insight.currency && <span className="sm-chip"><bdi dir="ltr">{insight.currency}</bdi></span>}</span>
                  <h3 className="sm-row-title sm-user-text">{insight.title ?? t("assist.untitled")}</h3>
                  {insight.summary && <p className="sm-text sm-user-text">{insight.summary}</p>}
                  {insight.explanation && <p className="sm-text sm-muted sm-user-text">{insight.explanation}</p>}
                  <Sources sources={insight.sources} />
                  <span className="sm-ai-tools"><FeedbackButton kind="insight" id={insight.id} /></span>
                </span>
              </article>
            )}
          />
        </section>
      )}

      {on && settings.forecast === true && <Forecast />}

      {on && (
        <section className="sm-card" aria-labelledby="sm-ai-conversations" data-sm-section="conversations">
          <h2 id="sm-ai-conversations" className="sm-card-title">{t("assist.conversationsTitle")}</h2>
          <PagedRead
            name="conversations"
            param="c"
            keyOf={assistKeys.conversations}
            loaderOf={conversationsLoader}
            build={buildConversations}
            label={t("assist.conversationsTitle")}
            empty={t("assist.conversationsEmpty")}
            renderItem={(conversation) => (
              <Link className="sm-link-row" to={aiConversationPath(conversation.id)} state={{ from: MOBILE_AI }} data-sm-conversation={conversation.id}>
                <span className="sm-row-main">
                  <span className="sm-row-title sm-user-text">{conversation.title ?? t("assist.untitledConversation")}</span>
                  {conversation.updatedAt && <span className="sm-row-meta"><bdi>{formatMoment(conversation.updatedAt, locale)}</bdi></span>}
                </span>
                <Chevron />
              </Link>
            )}
          />
          <p className="sm-text sm-muted sm-fine">{t("assist.manageFull")}</p>
        </section>
      )}

      <Quotas />

      <div className="sm-card">
        <h2 className="sm-card-title">{t("assist.privacyTitle")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <div className="sm-stat"><dt>{t("assist.consent")}</dt><dd>{t(settings.consent === true ? "assist.on" : settings.consent === false ? "assist.offShort" : "assist.unknown")}</dd></div>
          {settings.retentionDays !== null && <div className="sm-stat"><dt>{t("assist.retention")}</dt><dd>{t("assist.days", { count: settings.retentionDays })}</dd></div>}
        </dl>
        <Link className="sm-link-row" to={PATH.USER.AI_ASSISTANT}>
          <span>{t("assist.settingsFull")}</span>
          <Chevron />
        </Link>
      </div>
    </section>
  );
}

/* One conversation's messages, a server page at a time (oldest first, as the backend orders them). */
export function MobileConversation() {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const { conversationId } = useParams();
  const valid = isAccountId(conversationId);
  const keyOf = useMemo(() => (page) => assistKeys.conversation(conversationId, page), [conversationId]);
  const loaderOf = useMemo(() => (page) => conversationLoader(conversationId, page), [conversationId]);

  return (
    <section className="sm-page" data-sm-screen="conversation" data-sm-record={valid ? conversationId : undefined}>
      <Link className="sm-link-row sm-back" to={MOBILE_AI}>
        <Chevron back />
        <span>{t("assist.back")}</span>
      </Link>
      {!valid ? (
        <ErrorPanel error={{ code: "NOT_FOUND" }} />
      ) : (
        <div className="sm-card">
          <PagedRead
            name="messages"
            keyOf={keyOf}
            loaderOf={loaderOf}
            build={buildMessages}
            label={t("assist.messages")}
            empty={t("assist.messagesEmpty")}
            previousLabel={t("assist.earlier")}
            nextLabel={t("assist.later")}
            renderItem={(message) => (
              <article className={`sm-ai-message sm-ai-${message.role}`} data-sm-role={message.role}>
                <p className="sm-text sm-fine sm-muted">{t(`assist.role.${message.role}`)}{message.role === "assistant" && <> · <AiLabel /></>}</p>
                <p className="sm-text sm-user-text sm-ai-content">{message.content}</p>
                <Sources sources={message.sources} />
                {message.role === "assistant" && <span className="sm-ai-tools"><FeedbackButton kind="message" id={message.id} /></span>}
              </article>
            )}
          />
          <p className="sm-text sm-muted sm-fine" role="note" data-sm-note="write-closed" data-sm-write="ai.message">{t("assist.replyClosed")}</p>
          <DeleteConversation />
        </div>
      )}
    </section>
  );
}
