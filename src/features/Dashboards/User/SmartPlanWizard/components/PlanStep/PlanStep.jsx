import { useTranslation } from "react-i18next";
import { LuChartNoAxesColumn, LuInfo, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

import { getSmartPlanErrorMessage } from "../../../SavingsGoals/smartPlanHelpers";
import PlanOptionCard from "../PlanOptionCard/PlanOptionCard";

import "./PlanStep.css";

/*
 * Stage 2: the backend's Easy / Balanced / Intensive options for the goal
 * and rhythm from stage 1. Read only — previewing creates nothing.
 *
 * `preview` is { loading, data, error } for the current inputs; a change to
 * any input fetches a new preview and clears the choice. `stale` is the
 * verdict of a 409 at creation: the options shown are the regenerated ones
 * and the user must choose again.
 */
export default function PlanStep({
  preview,
  selected,
  onSelect,
  onRetry,
  onEditGoal,
  stale,
  money,
  day,
  locale,
}) {
  const { t, i18n } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlanWizard.plan";

  const staleBanner = stale && (
    <div className="plan-step__banner plan-step__banner--warning" role="alert">
      <LuRefreshCw aria-hidden="true" />
      <div>
        <strong>{t(`${prefix}.stale.title`)}</strong>
        <p>{t(`${prefix}.stale.${stale}`, { defaultValue: t(`${prefix}.stale.unavailable`) })}</p>
      </div>
    </div>
  );

  if (preview.loading) {
    return (
      <div className="plan-step">
        {staleBanner}
        <p className="plan-step__sr-only" role="status">
          {t(`${prefix}.loading`)}
        </p>
        <div className="plan-step__cards" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="plan-step__skeleton">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (preview.error) {
    const isValidation = preview.error.code === "VALIDATION_ERROR";

    return (
      <div className="plan-step">
        <div className="plan-step__banner plan-step__banner--danger" role="alert">
          <LuTriangleAlert aria-hidden="true" />
          <div>
            <strong>{t(`${prefix}.errorTitle`)}</strong>
            <p dir="auto">{getSmartPlanErrorMessage(preview.error, t, i18n, "load")}</p>
            <div className="plan-step__banner-actions">
              {isValidation ? (
                <button type="button" onClick={onEditGoal}>
                  {t(`${prefix}.editGoal`)}
                </button>
              ) : (
                <button type="button" onClick={onRetry}>
                  {t("common.retry")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = preview.data;
  if (!data) return null;

  const options = data.options ?? [];
  const capacity = data.capacity;
  const capacityStatus = capacity?.status ?? "unknown";
  const notes = [...(capacity?.warnings ?? []), ...(data.warnings ?? [])].filter((warning) =>
    i18n.exists(`${prefix}.capacity.warnings.${warning}`),
  );

  if (options.length === 0) {
    return (
      <div className="plan-step">
        {staleBanner}
        <div className="plan-step__empty">
          <h2>{t(`${prefix}.empty.title`)}</h2>
          <p>
            {t(`${prefix}.reasons.${data.recommendation_reason}`, {
              defaultValue: t(`${prefix}.empty.body`),
            })}
          </p>
          <button type="button" onClick={onEditGoal}>
            {t(`${prefix}.editGoal`)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plan-step">
      {staleBanner}

      <section className={`plan-step__capacity plan-step__capacity--${capacityStatus}`} aria-labelledby="plan-step-capacity-title">
        <span className="plan-step__capacity-icon" aria-hidden="true">
          <LuChartNoAxesColumn />
        </span>
        <div>
          <h2 id="plan-step-capacity-title">{t(`${prefix}.capacity.title`)}</h2>
          <p className="plan-step__capacity-value">
            {capacityStatus === "known" ? (
              <>
                {money(capacity.monthly_amount)} <span>{t(`${prefix}.capacity.perMonth`)}</span>
              </>
            ) : (
              t(`${prefix}.capacity.${capacityStatus}`, { defaultValue: t(`${prefix}.capacity.unknown`) })
            )}
          </p>
          <p className="plan-step__capacity-hint">{t(`${prefix}.capacity.disclaimer`)}</p>
          {notes.length > 0 && (
            <ul className="plan-step__capacity-notes">
              {notes.map((note) => (
                <li key={note}>{t(`${prefix}.capacity.warnings.${note}`)}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="plan-step__recommendation" role="note">
        <LuInfo aria-hidden="true" />
        <span>
          {t(`${prefix}.reasons.${data.recommendation_reason}`, {
            defaultValue: t(`${prefix}.reasons.none`),
          })}
        </span>
      </p>

      <fieldset className="plan-step__options">
        <legend className="plan-step__sr-only">{t(`${prefix}.chooseLabel`)}</legend>
        <div className="plan-step__cards">
          {options.map((option) => (
            <PlanOptionCard
              key={option.intensity}
              name="smart-wizard-intensity"
              option={option}
              recommended={option.intensity === data.recommended_intensity}
              checked={option.intensity === selected}
              onSelect={onSelect}
              money={money}
              day={day}
              locale={locale}
            />
          ))}
        </div>
      </fieldset>

      <p className="plan-step__footnote">{t(`${prefix}.footnote`)}</p>
    </div>
  );
}
