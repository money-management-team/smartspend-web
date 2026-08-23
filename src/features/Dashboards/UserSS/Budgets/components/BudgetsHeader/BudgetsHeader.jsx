import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./BudgetsHeader.css";

export default function BudgetsHeader() {
  const { t } = useTranslation();

  const handleCreateBudget = () => {
    console.log("Create budget");
  };

  return (
    <header className="budgets-header">
      <div className="budgets-header__copy">
        <h1>
          {t("dashboard.budgets.title")}
        </h1>

        <p>
          {t("dashboard.budgets.subtitle")}
        </p>
      </div>

      <button
        type="button"
        className="budgets-header__button"
        onClick={handleCreateBudget}
      >
        <LuPlus />

        <span>
          {t("dashboard.budgets.create")}
        </span>
      </button>
    </header>
  );
}