import { useTranslation } from "react-i18next";
import { LuPencil, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatAllocation, getSmartPlanErrorMessage } from "../../../SavingsGoals/smartPlanHelpers";
import { STEPS, percentToBps } from "../../smartPlanWizardHelpers";

import "./ReviewStep.css";

/*
 * Stage 4: everything that will be created, from the values the user chose
 * and the option the backend proposed — nothing recomputed. Creating needs
 * the explicit approval below; accepting a plan moves no money.
 *
 * `summary` is { name, targetAmount, currency, targetDate, existing };
 * `failure` is the last creation error ({ error, kind, step }).
 */
export default function ReviewStep({
  summary,
  option,
  funding,
  accountsById,
  accepted,
  onAcceptedChange,
  onEdit,
  failure,
  disabled,
  money,
  day,
  locale,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlanWizard.review";
  const intensity = translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", option.intensity);
  const interval = Number(option.interval) || 1;
  const rhythmKey = `dashboard.savingsGoals.smartPlanWizard.plan.per.${option.frequency === "weekly" ? "weekly" : "monthly"}${
    interval > 1 ? "Every" : ""
  }`;

  const editButton = (step) => (
    <button type="button" className="review-step__edit" onClick={() => onEdit(STEPS.indexOf(step))} aria-label={t(`${prefix}.edit.${step}`)}>
      <LuPencil aria-hidden="true" />
      <span>{t(`${prefix}.editLabel`)}</span>
    </button>
  );

  return (
    <div className="review-step">
      {failure && (
        <div
          className={`review-step__failure review-step__failure--${failure.kind === "unknown" ? "warning" : "danger"}`}
          role="alert"
        >
          <LuTriangleAlert aria-hidden="true" />
          <div>
            <p dir="auto">
              {failure.kind === "unknown"
                ? t(`${prefix}.unknownOutcome`)
                : getSmartPlanErrorMessage(failure.error, t, i18n, "create")}
            </p>
            {failure.step && (
              <button type="button" onClick={() => onEdit(STEPS.indexOf(failure.step))}>
                {t(`${prefix}.fix.${failure.step}`)}
              </button>
            )}
          </div>
        </div>
      )}

      <section className="review-step__card review-step__card--goal" aria-labelledby="review-goal-title">
        <header>
          <h2 id="review-goal-title">{t(`${prefix}.goalTitle`)}</h2>
          {!summary.existing && editButton("goal")}
        </header>
        <dl className="review-step__facts">
          <div>
            <dt>{t("dashboard.savingsGoals.fields.name")}</dt>
            <dd dir="auto">{summary.name}</dd>
          </div>
          <div>
            <dt>{t("dashboard.savingsGoals.fields.targetAmount")}</dt>
            <dd>{money(summary.targetAmount)}</dd>
          </div>
          <div>
            <dt>{t("dashboard.savingsGoals.fields.targetDate")}</dt>
            <dd>{summary.targetDate ? day(summary.targetDate) : t(`${prefix}.noTargetDate`)}</dd>
          </div>
        </dl>
      </section>

      <section className="review-step__card review-step__card--plan" aria-labelledby="review-plan-title">
        <header>
          <h2 id="review-plan-title">{t(`${prefix}.planTitle`, { intensity })}</h2>
          {editButton("plan")}
        </header>
        <p className="review-step__amount">
          <strong>{money(option.installment_amount)}</strong> <span>{t(rhythmKey, { count: interval })}</span>
        </p>
        <dl className="review-step__facts">
          <div>
            <dt>{t("dashboard.savingsGoals.smartPlanWizard.plan.installments")}</dt>
            <dd>
              <bdi>{new Intl.NumberFormat(locale).format(Number(option.installment_count) || 0)}</bdi>
            </dd>
          </div>
          <div>
            <dt>{t(`${prefix}.firstInstallment`)}</dt>
            <dd>{day(option.first_due_date)}</dd>
          </div>
          <div>
            <dt>{t(`${prefix}.lastInstallment`)}</dt>
            <dd>{day(option.expected_completion_date)}</dd>
          </div>
          {option.final_installment_amount != null && option.final_installment_amount !== option.installment_amount && (
            <div>
              <dt>{t("dashboard.savingsGoals.smartPlanWizard.plan.finalInstallment")}</dt>
              <dd>{money(option.final_installment_amount)}</dd>
            </div>
          )}
          <div>
            <dt>{t(`${prefix}.affordability`)}</dt>
            <dd>
              {/* Under the "Affordability" label, the unknown band reads "Not known yet", not "Affordability unknown". */}
              {(option.affordability?.band ?? "unknown") === "unknown"
                ? t(`${prefix}.affordabilityUnknown`)
                : t(`dashboard.savingsGoals.smartPlanWizard.plan.bands.${option.affordability.band}`, {
                    defaultValue: t(`${prefix}.affordabilityUnknown`),
                  })}{" "}
              <em>{t("dashboard.savingsGoals.smartPlanWizard.plan.estimate")}</em>
            </dd>
          </div>
        </dl>
      </section>

      <section className="review-step__card review-step__card--funding" aria-labelledby="review-funding-title">
        <header>
          <h2 id="review-funding-title">{t(`${prefix}.fundingTitle`)}</h2>
          {editButton("funding")}
        </header>
        <p className="review-step__mode">{t(`dashboard.savingsGoals.smartPlan.funding.modes.${funding.mode}`)}</p>
        {funding.mode === "at_confirmation" ? (
          <p className="review-step__muted">{t(`${prefix}.atConfirmation`)}</p>
        ) : (
          <ol className="review-step__sources">
            {funding.sources.map((source, index) => (
              <li key={source.account_id}>
                {funding.mode === "priority" && <span className="review-step__order">{index + 1}</span>}
                <span dir="auto">{accountsById.get(String(source.account_id))?.name ?? `#${source.account_id}`}</span>
                {funding.mode === "allocated" && (
                  <bdi dir="ltr">{formatAllocation(percentToBps(source.percent), locale)}</bdi>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="review-step__assurance" role="note">
        <LuShieldCheck aria-hidden="true" />
        <div>
          <strong>{t(`${prefix}.noMoneyTitle`)}</strong>
          <p>{t(`${prefix}.noMoneyBody`)}</p>
        </div>
      </div>

      <label className="review-step__accept">
        <input type="checkbox" checked={accepted} disabled={disabled} onChange={(event) => onAcceptedChange(event.target.checked)} />
        <span>{t(`${prefix}.accept`)}</span>
      </label>
    </div>
  );
}
