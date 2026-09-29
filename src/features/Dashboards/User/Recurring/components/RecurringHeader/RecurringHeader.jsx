import {
  LuPlus,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./RecurringHeader.css";

// Both buttons open the same form, preset to income or expense.
export default function RecurringHeader({ onAdd }) {
  const { t } = useTranslation();

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
          onClick={() => onAdd("income")}
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
          onClick={() => onAdd("expense")}
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
