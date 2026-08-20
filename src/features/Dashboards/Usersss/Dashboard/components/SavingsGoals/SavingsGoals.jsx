import { useTranslation } from "react-i18next";

import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";

import "./SavingsGoals.css";

const goals = [
  { key: "emergency", value: 73 },
  { key: "studio", value: 32 },
  { key: "macbook", value: 82 },
];

export default function SavingsGoals() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="savings-goals-card"
      title={t("dashboard.user.savingsGoals.title")}
      action={
        <button type="button" className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </button>
      }
    >
      <div className="savings-goals-card__list">
        {goals.map((goal) => (
          <div className="savings-goals-card__item" key={goal.key}>
            <div className="savings-goals-card__meta">
              <strong>{t(`dashboard.user.savingsGoals.items.${goal.key}`)}</strong>
              <span>{goal.value}%</span>
            </div>

            <ProgressBar value={goal.value} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
