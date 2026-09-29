import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import {
  GOAL_PROGRESS_STATUSES,
  GOAL_STATUSES,
  hasActiveGoalFilters,
} from "../../savingsGoalHelpers";

import "./SavingsGoalFilters.css";

/*
 * Backend filters for GET /savings-goals: lifecycle status, progress status
 * and currency. The page keeps them in the URL and resets to page 1 on change.
 */
export default function SavingsGoalFilters({ filters, currencies, onChange, onClear, disabled = false }) {
  const { t } = useTranslation();

  const handle = (event) => onChange({ [event.target.name]: event.target.value });

  return (
    <div className="savings-goal-filters" role="group" aria-label={t("dashboard.savingsGoals.filters.label")}>
      <label className="savings-goal-filters__field">
        <span>{t("dashboard.savingsGoals.fields.status")}</span>
        <select name="status" value={filters.status} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.savingsGoals.filters.allStatuses")}</option>
          {GOAL_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`dashboard.savingsGoals.status.${status}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="savings-goal-filters__field">
        <span>{t("dashboard.savingsGoals.fields.progressStatus")}</span>
        <select name="progress_status" value={filters.progress_status} onChange={handle} disabled={disabled}>
          <option value="">{t("dashboard.savingsGoals.filters.allProgress")}</option>
          {GOAL_PROGRESS_STATUSES.map((status) => (
            <option value={status} key={status}>
              {t(`dashboard.savingsGoals.progressStatus.${status}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="savings-goal-filters__field">
        <span>{t("dashboard.savingsGoals.fields.currency")}</span>
        <select name="currency_code" value={filters.currency_code} onChange={handle} disabled={disabled} dir="ltr">
          <option value="">{t("dashboard.savingsGoals.filters.allCurrencies")}</option>
          {currencies.map((currency) => (
            <option value={currency} key={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>

      {hasActiveGoalFilters(filters) && (
        <button type="button" className="savings-goal-filters__clear" onClick={onClear} disabled={disabled}>
          <LuX aria-hidden="true" />
          <span>{t("dashboard.savingsGoals.filters.clear")}</span>
        </button>
      )}
    </div>
  );
}
