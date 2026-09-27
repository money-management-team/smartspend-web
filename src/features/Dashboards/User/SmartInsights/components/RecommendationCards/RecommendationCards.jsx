import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuTriangleAlert,
  LuCircleDollarSign,
  LuCalendarDays,
  LuTrendingUp,
  LuEye,
  LuCheck,
  LuSlidersHorizontal,
} from "react-icons/lu";
import "./RecommendationCards.css";

export default function RecommendationCards({
  onOpenSpendingModal,
  onOpenSavingsModal,
  onApplyDiningCap,
  onEnableAutoTransfer,
  onScheduleReminder,
  onApplyRebalance,
  isDiningApplied = false,
  isAutoTransferEnabled = false,
  isReminderScheduled = false,
  isRebalanced = false,
}) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <section className="insights-recommendations-section">
      {/* Section Header */}
      <div className="insights-section-header">
        <div className="insights-section-header__title-group">
          <h2 className="insights-section-header__title">
            {t("dashboard.smartInsights.section.title")}
          </h2>
          <span className="insights-section-header__subtitle">
            {t("dashboard.smartInsights.section.count5")}
          </span>
        </div>

        {/* Filter Priority Controls */}
        <div className="insights-section-header__filters">
          <button
            type="button"
            className={`insights-filter-btn ${activeFilter === "all" ? "insights-filter-btn--active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <LuSlidersHorizontal className="insights-filter-icon" />
            <span>{t("dashboard.smartInsights.section.filterPriority")}</span>
          </button>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="insights-cards-grid">
        {/* Card 1: Restaurant Spending Alert */}
        <div className="insights-card insights-card--alert-highlight">
          <div className="insights-card__header">
            <div className="insights-card__tag-group">
              <span className="insights-card__alert-ribbon">
                <LuTriangleAlert className="insights-card__ribbon-icon" />
                <span>{t("dashboard.smartInsights.cards.dining.alertRibbon")}</span>
              </span>
            </div>
            <span className="insights-card__time">
              {t("dashboard.smartInsights.cards.dining.time")}
            </span>
          </div>

          <h3 className="insights-card__title">
            {t("dashboard.smartInsights.cards.dining.title")}
          </h3>

          <p className="insights-card__desc">
            {t("dashboard.smartInsights.cards.dining.desc")}
          </p>

          {/* Progress / Benchmark Bar Box */}
          <div className="insights-card__spending-box">
            <div className="insights-card__spending-labels">
              <span className="insights-card__spending-avg">
                {t("dashboard.smartInsights.cards.dining.avgLabel")}
              </span>
              <span className="insights-card__spending-current">
                {t("dashboard.smartInsights.cards.dining.currentLabel")}
              </span>
            </div>

            <div className="insights-card__spending-track">
              <div
                className="insights-card__spending-fill"
                style={{ width: "80%" }}
              />
            </div>

            <div className="insights-card__spending-sub">
              <span>{t("dashboard.smartInsights.cards.dining.safeLimit")}</span>
              <span className="insights-card__spending-excess">
                {t("dashboard.smartInsights.cards.dining.excess")}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="insights-card__actions">
            <button
              type="button"
              className={`insights-card__btn-primary insights-card__btn-primary--dark ${
                isDiningApplied ? "insights-card__btn-primary--done" : ""
              }`}
              onClick={onApplyDiningCap}
              disabled={isDiningApplied}
            >
              {isDiningApplied && <LuCheck className="insights-btn-icon" />}
              <span>
                {isDiningApplied
                  ? t("dashboard.smartInsights.cards.dining.applied")
                  : t("dashboard.smartInsights.cards.dining.applyBtn")}
              </span>
            </button>

            <button
              type="button"
              className="insights-card__btn-outline"
              onClick={onOpenSpendingModal}
            >
              <LuEye className="insights-btn-icon" />
              <span>{t("dashboard.smartInsights.cards.dining.viewDetailsBtn")}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Cash Surplus to Deposit */}
        <div className="insights-card">
          <div className="insights-card__header">
            <div className="insights-card__tag-group">
              <div className="insights-card__icon-wrap insights-card__icon-wrap--green">
                <LuCircleDollarSign />
              </div>
              <span className="insights-card__badge insights-card__badge--green">
                {t("dashboard.smartInsights.cards.surplus.tag")}
              </span>
            </div>
            <span className="insights-card__accuracy">
              {t("dashboard.smartInsights.cards.surplus.accuracy")}
            </span>
          </div>

          <h3 className="insights-card__title">
            {t("dashboard.smartInsights.cards.surplus.title")}
          </h3>

          <p className="insights-card__desc">
            {t("dashboard.smartInsights.cards.surplus.desc")}
          </p>

          {/* Highlight Box */}
          <div className="insights-card__highlight-box">
            <span>{t("dashboard.smartInsights.cards.surplus.highlight")}</span>
          </div>

          {/* Actions */}
          <div className="insights-card__actions">
            <button
              type="button"
              className={`insights-card__btn-primary insights-card__btn-primary--emerald ${
                isAutoTransferEnabled ? "insights-card__btn-primary--done" : ""
              }`}
              onClick={onEnableAutoTransfer}
              disabled={isAutoTransferEnabled}
            >
              {isAutoTransferEnabled && <LuCheck className="insights-btn-icon" />}
              <span>
                {isAutoTransferEnabled
                  ? t("dashboard.smartInsights.cards.surplus.enabled")
                  : t("dashboard.smartInsights.cards.surplus.enableAutoBtn")}
              </span>
            </button>

            <button
              type="button"
              className="insights-card__btn-outline"
              onClick={onOpenSavingsModal}
            >
              <span>{t("dashboard.smartInsights.cards.surplus.editAmountBtn")}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Upcoming Subscriptions */}
        <div className="insights-card">
          <div className="insights-card__header">
            <div className="insights-card__tag-group">
              <div className="insights-card__icon-wrap insights-card__icon-wrap--blue">
                <LuCalendarDays />
              </div>
              <span className="insights-card__badge insights-card__badge--blue">
                {t("dashboard.smartInsights.cards.subscriptions.tag")}
              </span>
            </div>
            <span className="insights-card__date-range">
              {t("dashboard.smartInsights.cards.subscriptions.dateRange")}
            </span>
          </div>

          <h3 className="insights-card__title">
            {t("dashboard.smartInsights.cards.subscriptions.title")}
          </h3>

          <p className="insights-card__desc">
            {t("dashboard.smartInsights.cards.subscriptions.desc")}
          </p>

          {/* Subscriptions Grid (2x2) */}
          <div className="insights-card__subs-grid">
            <div className="insights-sub-item">
              <span className="insights-sub-item__name">
                {t("dashboard.smartInsights.cards.subscriptions.item1")}
              </span>
              <span className="insights-sub-item__cost">
                {t("dashboard.smartInsights.cards.subscriptions.item1Cost")}
              </span>
            </div>
            <div className="insights-sub-item">
              <span className="insights-sub-item__name">
                {t("dashboard.smartInsights.cards.subscriptions.item2")}
              </span>
              <span className="insights-sub-item__cost">
                {t("dashboard.smartInsights.cards.subscriptions.item2Cost")}
              </span>
            </div>
            <div className="insights-sub-item">
              <span className="insights-sub-item__name">
                {t("dashboard.smartInsights.cards.subscriptions.item3")}
              </span>
              <span className="insights-sub-item__cost">
                {t("dashboard.smartInsights.cards.subscriptions.item3Cost")}
              </span>
            </div>
            <div className="insights-sub-item">
              <span className="insights-sub-item__name">
                {t("dashboard.smartInsights.cards.subscriptions.item4")}
              </span>
              <span className="insights-sub-item__cost">
                {t("dashboard.smartInsights.cards.subscriptions.item4Cost")}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="insights-card__actions">
            <button
              type="button"
              className="insights-card__btn-primary insights-card__btn-primary--blue"
              onClick={onOpenSavingsModal}
            >
              <span>{t("dashboard.smartInsights.cards.subscriptions.reviewBtn")}</span>
            </button>

            <button
              type="button"
              className="insights-card__btn-outline"
              onClick={onScheduleReminder}
              disabled={isReminderScheduled}
            >
              {isReminderScheduled && <LuCheck className="insights-btn-icon" />}
              <span>
                {isReminderScheduled
                  ? t("dashboard.smartInsights.cards.subscriptions.scheduled")
                  : t("dashboard.smartInsights.cards.subscriptions.scheduleBtn")}
              </span>
            </button>
          </div>
        </div>

        {/* Card 4: Portfolio Rebalancing */}
        <div className="insights-card">
          <div className="insights-card__header">
            <div className="insights-card__tag-group">
              <div className="insights-card__icon-wrap insights-card__icon-wrap--purple">
                <LuTrendingUp />
              </div>
              <span className="insights-card__badge insights-card__badge--purple">
                {t("dashboard.smartInsights.cards.portfolio.tag")}
              </span>
            </div>
            <span className="insights-card__time">
              {t("dashboard.smartInsights.cards.portfolio.time")}
            </span>
          </div>

          <h3 className="insights-card__title">
            {t("dashboard.smartInsights.cards.portfolio.title")}
          </h3>

          <p className="insights-card__desc">
            {t("dashboard.smartInsights.cards.portfolio.desc")}
          </p>

          {/* Asset Allocation Bar Box */}
          <div className="insights-card__asset-box">
            <div className="insights-card__asset-header">
              <span className="insights-card__asset-title">
                {t("dashboard.smartInsights.cards.portfolio.distTitle")}
              </span>
              <span className="insights-card__asset-diff">
                {t("dashboard.smartInsights.cards.portfolio.diffBadge")}
              </span>
            </div>

            <div className="insights-card__asset-bar">
              <div
                className="insights-card__asset-segment insights-card__asset-segment--gold"
                style={{ width: "35%" }}
              />
              <div
                className="insights-card__asset-segment insights-card__asset-segment--blue"
                style={{ width: "65%" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="insights-card__actions">
            <button
              type="button"
              className={`insights-card__btn-primary insights-card__btn-primary--purple ${
                isRebalanced ? "insights-card__btn-primary--done" : ""
              }`}
              onClick={onApplyRebalance}
              disabled={isRebalanced}
            >
              {isRebalanced && <LuCheck className="insights-btn-icon" />}
              <span>
                {isRebalanced
                  ? t("dashboard.smartInsights.cards.portfolio.rebalanced")
                  : t("dashboard.smartInsights.cards.portfolio.applyRebalanceBtn")}
              </span>
            </button>

            <button
              type="button"
              className="insights-card__btn-outline"
              onClick={onOpenSavingsModal}
            >
              <span>{t("dashboard.smartInsights.cards.portfolio.viewAssetsBtn")}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
