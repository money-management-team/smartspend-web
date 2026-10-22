import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleHelp, LuSparkles, LuWallet } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";

import "./GoalPlanChip.css";

const ICONS = { smart: LuSparkles, flexible: LuWallet, unavailable: LuCircleHelp };

/*
 * Smart plan or flexible saving, from the goal's plan summary
 * (`smartSavings.toPlanSummary`). "unavailable" means the lookup failed, so
 * the chip says so instead of claiming the goal has no plan.
 */
export default function GoalPlanChip({ summary }) {
  const { t, i18n } = useTranslation();
  const state = summary?.state;

  if (!state) return null;

  if (state === "loading") {
    return (
      <span className="goal-plan-chip goal-plan-chip--loading" role="status">
        {t("dashboard.savingsGoals.overview.mode.loading")}
      </span>
    );
  }

  const intensity =
    state === "smart"
      ? translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", summary.intensity)
      : "";

  return (
    <span className={`goal-plan-chip goal-plan-chip--${state}`}>
      {ICONS[state] && createElement(ICONS[state], { "aria-hidden": "true" })}
      <span>{t(`dashboard.savingsGoals.overview.mode.${state}`)}</span>
      {intensity && (
        <>
          <span className="goal-plan-chip__dot" aria-hidden="true" />
          <span className="goal-plan-chip__intensity">{intensity}</span>
        </>
      )}
    </span>
  );
}
