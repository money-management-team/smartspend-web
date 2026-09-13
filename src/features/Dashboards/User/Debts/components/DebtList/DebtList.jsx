import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuBookOpen, LuWalletCards } from "react-icons/lu";

import { getDebtDetailsPath } from "../../../../../../routes/Path";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney } from "../../../Dashboard/dashboardHelpers";
import { formatDate } from "../../../utils/formatters";
import {
  getDebtStatus,
  getDueCountdown,
  hasOpeningMovement,
  isOverdueDebt,
  toDateOnly,
} from "../../debtHelpers";
import DebtBadge from "../DebtBadge/DebtBadge";

import "./DebtList.css";

const AMOUNT_COLUMNS = [
  { key: "original_amount", label: "originalAmount" },
  { key: "paid_amount", label: "paidAmount" },
  { key: "remaining_amount", label: "remainingAmount" },
];

/*
 * One page of GET /debts. Every figure is the backend's own: amounts are its
 * decimal strings (formatted for display only), the state is
 * `effective_status` and the countdown is `days_until_due`; nothing is
 * recalculated here. The counterparty opens the debt's details page.
 */
export default function DebtList({ debts }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  return (
    <div className="debt-list">
      <table className="debt-list__table">
        <caption className="debt-list__caption">{t("dashboard.debts.list.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("dashboard.debts.fields.counterparty")}</th>
            <th scope="col">{t("dashboard.debts.fields.direction")}</th>
            {AMOUNT_COLUMNS.map(({ key, label }) => (
              <th scope="col" className="debt-list__amount" key={key}>
                {t(`dashboard.debts.fields.${label}`)}
              </th>
            ))}
            <th scope="col">{t("dashboard.debts.fields.dueDate")}</th>
            <th scope="col">{t("dashboard.debts.fields.status")}</th>
            <th scope="col">{t("dashboard.debts.fields.daysUntilDue")}</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((debt) => {
            const currency = debt.currency_code;
            const countdown = getDueCountdown(debt);
            const movement = hasOpeningMovement(debt);
            const dueDate = toDateOnly(debt.due_date);

            return (
              <tr key={debt.id} className={isOverdueDebt(debt) ? "debt-list__row--overdue" : undefined}>
                <th scope="row" className="debt-list__party">
                  <Link className="debt-list__link" to={getDebtDetailsPath(debt.id)} dir="auto">
                    {debt.counterparty_name || `#${debt.id}`}
                  </Link>
                  {movement != null && (
                    <small className={`debt-list__movement${movement ? " debt-list__movement--posted" : ""}`}>
                      {movement ? <LuWalletCards aria-hidden="true" /> : <LuBookOpen aria-hidden="true" />}
                      {t(movement ? "dashboard.debts.list.withMovement" : "dashboard.debts.list.recordOnly")}
                    </small>
                  )}
                </th>
                <td>
                  <DebtBadge kind="direction" value={debt.direction} />
                </td>
                {AMOUNT_COLUMNS.map(({ key }) => (
                  <td className="debt-list__amount" key={key}>
                    <bdi dir="ltr">{formatOptionalMoney(debt[key], currency, locale)}</bdi>
                  </td>
                ))}
                <td>
                  {dueDate ? (
                    <bdi>{formatDate(dueDate, locale)}</bdi>
                  ) : (
                    <span className="debt-list__muted">{t("dashboard.debts.list.noDueDate")}</span>
                  )}
                </td>
                <td>
                  <DebtBadge kind="status" value={getDebtStatus(debt)} />
                </td>
                <td>
                  {countdown ? (
                    <span className={`debt-list__countdown debt-list__countdown--${countdown.key}`}>
                      {t(`dashboard.debts.list.${countdown.key}`, {
                        days: new Intl.NumberFormat(locale).format(countdown.days),
                      })}
                    </span>
                  ) : (
                    <span className="debt-list__muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
