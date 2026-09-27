import { useTranslation } from "react-i18next";
import { LuSparkles, LuRefreshCw, LuChevronDown } from "react-icons/lu";
import "./SmartInsightsHeader.css";

export default function SmartInsightsHeader({
  selectedPeriod,
  onPeriodChange,
  onRefresh,
  isRefreshing,
}) {
  const { t } = useTranslation();

  return (
    <header className="smart-insights-header">
      <div className="smart-insights-header__info">
        <div className="smart-insights-header__title-row">
          <h1 className="smart-insights-header__title">
            {t("dashboard.smartInsights.title")}
          </h1>
          <span className="smart-insights-header__badge">
            <LuSparkles className="smart-insights-header__badge-icon" />
            <span>{t("dashboard.smartInsights.badge")}</span>
          </span>
        </div>
        <p className="smart-insights-header__subtitle">
          {t("dashboard.smartInsights.subtitle")}
        </p>
      </div>

      <div className="smart-insights-header__actions">
        {/* Refresh Analytics Button */}
        <button
          type="button"
          className="smart-insights-header__refresh-btn"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <LuRefreshCw
            className={`smart-insights-header__refresh-icon ${
              isRefreshing ? "smart-insights-header__refresh-icon--spinning" : ""
            }`}
          />
          <span>
            {isRefreshing
              ? t("dashboard.smartInsights.refreshing")
              : t("dashboard.smartInsights.refreshBtn")}
          </span>
        </button>

        {/* Period Selector Dropdown */}
        <div className="smart-insights-header__select-wrap">
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="smart-insights-header__period-select"
            aria-label={t("dashboard.smartInsights.periods.july2024")}
          >
            <option value="july2024">
              {t("dashboard.smartInsights.periods.july2024")}
            </option>
            <option value="june2024">
              {t("dashboard.smartInsights.periods.june2024")}
            </option>
            <option value="may2024">
              {t("dashboard.smartInsights.periods.may2024")}
            </option>
            <option value="q2_2024">
              {t("dashboard.smartInsights.periods.q2_2024")}
            </option>
          </select>
          <LuChevronDown className="smart-insights-header__select-arrow" />
        </div>
      </div>
    </header>
  );
}
