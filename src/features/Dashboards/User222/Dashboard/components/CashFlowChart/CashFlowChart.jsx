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
import { formatMoney } from "../../../utils/formatters";

function CashFlowTooltip({ active, payload, label, currency }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  if (!active || !payload?.length) return null;

  return (
    <div className="cash-flow-tooltip">
      <strong>{label}</strong>
      <span>
        {t("dashboard.user.cashFlow.income")}: {formatMoney(payload[0]?.value, currency, locale)}
      </span>
      <span>
        {t("dashboard.user.cashFlow.expense")}: {formatMoney(payload[1]?.value, currency, locale)}
      </span>
    </div>
  );
}

export default function CashFlowChart({ totals, period }) {
  const { t } = useTranslation();

  const data = [
    {
      label: period?.preset ?? t("dashboard.user.hero.month"),
      income: Number(totals?.income || 0),
      expense: Number(totals?.expense || 0),
    },
  ];
  const maximum = Math.max(data[0].income, data[0].expense, 1);

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
                <stop offset="0%" stopColor="var(--chart-green)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--chart-green)" stopOpacity={0.02} />
              </linearGradient>

              <linearGradient id="cashFlowExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-orange)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-orange)" stopOpacity={0.02} />
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
              domain={[0, Math.ceil(maximum * 1.2)]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value / 1000}k`}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            />

            <Tooltip content={<CashFlowTooltip currency={totals?.currency_code ?? "ILS"} />} />

            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--chart-green)"
              strokeWidth={2.5}
              fill="url(#cashFlowIncomeFill)"
              activeDot={{ r: 4 }}
            />

            <Area
              type="monotone"
              dataKey="expense"
              stroke="var(--chart-orange)"
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
