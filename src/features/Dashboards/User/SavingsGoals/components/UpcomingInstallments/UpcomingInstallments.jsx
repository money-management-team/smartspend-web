import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LuCalendarClock, LuChevronRight } from "react-icons/lu";

import { getSavingsGoalDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import PrivateMoney from "../../../Experience/PrivateMoney";
import { formatDate, formatMoney } from "../../../utils/formatters";
import { getGoalCurrency } from "../../savingsGoalHelpers";

import "./UpcomingInstallments.css";

/*
 * The next open installment of each smart plan on the current page
 * (`smartSavings.getUpcomingInstallments`). Read only: an installment moves
 * money only when its owner confirms it, from the goal's own page.
 */
export default function UpcomingInstallments({ items }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  if (!items?.length) return null;

  return (
    <section className="upcoming-installments" aria-labelledby="upcoming-installments-title">
      <header className="upcoming-installments__header">
        <span className="upcoming-installments__icon" aria-hidden="true">
          <LuCalendarClock />
        </span>
        <div>
          <h2 id="upcoming-installments-title">
            {t("dashboard.savingsGoals.overview.upcoming.title")}
          </h2>
          <p>{t("dashboard.savingsGoals.overview.upcoming.hint")}</p>
        </div>
      </header>

      <ol className="upcoming-installments__list">
        {items.map(({ goal, installment }) => (
          <li
            key={`${goal.id}:${installment.id}`}
            className={`upcoming-installments__item${
              installment.isOverdue ? " upcoming-installments__item--overdue" : ""
            }`}
          >
            <Link to={getSavingsGoalDetailsPath(goal.id)}>
              <span className="upcoming-installments__date">
                <bdi>{formatDate(installment.date, locale)}</bdi>
                {installment.isOverdue && (
                  <span className="upcoming-installments__overdue">
                    {t("dashboard.savingsGoals.overview.overdue")}
                  </span>
                )}
              </span>
              <span className="upcoming-installments__goal" dir="auto">
                {goal.name}
              </span>
              <span className="upcoming-installments__amount">
                <bdi dir="ltr">
                  <PrivateMoney>
                    {formatMoney(installment.amount, getGoalCurrency(goal), locale)}
                  </PrivateMoney>
                </bdi>
              </span>
              <LuChevronRight className="upcoming-installments__chevron" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
