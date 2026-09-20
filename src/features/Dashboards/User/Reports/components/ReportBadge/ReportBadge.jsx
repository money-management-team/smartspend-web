import { useTranslation } from "react-i18next";

import { getValueLabel } from "../../reportHelpers";

import "./ReportBadge.css";

// Tone of a backend status / type / direction. Unknown values stay neutral.
const TONES = {
  positive: ["safe", "achieved", "active", "posted", "income", "receivable", "paid", "completed", "operating"],
  warning: ["warning", "near_limit", "almost_there", "paused", "due", "scheduled", "partially_paid", "in_progress"],
  danger: ["exceeded", "overdue", "failed", "expense", "payable"],
  muted: ["archived", "cancelled", "skipped", "not_started", "inactive"],
};

const getTone = (value) =>
  Object.keys(TONES).find((tone) => TONES[tone].includes(value)) ?? "neutral";

export default function ReportBadge({ value }) {
  const { t, i18n } = useTranslation();

  if (value == null || value === "") return <span className="report-badge report-badge--neutral">—</span>;

  return (
    <span className={`report-badge report-badge--${getTone(String(value))}`}>
      {getValueLabel(value, t, i18n)}
    </span>
  );
}
