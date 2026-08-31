import { LuSigma, LuMinus, LuPlus } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import "./BudgetSummary.css";

function formatMoney(value, currency, language) {
  const locale = language?.toLowerCase().startsWith("ar") ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "ILS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function BudgetSummary({ summary }) {
  const { t, i18n } = useTranslation();
  const items = [
    { key: "monthly", amount: summary?.limit, icon: LuSigma, primary: true },
    { key: "spent", amount: summary?.spent, icon: LuMinus },
    { key: "remaining", amount: summary?.remaining, icon: LuPlus },
  ];

  return (
    <section className="budget-summary">
      {items.map(({ key, amount, icon: Icon, primary }) => (
        <article key={key} className={`budget-summary-card ${primary ? "budget-summary-card--primary" : ""}`}>
          <div className="budget-summary-card__top">
            <span className="budget-summary-card__label">{t(`dashboard.budgets.summary.${key}`)}</span>
            <span className="budget-summary-card__icon"><Icon /></span>
          </div>
          <strong className="budget-summary-card__amount" dir="ltr">
            {formatMoney(amount, summary?.currency, i18n.resolvedLanguage || i18n.language)}
          </strong>
        </article>
      ))}
    </section>
  );
}
