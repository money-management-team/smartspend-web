import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";
import { PATH, getSavingsGoalDetailsPath } from "../../../../../../routes/Path";
import "./SavingsGoals.css";

export default function SavingsGoals({ goals = [] }) {
  const { t } = useTranslation();
  const visibleGoals = goals.slice(0, 3);

  return (
    <SectionCard
      className="savings-goals-card"
      title={t("dashboard.user.savingsGoals.title")}
      action={
        <Link to={PATH.USER.SAVINGS_GOALS} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      <div className="savings-goals-card__list">
        {visibleGoals.length === 0 && (
          <p className="savings-goals-card__empty">{t("dashboard.user.savingsGoals.empty")}</p>
        )}
        {visibleGoals.map((goal) => {
          const value = Math.min(100, Math.max(0, Number(goal.percentage_funded || 0)));
          return (
            <div className="savings-goals-card__item" key={goal.goal_id}>
              <div className="savings-goals-card__meta">
                {goal.goal_id != null ? (
                  <Link to={getSavingsGoalDetailsPath(goal.goal_id)}>
                    <strong>{goal.name}</strong>
                  </Link>
                ) : (
                  <strong>{goal.name}</strong>
                )}
                <span>{Number(goal.percentage_funded || 0).toFixed(1)}%</span>
              </div>
              <ProgressBar value={value} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
