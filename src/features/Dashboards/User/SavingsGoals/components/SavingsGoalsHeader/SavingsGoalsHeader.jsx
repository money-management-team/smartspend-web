import { LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import "./SavingsGoalsHeader.css";

/*
 * `goalCount` is the list's own `total` (goals matching the current filters);
 * null while it loads or after an error, when no count is shown.
 */
export default function SavingsGoalsHeader({ onNewGoal, goalCount = null, isFiltered = false }) {
  const { t, i18n } = useTranslation();

  return (
    <header className="savings-goals-header">
      <div className="savings-goals-header__copy">
        <h1>{t("dashboard.savingsGoals.title")}</h1>
        <p>{t("dashboard.savingsGoals.subtitle")}</p>

        {goalCount != null && (
          <span className="savings-goals-header__count">
            <span>
              {t(
                isFiltered
                  ? "dashboard.savingsGoals.overview.matchingGoals"
                  : "dashboard.savingsGoals.overview.totalGoals",
              )}
            </span>
            <strong>{new Intl.NumberFormat(i18n.language).format(goalCount)}</strong>
          </span>
        )}
      </div>

      <button type="button" className="savings-goals-header__button" onClick={onNewGoal}>
        <LuPlus aria-hidden="true" />
        <span>{t("dashboard.savingsGoals.newGoal")}</span>
      </button>
    </header>
  );
}
