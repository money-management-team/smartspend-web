import { useTranslation } from "react-i18next";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import SectionCard from "../shared/SectionCard";

import "./ExpenseCategories.css";

const categories = [
  { key: "travel", value: 640, color: "var(--chart-blue)" },
  { key: "dining", value: 314, color: "var(--chart-green)" },
  { key: "groceries", value: 184, color: "var(--chart-orange)" },
  { key: "software", value: 144, color: "var(--chart-purple)" },
  { key: "utilities", value: 132, color: "var(--chart-red)" },
];

export default function ExpenseCategories() {
  const { t } = useTranslation();

  const data = categories.map((item) => ({
    ...item,
    name: t(`dashboard.user.categories.${item.key}`),
  }));

  return (
    <SectionCard
      className="expense-categories-card"
      title={t("dashboard.user.expenseCategories.title")}
    >
      <div className="expense-categories-card__chart" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(value) => [`$${value}`, t("dashboard.user.expenseCategories.amount")]} />
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
        {categories.map((item) => (
          <li key={item.key}>
            <span
              className="expense-categories-card__dot"
              style={{ backgroundColor: item.color }}
            />
            <span>{t(`dashboard.user.categories.${item.key}`)}</span>
            <strong>{t(`dashboard.user.expenseCategories.values.${item.key}`)}</strong>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
