import {
  LuPlus,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./RecurringHeader.css";

export default function RecurringHeader() {
  const { t } = useTranslation();

  const handleAddIncome = () => {
    console.log("Add recurring income");
  };

  const handleAddExpense = () => {
    console.log("Add recurring expense");
  };

  return (
    <header className="recurring-header">
      <div className="recurring-header__copy">
        <h1>
          {t("dashboard.recurring.title")}
        </h1>

        <p>
          {t("dashboard.recurring.subtitle")}
        </p>
      </div>

      <div className="recurring-header__actions">
        <button
          type="button"
          className="recurring-header__button recurring-header__button--secondary"
          onClick={handleAddIncome}
        >
          <LuPlus />

          <span>
            {t(
              "dashboard.recurring.actions.addIncome",
            )}
          </span>
        </button>

        <button
          type="button"
          className="recurring-header__button recurring-header__button--primary"
          onClick={handleAddExpense}
        >
          <LuPlus />

          <span>
            {t(
              "dashboard.recurring.actions.addExpense",
            )}
          </span>
        </button>
      </div>
    </header>
  );
}