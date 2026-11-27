import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { TONES } from "./tones.js";


/*
 * A Planning state (budget progress, budget or goal lifecycle, goal progress,
 * rule status) as the backend reports it. The known words have a translated
 * label; anything else is shown as sent ("Unknown status: x"), never mapped to
 * the nearest known word, so an unexpected state is not silently "active" or
 * "complete". A missing state says so.
 */
export default function PlanChip({ state, known }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  if (!state) return <span className="sm-chip sm-plan-chip" data-sm-tone="neutral" data-sm-state="missing">{t("planning.state.missing")}</span>;

  const label = known ? t(`planning.state.${state}`) : t("planning.state.unknown", { status: state.replace(/_/g, " ") });

  return (
    <span className="sm-chip sm-plan-chip" data-sm-tone={known ? TONES[state] ?? "neutral" : "neutral"} data-sm-state={known ? state : "unknown"}>
      {label}
    </span>
  );
}
