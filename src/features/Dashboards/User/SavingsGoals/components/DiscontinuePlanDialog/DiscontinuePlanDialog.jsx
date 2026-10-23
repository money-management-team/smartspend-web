import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getSmartPlanErrorMessage } from "../../smartPlanHelpers";
import { usePlanWrite } from "../../usePlanWrite";
import PlanDialog from "../PlanDialog/PlanDialog";

import "./DiscontinuePlanDialog.css";

const POINTS = ["noMoney", "cancelled", "kept", "flexible", "final"];

/*
 * Ends the goal's active plan (POST …/plan/discontinue). No money moves:
 * open installments are cancelled, confirmed ones and the goal's balance
 * stay exactly as they are, and the goal is flexible saving again. A
 * discontinued plan can't be reopened (a new one can be created), so this
 * needs an explicit acknowledgement, tied to the plan version shown.
 *
 * The request names that `plan_version`. A plan that changed meanwhile
 * (409) is fetched again and the acknowledgement asked for again.
 */
export default function DiscontinuePlanDialog({
  goal,
  plan,
  health,
  balance,
  disabled = false,
  money,
  onDone,
  onOutdated,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.planManagement.discontinue";
  const [ack, setAck] = useState({ version: null, checked: false });
  const acknowledged = ack.checked && ack.version === plan.plan_version;
  const { run, isRunning, failure } = usePlanWrite("discontinue", { goalId: goal.id, onOutdated });

  const handleConfirm = async () => {
    if (disabled || isRunning || !acknowledged) return;

    const data = await run({ expected_plan_version: plan.plan_version });
    if (data) onDone(data);
  };

  const openCount = Number(health.outstanding_count) || 0;

  return (
    <PlanDialog
      id="discontinue-plan"
      role="alertdialog"
      eyebrow={t(`${prefix}.eyebrow`)}
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
            disabled={disabled || isRunning || !acknowledged}
            aria-busy={isRunning || undefined}
          >
            {t(isRunning ? `${prefix}.running` : failure?.kind === "unknown" ? `${prefix}.retry` : `${prefix}.submit`)}
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
            <p dir="auto">{getSmartPlanErrorMessage(failure.error, t, i18n, "discontinue")}</p>
            {failure.kind === "stale" && <p>{t("dashboard.savingsGoals.smartPlan.reviewUpdated")}</p>}
          </div>
        </div>
      )}

      <dl className="plan-dialog__facts">
        <div>
          <dt>{t(`${prefix}.facts.open`)}</dt>
          <dd>
            <bdi>{new Intl.NumberFormat(getDisplayLocale(i18n.language)).format(openCount)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t(`${prefix}.facts.scheduled`)}</dt>
          <dd>{money(health.outstanding_amount)}</dd>
        </div>
        <div>
          <dt>{t(`${prefix}.facts.saved`)}</dt>
          <dd>{money(balance.saved_amount)}</dd>
        </div>
      </dl>

      <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
        <LuInfo aria-hidden="true" />
        <ul>
          {POINTS.map((point) => (
            <li key={point}>{t(`${prefix}.points.${point}`, { count: openCount })}</li>
          ))}
        </ul>
      </div>

      <label className="discontinue-plan__ack">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAck({ version: plan.plan_version, checked: event.target.checked })}
          disabled={isRunning}
        />
        <span>{t(`${prefix}.acknowledge`)}</span>
      </label>
    </PlanDialog>
  );
}
