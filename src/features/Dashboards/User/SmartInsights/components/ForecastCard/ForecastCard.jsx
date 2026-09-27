import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuTrendingUp, LuArrowLeft, LuArrowRight } from "react-icons/lu";
import { PATH } from "../../../../../../routes/Path";
import "./ForecastCard.css";

export default function ForecastCard({ onViewDetails }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  const handleView = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      navigate(PATH.USER.SMART_INSIGHTS_FORECAST);
    }
  };

  return (
    <section className="forecast-card" aria-labelledby="forecast-heading">
      {/* Top Header */}
      <div className="forecast-card__header">
        <div className="forecast-card__header-right">
          <div className="forecast-card__badges-line">
            <span className="forecast-card__badge-smart">
              <LuTrendingUp className="forecast-card__trend-icon" />
              <span>{t("dashboard.smartInsights.forecast.badge")}</span>
            </span>
            <span className="forecast-card__auto-update">
              {t("dashboard.smartInsights.forecast.autoUpdate")}
            </span>
          </div>
          <h2 id="forecast-heading" className="forecast-card__title">
            {t("dashboard.smartInsights.forecast.title")}
          </h2>
        </div>

        <div className="forecast-card__header-left">
          <span className="forecast-card__accuracy-badge">
            {t("dashboard.smartInsights.forecast.accuracy")}
          </span>
        </div>
      </div>

      {/* Main Content (2 Columns) */}
      <div className="forecast-card__content">
        {/* Right Stats Column (in RTL) */}
        <div className="forecast-card__stats-col">
          <span className="forecast-card__net-label">
            {t("dashboard.smartInsights.forecast.netFlowTitle")}
          </span>

          <div className="forecast-card__net-row">
            <span className="forecast-card__net-amount">
              {t("dashboard.smartInsights.forecast.netFlowValue")} {t("dashboard.smartInsights.forecast.currency")}
            </span>
            <span className="forecast-card__net-surplus">
              {t("dashboard.smartInsights.forecast.surplus")}
            </span>
          </div>

          <p className="forecast-card__net-desc">
            {t("dashboard.smartInsights.forecast.netFlowDesc")}
          </p>

          {/* Mini Breakdown Bars */}
          <div className="forecast-card__bars">
            <div className="forecast-mini-bar">
              <div className="forecast-mini-bar__labels">
                <span>{t("dashboard.smartInsights.forecast.expectedIncome")}</span>
              </div>
              <div className="forecast-mini-bar__track">
                <div
                  className="forecast-mini-bar__fill forecast-mini-bar__fill--income"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div className="forecast-mini-bar">
              <div className="forecast-mini-bar__labels">
                <span>{t("dashboard.smartInsights.forecast.estimatedExpenses")}</span>
              </div>
              <div className="forecast-mini-bar__track">
                <div
                  className="forecast-mini-bar__fill forecast-mini-bar__fill--expenses"
                  style={{ width: "66%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left Trend SVG Chart Column */}
        <div className="forecast-card__chart-col">
          <div className="forecast-chart-labels">
            <span>{t("dashboard.smartInsights.forecast.day1")}</span>
            <span className="forecast-chart-labels__mid">
              {t("dashboard.smartInsights.forecast.pathLabel")}
            </span>
            <span>{t("dashboard.smartInsights.forecast.day30")}</span>
          </div>

          <div className="forecast-svg-container">
            <svg
              className="forecast-svg"
              viewBox="0 0 320 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="forecastGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Shaded Area */}
              <path
                d="M 10,85 C 80,82 140,70 210,62 C 260,56 290,38 310,30 L 310,100 L 10,100 Z"
                fill="url(#forecastGlow)"
              />

              {/* Smooth Trend Curve */}
              <path
                d="M 10,85 C 80,82 140,70 210,62 C 260,56 290,38 310,30"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* End Point Dot */}
              <circle cx="310" cy="30" r="4.5" fill="#2563eb" />
              <circle cx="310" cy="30" r="8" fill="#2563eb" fillOpacity="0.2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer Line with Button & Note */}
      <div className="forecast-card__footer">
        <button
          type="button"
          className="forecast-card__view-btn"
          onClick={handleView}
        >
          <span>{t("dashboard.smartInsights.forecast.viewDetails")}</span>
          {isArabic ? <LuArrowLeft /> : <LuArrowRight />}
        </button>

        <div className="forecast-card__footnote">
          <span className="forecast-card__footnote-dot" />
          <span>{t("dashboard.smartInsights.forecast.footnote")}</span>
        </div>
      </div>
    </section>
  );
}
