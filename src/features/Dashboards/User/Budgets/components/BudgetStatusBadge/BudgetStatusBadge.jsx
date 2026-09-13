import { useTranslation } from "react-i18next";
import { LuArchive } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { getProgressStatus } from "../../budgetHelpers";

import "./BudgetStatusBadge.css";

/*
 * The backend's progress status (safe / warning / near_limit / exceeded), or
 * the "Archived" state with `archived`. The status is never derived here.
 */
export default function BudgetStatusBadge({ status, archived = false }) {
  const { t, i18n } = useTranslation();

  if (archived) {
    return (
      <span className="budget-status-badge budget-status-badge--archived">
        <LuArchive aria-hidden="true" />
        {t("dashboard.budgets.status.archived")}
      </span>
    );
  }

  if (!status) return null;

  return (
    <span className={`budget-status-badge budget-status-badge--${getProgressStatus({ status })}`}>
      {translateEnum(t, i18n, "dashboard.budgets.progressStatus", status)}
    </span>
  );
}
