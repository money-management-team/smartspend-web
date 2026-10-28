import { useTranslation } from "react-i18next";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";

/*
 * A state word the backend sent (the status of a debt, a transfer, a payment).
 * A known word has its label under `labels`; anything else is shown as sent
 * ("Unknown status: x"), never mapped to the nearest known one. `tones` maps a
 * known word to good | warn | bad | neutral.
 */
export default function StateChip({ state, known, labels, tones = {} }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);

  if (!state) return <span className="sm-chip sm-plan-chip" data-sm-tone="neutral" data-sm-state="missing">{t("planning.state.missing")}</span>;

  return (
    <span className="sm-chip sm-plan-chip" data-sm-tone={known ? tones[state] ?? "neutral" : "neutral"} data-sm-state={known ? state : "unknown"}>
      {known ? t(`${labels}.${state}`) : t("planning.state.unknown", { status: state.replace(/_/g, " ") })}
    </span>
  );
}

/** One label and value in a details list (a `dl` of `sm-stats`). */
export function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
