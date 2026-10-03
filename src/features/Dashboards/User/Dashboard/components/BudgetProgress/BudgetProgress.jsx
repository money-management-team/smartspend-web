import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";
import { PATH, getBudgetDetailsPath } from "../../../../../../routes/Path";
import "./BudgetProgress.css";

export default function BudgetProgress({ budgets = [] }) {
  const { t } = useTranslation();
  const visibleBudgets = budgets.slice(0, 4);

  return (
    <SectionCard
      className="budget-progress-card"
      title={t("dashboard.user.budgetProgress.title")}
      action={
        <Link to={PATH.USER.BUDGETS} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      <div className="budget-progress-card__list">
        {visibleBudgets.length === 0 && (
          <p className="budget-progress-card__empty">{t("dashboard.user.budgetProgress.empty")}</p>
        )}
        {visibleBudgets.map((item) => {
          const value = Math.min(100, Math.max(0, Number(item.percentage_used || 0)));
          const danger = item.status === "exceeded";
          return (
            <div className="budget-progress-card__item" key={item.budget_id}>
              <div className="budget-progress-card__meta">
                {item.budget_id != null ? (
                  <Link to={getBudgetDetailsPath(item.budget_id)}>
                    <strong>{item.name}</strong>
                  </Link>
                ) : (
                  <strong>{item.name}</strong>
                )}
                <span className={danger ? "budget-progress-card__danger" : ""}>
                  {Number(item.percentage_used || 0).toFixed(1)}%
                </span>
              </div>
              <ProgressBar value={value} danger={danger} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
