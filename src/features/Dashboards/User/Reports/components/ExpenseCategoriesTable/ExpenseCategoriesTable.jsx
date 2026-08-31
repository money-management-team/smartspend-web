import { useTranslation } from "react-i18next";
import "./ExpenseCategoriesTable.css";

function formatMoney(value, currency, language) {
  const locale = language?.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function ExpenseCategoriesTable({ categories, currency }) {
  const { t, i18n } = useTranslation();
  const expenseCategories = categories
    .filter((category) => category.type === "expense")
    .sort((a, b) => Number(b.total) - Number(a.total));

  return (
    <section className="expense-categories-table">
      <header className="expense-categories-table__header">
        <h2>{t("dashboard.reports.expenseCategories")}</h2>
      </header>

      <div className="expense-categories-table__body">
        {expenseCategories.length === 0 && (
          <div className="expense-category-row"><span>{t("dashboard.reports.states.noExpenseCategories")}</span></div>
        )}
        {expenseCategories.map((category) => (
          <div className="expense-category-row" key={category.category_id ?? category.name}>
            <span>{category.name}</span>
            <strong dir="ltr">{formatMoney(category.total, currency, i18n.resolvedLanguage || i18n.language)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
