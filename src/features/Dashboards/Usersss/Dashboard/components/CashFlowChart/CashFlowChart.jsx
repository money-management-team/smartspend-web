import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SectionCard from "../shared/SectionCard";

import "./CashFlowChart.css";

const chartData = [
  { month: "jan", income: 8500, expense: 5600 },
  { month: "feb", income: 8200, expense: 6200 },
  { month: "mar", income: 9300, expense: 5900 },
  { month: "apr", income: 9100, expense: 6500 },
  { month: "may", income: 9700, expense: 6100 },
  { month: "jun", income: 10400, expense: 6900 },
  { month: "jul", income: 10000, expense: 6400 },
  { month: "aug", income: 11300, expense: 7000 },
];

function CashFlowTooltip({ active, payload, label }) {
  const { t } = useTranslation();

  if (!active || !payload?.length) return null;

  return (
    <div className="cash-flow-tooltip">
      <strong>{label}</strong>
      <span>
        {t("dashboard.user.cashFlow.income")}: ${payload[0]?.value?.toLocaleString()}
      </span>
      <span>
        {t("dashboard.user.cashFlow.expense")}: ${payload[1]?.value?.toLocaleString()}
      </span>
    </div>
  );
}

export default function CashFlowChart() {
  const { t } = useTranslation();

  const data = chartData.map((item) => ({
    ...item,
    label: t(`dashboard.user.months.${item.month}`),
  }));

  return (
    <SectionCard
      className="cash-flow-card"
      title={t("dashboard.user.cashFlow.title")}
      subtitle={t("dashboard.user.cashFlow.subtitle")}
    >
      <div className="cash-flow-card__chart" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cashFlowIncomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>

              <linearGradient id="cashFlowExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            />

            <YAxis
              domain={[0, 12000]}
              ticks={[0, 3000, 6000, 9000, 12000]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value / 1000}k`}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            />

            <Tooltip content={<CashFlowTooltip />} />

            <Area
              type="monotone"
              dataKey="income"
              stroke="#16a34a"
              strokeWidth={2.5}
              fill="url(#cashFlowIncomeFill)"
              activeDot={{ r: 4 }}
            />

            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#cashFlowExpenseFill)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
