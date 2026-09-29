import { LuChartPie, LuCircleCheck, LuCircleAlert, LuTriangleAlert } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { getDisplayLocale } from "../../../Accounts/accountHelpers";

import "./BudgetSummary.css";

/*
 * Counts of the listed budgets by the backend's progress status. Money isn't
 * totalled here: a general budget already includes the expenses of category
 * budgets in the same period, and budgets can use different currencies, so a
 * sum would double-count or mix currencies.
 */
export default function BudgetSummary({ counts, isPartial }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const items = [
    { key: "active", icon: LuChartPie, primary: true },
    { key: "onTrack", icon: LuCircleCheck, tone: "safe" },
    { key: "attention", icon: LuTriangleAlert, tone: "attention" },
    { key: "exceeded", icon: LuCircleAlert, tone: "exceeded" },
  ];

  return (
    <section className="budget-summary" aria-label={t("dashboard.budgets.summary.label")}>
      <div className="budget-summary__grid">
        {items.map(({ key, icon: Icon, primary, tone }) => (
          <article
            key={key}
            className={`budget-summary-card${primary ? " budget-summary-card--primary" : ""}${
              tone ? ` budget-summary-card--${tone}` : ""
            }`}
          >
            <div className="budget-summary-card__top">
              <span className="budget-summary-card__label">
                {t(`dashboard.budgets.summary.${key}`)}
              </span>
              <span className="budget-summary-card__icon" aria-hidden="true">
                <Icon />
              </span>
            </div>
            <strong className="budget-summary-card__amount">
              {new Intl.NumberFormat(locale).format(counts[key] ?? 0)}
            </strong>
          </article>
        ))}
      </div>

      {isPartial && <p className="budget-summary__hint">{t("dashboard.budgets.summary.pageHint")}</p>}
    </section>
  );
}
