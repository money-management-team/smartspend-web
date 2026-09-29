import { useTranslation } from "react-i18next";
import {
  LuCalendarClock,
  LuChartNoAxesCombined,
  LuChartPie,
  LuChevronDown,
  LuCircleAlert,
  LuLightbulb,
  LuPiggyBank,
  LuReceipt,
  LuRefreshCw,
  LuRepeat,
  LuTarget,
  LuTrendingUp,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";

import { aiLocale, formatAiMoney } from "../../aiFormat";
import { FeedbackButtons, SourceChips, SuggestedContribution } from "../AiShared/AiShared";

import "./InsightsPanel.css";

const x = "dashboard.aiAssistant.extra";

// Presentation only: an icon and a tone per documented insight type.
const TYPE_STYLE = {
  budget_risk: { icon: LuTriangleAlert, tone: "warning" },
  unusual_spending: { icon: LuCircleAlert, tone: "danger" },
  debt_due: { icon: LuCalendarClock, tone: "warning" },
  spending_change: { icon: LuTrendingUp, tone: "primary" },
  spending_summary: { icon: LuChartPie, tone: "primary" },
  top_category: { icon: LuReceipt, tone: "primary" },
  recurring_commitment: { icon: LuRepeat, tone: "primary" },
  savings_goal_progress: { icon: LuTarget, tone: "success" },
  savings_suggestion: { icon: LuPiggyBank, tone: "success" },
  cashflow_forecast: { icon: LuChartNoAxesCombined, tone: "insights" },
};
const DEFAULT_STYLE = { icon: LuLightbulb, tone: "primary" };

function InsightCard({ item, detail, busy, onToggleDetails, onFeedback, onDismiss, onSuggestedAction }) {
  const { t, i18n } = useTranslation();
  const locale = aiLocale(i18n);
  const { icon: Icon, tone } = TYPE_STYLE[item.type] ?? DEFAULT_STYLE;
  const isActive = item.status === "active";

  return (
    <article className={`ai-insight ai-insight--${tone} ${isActive ? "" : "ai-insight--inactive"}`}>
      <header className="ai-insight__head">
        <span className="ai-insight__icon" aria-hidden="true">
          <Icon />
        </span>
        <span className="ai-insight__type">{t(`${x}.insightTypes.${item.type}`, { defaultValue: item.type })}</span>
        {item.currency_code && (
          <span className="ai-insight__chip">
            <bdi dir="ltr">{item.currency_code}</bdi>
          </span>
        )}
        {!isActive && (
          <span className="ai-insight__chip">{t(`${x}.insightStatuses.${item.status}`, { defaultValue: item.status })}</span>
        )}
      </header>

      <h3 className="ai-insight__title" dir="auto">{item.title}</h3>
      <p className="ai-insight__summary" dir="auto">{item.summary}</p>
      {item.explanation && <p className="ai-insight__explanation" dir="auto">{item.explanation}</p>}

      {isActive && <SuggestedContribution action={item.suggested_action} onOpen={onSuggestedAction} />}

      <SourceChips sources={item.sources} />

      {detail && (
        <dl className="ai-insight__facts" id={`ai-insight-facts-${item.id}`}>
          {detail.facts?.map((fact) => (
            <div key={fact.key}>
              <dt>
                <bdi>{fact.label}</bdi>
              </dt>
              <dd>
                <bdi dir="ltr">
                  {fact.currency_code ? formatAiMoney(fact.value, fact.currency_code, locale) : fact.value}
                </bdi>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="ai-insight__foot">
        <button
          type="button"
          className="ai-insight__details"
          disabled={busy}
          aria-expanded={Boolean(detail)}
          aria-controls={detail ? `ai-insight-facts-${item.id}` : undefined}
          onClick={() => onToggleDetails(item)}
        >
          <span>{detail ? t(`${x}.hideDetails`) : t(`${x}.details`)}</span>
          <LuChevronDown aria-hidden="true" />
        </button>

        <span className="ai-insight__spacer" />

        <FeedbackButtons disabled={busy} onRate={(rating) => onFeedback(item.id, rating)} />

        {isActive && (
          <button
            type="button"
            className="ai-icon-button ai-insight__dismiss"
            disabled={busy}
            onClick={() => onDismiss(item)}
            aria-label={`${t(`${x}.dismiss`)}: ${item.title}`}
            title={t(`${x}.dismiss`)}
          >
            <LuX aria-hidden="true" />
          </button>
        )}
      </footer>
    </article>
  );
}

/*
 * Insights: header with the refresh action, filter toolbar, then the cards.
 * Type and status apply at once; the currency code applies with the form.
 * Every text and figure is the backend's.
 */
export default function InsightsPanel({
  types,
  statuses,
  filters,
  draftCurrency,
  onDraftCurrencyChange,
  onFilterChange,
  onApplyCurrency,
  insights,
  isLoading,
  hasMore,
  onLoadMore,
  canRefresh,
  refreshPending,
  onRefresh,
  details,
  busy,
  onToggleDetails,
  onFeedback,
  onDismiss,
  onSuggestedAction,
}) {
  const { t } = useTranslation();

  return (
    <section className="ai-panel" aria-labelledby="ai-insights-title">
      <header className="ai-panel__head">
        <div>
          <h2 id="ai-insights-title">{t(`${x}.insightsTitle`)}</h2>
          <p>{t(`${x}.insightsDescription`)}</p>
        </div>

        <button
          type="button"
          className={`ai-button ai-button--secondary ${refreshPending ? "ai-button--pending" : ""}`}
          disabled={busy || refreshPending || !canRefresh}
          onClick={onRefresh}
        >
          <LuRefreshCw aria-hidden="true" />
          <span>{refreshPending ? t(`${x}.waitingForInsights`) : t(`${x}.refresh`)}</span>
        </button>
      </header>

      <form
        className="ai-insights-filters"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyCurrency();
        }}
      >
        <label className="ai-field">
          <span>{t(`${x}.insightType`)}</span>
          <select value={filters.type} onChange={(event) => onFilterChange("type", event.target.value)}>
            <option value="">{t(`${x}.allTypes`)}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {t(`${x}.insightTypes.${type}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="ai-field">
          <span>{t(`${x}.insightStatus`)}</span>
          <select value={filters.status} onChange={(event) => onFilterChange("status", event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`${x}.insightStatuses.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="ai-insights-filters__currency">
          <label className="ai-field">
            <span>{t(`${x}.currencyFilter`)}</span>
            <input
              value={draftCurrency}
              maxLength={3}
              pattern="[a-zA-Z]{3}"
              placeholder="ILS"
              dir="ltr"
              autoCapitalize="characters"
              onChange={(event) => onDraftCurrencyChange(event.target.value)}
            />
          </label>
          <button type="submit" className="ai-button ai-button--secondary">
            {t(`${x}.applyFilters`)}
          </button>
        </div>
      </form>

      {!insights.length ? (
        <div className="ai-empty">
          <span className="ai-empty__icon" aria-hidden="true">
            <LuLightbulb />
          </span>
          <p role="status">{isLoading ? t(`${x}.loading`) : t(`${x}.emptyFilteredInsights`)}</p>
        </div>
      ) : (
        <div className="ai-insights-grid">
          {insights.map((item) => (
            <InsightCard
              key={item.id}
              item={item}
              detail={details[item.id]}
              busy={busy}
              onToggleDetails={onToggleDetails}
              onFeedback={onFeedback}
              onDismiss={onDismiss}
              onSuggestedAction={onSuggestedAction}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="ai-panel__more">
          <button type="button" className="ai-button ai-button--secondary" disabled={busy} onClick={onLoadMore}>
            {t(`${x}.more`)}
          </button>
        </div>
      )}
    </section>
  );
}
