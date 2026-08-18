import {
  RadialBar,
  RadialBarChart,
} from "recharts";

import "./GoalProgress.css";

export default function GoalProgress({
  value,
}) {
  const data = [
    {
      value,
      fill: "var(--chart-blue)",
    },
  ];

  return (
    <div
      className="goal-progress"
      aria-label={`${value}%`}
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
        />
      </RadialBarChart>

      <strong className="goal-progress__value">
        {value}%
      </strong>
    </div>
  );
}