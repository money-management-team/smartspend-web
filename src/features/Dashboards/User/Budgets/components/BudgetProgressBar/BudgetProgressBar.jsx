import { getProgressBarWidth, getProgressStatus } from "../../budgetHelpers";

import "./BudgetProgressBar.css";

/*
 * Visual bar for `progress.percentage_used`. Only the bar's width is clamped
 * to 0–100 %; `valueText` (the real percentage, which can exceed 100) is what
 * assistive technology reads.
 */
export default function BudgetProgressBar({ percentage, status, label, valueText, size = "md" }) {
  const width = getProgressBarWidth(percentage);

  return (
    <div
      className={`budget-progress-bar budget-progress-bar--${getProgressStatus({ status })} budget-progress-bar--${size}`}
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
