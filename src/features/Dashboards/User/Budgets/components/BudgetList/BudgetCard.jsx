import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuArchive, LuPencil } from "react-icons/lu";

import { getBudgetDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  canManageBudget,
  formatPercentage,
  getBudgetProgress,
  getBudgetScope,
  getPeriodState,
  isArchivedBudget,
  toPeriodDate,
} from "../../budgetHelpers";
import BudgetProgressBar from "../BudgetProgressBar/BudgetProgressBar";
import BudgetStatusBadge from "../BudgetStatusBadge/BudgetStatusBadge";

/*
 * One budget in the list. Every figure is the backend's own progress; when a
 * budget comes without progress, only its limit is shown. The whole card
 * opens the details page; Edit and Archive exist only while it is active.
 */
export default function BudgetCard({ budget, onEdit, onArchive }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const locale = getDisplayLocale(i18n.language);
  const progress = getBudgetProgress(budget);
  const isArchived = isArchivedBudget(budget);
  const canManage = canManageBudget(budget);
  const scope = getBudgetScope(budget);
  const currency = budget.currency_code || progress?.currency_code;
  const periodState = getPeriodState(progress);
  const money = (value) => formatMoney(value, currency, locale);
  const percentage = formatPercentage(progress?.percentage_used, locale);
  const isOverspent = isNegativeMoney(progress?.remaining);

  return (
    <article className={`budget-item${isArchived ? " budget-item--archived" : ""}`}>
      <div className="budget-item__title-row">
        <div className="budget-item__identity">
          {/* Stretched over the card: the card opens the details page, which
              links back to the list with the same filters. */}
          <Link
            className="budget-item__link"
            to={getBudgetDetailsPath(budget.id)}
            state={{ from: location.search }}
          >
            <h3 dir="auto">{budget.name}</h3>
          </Link>
          <small className="budget-item__category">
            {t(`dashboard.budgets.scopes.${scope}`)}
            {scope === "category" && budget.category?.name && (
              <>
                {" · "}
                <bdi>{budget.category.name}</bdi>
              </>
            )}
          </small>
        </div>

        {canManage && (
          <div className="budget-item__actions">
            <button
              type="button"
              className="budget-item__edit"
              onClick={onEdit}
              aria-label={t("dashboard.budgets.editNamed", { name: budget.name })}
              title={t("dashboard.budgets.edit")}
            >
              <LuPencil aria-hidden="true" />
            </button>
            <button
              type="button"
              className="budget-item__archive"
              onClick={onArchive}
              aria-label={t("dashboard.budgets.archiveNamed", { name: budget.name })}
              title={t("dashboard.budgets.archive")}
            >
              <LuArchive aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="budget-item__badges">
        {isArchived && <BudgetStatusBadge archived />}
        {progress?.status && <BudgetStatusBadge status={progress.status} />}
        {periodState && periodState !== "current" && (
          <span className="budget-item__period-state">
            {t(`dashboard.budgets.periodState.${periodState}`)}
          </span>
        )}
      </div>

      {progress ? (
        <>
          <div className="budget-item__details">
            <span className="budget-item__spent">
              {t("dashboard.budgets.fields.spent")}{" "}
              <bdi dir="ltr">{money(progress.spent)}</bdi>
              {" / "}
              <bdi dir="ltr">{money(progress.amount_limit)}</bdi>
            </span>
            <strong className={`budget-item__percent${isOverspent ? " budget-item__percent--danger" : ""}`}>
              <bdi>{percentage}</bdi>
            </strong>
          </div>

          <BudgetProgressBar
            percentage={progress.percentage_used}
            status={progress.status}
            label={t("dashboard.budgets.fields.percentageUsed")}
            valueText={percentage}
          />

          <div className="budget-item__foot">
            <span className={`budget-item__status${isOverspent ? " budget-item__status--danger" : ""}`}>
              {t("dashboard.budgets.fields.remaining")}{" "}
              <bdi dir="ltr">{money(progress.remaining)}</bdi>
            </span>
            <span className="budget-item__period">
              <bdi>{formatDate(toPeriodDate(budget.period_start), locale)}</bdi>
              {" – "}
              <bdi>{formatDate(toPeriodDate(budget.period_end), locale)}</bdi>
            </span>
          </div>
        </>
      ) : (
        <div className="budget-item__foot">
          <span className="budget-item__spent">
            {t("dashboard.budgets.fields.amountLimit")}{" "}
            <bdi dir="ltr">{money(budget.amount_limit)}</bdi>
          </span>
          <span className="budget-item__period">{t("dashboard.budgets.card.noProgress")}</span>
        </div>
      )}
    </article>
  );
}
