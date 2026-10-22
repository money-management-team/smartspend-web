import { useTranslation } from "react-i18next";
import { LuCheck } from "react-icons/lu";

import { STEPS } from "../../smartPlanWizardHelpers";

import "./WizardStepper.css";

/*
 * The four stages. Earlier stages can be revisited; later ones open only
 * through Continue, which checks the current stage first.
 */
export default function WizardStepper({ current, onSelect }) {
  const { t } = useTranslation();
  const prefix = "dashboard.savingsGoals.smartPlanWizard.steps";

  return (
    <nav className="wizard-stepper" aria-label={t(`${prefix}.label`)}>
      <p className="wizard-stepper__count">
        {t(`${prefix}.count`, { current: current + 1, total: STEPS.length })}
      </p>

      <ol className="wizard-stepper__list">
        {STEPS.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "upcoming";

          return (
            <li key={step} className={`wizard-stepper__item wizard-stepper__item--${state}`}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={index >= current}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className="wizard-stepper__dot" aria-hidden="true">
                  {state === "done" ? <LuCheck /> : index + 1}
                </span>
                <span className="wizard-stepper__label">{t(`${prefix}.${step}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
