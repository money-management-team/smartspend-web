import { useTranslation } from "react-i18next";
import { LuTriangleAlert } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { getDisplayLocale, isNegativeMoney } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney } from "../../../Dashboard/dashboardHelpers";
import { isPositiveMoney } from "../../../SavingsGoals/savingsGoalHelpers";
import { getDebtErrorMessage } from "../../debtHelpers";

import "./DebtSummary.css";

const SIDES = [
  { key: "payable", label: "totalPayable" },
  { key: "receivable", label: "totalReceivable" },
];

function getNetTone(value) {
  if (isNegativeMoney(value)) return "negative";
  if (isPositiveMoney(value)) return "positive";
  return "zero";
}

/*
 * GET /debts/summary: one card per currency of `summary.by_currency`, each in
 * its own currency. Amounts in different currencies are never added together
 * and nothing is recalculated: every figure is the backend's. The summary
 * covers all the workspace's debts, not only the filtered list.
 */
export default function DebtSummary({ rows, isLoading, error, onRetry }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const number = new Intl.NumberFormat(locale);
  const count = (value) => (value == null ? "—" : number.format(value));

  return (
    <section className="debt-summary" aria-labelledby="debt-summary-title">
      <header className="debt-summary__header">
        <h2 id="debt-summary-title">{t("dashboard.debts.summary.title")}</h2>
        <p>{t("dashboard.debts.summary.subtitle")}</p>
      </header>

      {isLoading && <Loading message={t("dashboard.debts.summary.loading")} />}

      {!isLoading && error && (
        <div className="debt-summary__state debt-summary__state--error" role="alert">
          <p>{getDebtErrorMessage(error, t)}</p>
          <button type="button" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && rows?.length === 0 && (
        <div className="debt-summary__state">
          <p>{t("dashboard.debts.summary.empty")}</p>
        </div>
      )}

      {!isLoading && !error && rows?.length > 0 && (
        <div className="debt-summary__grid">
          {rows.map((row) => {
            const currency = row.currency_code;
            const money = (value) => <bdi dir="ltr">{formatOptionalMoney(value, currency, locale)}</bdi>;
            const netTone = getNetTone(row.net_position);

            return (
              <article className="debt-summary-card" key={currency}>
                <header className="debt-summary-card__top">
                  <strong className="debt-summary-card__currency">
                    <bdi dir="ltr">{currency}</bdi>
                  </strong>
                  {row.overdue_debts_count > 0 && (
                    <span className="debt-summary-card__overdue">
                      <LuTriangleAlert aria-hidden="true" />
                      {t("dashboard.debts.summary.overdueCount", { count: count(row.overdue_debts_count) })}
                    </span>
                  )}
                </header>

                <dl className="debt-summary-card__sides">
                  {SIDES.map(({ key, label }) => (
                    <div className={`debt-summary-card__side debt-summary-card__side--${key}`} key={key}>
                      <dt>
                        {t(`dashboard.debts.summary.${label}`)}
                        <span>{t(`dashboard.debts.directionShort.${key}`)}</span>
                      </dt>
                      <dd>{money(row[key].remaining_amount)}</dd>
                      <dd className="debt-summary-card__side-meta">
                        {t("dashboard.debts.summary.sideMeta", { count: count(row[key].debts_count) })}
                        <span aria-hidden="true"> · </span>
                        {t("dashboard.debts.fields.paidAmount")} {money(row[key].paid_amount)}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className={`debt-summary-card__net debt-summary-card__net--${netTone}`}>
                  <span>{t("dashboard.debts.summary.netPosition")}</span>
                  <strong>{money(row.net_position)}</strong>
                  <small>{t(`dashboard.debts.summary.net.${netTone}`)}</small>
                </div>

                <footer className="debt-summary-card__counts">
                  <span>
                    {t("dashboard.debts.summary.activeDebts")} <bdi>{count(row.active_debts_count)}</bdi>
                  </span>
                  <span>
                    {t("dashboard.debts.summary.overdueDebts")} <bdi>{count(row.overdue_debts_count)}</bdi>
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
