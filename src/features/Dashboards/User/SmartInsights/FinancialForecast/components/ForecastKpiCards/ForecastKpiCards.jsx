import { useTranslation } from "react-i18next";
import {
  LuDollarSign,
  LuArrowDown,
  LuTrendingUp,
  LuCalendarCheck,
  LuShieldCheck,
  LuRotateCcw,
  LuTriangleAlert,
} from "react-icons/lu";
import "./ForecastKpiCards.css";

export default function ForecastKpiCards({ activeTab = "all" }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  if (activeTab === "income") {
    return (
      <div className="forecast-kpi-grid">
        {/* Card 1: Total Expected Income */}
        <div className="forecast-kpi-card forecast-kpi-card--green">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.income")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--green">
              <LuDollarSign />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">18,500</span>
            <span className="forecast-kpi-card__currency">{isArabic ? "ر.س" : "SAR"}</span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--green">
              <LuTrendingUp />
              <span>{t("dashboard.smartInsights.detailedForecast.kpi.incomeChange")}</span>
            </span>
            <span className="forecast-kpi-card__subtext">
              {t("dashboard.smartInsights.detailedForecast.kpi.salaryDate")}
            </span>
          </div>
        </div>

        {/* Card 2: Confirmed Deposits */}
        <div className="forecast-kpi-card forecast-kpi-card--blue">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.confirmedDeposits")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--blue">
              <LuCalendarCheck />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">2</span>
            <span className="forecast-kpi-card__currency">
              {isArabic ? "عمليات إيداع" : "Deposits"}
            </span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--blue">
              {t("dashboard.smartInsights.detailedForecast.kpi.depositsStatus")}
            </span>
            <span className="forecast-kpi-card__subtext">
              {t("dashboard.smartInsights.detailedForecast.kpi.depositsMeta")}
            </span>
          </div>
        </div>

        {/* Card 3: AI Certainty Score */}
        <div className="forecast-kpi-card forecast-kpi-card--purple">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.certaintyScore")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--purple">
              <LuShieldCheck />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">99.2%</span>
            <span className="forecast-kpi-card__sub-label">
              {t("dashboard.smartInsights.detailedForecast.kpi.certaintyLabel")}
            </span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--purple">
              {t("dashboard.smartInsights.detailedForecast.kpi.netFlowDesc")}
            </span>
            <span className="forecast-kpi-card__subtext">
              {isArabic ? "+6,250 ر.س فائض متوقع" : "+6,250 SAR surplus"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "expenses") {
    return (
      <div className="forecast-kpi-grid">
        {/* Card 1: Expected Expenses */}
        <div className="forecast-kpi-card forecast-kpi-card--rose">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.expenses")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--rose">
              <LuArrowDown />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">12,250</span>
            <span className="forecast-kpi-card__currency">{isArabic ? "ر.س" : "SAR"}</span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--gray">
              {t("dashboard.smartInsights.detailedForecast.kpi.expensesBreakdown")}
            </span>
            <span className="forecast-kpi-card__subtext">
              {t("dashboard.smartInsights.detailedForecast.kpi.expensesSafeCap")}
            </span>
          </div>
        </div>

        {/* Card 2: Confirmed Obligations */}
        <div className="forecast-kpi-card forecast-kpi-card--blue">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.confirmedExpenses")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--blue">
              <LuRotateCcw />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">6</span>
            <span className="forecast-kpi-card__currency">
              {isArabic ? "التزامات مجدولة" : "Obligations"}
            </span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--blue">
              {t("dashboard.smartInsights.detailedForecast.kpi.autoDebitCoverage")}
            </span>
            <span className="forecast-kpi-card__subtext">
              {t("dashboard.smartInsights.detailedForecast.kpi.obligationsTotal")}
            </span>
          </div>
        </div>

        {/* Card 3: Peak Outflow Window */}
        <div className="forecast-kpi-card forecast-kpi-card--amber">
          <div className="forecast-kpi-card__top">
            <span className="forecast-kpi-card__title">
              {t("dashboard.smartInsights.detailedForecast.kpi.peakExpenses")}
            </span>
            <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--amber">
              <LuTriangleAlert />
            </span>
          </div>

          <div className="forecast-kpi-card__amount-row">
            <span className="forecast-kpi-card__amount">21 - 24</span>
            <span className="forecast-kpi-card__currency">
              {isArabic ? "أغسطس 2024" : "August 2024"}
            </span>
          </div>

          <div className="forecast-kpi-card__footer">
            <span className="forecast-kpi-pill forecast-kpi-pill--amber">
              {t("dashboard.smartInsights.detailedForecast.kpi.liquidityStressStatus")}
            </span>
            <span className="forecast-kpi-card__subtext">
              {t("dashboard.smartInsights.detailedForecast.kpi.peakDetails")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default: "all" flows view
  return (
    <div className="forecast-kpi-grid">
      {/* Card 1: Total Expected Income */}
      <div className="forecast-kpi-card forecast-kpi-card--green">
        <div className="forecast-kpi-card__top">
          <span className="forecast-kpi-card__title">
            {t("dashboard.smartInsights.detailedForecast.kpi.income")}
          </span>
          <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--green">
            <LuDollarSign />
          </span>
        </div>

        <div className="forecast-kpi-card__amount-row">
          <span className="forecast-kpi-card__amount">18,500</span>
          <span className="forecast-kpi-card__currency">{isArabic ? "ر.س" : "SAR"}</span>
        </div>

        <div className="forecast-kpi-card__footer">
          <span className="forecast-kpi-pill forecast-kpi-pill--green">
            <LuTrendingUp />
            <span>{t("dashboard.smartInsights.detailedForecast.kpi.incomeChange")}</span>
          </span>
          <span className="forecast-kpi-card__subtext">
            {t("dashboard.smartInsights.detailedForecast.kpi.salaryDate")}
          </span>
        </div>
      </div>

      {/* Card 2: Expected Expenses */}
      <div className="forecast-kpi-card forecast-kpi-card--rose">
        <div className="forecast-kpi-card__top">
          <span className="forecast-kpi-card__title">
            {t("dashboard.smartInsights.detailedForecast.kpi.expenses")}
          </span>
          <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--rose">
            <LuArrowDown />
          </span>
        </div>

        <div className="forecast-kpi-card__amount-row">
          <span className="forecast-kpi-card__amount">12,250</span>
          <span className="forecast-kpi-card__currency">{isArabic ? "ر.س" : "SAR"}</span>
        </div>

        <div className="forecast-kpi-card__footer">
          <span className="forecast-kpi-pill forecast-kpi-pill--gray">
            {t("dashboard.smartInsights.detailedForecast.kpi.expensesBreakdown")}
          </span>
          <span className="forecast-kpi-card__subtext">
            {t("dashboard.smartInsights.detailedForecast.kpi.expensesSafeCap")}
          </span>
        </div>
      </div>

      {/* Card 3: Net Cash Flow */}
      <div className="forecast-kpi-card forecast-kpi-card--blue">
        <div className="forecast-kpi-card__top">
          <span className="forecast-kpi-card__title">
            {t("dashboard.smartInsights.detailedForecast.kpi.netFlow")}
          </span>
          <span className="forecast-kpi-card__icon-badge forecast-kpi-card__icon-badge--blue">
            <LuTrendingUp />
          </span>
        </div>

        <div className="forecast-kpi-card__amount-row">
          <span className="forecast-kpi-card__amount forecast-kpi-card__amount--surplus">
            +6,250
          </span>
          <span className="forecast-kpi-card__currency">{isArabic ? "ر.س" : "SAR"}</span>
        </div>

        <div className="forecast-kpi-card__footer">
          <span className="forecast-kpi-pill forecast-kpi-pill--blue">
            {t("dashboard.smartInsights.detailedForecast.kpi.netFlowDesc")}
          </span>
          <span className="forecast-kpi-card__subtext">
            {t("dashboard.smartInsights.detailedForecast.kpi.savingsOpp")}
          </span>
        </div>
      </div>
    </div>
  );
}
