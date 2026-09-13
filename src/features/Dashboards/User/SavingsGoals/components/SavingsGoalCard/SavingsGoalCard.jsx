import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuArchive, LuPencil, LuPlus } from "react-icons/lu";

import { getSavingsGoalDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatPercentage } from "../../../Budgets/budgetHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import {
  getGoalActions,
  getGoalCurrency,
  getGoalProgress,
  getGoalStatus,
  toDateOnly,
} from "../../savingsGoalHelpers";
import GoalProgress from "../GoalProgress/GoalProgress";
import GoalStatusBadge from "../GoalStatusBadge/GoalStatusBadge";

import "./SavingsGoalCard.css";

/*
 * One goal in the list. Every figure is the backend's own progress (saved,
 * remaining, percentage, status); nothing is calculated here. The whole card
 * opens the details page; the buttons follow the lifecycle status.
 */
export default function SavingsGoalCard({ goal, onContribute, onEdit, onArchive }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const progress = getGoalProgress(goal);
  const status = getGoalStatus(goal);
  const actions = getGoalActions(goal);
  const currency = getGoalCurrency(goal);
  const percentage = formatPercentage(progress?.percentage_funded, locale);
  const money = (value) =>
    value == null || value === "" ? "—" : <bdi dir="ltr">{formatMoney(value, currency, locale)}</bdi>;

  return (
    <article className={`saving-goal-card saving-goal-card--${status}`}>
      <div className="saving-goal-card__top">
        <GoalProgress
          percentage={progress?.percentage_funded}
          valueText={percentage}
          status={progress?.status}
          label={t("dashboard.savingsGoals.fields.percentageFunded")}
        />

        <div className="saving-goal-card__content">
          {/* Stretched over the card: the card opens the details page. */}
          <Link className="saving-goal-card__link" to={getSavingsGoalDetailsPath(goal.id)}>
            <h2 dir="auto">{goal.name}</h2>
          </Link>

          <div className="saving-goal-card__badges">
            <GoalStatusBadge kind="lifecycle" status={goal.status} />
            {progress?.status && progress.status !== goal.status && (
              <GoalStatusBadge kind="progress" status={progress.status} />
            )}
            {progress?.deadline_passed === true && status !== "achieved" && status !== "archived" && (
              <span className="saving-goal-card__deadline">
                {t("dashboard.savingsGoals.deadlinePassed")}
              </span>
            )}
          </div>

          <p>
            <span>{t("dashboard.savingsGoals.fields.savedAmount")}</span> {money(progress?.saved_amount)}
            <span className="saving-goal-card__separator">·</span>
            <span>{t("dashboard.savingsGoals.fields.targetAmount")}</span>{" "}
            {money(progress?.target_amount ?? goal.target_amount)}
          </p>

          <small className="saving-goal-card__meta">
            {progress && (
              <>
                {t("dashboard.savingsGoals.fields.remainingAmount")} {money(progress.remaining_amount)}
              </>
            )}
            {goal.target_date && (
              <>
                {progress && <span className="saving-goal-card__separator">·</span>}
                {t("dashboard.savingsGoals.fields.targetDate")}{" "}
                <bdi>{formatDate(toDateOnly(goal.target_date), locale)}</bdi>
              </>
            )}
          </small>

          {(actions.canContribute || actions.canEdit || actions.canArchive) && (
            <div className="saving-goal-card__actions">
              {actions.canContribute && (
                <button type="button" className="saving-goal-card__add" onClick={onContribute}>
                  <LuPlus aria-hidden="true" />
                  <span>{t("dashboard.savingsGoals.actions.contribute")}</span>
                </button>
              )}
              {actions.canEdit && (
                <button
                  type="button"
                  className="saving-goal-card__edit"
                  onClick={onEdit}
                  aria-label={t("dashboard.savingsGoals.actions.editNamed", { name: goal.name })}
                  title={t("dashboard.savingsGoals.actions.edit")}
                >
                  <LuPencil aria-hidden="true" />
                </button>
              )}
              {actions.canArchive && (
                <button
                  type="button"
                  className="saving-goal-card__archive"
                  onClick={onArchive}
                  aria-label={t("dashboard.savingsGoals.actions.archiveNamed", { name: goal.name })}
                  title={t("dashboard.savingsGoals.actions.archive")}
                >
                  <LuArchive aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
