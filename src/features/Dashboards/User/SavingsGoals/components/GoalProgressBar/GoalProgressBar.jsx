import { getProgressBarWidth } from "../../../Budgets/budgetHelpers";

import "./GoalProgressBar.css";

/*
 * Linear bar for `progress.percentage_funded`. Only the bar's width is
 * clamped to 0–100 %; `valueText` (the backend's real percentage, which can
 * exceed 100 when a goal is overfunded) is what assistive technology reads.
 */
export default function GoalProgressBar({ percentage, status, label, valueText, size = "md" }) {
  const width = getProgressBarWidth(percentage);

  return (
    <div
      className={`goal-progress-bar goal-progress-bar--${status || "unknown"} goal-progress-bar--${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-valuetext={valueText}
    >
      <span style={{ inlineSize: `${width}%` }} />
    </div>
  );
}
