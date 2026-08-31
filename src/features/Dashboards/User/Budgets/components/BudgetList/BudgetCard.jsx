import { LuPencil, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";

function formatMoney(value, currency, language) {
  const locale = language?.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function BudgetCard({ budget, onEdit, onArchive }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const spent = Number(budget.progress?.spent || 0);
  const limit = Number(budget.amount_limit || 0);
  const remaining = Number(budget.progress?.remaining ?? limit - spent);
  const percentage = Number(budget.progress?.percentage_used ?? (limit ? (spent / limit) * 100 : 0));
  const overBudget = budget.progress?.status === "exceeded" || percentage > 100;
  const progress = Math.min(Math.max(percentage, 0), 100);

  return (
    <article className={`budget-item ${overBudget ? "budget-item--over" : ""}`}>
      <div className="budget-item__title-row">
        <div>
          <h3>{budget.name}</h3>
          {budget.category?.name && <small className="budget-item__category">{budget.category.name}</small>}
        </div>

        <div className="budget-item__actions">
          <button type="button" className="budget-item__edit" onClick={onEdit} aria-label={t("dashboard.budgets.edit")}>
            <LuPencil />
          </button>
          <button type="button" className="budget-item__delete" onClick={onArchive} aria-label={t("dashboard.budgets.delete")}>
            <LuTrash2 />
          </button>
        </div>
      </div>

      <div className="budget-item__details">
        <span className="budget-item__spent" dir="ltr">
          {formatMoney(spent, budget.currency_code, language)} / {formatMoney(limit, budget.currency_code, language)}
        </span>

        {overBudget ? (
          <span className="budget-item__status budget-item__status--danger">{t("dashboard.budgets.overBudget")}</span>
        ) : (
          <span className="budget-item__status">
            {t("dashboard.budgets.remaining")} <bdi>{formatMoney(Math.max(remaining, 0), budget.currency_code, language)}</bdi>
          </span>
        )}
      </div>

      <div className={`budget-item__progress ${overBudget ? "budget-item__progress--danger" : ""}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}
