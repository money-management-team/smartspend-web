import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import "./MonthlyReportChart.css";

function CustomTooltip({ active, payload, label }) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const byKey = Object.fromEntries(payload.map((item) => [item.dataKey, item.value]));

  return (
    <div className="monthly-report-tooltip">
      <strong>{label}</strong>
      {byKey.income !== undefined && (
        <span className="monthly-report-tooltip__income">
          {t("dashboard.reports.chart.income")}: {Number(byKey.income).toLocaleString("en-US")}
        </span>
      )}
      {byKey.expense !== undefined && (
        <span className="monthly-report-tooltip__expense">
          {t("dashboard.reports.chart.expenses")}: {Number(byKey.expense).toLocaleString("en-US")}
        </span>
      )}
    </div>
  );
}

export default function MonthlyReportChart({ activeReport, reportData }) {
  const { t } = useTranslation();
  const data = reportData.map((item) => ({
    ...item,
    label: `${t(`dashboard.reports.months.${item.monthKey}`)} ${item.year}`,
  }));
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));

  return (
    <section className="monthly-report">
      <header className="monthly-report__header">
        <h2>
          {activeReport === "income"
            ? t("dashboard.reports.chart.incomeReport")
            : activeReport === "expense"
              ? t("dashboard.reports.chart.expenseReport")
              : t("dashboard.reports.chart.monthlyReport")}
        </h2>
        <p>{t("dashboard.reports.chart.lastEightMonths")}</p>
      </header>

      <div className="monthly-report__chart" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -15, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} />
            <YAxis
              domain={[0, Math.ceil(maxValue * 1.15)]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 100) / 10}k` : value}
              tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            />
            <Tooltip cursor={{ fill: "color-mix(in srgb, var(--primary) 2.5%, transparent)" }} content={<CustomTooltip />} />

            {activeReport !== "expense" && (
              <Bar dataKey="income" fill="var(--chart-blue)" radius={[7, 7, 0, 0]} maxBarSize={43} />
            )}
            {activeReport !== "income" && (
              <Bar dataKey="expense" fill="var(--chart-orange)" radius={[7, 7, 0, 0]} maxBarSize={43} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
