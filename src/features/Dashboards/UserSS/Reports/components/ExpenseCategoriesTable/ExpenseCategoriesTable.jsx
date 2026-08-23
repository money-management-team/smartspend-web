import { useTranslation } from "react-i18next";

import "./ExpenseCategoriesTable.css";

const categories = [
  {
    key: "travel",
    value: 640,
  },
  {
    key: "dining",
    value: 314,
  },
  {
    key: "groceries",
    value: 184,
  },
  {
    key: "software",
    value: 144,
  },
  {
    key: "utilities",
    value: 132,
  },
  {
    key: "health",
    value: 89,
  },
  {
    key: "transport",
    value: 62,
  },
];

export default function ExpenseCategoriesTable() {
  const { t } = useTranslation();

  return (
    <section className="expense-categories-table">
      <header className="expense-categories-table__header">
        <h2>
          {t(
            "dashboard.reports.expenseCategories",
          )}
        </h2>
      </header>

      <div className="expense-categories-table__body">
        {categories.map(
          (category) => (
            <div
              className="expense-category-row"
              key={category.key}
            >
              <span>
                {t(
                  `dashboard.reports.categories.${category.key}`,
                )}
              </span>

              <strong dir="ltr">
                $
                {category.value.toLocaleString(
                  "en-US",
                )}
              </strong>
            </div>
          ),
        )}
      </div>
    </section>
  );
}