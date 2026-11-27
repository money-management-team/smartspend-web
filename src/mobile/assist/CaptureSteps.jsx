import { LuCheck } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * Where a capture is in its life, as three steps: the person's own (a photo or
 * a recording), SmartSpend reading it, and the person reviewing and
 * confirming. It makes visible what the screens already guarantee: reading
 * something never records an expense; only the last step, done by the person,
 * does. `first` is "photo" or "record"; `current` is 0, 1 or 2.
 */
export default function CaptureSteps({ first, current = 0 }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const labels = [t(first === "record" ? "captures.stepRecord" : "captures.stepPhoto"), t("captures.stepRead"), t("captures.stepReview")];

  return (
    <ol className="sm-stepper" aria-label={t("captures.stepsLabel")}>
      {labels.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "next";
        return (
          <li key={label} className="sm-stepper-item" data-sm-step-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="sm-stepper-dot" aria-hidden="true">{state === "done" ? <LuCheck /> : index + 1}</span>
            <span className="sm-stepper-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
