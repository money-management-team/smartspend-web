import { useTranslation } from "react-i18next";

import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";

import "./BudgetProgress.css";

const budgets = [
  { key: "dining", value: 87 },
  { key: "groceries", value: 68 },
  { key: "transport", value: 54 },
  { key: "software", value: 100, danger: true },
];

export default function BudgetProgress() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="budget-progress-card"
      title={t("dashboard.user.budgetProgress.title")}
      action={
        <button type="button" className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </button>
      }
    >
      <div className="budget-progress-card__list">
        {budgets.map((item) => (
          <div className="budget-progress-card__item" key={item.key}>
            <div className="budget-progress-card__meta">
              <strong>{t(`dashboard.user.categories.${item.key}`)}</strong>
              <span className={item.danger ? "budget-progress-card__danger" : ""}>
                {t(`dashboard.user.budgetProgress.values.${item.key}`)}
              </span>
            </div>

            <ProgressBar value={item.value} danger={item.danger} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
