import {
  LuSigma,
  LuMinus,
  LuPlus,
} from "react-icons/lu";

import { useTranslation } from "react-i18next";

import "./BudgetSummary.css";

const summaryItems = [
  {
    key: "monthly",
    amount: 3750,
    icon: LuSigma,
    primary: true,
  },
  {
    key: "spent",
    amount: 2522,
    icon: LuMinus,
  },
  {
    key: "remaining",
    amount: 1228,
    icon: LuPlus,
  },
];

function formatMoney(value, language) {
  const isArabic =
    language?.toLowerCase().startsWith("ar");

  if (isArabic) {
    return `$US ${new Intl.NumberFormat(
      "ar-EG",
    ).format(value)}`;
  }

  return `$${new Intl.NumberFormat(
    "en-US",
  ).format(value)}`;
}

export default function BudgetSummary() {
  const { t, i18n } = useTranslation();

  return (
    <section className="budget-summary">
      {summaryItems.map(
        ({
          key,
          amount,
          icon: Icon,
          primary,
        }) => (
          <article
            key={key}
            className={`budget-summary-card ${
              primary
                ? "budget-summary-card--primary"
                : ""
            }`}
          >
            <div className="budget-summary-card__top">
              <span className="budget-summary-card__label">
                {t(
                  `dashboard.budgets.summary.${key}`,
                )}
              </span>

              <span className="budget-summary-card__icon">
                <Icon />
              </span>
            </div>

            <strong
              className="budget-summary-card__amount"
              dir="ltr"
            >
              {formatMoney(
                amount,
                i18n.resolvedLanguage ||
                  i18n.language,
              )}
            </strong>
          </article>
        ),
      )}
    </section>
  );
}