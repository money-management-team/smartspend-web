import { useTranslation } from "react-i18next";
import { LuArrowRight, LuSparkles, LuWallet } from "react-icons/lu";

import { GOAL_CURRENCIES, NAME_MAX, NOTES_MAX, getGoalProgress } from "../../../SavingsGoals/savingsGoalHelpers";
import { RHYTHMS } from "../../smartPlanWizardHelpers";

import "./GoalStep.css";

/*
 * Stage 1. A new goal: Free savings (the existing create form, unchanged)
 * or Smart savings (this wizard), then the goal's fields. An existing goal:
 * its figures read only — amount and date change through Edit goal — and
 * only the installment rhythm and first date are chosen here.
 *
 * `errors` maps a field to a validation key; `money` / `day` render values.
 */
export default function GoalStep({ goal, form, errors, onChange, onChooseFree, money, day }) {
  const { t } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlanWizard.goal";
  const fieldError = (field) =>
    errors[field] ? (
      <small id={`smart-wizard-${field}-error`} role="alert">
        {t(`dashboard.savingsGoals.smartPlanWizard.validation.${errors[field]}`, {
          max: field === "name" ? NAME_MAX : NOTES_MAX,
        })}
      </small>
    ) : null;
  const describedBy = (field, hint) =>
    [errors[field] && `smart-wizard-${field}-error`, hint && `smart-wizard-${field}-hint`].filter(Boolean).join(" ") ||
    undefined;
  const input = (field) => ({
    id: `smart-wizard-${field}`,
    value: form[field],
    onChange: (event) => onChange(field, event.target.value),
    "aria-invalid": errors[field] ? true : undefined,
  });

  const progress = goal ? getGoalProgress(goal) : null;

  return (
    <div className="goal-step">
      {!goal && (
        <fieldset className="goal-step__kinds">
          <legend>{t(`${prefix}.kindTitle`)}</legend>

          <button type="button" className="goal-step__kind" onClick={onChooseFree}>
            <span className="goal-step__kind-icon" aria-hidden="true">
              <LuWallet />
            </span>
            <span className="goal-step__kind-copy">
              <strong>{t(`${prefix}.free.title`)}</strong>
              <span>{t(`${prefix}.free.description`)}</span>
            </span>
            <LuArrowRight className="goal-step__kind-arrow" aria-hidden="true" />
          </button>

          <div className="goal-step__kind goal-step__kind--selected" aria-current="true">
            <span className="goal-step__kind-icon goal-step__kind-icon--smart" aria-hidden="true">
              <LuSparkles />
            </span>
            <span className="goal-step__kind-copy">
              <strong>{t(`${prefix}.smart.title`)}</strong>
              <span>{t(`${prefix}.smart.description`)}</span>
            </span>
            <span className="goal-step__kind-tag">{t(`${prefix}.smart.selected`)}</span>
          </div>
        </fieldset>
      )}

      {goal ? (
        <section className="goal-step__existing" aria-labelledby="goal-step-existing-title">
          <h2 id="goal-step-existing-title" dir="auto">
            {goal.name}
          </h2>
          <dl>
            <div>
              <dt>{t(`${prefix}.existing.target`)}</dt>
              <dd>{money(progress?.target_amount ?? goal.target_amount)}</dd>
            </div>
            <div>
              <dt>{t(`${prefix}.existing.saved`)}</dt>
              <dd>{money(progress?.saved_amount)}</dd>
            </div>
            <div>
              <dt>{t(`${prefix}.existing.remaining`)}</dt>
              <dd>{money(progress?.remaining_amount)}</dd>
            </div>
            <div>
              <dt>{t(`${prefix}.existing.targetDate`)}</dt>
              <dd>{goal.target_date ? day(String(goal.target_date).slice(0, 10)) : t(`${prefix}.existing.noDate`)}</dd>
            </div>
          </dl>
          <p>{t(`${prefix}.existing.hint`)}</p>
        </section>
      ) : (
        <section className="goal-step__section" aria-labelledby="goal-step-details-title">
          <h2 id="goal-step-details-title">{t(`${prefix}.detailsTitle`)}</h2>

          <div className="goal-step__grid">
            <label className="goal-step__field goal-step__field--wide" htmlFor="smart-wizard-name">
              <span>{t("dashboard.savingsGoals.fields.name")}</span>
              <input {...input("name")} maxLength={NAME_MAX} autoComplete="off" aria-describedby={describedBy("name")} />
              {fieldError("name")}
            </label>

            <label className="goal-step__field" htmlFor="smart-wizard-target_amount">
              <span>{t("dashboard.savingsGoals.fields.targetAmount")}</span>
              <input
                {...input("target_amount")}
                inputMode="decimal"
                dir="ltr"
                autoComplete="off"
                aria-describedby={describedBy("target_amount")}
              />
              {errors.target_amount && (
                <small id="smart-wizard-target_amount-error" role="alert">
                  {t(`dashboard.transactions.validation.${errors.target_amount}`)}
                </small>
              )}
            </label>

            <label className="goal-step__field" htmlFor="smart-wizard-currency_code">
              <span>{t("dashboard.savingsGoals.fields.currency")}</span>
              <select {...input("currency_code")} aria-describedby={describedBy("currency_code")}>
                {GOAL_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              {fieldError("currency_code")}
            </label>

            <label className="goal-step__field" htmlFor="smart-wizard-target_date">
              <span>
                {t("dashboard.savingsGoals.fields.targetDate")} <em>{t(`${prefix}.optional`)}</em>
              </span>
              <input type="date" {...input("target_date")} aria-describedby={describedBy("target_date", true)} />
              <small id="smart-wizard-target_date-hint" className="goal-step__hint">
                {t(`${prefix}.targetDateHint`)}
              </small>
              {fieldError("target_date")}
            </label>

            <label className="goal-step__field goal-step__field--wide" htmlFor="smart-wizard-notes">
              <span>
                {t("dashboard.savingsGoals.fields.notes")} <em>{t(`${prefix}.optional`)}</em>
              </span>
              <textarea {...input("notes")} rows={2} maxLength={NOTES_MAX} aria-describedby={describedBy("notes")} />
              {fieldError("notes")}
            </label>
          </div>
        </section>
      )}

      <section className="goal-step__section" aria-labelledby="goal-step-rhythm-title">
        <h2 id="goal-step-rhythm-title">{t(`${prefix}.rhythmTitle`)}</h2>
        <p className="goal-step__lead">{t(`${prefix}.rhythmHint`)}</p>

        <fieldset className="goal-step__rhythms">
          <legend className="goal-step__sr-only">{t(`${prefix}.rhythmTitle`)}</legend>
          {Object.keys(RHYTHMS).map((rhythm) => (
            <label key={rhythm} className={`goal-step__rhythm${form.rhythm === rhythm ? " goal-step__rhythm--checked" : ""}`}>
              <input
                type="radio"
                name="smart-wizard-rhythm"
                value={rhythm}
                checked={form.rhythm === rhythm}
                onChange={() => onChange("rhythm", rhythm)}
              />
              <span>{t(`${prefix}.rhythms.${rhythm}`)}</span>
            </label>
          ))}
        </fieldset>
        {fieldError("rhythm")}

        <label className="goal-step__field goal-step__field--narrow" htmlFor="smart-wizard-start_date">
          <span>
            {t(`${prefix}.startDate`)} <em>{t(`${prefix}.optional`)}</em>
          </span>
          <input type="date" {...input("start_date")} aria-describedby={describedBy("start_date", true)} />
          <small id="smart-wizard-start_date-hint" className="goal-step__hint">
            {t(`${prefix}.startDateHint`)}
          </small>
          {fieldError("start_date")}
        </label>
      </section>
    </div>
  );
}
