import { useTranslation } from "react-i18next";
import "./MetricsOverview.css";

export default function MetricsOverview({ onOpenSavingsModal, onOpenSpendingModal }) {
  const { t } = useTranslation();

  // Score 84 circle calculation (radius 34, perimeter = 2 * PI * 34 ≈ 213.6)
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (84 / 100) * circumference;

  return (
    <section className="insights-metrics-grid" aria-label="KPI Overview">
      {/* 1. Financial Wellness Score Card */}
      <div className="insights-kpi-card insights-kpi-card--wellness">
        <div className="insights-wellness-circle">
          <svg className="insights-wellness-svg" viewBox="0 0 80 80">
            <circle
              className="insights-wellness-bg"
              cx="40"
              cy="40"
              r={radius}
            />
            <circle
              className="insights-wellness-progress"
              cx="40"
              cy="40"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="insights-wellness-score">
            <span className="insights-wellness-number">84</span>
            <span className="insights-wellness-rating">
              {t("dashboard.smartInsights.kpi.wellnessRating")}
            </span>
          </div>
        </div>

        <div className="insights-wellness-info">
          <h2 className="insights-kpi-card__title">
            {t("dashboard.smartInsights.kpi.wellnessTitle")}
          </h2>
          <span className="insights-wellness-pill">
            {t("dashboard.smartInsights.kpi.wellnessCompare")}
          </span>
          <span className="insights-wellness-timestamp">
            • {t("dashboard.smartInsights.kpi.wellnessLast")}
          </span>
        </div>
      </div>

      {/* 2. Safe Available Liquidity Card */}
      <div className="insights-kpi-card">
        <div className="insights-kpi-card__top">
          <span className="insights-badge insights-badge--green">
            {t("dashboard.smartInsights.kpi.liquidityBadge")}
          </span>
          <span className="insights-kpi-card__sub-title">
            {t("dashboard.smartInsights.kpi.liquidityTitle")}
          </span>
        </div>
        <div className="insights-kpi-card__value">
          {t("dashboard.smartInsights.kpi.liquidityAmount")}
        </div>
        <p className="insights-kpi-card__desc">
          {t("dashboard.smartInsights.kpi.liquidityDesc")}
        </p>
      </div>

      {/* 3. Promising Savings Opportunities Card */}
      <div
        className="insights-kpi-card insights-kpi-card--interactive"
        onClick={onOpenSavingsModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpenSavingsModal();
        }}
      >
        <div className="insights-kpi-card__top">
          <span className="insights-badge insights-badge--blue">
            {t("dashboard.smartInsights.kpi.savingsBadge")}
          </span>
          <span className="insights-kpi-card__sub-title">
            {t("dashboard.smartInsights.kpi.savingsTitle")}
          </span>
        </div>
        <div className="insights-kpi-card__value">
          {t("dashboard.smartInsights.kpi.savingsAmount")}{" "}
          <span className="insights-kpi-card__unit">
            {t("dashboard.smartInsights.kpi.savingsUnit")}
          </span>
        </div>
        <p className="insights-kpi-card__desc">
          {t("dashboard.smartInsights.kpi.savingsDesc")}
        </p>
      </div>

      {/* 4. Spending Velocity Deviation Card */}
      <div
        className="insights-kpi-card insights-kpi-card--interactive"
        onClick={onOpenSpendingModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpenSpendingModal();
        }}
      >
        <div className="insights-kpi-card__top">
          <span className="insights-badge insights-badge--orange">
            {t("dashboard.smartInsights.kpi.velocityBadge")}
          </span>
          <span className="insights-kpi-card__sub-title">
            {t("dashboard.smartInsights.kpi.velocityTitle")}
          </span>
        </div>
        <div className="insights-kpi-card__value insights-kpi-card__value--orange">
          {t("dashboard.smartInsights.kpi.velocityAmount")}
        </div>
        <p className="insights-kpi-card__desc">
          {t("dashboard.smartInsights.kpi.velocityDesc")}
        </p>
      </div>
    </section>
  );
}
