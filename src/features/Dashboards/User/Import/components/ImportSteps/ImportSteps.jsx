import { useTranslation } from "react-i18next";
import { LuCheck } from "react-icons/lu";

import { IMPORT_STEPS } from "../../importHelpers";

import "./ImportSteps.css";

// Progress of the wizard; `current` comes from the backend import's fields.
export default function ImportSteps({ current }) {
  const { t } = useTranslation();
  const currentIndex = Math.max(0, IMPORT_STEPS.indexOf(current));

  return (
    <ol className="import-steps" aria-label={t("dashboard.importPage.steps.label")}>
      {IMPORT_STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";

        return (
          <li
            key={step}
            className={`import-step import-step--${state}`}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="import-step__number">
              {state === "done" ? <LuCheck aria-hidden="true" /> : index + 1}
            </span>
            <span className="import-step__text">{t(`dashboard.importPage.steps.${step}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
