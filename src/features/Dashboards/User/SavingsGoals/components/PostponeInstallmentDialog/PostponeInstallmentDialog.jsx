import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

import { toDateOnly } from "../../savingsGoalHelpers";
import {
  getConflictContext,
  getPostponeBounds,
  getSmartPlanErrorMessage,
  isDateOnly,
  todayIn,
} from "../../smartPlanHelpers";
import { useInstallmentWrite } from "../../useInstallmentWrite";
import PlanDialog from "../PlanDialog/PlanDialog";

/*
 * Moves one open installment to a later date (POST …/postpone). No money
 * moves; the amount, the other installments and the plan stay as they are.
 *
 * The picker is bounded by the backend's rules (after the current date and
 * not in the past, before the next installment, not past the target date);
 * the backend re-checks all of them. A date 409 narrows the picker to what
 * the backend allows; any other 409 refetches the plan so the user retries
 * against the current versions.
 */
export default function PostponeInstallmentDialog({
  goal,
  plan,
  installment,
  timeZone,
  disabled = false,
  money,
  day,
  onDone,
  onOutdated,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlan.postpone";
  const [date, setDate] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const { run, isRunning, failure } = useInstallmentWrite("postpone", {
    goalId: goal.id,
    installmentId: installment.id,
    onOutdated,
  });

  const bounds = getPostponeBounds({
    installment,
    installments: plan.installments,
    targetDate: toDateOnly(goal.target_date) || plan.target_date,
    today: todayIn(timeZone),
  });
  // A schedule 409 says exactly how far the date can go.
  const serverLatest = getConflictContext(failure?.error, "latest_allowed_date");
  const max = [bounds.max, serverLatest].filter(isDateOnly).sort()[0] ?? null;
  const limitReached = failure?.error?.serverCode === "savings_installment_postpone_limit_reached";

  const dateError = !date
    ? "required"
    : !isDateOnly(date)
      ? "invalid"
      : bounds.min && date < bounds.min
        ? "tooEarly"
        : max && date > max
          ? "tooLate"
          : null;
  const fieldError = showErrors && dateError;
  const backendFieldError = failure?.error?.errors?.new_date?.[0];
  const canSubmit = !disabled && !isRunning && !limitReached && bounds.available;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setShowErrors(true);
    if (!canSubmit || dateError) return;

    const data = await run({
      expected_plan_version: plan.plan_version,
      expected_lock_version: installment.lock_version,
      new_date: date,
    });

    if (data) onDone({ action: "postponed", sequence: installment.sequence, date: data.installment?.planned_date ?? date });
  };

  return (
    <PlanDialog
      id="postpone-installment"
      eyebrow={t(`${prefix}.eyebrow`, { number: installment.sequence })}
      title={t(`${prefix}.title`)}
      busy={isRunning}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isRunning} autoFocus>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="postpone-installment-form"
            disabled={!canSubmit}
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
            <p dir="auto">{getSmartPlanErrorMessage(failure.error, t, i18n, "postpone")}</p>
            {failure.kind === "stale" && <p>{t("dashboard.savingsGoals.smartPlan.reviewUpdated")}</p>}
          </div>
        </div>
      )}

      <dl className="plan-dialog__facts">
        <div>
          <dt>{t(`${prefix}.currentDate`)}</dt>
          <dd>{day(installment.planned_date)}</dd>
        </div>
        {installment.original_planned_date && (
          <div>
            <dt>{t(`${prefix}.originalDate`)}</dt>
            <dd>{day(installment.original_planned_date)}</dd>
          </div>
        )}
        <div>
          <dt>{t(`${prefix}.amount`)}</dt>
          <dd>{money(installment.amount)}</dd>
        </div>
      </dl>

      {bounds.available ? (
        <form id="postpone-installment-form" className="postpone-installment__form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>{t(`${prefix}.newDate`)}</span>
            <input
              type="date"
              value={date}
              min={bounds.min ?? undefined}
              max={max ?? undefined}
              onChange={(event) => setDate(event.target.value)}
              disabled={isRunning || limitReached}
              aria-invalid={Boolean(fieldError || backendFieldError) || undefined}
              aria-describedby="postpone-installment-rules"
              required
            />
            {fieldError && (
              <small role="alert">
                {t(`${prefix}.errors.${fieldError}`)}{" "}
                {fieldError === "tooEarly" && day(bounds.min)}
                {fieldError === "tooLate" && day(max)}
              </small>
            )}
            {!fieldError && backendFieldError && <small role="alert" dir="auto">{backendFieldError}</small>}
          </label>
        </form>
      ) : (
        <div className="plan-dialog__callout plan-dialog__callout--warning" role="note">
          <LuInfo aria-hidden="true" />
          <p>{t(`${prefix}.noRoom`)}</p>
        </div>
      )}

      <div id="postpone-installment-rules" className="plan-dialog__callout" role="note">
        <LuInfo aria-hidden="true" />
        <div>
          <p>{t(`${prefix}.rulesTitle`)}</p>
          <ul>
            <li>
              {t(`${prefix}.rules.after`)} {day(installment.planned_date)}
            </li>
            {bounds.nextDate && (
              <li>
                {t(`${prefix}.rules.beforeNext`)} {day(bounds.nextDate)}
              </li>
            )}
            {bounds.targetDate && (
              <li>
                {t(`${prefix}.rules.byTarget`)} {day(bounds.targetDate)}
              </li>
            )}
            <li>{t(`${prefix}.rules.limited`)}</li>
            <li>{t(`${prefix}.rules.noMoney`)}</li>
          </ul>
          {Number(installment.postponed_count) > 0 && (
            <p className="postpone-installment__count">
              {t(`${prefix}.postponedSoFar`, { count: Number(installment.postponed_count) })}
            </p>
          )}
        </div>
      </div>
    </PlanDialog>
  );
}
