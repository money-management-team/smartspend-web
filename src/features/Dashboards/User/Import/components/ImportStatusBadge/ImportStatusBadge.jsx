import { useTranslation } from "react-i18next";

import "./ImportStatusBadge.css";

const TONES = {
  positive: ["valid", "ready_for_review", "completed", "imported"],
  warning: ["mapping_required", "partially_valid", "duplicate", "mapped", "validating", "pending"],
  danger: ["invalid", "failed"],
  muted: ["ignored", "cancelled", "reversed"],
};

// An import or row status as sent by the backend; unknown values are shown
// as they are, never reinterpreted.
export default function ImportStatusBadge({ status }) {
  const { t, i18n } = useTranslation();
  const key = `dashboard.importPage.statuses.${status}`;
  const tone = Object.keys(TONES).find((name) => TONES[name].includes(status)) ?? "neutral";

  return (
    <span className={`import-status import-status--${tone}`}>
      {status == null || status === "" ? "—" : i18n.exists(key) ? t(key) : String(status)}
    </span>
  );
}
