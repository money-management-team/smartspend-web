import { LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";

function formatNumber(
  number,
  language,
) {
  const isArabic =
    language?.toLowerCase().startsWith("ar");

  return new Intl.NumberFormat(
    isArabic
      ? "ar-EG"
      : "en-US",
  ).format(number);
}

export default function BudgetCard({
  budget,
}) {
  const { t, i18n } = useTranslation();

  const language =
    i18n.resolvedLanguage ||
    i18n.language;

  const overBudget =
    budget.spent > budget.limit;

  const remaining =
    Math.max(
      budget.limit - budget.spent,
      0,
    );

  const progress =
    Math.min(
      (budget.spent /
        budget.limit) *
        100,
      100,
    );

  const handleDelete = () => {
    console.log(
      "Delete budget",
      budget.id,
    );
  };

  return (
    <article
      className={`budget-item ${
        overBudget
          ? "budget-item--over"
          : ""
      }`}
    >
      <div className="budget-item__title-row">
        <h3>
          {t(
            `dashboard.budgets.categories.${budget.key}`,
          )}
        </h3>

        <button
          type="button"
          className="budget-item__delete"
          onClick={handleDelete}
          aria-label={t(
            "dashboard.budgets.delete",
          )}
        >
          <LuTrash2 />
        </button>
      </div>

      <div className="budget-item__details">
        <span
          className="budget-item__spent"
          dir="ltr"
        >
          $
          {formatNumber(
            budget.spent,
            language,
          )}
          {" / "}
          $
          {formatNumber(
            budget.limit,
            language,
          )}
        </span>

        {overBudget ? (
          <span className="budget-item__status budget-item__status--danger">
            {t(
              "dashboard.budgets.overBudget",
            )}
          </span>
        ) : (
          <span className="budget-item__status">
            {t(
              "dashboard.budgets.remaining",
            )}{" "}
            <bdi>
              $
              {formatNumber(
                remaining,
                language,
              )}
            </bdi>
          </span>
        )}
      </div>

      <div
        className={`budget-item__progress ${
          overBudget
            ? "budget-item__progress--danger"
            : ""
        }`}
      >
        <span
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
    </article>
  );
}