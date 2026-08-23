import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./SavingsGoalsHeader.css";

export default function SavingsGoalsHeader() {
  const { t } = useTranslation();

  const handleNewGoal = () => {
    console.log("Create new saving goal");
  };

  return (
    <header className="savings-goals-header">
      <div className="savings-goals-header__copy">
        <h1>
          {t(
            "dashboard.savingsGoals.title",
          )}
        </h1>

        <p>
          {t(
            "dashboard.savingsGoals.subtitle",
          )}
        </p>
      </div>

      <button
        type="button"
        className="savings-goals-header__button"
        onClick={handleNewGoal}
      >
        <LuPlus />

        <span>
          {t(
            "dashboard.savingsGoals.newGoal",
          )}
        </span>
      </button>
    </header>
  );
}