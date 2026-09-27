import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LuCalendar,
  LuDownload,
  LuChevronLeft,
  LuChevronRight,
  LuSparkles,
} from "react-icons/lu";
import { PATH } from "../../../../../../../routes/Path";
import "./ForecastHeader.css";

export default function ForecastHeader({
  activeTab = "all",
  onTabChange,
  activeScenario = "realistic",
  onScenarioChange,
  onExport,
  isExporting = false,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  return (
    <header className="forecast-header">
      {/* Breadcrumb & Back button */}
      <div className="forecast-header__top-bar">
        <nav className="forecast-breadcrumb" aria-label="breadcrumb">
          <Link
            to={PATH.USER.SMART_INSIGHTS}
            className="forecast-breadcrumb__link"
          >
            {t("dashboard.smartInsights.detailedForecast.breadcrumb.insightsCenter")}
          </Link>
          <span className="forecast-breadcrumb__separator">/</span>
          <span className="forecast-breadcrumb__current">
            {t("dashboard.smartInsights.detailedForecast.breadcrumb.forecastTitle")}
          </span>
        </nav>

        <Link
          to={PATH.USER.SMART_INSIGHTS}
          className="forecast-header__back-btn"
        >
          {isArabic ? <LuChevronRight /> : <LuChevronLeft />}
          <span>{t("dashboard.smartInsights.detailedForecast.breadcrumb.backBtn")}</span>
        </Link>
      </div>

      {/* Main Title Row */}
      <div className="forecast-header__main-row">
        <div className="forecast-header__title-group">
          <div className="forecast-header__title-line">
            <h1 className="forecast-header__title">
              {t("dashboard.smartInsights.detailedForecast.header.title")}
            </h1>
            <span className="forecast-header__accuracy-badge">
              <span className="forecast-header__accuracy-dot" />
              <span>{t("dashboard.smartInsights.detailedForecast.header.badge")}</span>
            </span>
          </div>

          <p className="forecast-header__subtitle">
            {t("dashboard.smartInsights.detailedForecast.header.subtitle")}
          </p>
        </div>

        {/* Action Controls */}
        <div className="forecast-header__actions">
          <button
            type="button"
            className="forecast-header__period-select"
            aria-label="Period"
          >
            <LuCalendar className="forecast-header__period-icon" />
            <span>{t("dashboard.smartInsights.detailedForecast.header.periodLabel")}</span>
          </button>

          <button
            type="button"
            className="forecast-header__export-btn"
            onClick={onExport}
            disabled={isExporting}
          >
            <LuDownload />
            <span>
              {isExporting
                ? (isArabic ? "جارٍ التصدير..." : "Exporting...")
                : t("dashboard.smartInsights.detailedForecast.header.exportBtn")}
            </span>
          </button>
        </div>
      </div>

      {/* Switcher Bar: Tabs & Scenario */}
      <div className="forecast-header__controls-bar">
        {/* View Tabs */}
        <div className="forecast-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={`forecast-tab ${activeTab === "all" ? "forecast-tab--active" : ""}`}
            onClick={() => onTabChange?.("all")}
          >
            <span>{t("dashboard.smartInsights.detailedForecast.tabs.all")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "income"}
            className={`forecast-tab ${activeTab === "income" ? "forecast-tab--active" : ""}`}
            onClick={() => onTabChange?.("income")}
          >
            <span>{t("dashboard.smartInsights.detailedForecast.tabs.income")}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "expenses"}
            className={`forecast-tab ${activeTab === "expenses" ? "forecast-tab--active" : ""}`}
            onClick={() => onTabChange?.("expenses")}
          >
            <span>{t("dashboard.smartInsights.detailedForecast.tabs.expenses")}</span>
          </button>
        </div>

        {/* Scenario Switcher */}
        <div className="forecast-scenarios">
          <span className="forecast-scenarios__label">
            <LuSparkles className="forecast-scenarios__icon" />
            <span>{isArabic ? "السيناريو:" : "Scenario:"}</span>
          </span>

          <div className="forecast-scenarios__pill-group">
            <button
              type="button"
              className={`forecast-scenario-chip ${
                activeScenario === "realistic" ? "forecast-scenario-chip--active" : ""
              }`}
              onClick={() => onScenarioChange?.("realistic")}
            >
              {t("dashboard.smartInsights.detailedForecast.tabs.scenarioStandard")}
            </button>

            <button
              type="button"
              className={`forecast-scenario-chip ${
                activeScenario === "conservative" ? "forecast-scenario-chip--active" : ""
              }`}
              onClick={() => onScenarioChange?.("conservative")}
            >
              {t("dashboard.smartInsights.detailedForecast.tabs.scenarioConservative")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
