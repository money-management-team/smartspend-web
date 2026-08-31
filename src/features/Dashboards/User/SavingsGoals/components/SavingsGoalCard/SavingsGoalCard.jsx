import { LuPencil, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import GoalProgress from "../GoalProgress/GoalProgress";
import SavingPlans from "../SavingPlans/SavingPlans";
import "./SavingsGoalCard.css";

function formatMoney(value, currency, language) {
  const locale = language?.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function SavingsGoalCard({ goal, onAddFunds, onEdit, onArchive }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const progress = Math.min(100, Math.max(0, Number(goal.progress?.percentage_funded || 0)));
  const saved = Number(goal.progress?.saved_amount || 0);
  const target = Number(goal.target_amount || goal.progress?.target_amount || 0);

  return (
    <article className={`saving-goal-card ${goal.plans ? "" : "saving-goal-card--compact"}`}>
      <div className="saving-goal-card__top">
        <GoalProgress value={Math.round(progress)} />

        <div className="saving-goal-card__content">
          <h2>{goal.name}</h2>
          <p>
            <span>{t("dashboard.savingsGoals.saved")}</span>{" "}
            <bdi>{formatMoney(saved, goal.currency_code, language)}</bdi>
            <span className="saving-goal-card__separator">·</span>
            <span>{t("dashboard.savingsGoals.target")}</span>{" "}
            <bdi>{formatMoney(target, goal.currency_code, language)}</bdi>
          </p>

          {goal.target_date && (
            <small className="saving-goal-card__date">
              {t("dashboard.savingsGoals.targetDateLabel")}: {goal.target_date}
            </small>
          )}

          <div className="saving-goal-card__actions">
            <button type="button" className="saving-goal-card__add" onClick={onAddFunds}>
              {t("dashboard.savingsGoals.addFunds")}
            </button>
            <button type="button" className="saving-goal-card__edit" onClick={onEdit} aria-label={t("dashboard.savingsGoals.edit")}>
              <LuPencil />
            </button>
            <button type="button" className="saving-goal-card__delete" onClick={onArchive} aria-label={t("dashboard.savingsGoals.delete")}>
              <LuTrash2 />
            </button>
          </div>
        </div>
      </div>

      {goal.plans && <SavingPlans plans={goal.plans} activePlan={goal.activePlan} />}
    </article>
  );
}
