import { useTranslation } from "react-i18next";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import SectionCard from "../shared/SectionCard";

import "./ExpenseCategories.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatMoney } from "../../../utils/formatters";
import { formatOptionalMoney } from "../../dashboardHelpers";

const colors = [
  "var(--chart-blue)",
  "var(--chart-green)",
  "var(--chart-orange)",
  "var(--chart-purple)",
  "var(--chart-red)",
];

/*
 * Expense rows of `breakdown.by_category`. Rows in another currency than the
 * primary one are listed with their own currency but left out of the chart,
 * so amounts in different currencies never share one pie.
 */
export default function ExpenseCategories({ categories, currency }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  const rows = categories
    .filter((item) => item?.type === "expense" || item?.type == null)
    .map((item, index) => ({
      ...item,
      currency: item.currency_code || currency,
      color: item.color || colors[index % colors.length],
    }));
  const chartRows = rows
    .filter((item) => !currency || item.currency === currency)
    .map((item) => ({ ...item, value: Math.abs(Number(item.total) || 0) }))
    .filter((item) => item.value > 0);
  const hasOtherCurrencies = rows.some((item) => currency && item.currency !== currency);

  return (
    <SectionCard
      className="expense-categories-card"
      title={t("dashboard.user.expenseCategories.title")}
      subtitle={currency ? t("dashboard.user.expenseCategories.subtitle", { currency }) : undefined}
    >
      {rows.length === 0 ? (
        <p className="expense-categories-card__empty">{t("dashboard.user.expenseCategories.empty")}</p>
      ) : (
        <>
          {chartRows.length > 0 && (
            <div className="expense-categories-card__chart" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value) => [
                      formatMoney(value, currency, locale),
                      t("dashboard.user.expenseCategories.amount"),
                    ]}
                  />
                  <Pie
                    data={chartRows}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={1.5}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  >
                    {chartRows.map((item, index) => (
                      <Cell key={item.category_id ?? index} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <ul className="expense-categories-card__legend">
            {rows.map((item, index) => (
              <li key={`${item.category_id ?? index}-${item.currency ?? ""}`}>
                <span className="expense-categories-card__dot" style={{ backgroundColor: item.color }} />
                <span dir="auto">{item.name ?? t("dashboard.user.expenseCategories.uncategorized")}</span>
                <strong>{formatOptionalMoney(item.total, item.currency, locale)}</strong>
              </li>
            ))}
          </ul>

          {hasOtherCurrencies && (
            <p className="expense-categories-card__note">{t("dashboard.user.expenseCategories.otherCurrencies")}</p>
          )}
        </>
      )}
    </SectionCard>
  );
}
