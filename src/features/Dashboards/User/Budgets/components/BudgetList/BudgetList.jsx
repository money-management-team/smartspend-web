import { useTranslation } from "react-i18next";
import BudgetCard from "./BudgetCard";
import "./BudgetList.css";

export default function BudgetList({ budgets, onEdit, onArchive }) {
  const { t } = useTranslation();

  return (
    <section className="budget-list">
      <header className="budget-list__header">
        <h2>{t("dashboard.budgets.list.title")}</h2>
        <p>{t("dashboard.budgets.list.subtitle")}</p>
      </header>

      <div className="budget-list__grid">
        {budgets.length === 0 && <p className="budget-list__empty">{t("dashboard.budgets.states.empty")}</p>}
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            onEdit={() => onEdit?.(budget)}
            onArchive={() => onArchive?.(budget)}
          />
        ))}
      </div>
    </section>
  );
}
