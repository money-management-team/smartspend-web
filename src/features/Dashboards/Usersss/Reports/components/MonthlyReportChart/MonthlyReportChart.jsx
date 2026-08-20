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

const reportData = [
  {
    month: "jan",
    income: 8300,
    expense: 5500,
  },
  {
    month: "feb",
    income: 8000,
    expense: 6200,
  },
  {
    month: "mar",
    income: 9200,
    expense: 5900,
  },
  {
    month: "apr",
    income: 8900,
    expense: 6500,
  },
  {
    month: "may",
    income: 9700,
    expense: 6100,
  },
  {
    month: "jun",
    income: 10300,
    expense: 7000,
  },
  {
    month: "jul",
    income: 9900,
    expense: 6400,
  },
  {
    month: "aug",
    income: 11200,
    expense: 6900,
  },
];

function CustomTooltip({
  active,
  payload,
  label,
}) {
  const { t } = useTranslation();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="monthly-report-tooltip">
      <strong>
        {label}
      </strong>

      <span className="monthly-report-tooltip__income">
        {t(
          "dashboard.reports.chart.income",
        )}
        : $
        {payload[0]?.value?.toLocaleString(
          "en-US",
        )}
      </span>

      <span className="monthly-report-tooltip__expense">
        {t(
          "dashboard.reports.chart.expenses",
        )}
        : $
        {payload[1]?.value?.toLocaleString(
          "en-US",
        )}
      </span>
    </div>
  );
}

export default function MonthlyReportChart({
  activeReport,
}) {
  const { t } = useTranslation();

  const data = reportData.map(
    (item) => ({
      ...item,

      label: t(
        `dashboard.reports.months.${item.month}`,
      ),
    }),
  );

  return (
    <section className="monthly-report">
      <header className="monthly-report__header">
        <h2>
          {activeReport === "income"
            ? t(
                "dashboard.reports.chart.incomeReport",
              )
            : activeReport === "expense"
              ? t(
                  "dashboard.reports.chart.expenseReport",
                )
              : t(
                  "dashboard.reports.chart.monthlyReport",
                )}
        </h2>

        <p>
          {t(
            "dashboard.reports.chart.lastEightMonths",
          )}
        </p>
      </header>

      <div
        className="monthly-report__chart"
        dir="ltr"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 8,
              left: -15,
              bottom: 0,
            }}
            barGap={4}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e5e7eb"
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#7c8493",
                fontSize: 10,
              }}
            />

            <YAxis
              domain={[0, 12000]}
              ticks={[
                0,
                3000,
                6000,
                9000,
                12000,
              ]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) =>
                value === 0
                  ? "0k"
                  : `${value / 1000}k`
              }
              tick={{
                fill: "#7c8493",
                fontSize: 10,
              }}
            />

            <Tooltip
              cursor={{
                fill:
                  "rgba(37, 99, 235, 0.025)",
              }}
              content={
                <CustomTooltip />
              }
            />

            {activeReport !==
              "expense" && (
              <Bar
                dataKey="income"
                fill="#2563eb"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
                maxBarSize={43}
              />
            )}

            {activeReport !==
              "income" && (
              <Bar
                dataKey="expense"
                fill="#ea580c"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
                maxBarSize={43}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}