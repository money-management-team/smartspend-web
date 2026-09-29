import { useTranslation } from "react-i18next";

import SectionCard from "../shared/SectionCard";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatOptionalMoney, isNegativeAmount } from "../../dashboardHelpers";

import "./CurrencySummary.css";

const COLUMNS = ["current_balance", "income", "expense", "net"];

/*
 * One row per currency of `data.summary_by_currency`, each in its own
 * currency. Amounts in different currencies are never added together.
 */
export default function CurrencySummary({ rows, primaryCurrency }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);

  return (
    <SectionCard
      className="currency-summary"
      title={t("dashboard.user.currencies.title")}
      subtitle={t("dashboard.user.currencies.subtitle")}
    >
      <div className="currency-summary__scroll">
        <table className="currency-summary__table">
          <thead>
            <tr>
              <th scope="col">{t("dashboard.user.currencies.currency")}</th>
              <th scope="col">{t("dashboard.user.currencies.accounts")}</th>
              {COLUMNS.map((column) => (
                <th scope="col" key={column}>
                  {t(`dashboard.user.currencies.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.currency_code}>
                <th scope="row">
                  <bdi>{row.currency_code}</bdi>
                  {row.currency_code === primaryCurrency && (
                    <span className="currency-summary__primary">{t("dashboard.user.currencies.primary")}</span>
                  )}
                </th>
                <td>
                  <bdi>{row.accounts_count ?? "—"}</bdi>
                </td>
                {COLUMNS.map((column) => (
                  <td
                    key={column}
                    className={column === "net" && isNegativeAmount(row[column]) ? "currency-summary__negative" : ""}
                  >
                    <bdi>{formatOptionalMoney(row[column], row.currency_code, locale)}</bdi>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
