import {
  RadialBar,
  RadialBarChart,
} from "recharts";

import { getProgressBarWidth } from "../../../Budgets/budgetHelpers";

import "./GoalProgress.css";

/*
 * Radial view of `progress.percentage_funded`. Only the ring is clamped to
 * 0–100 %; the text is the backend's real percentage (`valueText`), which can
 * exceed 100 % for an overfunded goal.
 */
export default function GoalProgress({
  percentage,
  valueText,
  label,
  status,
}) {
  const data = [
    {
      value: getProgressBarWidth(percentage),
      fill: status === "achieved" ? "var(--color-success)" : "var(--chart-blue)",
    },
  ];

  return (
    <div
      className="goal-progress"
      role="img"
      aria-label={label ? `${label}: ${valueText}` : valueText}
    >
      <RadialBarChart
        width={108}
        height={108}
        cx="50%"
        cy="50%"
        innerRadius="78%"
        outerRadius="100%"
        barSize={8}
        data={data}
        startAngle={90}
        endAngle={90 - 360}
      >
        <RadialBar
          dataKey="value"
          cornerRadius={20}
          background={{
            fill: "var(--surface-soft)",
          }}
          isAnimationActive={false}
        />
      </RadialBarChart>

      <strong className="goal-progress__value" aria-hidden="true">
        <bdi>{valueText}</bdi>
      </strong>
    </div>
  );
}
