import { useTranslation } from "react-i18next";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

import { getSmartPlanErrorMessage } from "../../smartPlanHelpers";
import { useInstallmentWrite } from "../../useInstallmentWrite";
import PlanDialog from "../PlanDialog/PlanDialog";

const POINTS = ["noMoney", "targetUnchanged", "notReplaced", "final"];

/*
 * Skips one open installment (POST …/skip). No money moves, the goal's
 * target and date don't change, and the amount is not spread over the other
 * installments: plan health shows what the schedule no longer covers. A
 * skip can't be undone, so it needs this explicit confirmation.
 */
export default function SkipInstallmentDialog({
  goal,
  plan,
  installment,
  disabled = false,
  money,
  day,
  onDone,
  onOutdated,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlan.skip";
  const { run, isRunning, failure } = useInstallmentWrite("skip", {
    goalId: goal.id,
    installmentId: installment.id,
    onOutdated,
  });

  const handleConfirm = async () => {
    if (disabled || isRunning) return;

    const data = await run({
      expected_plan_version: plan.plan_version,
      expected_lock_version: installment.lock_version,
    });

    if (data) onDone({ action: "skipped", sequence: installment.sequence });
  };

  return (
    <PlanDialog
      id="skip-installment"
      role="alertdialog"
      eyebrow={t(`${prefix}.eyebrow`, { number: installment.sequence })}
      title={t(`${prefix}.title`)}
      busy={isRunning}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isRunning} autoFocus>
            {t(`${prefix}.keep`)}
          </button>
          <button
            type="submit"
            className="plan-dialog__caution"
            onClick={handleConfirm}
            disabled={disabled || isRunning}
            aria-busy={isRunning || undefined}
          >
            {t(isRunning ? `${prefix}.running` : `${prefix}.submit`)}
          </button>
        </>
      }
    >
      {failure && (
        <div
          className={`plan-dialog__callout plan-dialog__callout--${failure.kind === "unknown" ? "warning" : "danger"}`}
          role="alert"
        >
          <LuTriangleAlert aria-hidden="true" />
          <div>
            <p dir="auto">{getSmartPlanErrorMessage(failure.error, t, i18n, "skip")}</p>
            {failure.kind === "stale" && <p>{t("dashboard.savingsGoals.smartPlan.reviewUpdated")}</p>}
          </div>
        </div>
      )}

      <dl className="plan-dialog__facts">
        <div>
          <dt>{t(`${prefix}.date`)}</dt>
          <dd>{day(installment.planned_date)}</dd>
        </div>
        <div>
          <dt>{t(`${prefix}.amount`)}</dt>
          <dd>{money(installment.amount)}</dd>
        </div>
        {goal.target_amount != null && (
          <div>
            <dt>{t(`${prefix}.target`)}</dt>
            <dd>{money(goal.target_amount)}</dd>
          </div>
        )}
      </dl>

      <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
        <LuInfo aria-hidden="true" />
        <ul>
          {POINTS.map((point) => (
            <li key={point}>{t(`${prefix}.points.${point}`)}</li>
          ))}
        </ul>
      </div>
    </PlanDialog>
  );
}
