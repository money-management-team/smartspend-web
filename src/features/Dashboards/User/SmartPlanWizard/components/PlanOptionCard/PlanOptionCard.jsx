import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuGauge } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatAllocation } from "../../../SavingsGoals/smartPlanHelpers";
import { isSelectableOption } from "../../smartPlanWizardHelpers";

import "./PlanOptionCard.css";

const isZero = (value) => /^-?0*(\.0*)?$/.test(String(value ?? "0").trim());

/*
 * One Easy / Balanced / Intensive option, exactly as the backend proposed
 * it: the installment amount, count and dates, the full schedule on demand,
 * and the affordability band — labelled an estimate, never a promise. An
 * option that can't reach the goal, or repeats another tier's schedule,
 * can't be chosen and says why.
 */
export default function PlanOptionCard({ option, recommended, checked, onSelect, money, day, locale, name }) {
  const { t, i18n } = useTranslation();
  const [showSchedule, setShowSchedule] = useState(false);
  const scheduleId = useId();
  const prefix = "dashboard.savingsGoals.smartPlanWizard.plan";

  const selectable = isSelectableOption(option);
  const intensity = translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", option.intensity);
  const band = option.affordability?.band ?? "unknown";
  const interval = Number(option.interval) || 1;
  const rhythmKey = `${prefix}.per.${option.frequency === "weekly" ? "weekly" : "monthly"}${interval > 1 ? "Every" : ""}`;
  const installments = Array.isArray(option.installments) ? option.installments : [];
  const share = formatAllocation(option.affordability?.share_of_capacity_bps, locale);
  const warnings = (option.warnings ?? []).filter(
    (warning) => warning !== option.status && !warning.startsWith("same_schedule_as_") && i18n.exists(`${prefix}.warnings.${warning}`),
  );

  return (
    <article
      className={`plan-option${checked ? " plan-option--checked" : ""}${selectable ? "" : " plan-option--disabled"}${
        recommended ? " plan-option--recommended" : ""
      }`}
    >
      <label className="plan-option__choice">
        <input
          type="radio"
          name={name}
          value={option.intensity}
          checked={checked}
          disabled={!selectable}
          onChange={() => onSelect(option.intensity)}
        />

        <span className="plan-option__head">
          <span className="plan-option__name">{intensity}</span>
          {recommended && <span className="plan-option__badge">{t(`${prefix}.recommended`)}</span>}
          <span className="plan-option__radio" aria-hidden="true" />
        </span>

        {option.is_feasible ? (
          <span className="plan-option__amount">
            <strong>{money(option.installment_amount)}</strong>
            <span>{t(rhythmKey, { count: interval })}</span>
          </span>
        ) : (
          <span className="plan-option__unavailable">
            {t(`${prefix}.status.${option.status}`, { defaultValue: t(`${prefix}.status.unavailable`) })}
          </span>
        )}
      </label>

      {option.is_feasible && (
        <dl className="plan-option__facts">
          <div>
            <dt>{t(`${prefix}.installments`)}</dt>
            <dd>
              <bdi>{new Intl.NumberFormat(locale).format(Number(option.installment_count) || 0)}</bdi>
            </dd>
          </div>
          <div>
            <dt>{t(`${prefix}.dates`)}</dt>
            <dd>
              {day(option.first_due_date)} <span aria-hidden="true">→</span> {day(option.expected_completion_date)}
            </dd>
          </div>
          {option.final_installment_amount != null && option.final_installment_amount !== option.installment_amount && (
            <div>
              <dt>{t(`${prefix}.finalInstallment`)}</dt>
              <dd>{money(option.final_installment_amount)}</dd>
            </div>
          )}
        </dl>
      )}

      {!option.is_feasible && option.shortfall_amount != null && !isZero(option.shortfall_amount) && (
        <p className="plan-option__note">
          {t(`${prefix}.shortfall`)} {money(option.shortfall_amount)}
        </p>
      )}

      {option.duplicate_of && (
        <p className="plan-option__note">
          {t(`${prefix}.duplicate`, {
            intensity: translateEnum(t, i18n, "dashboard.savingsGoals.overview.intensity", option.duplicate_of),
          })}
        </p>
      )}

      {option.is_feasible && (
        <div className={`plan-option__fit plan-option__fit--${band}`}>
          <p className="plan-option__fit-head">
            <LuGauge aria-hidden="true" />
            <span>{t(`${prefix}.bands.${band}`, { defaultValue: t(`${prefix}.bands.unknown`) })}</span>
            <em>{t(`${prefix}.estimate`)}</em>
          </p>
          {band !== "unknown" && option.affordability?.monthly_equivalent != null && (
            <p className="plan-option__fit-detail">
              {t(`${prefix}.monthlyEquivalent`)} {money(option.affordability.monthly_equivalent)}
              {share && (
                <>
                  {" · "}
                  {t(`${prefix}.shareOfRoom`, { share })}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="plan-option__warnings">
          {warnings.map((warning) => (
            <li key={warning}>{t(`${prefix}.warnings.${warning}`)}</li>
          ))}
        </ul>
      )}

      {option.is_feasible && installments.length > 0 && (
        <>
          <button
            type="button"
            className="plan-option__toggle"
            aria-expanded={showSchedule}
            aria-controls={scheduleId}
            onClick={() => setShowSchedule((value) => !value)}
          >
            <span>
              {t(showSchedule ? `${prefix}.hideSchedule` : `${prefix}.showSchedule`, { count: installments.length })}
            </span>
            <LuChevronDown aria-hidden="true" />
          </button>

          {showSchedule && (
            <ol id={scheduleId} className="plan-option__schedule">
              {installments.map((installment) => (
                <li key={installment.sequence}>
                  <span className="plan-option__schedule-seq">{installment.sequence}</span>
                  <span>{day(installment.date)}</span>
                  <span className="plan-option__schedule-amount">{money(installment.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </article>
  );
}
