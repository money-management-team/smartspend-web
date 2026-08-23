import { useTranslation } from "react-i18next";

import BudgetCard from "./BudgetCard";

import "./BudgetList.css";

const budgets = [
  {
    id: 1,
    key: "dining",
    spent: 522,
    limit: 600,
  },
  {
    id: 2,
    key: "groceries",
    spent: 612,
    limit: 900,
  },
  {
    id: 3,
    key: "transport",
    spent: 188,
    limit: 350,
  },
  {
    id: 4,
    key: "software",
    spent: 431,
    limit: 400,
  },
  {
    id: 5,
    key: "travel",
    spent: 640,
    limit: 1200,
  },
  {
    id: 6,
    key: "health",
    spent: 129,
    limit: 300,
  },
];

export default function BudgetList() {
  const { t } = useTranslation();

  return (
    <section className="budget-list">
      <header className="budget-list__header">
        <h2>
          {t(
            "dashboard.budgets.list.title",
          )}
        </h2>

        <p>
          {t(
            "dashboard.budgets.list.subtitle",
          )}
        </p>
      </header>

      <div className="budget-list__grid">
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
          />
        ))}
      </div>
    </section>
  );
}