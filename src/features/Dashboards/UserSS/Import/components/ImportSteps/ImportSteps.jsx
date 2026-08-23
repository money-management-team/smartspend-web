import { useTranslation } from "react-i18next";

import "./ImportSteps.css";

const steps = [
  "upload",
  "extract",
  "review",
  "match",
  "confirm",
];

export default function ImportSteps() {
  const { t } = useTranslation();

  const activeStep = 1;

  return (
    <div
      className="import-steps"
      aria-label={t(
        "dashboard.importPage.steps.label",
      )}
    >
      {steps.map((step, index) => {
        const stepNumber =
          index + 1;

        const isActive =
          stepNumber === activeStep;

        return (
          <div
            key={step}
            className={`import-step ${
              isActive
                ? "import-step--active"
                : ""
            }`}
          >
            <span className="import-step__number">
              {stepNumber}
            </span>

            <span className="import-step__text">
              {t(
                `dashboard.importPage.steps.${step}`,
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}