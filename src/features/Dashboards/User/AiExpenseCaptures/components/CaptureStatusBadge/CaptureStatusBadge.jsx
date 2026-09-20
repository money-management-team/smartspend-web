import { useTranslation } from "react-i18next";

import { AI_CAPTURE_STATUS } from "../../captureConstants";

import "./CaptureStatusBadge.css";

/*
 * An AI capture's status. Separate from ImportStatusBadge on purpose: the two
 * features share the name `ready_for_review` but nothing else, and merging
 * them would tie two unrelated lifecycles (and two sets of translations)
 * together.
 *
 * Tones follow what the status means for the user's money:
 * - `confirmed` is the only one where a transaction exists → success;
 * - `ready_for_review` needs the user → the brand tone, so it stands out as
 *   the actionable one;
 * - `failed` → danger;
 * - the backend is still working, or the capture is closed → neutral tones.
 */
const TONES = {
  [AI_CAPTURE_STATUS.UPLOADED]: "neutral",
  [AI_CAPTURE_STATUS.QUEUED]: "neutral",
  [AI_CAPTURE_STATUS.PROCESSING]: "info",
  [AI_CAPTURE_STATUS.READY_FOR_REVIEW]: "action",
  [AI_CAPTURE_STATUS.FAILED]: "danger",
  [AI_CAPTURE_STATUS.CONFIRMED]: "success",
  [AI_CAPTURE_STATUS.DISCARDED]: "muted",
};

export default function CaptureStatusBadge({ status }) {
  const { t, i18n } = useTranslation();

  if (status == null || status === "") return null;

  // An undocumented status is shown as the backend sent it, in the neutral
  // tone, rather than being reinterpreted or crashing the row.
  const key = `dashboard.aiCaptures.statuses.${status}`;
  const label = i18n.exists(key) ? t(key) : String(status);

  return (
    <span
      className={`capture-status capture-status--${TONES[status] ?? "neutral"}`}
      dir="auto"
    >
      {label}
    </span>
  );
}
