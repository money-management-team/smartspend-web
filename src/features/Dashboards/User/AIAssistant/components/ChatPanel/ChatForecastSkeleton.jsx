import { useTranslation } from "react-i18next";
import { LuRotateCw } from "react-icons/lu";

import "./ChatForecastSkeleton.css";

export default function ChatForecastSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="ai-forecast-skeleton-card">
      <div className="ai-forecast-skeleton__header">
        <div className="ai-forecast-skeleton__status">
          <span className="ai-forecast-skeleton__pulse-dot" />
          <span className="ai-forecast-skeleton__status-text">
            {t("dashboard.aiAssistant.loadingState.title")}
          </span>
        </div>

        <div className="ai-forecast-skeleton__live-badge">
          <span className="ai-forecast-skeleton__live-dot" />
          <span>{t("dashboard.aiAssistant.loadingState.liveUpdate")}</span>
          <LuRotateCw className="ai-forecast-skeleton__live-icon" />
        </div>
      </div>

      <div className="ai-forecast-skeleton__body">
        {/* Top headline skeleton */}
        <div className="ai-skeleton-bar ai-skeleton-bar--headline" />

        {/* 3 Metric cards in a row */}
        <div className="ai-forecast-skeleton__metrics-grid">
          <div className="ai-forecast-skeleton__metric-card">
            <div className="ai-skeleton-box ai-skeleton-box--icon" />
            <div className="ai-forecast-skeleton__metric-lines">
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
            </div>
          </div>

          <div className="ai-forecast-skeleton__metric-card">
            <div className="ai-skeleton-box ai-skeleton-box--icon" />
            <div className="ai-forecast-skeleton__metric-lines">
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
            </div>
          </div>

          <div className="ai-forecast-skeleton__metric-card">
            <div className="ai-skeleton-box ai-skeleton-box--icon" />
            <div className="ai-forecast-skeleton__metric-lines">
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
            </div>
          </div>
        </div>

        {/* Chart card skeleton */}
        <div className="ai-forecast-skeleton__chart-card">
          <div className="ai-forecast-skeleton__chart-header">
            <div className="ai-skeleton-bar ai-skeleton-bar--pill" />
            <div className="ai-skeleton-bar ai-skeleton-bar--pill-sm" />
            <div className="ai-forecast-skeleton__chart-spacer" />
            <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
          </div>

          <div className="ai-forecast-skeleton__chart-visual">
            <svg
              className="ai-forecast-skeleton__svg"
              viewBox="0 0 600 120"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="aiChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 C80,82 140,55 220,68 C300,80 370,38 450,58 C520,74 570,45 600,50 L600,120 L0,120 Z"
                fill="url(#aiChartGrad)"
              />
              <path
                d="M0,80 C80,82 140,55 220,68 C300,80 370,38 450,58 C520,74 570,45 600,50"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="4 4"
                className="ai-forecast-skeleton__curve"
              />
            </svg>
          </div>

          <div className="ai-forecast-skeleton__chart-ticks">
            <div className="ai-skeleton-bar ai-skeleton-bar--tick" />
            <div className="ai-skeleton-bar ai-skeleton-bar--tick" />
            <div className="ai-skeleton-bar ai-skeleton-bar--tick" />
            <div className="ai-skeleton-bar ai-skeleton-bar--tick" />
            <div className="ai-skeleton-bar ai-skeleton-bar--tick" />
          </div>
        </div>

        {/* Breakdown list skeleton */}
        <div className="ai-forecast-skeleton__list-card">
          <div className="ai-forecast-skeleton__list-header">
            <div className="ai-skeleton-bar ai-skeleton-bar--short" />
          </div>

          <div className="ai-forecast-skeleton__list-rows">
            <div className="ai-forecast-skeleton__row">
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
              <div className="ai-forecast-skeleton__row-spacer" />
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-box ai-skeleton-box--item-icon" />
            </div>

            <div className="ai-forecast-skeleton__row">
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
              <div className="ai-forecast-skeleton__row-spacer" />
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-box ai-skeleton-box--item-icon" />
            </div>

            <div className="ai-forecast-skeleton__row">
              <div className="ai-skeleton-bar ai-skeleton-bar--medium" />
              <div className="ai-forecast-skeleton__row-spacer" />
              <div className="ai-skeleton-bar ai-skeleton-bar--short" />
              <div className="ai-skeleton-box ai-skeleton-box--item-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
