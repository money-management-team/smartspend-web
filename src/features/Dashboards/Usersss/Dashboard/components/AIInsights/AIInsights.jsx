import { useTranslation } from "react-i18next";
import {
  LuTrendingUp,
  LuSparkles,
  LuPiggyBank,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./AIInsights.css";

const insights = [
  { key: "dining", icon: LuTrendingUp, tone: "orange" },
  { key: "idle", icon: LuSparkles, tone: "blue" },
  { key: "goal", icon: LuPiggyBank, tone: "green" },
];

export default function AIInsights() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="ai-insights-card"
      title={t("dashboard.user.aiInsights.title")}
      action={
        <span className="ai-insights-card__assistant">
          {t("dashboard.user.aiInsights.assistant")}
        </span>
      }
    >
      <div className="ai-insights-card__list">
        {insights.map(({ key, icon: Icon, tone }) => (
          <article className="ai-insight" key={key}>
            <span className={`ai-insight__icon ai-insight__icon--${tone}`}>
              <Icon />
            </span>

            <div>
              <strong>{t(`dashboard.user.aiInsights.items.${key}.title`)}</strong>
              <p>{t(`dashboard.user.aiInsights.items.${key}.text`)}</p>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
