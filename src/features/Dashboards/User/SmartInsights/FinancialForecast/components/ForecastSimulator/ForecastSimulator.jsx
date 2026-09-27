import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuSparkles,
  LuBookmark,
  LuCheck,
} from "react-icons/lu";
import "./ForecastSimulator.css";

export default function ForecastSimulator({ activeTab = "all", onSaveScenario }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  // State for all tab
  const [flexibleVariance, setFlexibleVariance] = useState(15);

  // State for income tab (50/30/20)
  const [savingsRatio, setSavingsRatio] = useState(30);

  // State for expenses tab
  const [expenseCompression, setExpenseCompression] = useState(15);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    onSaveScenario?.();
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Calculations for all tab
  const calculatedSurplus = 6250 - (flexibleVariance * 44.5);
  const calculatedLowest = 9420 - (flexibleVariance * 44.5);

  // Calculations for income tab
  const totalIncome = 18500;
  const needAmount = Math.round(totalIncome * 0.5);
  const saveAmount = Math.round(totalIncome * (savingsRatio / 100));
  const wantAmount = totalIncome - needAmount - saveAmount;

  // Calculations for expenses tab
  const baseFlexible = 2250;
  const savedAmount = ((baseFlexible * expenseCompression) / 100).toFixed(2);

  return (
    <div className="forecast-simulator-card">
      {/* =========================================
          TAB: ALL FLOWS
      ========================================= */}
      {activeTab === "all" && (
        <>
          <div className="forecast-sim-header">
            <span className="forecast-sim-badge">
              <LuSparkles />
              <span>{t("dashboard.smartInsights.detailedForecast.simulators.optimizerTitle")}</span>
            </span>
          </div>

          <p className="forecast-sim-desc">
            {t("dashboard.smartInsights.detailedForecast.simulators.optimizerSub")}
          </p>

          <div className="forecast-sim-control">
            <div className="forecast-sim-control__label-row">
              <span className="forecast-sim-control__label">
                {isArabic ? "تغير المصروفات المرنة:" : "Discretionary Spend Variance:"}
              </span>
              <span className="forecast-sim-control__value-badge">
                {flexibleVariance > 0 ? `+${flexibleVariance}%` : `${flexibleVariance}%`}
              </span>
            </div>

            <div className="forecast-sim-chips">
              <button
                type="button"
                className={`forecast-sim-chip ${flexibleVariance === -20 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setFlexibleVariance(-20)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chipMinus20")}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${flexibleVariance === 0 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setFlexibleVariance(0)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chipCurrent")}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${flexibleVariance === 15 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setFlexibleVariance(15)}
              >
                +15%
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${flexibleVariance === 40 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setFlexibleVariance(40)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chipPlus40")}
              </button>
            </div>
          </div>

          {/* Results Box */}
          <div className="forecast-sim-result-box">
            <span className="forecast-sim-result-title">
              {t("dashboard.smartInsights.detailedForecast.simulators.resultTitle")}
            </span>

            <div className="forecast-sim-result-item">
              <span className="forecast-sim-result-label">
                {isArabic ? "صافي الفائض الجديد:" : "New Net Surplus:"}
              </span>
              <span className="forecast-sim-result-val forecast-sim-result-val--green">
                {calculatedSurplus.toLocaleString()} {isArabic ? "ر.س" : "SAR"}
              </span>
            </div>

            <div className="forecast-sim-result-item">
              <span className="forecast-sim-result-label">
                {isArabic ? "أدنى نقطة رصيد:" : "Lowest Balance Dip:"}
              </span>
              <span className="forecast-sim-result-val">
                {calculatedLowest.toLocaleString()} {isArabic ? "ر.س (آمن)" : "SAR (Safe)"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="forecast-sim-save-btn"
            onClick={handleSave}
          >
            {isSaved ? <LuCheck /> : <LuBookmark />}
            <span>
              {isSaved
                ? (isArabic ? "تم حفظ السيناريو بنجاح" : "Scenario Saved")
                : t("dashboard.smartInsights.detailedForecast.simulators.saveScenarioBtn")}
            </span>
          </button>
        </>
      )}

      {/* =========================================
          TAB: INCOME ONLY (50/30/20 Rule)
      ========================================= */}
      {activeTab === "income" && (
        <>
          <div className="forecast-sim-header">
            <span className="forecast-sim-badge">
              <LuSparkles />
              <span>{t("dashboard.smartInsights.detailedForecast.simulators.rule503020Title")}</span>
            </span>
          </div>

          <p className="forecast-sim-desc">
            {isArabic
              ? "توزيع الدخل الشهري المتوقع وفق أفضل الممارسات المالية لتحقيق أهدافك الادخارية:"
              : "Distribution of expected monthly income according to financial best practices:"}
          </p>

          {/* 50/30/20 Breakdown Bars */}
          <div className="forecast-sim-bars-group">
            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span>{t("dashboard.smartInsights.detailedForecast.simulators.need50")}</span>
                <span className="forecast-sim-bar-num">{needAmount.toLocaleString()} {isArabic ? "ر.س" : "SAR"}</span>
              </div>
              <div className="forecast-sim-bar-track">
                <div className="forecast-sim-bar-fill forecast-sim-bar-fill--blue" style={{ width: "50%" }} />
              </div>
            </div>

            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span className="forecast-sim-bar-label--highlight">
                  • {savingsRatio}% {isArabic ? "الادخار والاستثمار التلقائي:" : "Auto Savings & Investment:"}
                </span>
                <span className="forecast-sim-bar-num forecast-sim-bar-num--green">
                  {saveAmount.toLocaleString()} {isArabic ? "ر.س" : "SAR"}
                </span>
              </div>
              <div className="forecast-sim-bar-track">
                <div
                  className="forecast-sim-bar-fill forecast-sim-bar-fill--green"
                  style={{ width: `${savingsRatio}%` }}
                />
              </div>
            </div>

            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span>
                  {100 - 50 - savingsRatio}% {isArabic ? "المصروفات الشخصية والمرنة:" : "Discretionary Wants:"}
                </span>
                <span className="forecast-sim-bar-num">{wantAmount.toLocaleString()} {isArabic ? "ر.س" : "SAR"}</span>
              </div>
              <div className="forecast-sim-bar-track">
                <div
                  className="forecast-sim-bar-fill forecast-sim-bar-fill--orange"
                  style={{ width: `${100 - 50 - savingsRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Ratio Selector */}
          <div className="forecast-sim-control">
            <span className="forecast-sim-control__label">
              {t("dashboard.smartInsights.detailedForecast.simulators.adjustSavingsRatio")}
            </span>

            <div className="forecast-sim-chips">
              <button
                type="button"
                className={`forecast-sim-chip ${savingsRatio === 10 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setSavingsRatio(10)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chip10")}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${savingsRatio === 20 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setSavingsRatio(20)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chip20")}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${savingsRatio === 30 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setSavingsRatio(30)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chip30")}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${savingsRatio === 50 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setSavingsRatio(50)}
              >
                {t("dashboard.smartInsights.detailedForecast.simulators.chip50")}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="forecast-sim-save-btn"
            onClick={handleSave}
          >
            {isSaved ? <LuCheck /> : <LuBookmark />}
            <span>
              {isSaved
                ? (isArabic ? "تم حفظ السيناريو بنجاح" : "Scenario Saved")
                : t("dashboard.smartInsights.detailedForecast.simulators.saveScenarioBtn")}
            </span>
          </button>
        </>
      )}

      {/* =========================================
          TAB: EXPENSES ONLY (Optimizer)
      ========================================= */}
      {activeTab === "expenses" && (
        <>
          <div className="forecast-sim-header">
            <span className="forecast-sim-badge forecast-sim-badge--purple">
              <LuSparkles />
              <span>{t("dashboard.smartInsights.detailedForecast.simulators.expensesOptimizerTitle")}</span>
            </span>
          </div>

          <p className="forecast-sim-desc">
            {t("dashboard.smartInsights.detailedForecast.simulators.expensesOptimizerSub")}
          </p>

          {/* Expense Proportions */}
          <div className="forecast-sim-bars-group">
            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span>{t("dashboard.smartInsights.detailedForecast.simulators.fixedObligations")}</span>
              </div>
              <div className="forecast-sim-bar-track">
                <div className="forecast-sim-bar-fill forecast-sim-bar-fill--rose" style={{ width: "64%" }} />
              </div>
            </div>

            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span>{t("dashboard.smartInsights.detailedForecast.simulators.recurringBills")}</span>
              </div>
              <div className="forecast-sim-bar-track">
                <div className="forecast-sim-bar-fill forecast-sim-bar-fill--amber" style={{ width: "18%" }} />
              </div>
            </div>

            <div className="forecast-sim-bar-item">
              <div className="forecast-sim-bar-header">
                <span>{t("dashboard.smartInsights.detailedForecast.simulators.flexibleExpenses")}</span>
              </div>
              <div className="forecast-sim-bar-track">
                <div className="forecast-sim-bar-fill forecast-sim-bar-fill--cyan" style={{ width: "18%" }} />
              </div>
            </div>
          </div>

          {/* Compression Chips */}
          <div className="forecast-sim-control">
            <span className="forecast-sim-control__label">
              {t("dashboard.smartInsights.detailedForecast.simulators.flexibleReductionLabel")}:
            </span>

            <div className="forecast-sim-chips">
              <button
                type="button"
                className={`forecast-sim-chip ${expenseCompression === 10 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setExpenseCompression(10)}
              >
                10% {isArabic ? "خفض" : "Cut"}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${expenseCompression === 15 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setExpenseCompression(15)}
              >
                15% {isArabic ? "خفض" : "Cut"}
              </button>

              <button
                type="button"
                className={`forecast-sim-chip ${expenseCompression === 25 ? "forecast-sim-chip--active" : ""}`}
                onClick={() => setExpenseCompression(25)}
              >
                25% {isArabic ? "خفض" : "Cut"}
              </button>
            </div>
          </div>

          {/* Impact Banner */}
          <div className="forecast-sim-savings-pill">
            <span className="forecast-sim-savings-text">
              {isArabic
                ? `وفر مالي محقق لخط الأمان: +${savedAmount} ر.س`
                : `Achieved safety margin savings: +${savedAmount} SAR`}
            </span>
          </div>

          <button
            type="button"
            className="forecast-sim-save-btn"
            onClick={handleSave}
          >
            {isSaved ? <LuCheck /> : <LuCheck />}
            <span>
              {isSaved
                ? (isArabic ? "تم تطبيق الخطة بنجاح" : "Plan Applied")
                : t("dashboard.smartInsights.detailedForecast.simulators.applyPlanBtn")}
            </span>
          </button>
        </>
      )}
    </div>
  );
}
