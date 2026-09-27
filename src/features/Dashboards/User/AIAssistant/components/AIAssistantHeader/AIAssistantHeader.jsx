import { useTranslation } from "react-i18next";
import { LuChartColumn } from "react-icons/lu";

import "./AIAssistantHeader.css";

export default function AIAssistantHeader({ subtitle, onOpenInsights }) {
  const { t } = useTranslation();

  return (
    <header className="ai-assistant-header">
      <div className="ai-assistant-header__text">
        <h1 className="ai-assistant-header__title">
          {t("dashboard.aiAssistant.title")}
        </h1>

        <p className="ai-assistant-header__subtitle">
          {subtitle || t("dashboard.aiAssistant.subtitle")}
        </p>
      </div>

      <button
        type="button"
        className="ai-assistant-header__insights-btn"
        onClick={onOpenInsights}
      >
        <LuChartColumn className="ai-assistant-header__insights-icon" />
        <span>{t("dashboard.aiAssistant.smartInsightsCenter")}</span>
      </button>
    </header>
  );
}