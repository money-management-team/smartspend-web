import { useTranslation } from "react-i18next";
import { LuChartNoAxesCombined, LuLightbulb, LuMessagesSquare, LuSettings2, LuSparkles } from "react-icons/lu";

import "./AssistantTopbar.css";

const x = "dashboard.aiAssistant.extra";
const TABS = [
  { id: "chat", icon: LuMessagesSquare },
  { id: "insights", icon: LuLightbulb },
  { id: "forecast", icon: LuChartNoAxesCombined },
  { id: "settings", icon: LuSettings2 },
];

/*
 * Page title, assistant status and the view switcher in one compact strip,
 * so the working area (chat, insights, …) starts near the top of the page.
 */
export default function AssistantTopbar({ tab, onTabChange, status }) {
  const { t } = useTranslation();

  return (
    <header className="ai-topbar">
      <div className="ai-topbar__identity">
        <span className="ai-topbar__mark" aria-hidden="true">
          <LuSparkles />
        </span>

        <div className="ai-topbar__copy">
          <h1>{t("dashboard.aiAssistant.title")}</h1>
          <p>{t("dashboard.aiAssistant.subtitle")}</p>
        </div>

        <span className={`ai-topbar__status ai-topbar__status--${status}`} role="status">
          <span className="ai-topbar__status-dot" aria-hidden="true" />
          {status === "loading" ? t(`${x}.loading`) : status === "ready" ? t(`${x}.ready`) : t(`${x}.needsActivation`)}
        </span>
      </div>

      <nav className="ai-topbar__tabs" aria-label={t(`${x}.tabsLabel`)}>
        {TABS.map(({ id, icon: Icon }) => (
          <button
            type="button"
            key={id}
            data-ai-tab={id}
            className={`ai-topbar__tab ${tab === id ? "ai-topbar__tab--active" : ""}`}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => onTabChange(id)}
          >
            <Icon aria-hidden="true" />
            <span>{t(`${x}.${id}`)}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
