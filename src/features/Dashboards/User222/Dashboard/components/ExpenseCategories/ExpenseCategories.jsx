import { useTranslation } from "react-i18next";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import SectionCard from "../shared/SectionCard";

import "./ExpenseCategories.css";
import { formatMoney } from "../../../utils/formatters";

const colors = [
  "var(--chart-blue)",
  "var(--chart-green)",
  "var(--chart-orange)",
  "var(--chart-purple)",
  "var(--chart-red)",
];

export default function ExpenseCategories({ categories, currency = "ILS" }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  const data = categories
    .filter((item) => item.type === "expense")
    .map((item, index) => ({
      ...item,
      value: Number(item.total || 0),
      color: item.color || colors[index % colors.length],
    }));

  return (
    <SectionCard
      className="expense-categories-card"
      title={t("dashboard.user.expenseCategories.title")}
    >
      <div className="expense-categories-card__chart" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(value) => [formatMoney(value, currency, locale), t("dashboard.user.expenseCategories.amount")]} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={1.5}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="expense-categories-card__legend">
        {data.map((item) => (
          <li key={item.category_id}>
            <span
              className="expense-categories-card__dot"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
            <strong>{formatMoney(item.value, currency, locale)}</strong>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
