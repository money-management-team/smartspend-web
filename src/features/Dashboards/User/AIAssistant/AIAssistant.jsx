import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LuCircleAlert, LuCircleCheck, LuSettings2, LuSparkles, LuX } from "react-icons/lu";
import { aiCopilotApi } from "../api/aiCopilotApi";
import { getApiErrorMessage } from "../api/apiClient";
import { getSavingsGoalDetailsPath } from "../../../../routes/Path";
import ActivationCard from "./components/ActivationCard/ActivationCard";
import AssistantTopbar from "./components/AssistantTopbar/AssistantTopbar";
import ChatWorkspace from "./components/ChatWorkspace/ChatWorkspace";
import FeedbackDialog from "./components/FeedbackDialog/FeedbackDialog";
import ForecastPanel from "./components/ForecastPanel/ForecastPanel";
import InsightsPanel from "./components/InsightsPanel/InsightsPanel";
import SettingsPanel from "./components/SettingsPanel/SettingsPanel";
import { getSavingsContributionSuggestion } from "./aiSuggestedAction";
import "./AIAssistant.css";

const INSIGHT_TYPES = ["spending_summary", "spending_change", "top_category", "budget_risk", "unusual_spending", "recurring_commitment", "debt_due", "savings_goal_progress", "savings_suggestion", "cashflow_forecast"];
const INSIGHT_STATUSES = ["active", "dismissed", "expired", "superseded"];

/*
 * AI Copilot page. This component owns every request and piece of state
 * (see docs/ai-copilot/integration.md); the components under ./components
 * only present it: AssistantTopbar (title, status, view switcher),
 * ChatWorkspace (conversations + chat), InsightsPanel, ForecastPanel,
 * SettingsPanel and ActivationCard (consent).
 */
export default function AIAssistant() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [chatPage, setChatPage] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePage, setMessagePage] = useState(null);
  const [message, setMessage] = useState("");
  const [draftRetention, setDraftRetention] = useState(30);
  const [settings, setSettings] = useState(null);
  const [insights, setInsights] = useState([]);
  const [insightPage, setInsightPage] = useState(null);
  const [loadedInsightFilter, setLoadedInsightFilter] = useState(null);
  const [insightDetails, setInsightDetails] = useState({});
  const [insightFilters, setInsightFilters] = useState({ type: "", status: "active", currency_code: "" });
  const [draftCurrency, setDraftCurrency] = useState("");
  const [refreshPending, setRefreshPending] = useState(false);
  const refreshBaseline = useRef("");
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const selected = useRef(null);
  const pending = useRef(null);
  const x = "dashboard.aiAssistant.extra";

  const loadChats = useCallback(async (page = 1, signal) => {
    const result = (await aiCopilotApi.conversations({ page, per_page: 30 }, { signal })).data?.conversations;
    if (signal?.aborted) return;
    setConversations((old) => page === 1 ? result?.data ?? [] : [...old, ...(result?.data ?? [])]);
    setChatPage(result);
  }, []);

  const loadChat = useCallback(async (id, page = 1, signal) => {
    selected.current = id;
    let result = (await aiCopilotApi.conversation(id, { page, per_page: 50 }, { signal })).data?.messages;
    if (page === 1 && result?.last_page > 1) {
      result = (await aiCopilotApi.conversation(id, { page: result.last_page, per_page: 50 }, { signal })).data?.messages;
    }
    if (selected.current !== id || signal?.aborted) return;
    setActiveId(id);
    setMessages((old) => page === 1 ? result?.data ?? [] : [...(result?.data ?? []), ...old]);
    setMessagePage(result);
  }, []);

  const loadInsights = useCallback(async (page = 1, signal) => {
    const result = (await aiCopilotApi.insights({ page, per_page: 20, ...insightFilters }, { signal })).data?.insights;
    if (signal?.aborted) return;
    setInsights((old) => page === 1 ? result?.data ?? [] : [...old, ...(result?.data ?? [])]);
    setInsightPage(result);
    setLoadedInsightFilter(JSON.stringify(insightFilters));
  }, [insightFilters]);

  useEffect(() => {
    if (tab !== "insights" || !settings?.consent?.active || !settings.insights_enabled) return;
    const controller = new AbortController();
    Promise.resolve().then(() => { if (!controller.signal.aborted) return loadInsights(1, controller.signal); })
      .catch((failure) => {
      if (failure.name !== "AbortError") setError(getApiErrorMessage(failure, t));
    });
    return () => controller.abort();
  }, [tab, settings?.consent?.active, settings?.insights_enabled, loadInsights, t]);

  useEffect(() => {
    if (!refreshPending || tab !== "insights") return;
    let cancelled = false;
    let attempts = 0;
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const result = (await aiCopilotApi.insights({ page: 1, per_page: 20, ...insightFilters })).data?.insights;
        if (cancelled) return;
        if (!result || !Array.isArray(result.data)) throw new Error(t(`${x}.invalidResponse`));
        setInsights(result.data); setInsightPage(result); setLoadedInsightFilter(JSON.stringify(insightFilters));
        attempts += 1;
        const fingerprint = JSON.stringify(result.data.map((item) => [item.id, item.generated_at, item.status]));
        if (fingerprint !== refreshBaseline.current || attempts >= 12) {
          setRefreshPending(false);
          setNotice(t(fingerprint !== refreshBaseline.current ? `${x}.insightsUpdated` : `${x}.refreshStillQueued`));
        }
      } catch (failure) {
        if (!cancelled) { setRefreshPending(false); setError(getApiErrorMessage(failure, t)); }
      } finally { polling = false; }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refreshPending, tab, insightFilters, t]);

  useEffect(() => {
    const controller = new AbortController();
    aiCopilotApi.settings({ signal: controller.signal })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        const current = response.data?.settings;
        if (!current) throw new Error(t(`${x}.invalidResponse`));
        setSettings(current);
        setDraftRetention(current.retention_days);
        if (current.consent?.active) {
          try { await loadChats(1, controller.signal); }
          catch (failure) { if (failure.name !== "AbortError") setError(getApiErrorMessage(failure, t)); }
        }
      })
      .catch((failure) => { if (failure.name !== "AbortError") setError(getApiErrorMessage(failure, t)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t, loadChats]);

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) { setError(getApiErrorMessage(failure, t)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function newChat() {
    selected.current = null; pending.current = null;
    setActiveId(null); setMessages([]); setMessage(""); setMessagePage(null); setError("");
  }

  async function send(customMessage) {
    const content = String(customMessage ?? message).trim();
    if (!content || content.length > 4000 || busy || !settings?.consent?.active) return;
    setSending(true);
    try { await run(async () => {
      let id = activeId;
      if (!id) {
        const created = (await aiCopilotApi.createConversation(i18n.language?.startsWith("ar") ? "ar" : "en")).data?.conversation;
        if (!created?.id) throw new Error(t(`${x}.invalidResponse`));
        id = created.id; selected.current = id; setActiveId(id);
        setConversations((old) => [created, ...old]);
      }
      const key = pending.current?.id === id && pending.current?.content === content
        ? pending.current.key : `web-${crypto.randomUUID()}`;
      pending.current = { id, content, key };
      const result = (await aiCopilotApi.sendMessage(id, content, key)).data;
      if (!result?.user_message || !result?.assistant_message) throw new Error(t(`${x}.invalidResponse`));
      pending.current = null; setMessage("");
      if (selected.current === id) setMessages((old) => [
        ...old.filter((item) => item.id !== result.user_message.id && item.id !== result.assistant_message.id),
        result.user_message, result.assistant_message,
      ]);
      await loadChats();
    }); } finally { setSending(false); }
  }

  async function openTab(next) {
    setTab(next);
    setError(""); setNotice("");
    if (!settings?.consent?.active) return;
    if (next === "forecast" && settings.forecast_enabled) await run(async () => setForecast((await aiCopilotApi.forecast()).data?.forecast));
  }

  function openSuggestedAction(action) {
    const suggestion = getSavingsContributionSuggestion(action);
    if (suggestion) navigate(getSavingsGoalDetailsPath(suggestion.targetId), { state: { aiContributionPrefill: suggestion } });
  }

  async function submitFeedback(payload) {
    await run(async () => {
      if (feedbackTarget.kind === "message") await aiCopilotApi.messageFeedback(feedbackTarget.id, payload);
      else await aiCopilotApi.insightFeedback(feedbackTarget.id, payload);
      setFeedbackTarget(null);
      setNotice(t(`${x}.feedbackSaved`));
    });
  }

  async function enableAssistant() {
    await run(async () => {
      const current = (await aiCopilotApi.updateSettings({ ai_enabled: true })).data?.settings;
      if (!current?.consent?.active) throw new Error(t(`${x}.invalidResponse`));
      setSettings(current);
      setNotice(t(`${x}.enabledNotice`));
      try { await loadChats(); }
      catch (failure) { setError(getApiErrorMessage(failure, t)); }
    });
  }

  const hasConsent = Boolean(settings?.consent?.active);
  const needsSetup = !loading && settings && !hasConsent;
  const featureOff = hasConsent && ((tab === "insights" && !settings.insights_enabled) || (tab === "forecast" && !settings.forecast_enabled));
  const visibleInsights = loadedInsightFilter === JSON.stringify(insightFilters) ? insights : [];
  const visibleInsightPage = loadedInsightFilter === JSON.stringify(insightFilters) ? insightPage : null;
  const status = loading ? "loading" : hasConsent ? "ready" : "inactive";

  /* ---------- Chat actions ---------- */

  const selectConversation = (id) => run(async () => {
    setLoadingChat(true);
    try { await loadChat(id); } finally { setLoadingChat(false); }
  });

  const deleteConversation = (id) => {
    if (window.confirm(t(`${x}.confirmDeleteChat`))) run(async () => {
      await aiCopilotApi.deleteConversation(id);
      setConversations((old) => old.filter((chat) => chat.id !== id));
      if (activeId === id) newChat();
    });
  };

  /* ---------- Insight actions ---------- */

  const changeInsightFilter = (key, value) => {
    setRefreshPending(false);
    setInsightFilters((old) => ({ ...old, [key]: value }));
  };

  const applyInsightCurrency = () => {
    setRefreshPending(false);
    setInsightFilters((old) => ({ ...old, currency_code: draftCurrency.trim().toUpperCase() }));
  };

  const refreshInsights = () => run(async () => {
    refreshBaseline.current = JSON.stringify(visibleInsights.map((item) => [item.id, item.generated_at, item.status]));
    await aiCopilotApi.refreshInsights(); setRefreshPending(true); setNotice(t(`${x}.queued`));
  });

  // Opening reads GET /ai/insights/{id}; closing only hides the facts.
  const toggleInsightDetails = (item) => {
    if (insightDetails[item.id]) {
      setInsightDetails((old) => ({ ...old, [item.id]: null }));
      return;
    }
    run(async () => {
      const detail = (await aiCopilotApi.insight(item.id)).data?.insight;
      setInsightDetails((old) => ({ ...old, [item.id]: detail }));
    });
  };

  const dismissInsight = (item) => run(async () => {
    await aiCopilotApi.dismissInsight(item.id);
    setInsights((old) => old.filter((insight) => insight.id !== item.id));
    await loadInsights(1);
  });

  /* ---------- Settings actions ---------- */

  const toggleSetting = (key, checked) => run(async () => {
    const current = (await aiCopilotApi.updateSettings({ [key]: checked })).data.settings;
    setSettings(current);
    if (key === "ai_enabled" && current?.consent?.active) await loadChats();
  });

  const changeLanguage = (value) => run(async () =>
    setSettings((await aiCopilotApi.updateSettings({ preferred_language: value })).data.settings));

  const saveRetention = () => run(async () => {
    const current = (await aiCopilotApi.updateSettings({ retention_days: Number(draftRetention) })).data.settings;
    setSettings(current); setDraftRetention(current.retention_days);
  });

  const deleteAiData = () => {
    if (window.confirm(t(`${x}.confirmDeleteData`))) run(async () => {
      await aiCopilotApi.deleteData(); newChat(); setConversations([]); setInsights([]);
      setSettings((await aiCopilotApi.settings()).data?.settings);
      setNotice(t(`${x}.deleted`));
    });
  };

  let content;
  if (loading) {
    content = <div className="ai-state" role="status">
      <span className="ai-state__icon ai-state__icon--pulse" aria-hidden="true"><LuSparkles /></span>
      <p>{t(`${x}.loading`)}</p>
    </div>;
  } else if (needsSetup && tab !== "settings") {
    content = <ActivationCard busy={busy} onEnable={enableAssistant} onReviewSettings={() => openTab("settings")} />;
  } else if (featureOff) {
    content = <section className="ai-state">
      <span className="ai-state__icon" aria-hidden="true"><LuSettings2 /></span>
      <h2>{t(`${x}.featureDisabled`)}</h2>
      <p>{t(`${x}.featureDisabledHint`)}</p>
      <button type="button" className="ai-button ai-button--primary" onClick={() => openTab("settings")}>{t(`${x}.reviewSettings`)}</button>
    </section>;
  } else if (!settings) {
    content = <div className="ai-state">
      <span className="ai-state__icon ai-state__icon--danger" aria-hidden="true"><LuCircleAlert /></span>
      <p>{t(`${x}.settingsUnavailable`)}</p>
      <button type="button" className="ai-button ai-button--primary" onClick={() => window.location.reload()}>{t(`${x}.retry`)}</button>
    </div>;
  } else if (tab === "chat") {
    content = <ChatWorkspace
      conversations={conversations}
      activeId={activeId}
      hasMoreChats={chatPage?.current_page < chatPage?.last_page}
      onLoadMoreChats={() => run(() => loadChats(chatPage.current_page + 1))}
      onNewChat={newChat}
      onSelectConversation={selectConversation}
      onDeleteConversation={deleteConversation}
      busy={busy}
      messages={messages}
      message={message}
      setMessage={setMessage}
      onSend={send}
      onSuggestionClick={setMessage}
      isSending={sending}
      loadingChat={loadingChat}
      hasOlder={messagePage?.current_page > 1}
      onLoadOlder={() => run(() => loadChat(activeId, messagePage.current_page - 1))}
      onSuggestedAction={openSuggestedAction}
      onFeedback={(id, rating) => { setError(""); setFeedbackTarget({ kind: "message", id, rating }); }}
    />;
  } else if (tab === "insights") {
    content = <InsightsPanel
      types={INSIGHT_TYPES}
      statuses={INSIGHT_STATUSES}
      filters={insightFilters}
      draftCurrency={draftCurrency}
      onDraftCurrencyChange={setDraftCurrency}
      onFilterChange={changeInsightFilter}
      onApplyCurrency={applyInsightCurrency}
      insights={visibleInsights}
      isLoading={busy || loadedInsightFilter !== JSON.stringify(insightFilters)}
      hasMore={visibleInsightPage?.current_page < visibleInsightPage?.last_page}
      onLoadMore={() => run(() => loadInsights(visibleInsightPage.current_page + 1))}
      canRefresh={Boolean(settings?.ai_enabled && settings?.insights_enabled)}
      refreshPending={refreshPending}
      onRefresh={refreshInsights}
      details={insightDetails}
      busy={busy}
      onToggleDetails={toggleInsightDetails}
      onFeedback={(id, rating) => { setError(""); setFeedbackTarget({ kind: "insight", id, rating }); }}
      onDismiss={dismissInsight}
      onSuggestedAction={openSuggestedAction}
    />;
  } else if (tab === "forecast") {
    content = <ForecastPanel forecast={forecast} busy={busy} />;
  } else {
    content = <SettingsPanel
      settings={settings}
      hasConsent={hasConsent}
      busy={busy}
      draftRetention={draftRetention}
      onDraftRetentionChange={setDraftRetention}
      onToggle={toggleSetting}
      onLanguageChange={changeLanguage}
      onSaveRetention={saveRetention}
      onDeleteData={deleteAiData}
    />;
  }

  return <main className="ai-assistant-page">
    <AssistantTopbar tab={tab} onTabChange={openTab} status={status} />

    {error && !feedbackTarget && <div role="alert" className="ai-alert ai-alert--error">
      <LuCircleAlert aria-hidden="true" />
      <span>{error}</span>
      <button type="button" className="ai-icon-button" onClick={() => setError("")} aria-label={t(`${x}.dismissAlert`)}>
        <LuX aria-hidden="true" />
      </button>
    </div>}
    {notice && <div role="status" className="ai-alert ai-alert--success">
      <LuCircleCheck aria-hidden="true" />
      <span>{notice}</span>
      <button type="button" className="ai-icon-button" onClick={() => setNotice("")} aria-label={t(`${x}.dismissAlert`)}>
        <LuX aria-hidden="true" />
      </button>
    </div>}

    {content}

    {feedbackTarget && <FeedbackDialog key={`${feedbackTarget.kind}-${feedbackTarget.id}-${feedbackTarget.rating}`}
      rating={feedbackTarget.rating} busy={busy} error={error} onClose={() => setFeedbackTarget(null)} onSubmit={submitFeedback} />}
  </main>;
}
