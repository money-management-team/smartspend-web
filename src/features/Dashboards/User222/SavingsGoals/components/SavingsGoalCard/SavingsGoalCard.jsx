import {
  LuTrash2,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import GoalProgress from "../GoalProgress/GoalProgress";
import SavingPlans from "../SavingPlans/SavingPlans";

import "./SavingsGoalCard.css";

function formatMoney(
  value,
  language,
) {
  const isArabic =
    language
      ?.toLowerCase()
      .startsWith("ar");

  const formatted =
    new Intl.NumberFormat(
      isArabic
        ? "ar-EG"
        : "en-US",
    ).format(value);

  return isArabic
    ? `$US ${formatted}`
    : `$${formatted}`;
}

export default function SavingsGoalCard({
  goal,
}) {
  const { t, i18n } = useTranslation();

  const language =
    i18n.resolvedLanguage ||
    i18n.language;

  const handleAddFunds = () => {
    console.log(
      "Add funds:",
      goal.id,
    );
  };

  const handleDelete = () => {
    console.log(
      "Delete saving goal:",
      goal.id,
    );
  };

  return (
    <article className="saving-goal-card">
      {/* =========================
          TOP
      ========================= */}

      <div className="saving-goal-card__top">
        <GoalProgress
          value={goal.progress}
        />

        <div className="saving-goal-card__content">
          <h2>
            {t(
              `dashboard.savingsGoals.goals.${goal.key}`,
            )}
          </h2>

          <p>
            <span>
              {t(
                "dashboard.savingsGoals.saved",
              )}
            </span>

            {" "}

            <bdi>
              {formatMoney(
                goal.saved,
                language,
              )}
            </bdi>

            <span className="saving-goal-card__separator">
              ·
            </span>

            <span>
              {t(
                "dashboard.savingsGoals.target",
              )}
            </span>

            {" "}

            <bdi>
              {formatMoney(
                goal.target,
                language,
              )}
            </bdi>
          </p>

          <div className="saving-goal-card__actions">
            <button
              type="button"
              className="saving-goal-card__add"
              onClick={handleAddFunds}
            >
              {t(
                "dashboard.savingsGoals.addFunds",
              )}
            </button>

            <button
              type="button"
              className="saving-goal-card__delete"
              onClick={handleDelete}
              aria-label={t(
                "dashboard.savingsGoals.delete",
              )}
            >
              <LuTrash2 />
            </button>
          </div>
        </div>
      </div>

      {/* =========================
          AI PLANS
      ========================= */}

      <SavingPlans
        plans={goal.plans}
        activePlan={goal.activePlan}
      />
    </article>
  );
}