import { createElement } from "react";
import { useTranslation } from "react-i18next";

import {
  LuArrowDownRight,
  LuArrowUpRight,
  LuScale,
} from "react-icons/lu";

import "./SummaryCards.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney, isNegativeAmount } from "../../dashboardHelpers";

const cards = [
  { key: "income", icon: LuArrowUpRight },
  { key: "expense", icon: LuArrowDownRight },
  { key: "net", icon: LuScale },
];

/*
 * Income, expense and net of the selected period, exactly as the backend
 * calculated them (`data.totals`). Transfers between the user's own accounts
 * are not part of these figures; they are reported separately.
 */
export default function SummaryCards({ totals }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  return (
    <section className="dashboard-summary-cards" aria-label={t("dashboard.user.summary.label")}>
      {cards.map(({ key, icon }) => {
        const value = totals?.[key];
        const tone = key === "net" && isNegativeAmount(value) ? " dashboard-summary-card__amount--negative" : "";

        return (
          <article className={`dashboard-summary-card dashboard-summary-card--${key}`} key={key}>
            <div className="dashboard-summary-card__content">
              <span className="dashboard-summary-card__label">
                {t(`dashboard.user.summary.${key}.label`)}
              </span>

              <div className={`dashboard-summary-card__amount${tone}`}>
                <strong>{formatOptionalMoney(value, totals?.currency_code, locale)}</strong>
              </div>

              <span className="dashboard-summary-card__hint">
                {t(`dashboard.user.summary.${key}.hint`)}
              </span>
            </div>

            <span className="dashboard-summary-card__icon">
              {createElement(icon)}
            </span>
          </article>
        );
      })}
    </section>
  );
}
