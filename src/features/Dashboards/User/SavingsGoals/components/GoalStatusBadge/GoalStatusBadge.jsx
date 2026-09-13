import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { LuArchive, LuCircleCheck, LuPause } from "react-icons/lu";

import { translateEnum } from "../../../FinancialOperations/transactionHelpers";

import "./GoalStatusBadge.css";

const LIFECYCLE_ICONS = {
  paused: LuPause,
  achieved: LuCircleCheck,
  archived: LuArchive,
};

/*
 * One badge for either of the goal's two backend statuses, never derived
 * here:
 * - `kind="lifecycle"`: goal.status (active / paused / achieved / archived);
 * - `kind="progress"`: progress.status (not_started / in_progress /
 *   almost_there / achieved).
 * Unknown values are shown raw.
 */
export default function GoalStatusBadge({ kind = "lifecycle", status }) {
  const { t, i18n } = useTranslation();

  if (!status) return null;

  const prefix =
    kind === "progress" ? "dashboard.savingsGoals.progressStatus" : "dashboard.savingsGoals.status";
  const icon = kind === "lifecycle" ? LIFECYCLE_ICONS[status] : null;

  return (
    <span className={`goal-status-badge goal-status-badge--${kind}-${status}`}>
      {icon && createElement(icon, { "aria-hidden": "true" })}
      {translateEnum(t, i18n, prefix, status)}
    </span>
  );
}
