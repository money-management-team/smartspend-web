import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuClock, LuCircleCheck } from "react-icons/lu";

import ForecastHeader from "./components/ForecastHeader/ForecastHeader";
import ForecastKpiCards from "./components/ForecastKpiCards/ForecastKpiCards";
import ForecastBanner from "./components/ForecastBanner/ForecastBanner";
import ForecastChart from "./components/ForecastChart/ForecastChart";
import ForecastMilestonesTable from "./components/ForecastMilestonesTable/ForecastMilestonesTable";
import ForecastSimulator from "./components/ForecastSimulator/ForecastSimulator";

import "./FinancialForecast.css";

export default function FinancialForecast() {
  const { i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language)?.toLowerCase().startsWith("ar");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === "income" || initialTab === "expenses") {
      return initialTab;
    }
    return "all";
  });

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (newTab === "all") {
        updated.delete("tab");
      } else {
        updated.set("tab", newTab);
      }
      return updated;
    });
  };

  const [activeScenario, setActiveScenario] = useState("realistic");
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast(isArabic ? "تم تجهيز وتصدير التقرير المالي التوقعي بنجاح (PDF/CSV)" : "Forecast report exported successfully (PDF/CSV)");
    }, 1200);
  };

  const handleActionPrimary = () => {
    if (activeTab === "income") {
      showToast(isArabic ? "تم تفعيل الاستقطاع التلقائي للمحفظة الاستثمارية بنجاح" : "Auto-deduction for investment portfolio enabled");
    } else if (activeTab === "expenses") {
      showToast(isArabic ? "تمت جدولة التحويل الوقائي لتغطية ذروة الالتزامات" : "Protective funding scheduled for peak obligations");
    } else {
      showToast(isArabic ? "تم بدء إجراءات التحويل الوقائي لتأمين السيولة" : "Transfer initiated to secure liquidity margin");
    }
  };

  const handleActionSecondary = () => {
    if (activeTab === "income") {
      showToast(isArabic ? "جاري عرض تفاصيل خطة الادخار السنوية..." : "Opening annual savings plan details...");
    } else if (activeTab === "expenses") {
      showToast(isArabic ? "تم طلب تقسيم الفواتير وإعادة الجدولة" : "Rescheduling & split-bill request sent");
    } else {
      showToast(isArabic ? "تم تعديل موعد الاستقطاع بنجاح إلى 28 أغسطس" : "Auto-debit rescheduled to August 28");
    }
  };

  const handleSaveScenario = () => {
    showToast(isArabic ? "تم حفظ محاكاة السيناريو كميزانية بديلة معتمدة" : "Scenario saved as alternative active budget");
  };

  const handleViewAllOperations = () => {
    showToast(isArabic ? "عرض كافة الـ 18 عملية مالية المجدولة لشهر أغسطس" : "Showing all 18 scheduled operations for August");
  };

  return (
    <div className="financial-forecast-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="forecast-toast" role="status">
          <LuCircleCheck className="forecast-toast__icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Switchers */}
      <ForecastHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* 3 Top Dynamic KPI Cards */}
      <ForecastKpiCards activeTab={activeTab} />

      {/* Highlight Alert/Opportunity Banner */}
      <ForecastBanner
        activeTab={activeTab}
        onActionPrimary={handleActionPrimary}
        onActionSecondary={handleActionSecondary}
      />

      {/* Interactive Trajectory SVG Chart */}
      <ForecastChart activeTab={activeTab} />

      {/* Bottom Grid: Milestones Schedule Table + Scenario Simulator */}
      <div className="forecast-bottom-grid">
        <ForecastMilestonesTable
          activeTab={activeTab}
          onViewAll={handleViewAllOperations}
        />

        <ForecastSimulator
          activeTab={activeTab}
          onSaveScenario={handleSaveScenario}
        />
      </div>

      {/* Bottom Compliance & AI Footnote */}
      <footer className="forecast-compliance-footer">
        <LuClock className="forecast-compliance-footer__icon" />
        <p className="forecast-compliance-footer__text">
          {isArabic
            ? "تعتمد هذه التوقعات على خوارزميات التعلم الآلي وأنماط الإنفاق السابقة والعمليات البنكية المتكررة. البيانات مشفرة وتخضع لضوابط الخصوصية المصرفية المعتمدة."
            : "These forecasts rely on machine learning models, historical spending habits, and recurring bank transactions. All data is encrypted under strict banking privacy standards."}
        </p>
      </footer>
    </div>
  );
}
