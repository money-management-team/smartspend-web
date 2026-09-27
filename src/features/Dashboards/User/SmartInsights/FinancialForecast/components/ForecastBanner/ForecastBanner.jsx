import { useTranslation } from "react-i18next";
import { LuSparkles, LuTriangleAlert } from "react-icons/lu";
import "./ForecastBanner.css";

export default function ForecastBanner({
  activeTab = "all",
  onActionPrimary,
  onActionSecondary,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  let bannerData = {
    theme: "blue",
    icon: <LuSparkles />,
    tag: isArabic ? "تنبيه ذكي" : "Smart Alert",
    tagTheme: "amber",
    title: t("dashboard.smartInsights.detailedForecast.banners.allTitle"),
    desc: t("dashboard.smartInsights.detailedForecast.banners.allDesc"),
    btnPrimary: t("dashboard.smartInsights.detailedForecast.banners.allBtnTransfer"),
    btnSecondary: t("dashboard.smartInsights.detailedForecast.banners.allBtnAdjust"),
  };

  if (activeTab === "income") {
    bannerData = {
      theme: "blue",
      icon: <LuSparkles />,
      tag: isArabic ? "توصية ذكية" : "Smart Recommendation",
      tagTheme: "amber",
      title: t("dashboard.smartInsights.detailedForecast.banners.incomeTitle"),
      desc: t("dashboard.smartInsights.detailedForecast.banners.incomeDesc"),
      btnPrimary: t("dashboard.smartInsights.detailedForecast.banners.incomeBtnAuto"),
      btnSecondary: t("dashboard.smartInsights.detailedForecast.banners.incomeBtnPlan"),
    };
  } else if (activeTab === "expenses") {
    bannerData = {
      theme: "amber",
      icon: <LuTriangleAlert />,
      tag: isArabic ? "تنبيه ذكاء اصطناعي" : "AI Alert",
      tagTheme: "amber",
      title: t("dashboard.smartInsights.detailedForecast.banners.expensesTitle"),
      desc: t("dashboard.smartInsights.detailedForecast.banners.expensesDesc"),
      btnPrimary: t("dashboard.smartInsights.detailedForecast.banners.expensesBtnFund"),
      btnSecondary: t("dashboard.smartInsights.detailedForecast.banners.expensesBtnReschedule"),
    };
  }

  return (
    <div className={`forecast-banner forecast-banner--${bannerData.theme}`}>
      <div className="forecast-banner__content">
        <div className="forecast-banner__header-line">
          <div className="forecast-banner__title-wrapper">
            <span className={`forecast-banner__tag forecast-banner__tag--${bannerData.tagTheme}`}>
              {bannerData.tag}
            </span>
            <h3 className="forecast-banner__title">{bannerData.title}</h3>
          </div>
        </div>

        <p className="forecast-banner__desc">{bannerData.desc}</p>

        <div className="forecast-banner__actions">
          <button
            type="button"
            className="forecast-banner__btn forecast-banner__btn--primary"
            onClick={onActionPrimary}
          >
            {bannerData.btnPrimary}
          </button>

          <button
            type="button"
            className="forecast-banner__btn forecast-banner__btn--secondary"
            onClick={onActionSecondary}
          >
            {bannerData.btnSecondary}
          </button>
        </div>
      </div>

      <div className={`forecast-banner__icon-col forecast-banner__icon-col--${bannerData.theme}`}>
        <span className="forecast-banner__icon-circle">
          {bannerData.icon}
        </span>
      </div>
    </div>
  );
}
