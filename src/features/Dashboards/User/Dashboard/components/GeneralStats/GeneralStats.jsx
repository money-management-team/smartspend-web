import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuPiggyBank,
  LuWallet,
  LuArrowRightLeft,
  LuSlidersHorizontal,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./GeneralStats.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatPercentage } from "../../../Budgets/budgetHelpers";
import { formatOptionalMoney, getTransfersSummary } from "../../dashboardHelpers";

const formatCount = (value, locale) => {
  const number = Number(value);
  return value == null || value === "" || !Number.isFinite(number) ? "—" : number.toLocaleString(locale);
};

/*
 * Figures the backend calculated for the period, shown as sent: savings rate,
 * accounts, transfers (`data.transfers`, kept apart from income and expense)
 * and balance adjustments.
 */
export default function GeneralStats({ totals, transfers }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const transferSummary = getTransfersSummary(transfers);
  const activeAccounts = totals?.active_accounts_count ?? totals?.accounts_count;

  const stats = [
    {
      key: "savingsRate",
      icon: LuPiggyBank,
      value: formatPercentage(totals?.savings_rate, locale),
    },
    {
      key: "activeAccounts",
      icon: LuWallet,
      value: formatCount(activeAccounts, locale),
      note:
        totals?.accounts_count != null && totals?.active_accounts_count != null
          ? t("dashboard.user.stats.activeAccounts.note", { count: Number(totals.accounts_count) })
          : "",
    },
    {
      key: "transfers",
      icon: LuArrowRightLeft,
      value: transferSummary?.count != null ? formatCount(transferSummary.count, locale) : "—",
      note:
        transferSummary?.amount != null
          ? formatOptionalMoney(
              transferSummary.amount,
              transferSummary.currency || totals?.currency_code,
              locale,
            )
          : "",
    },
    {
      key: "adjustments",
      icon: LuSlidersHorizontal,
      value: formatOptionalMoney(totals?.adjustments, totals?.currency_code, locale),
    },
  ];

  return (
    <SectionCard
      className="general-stats-card"
      title={t("dashboard.user.stats.title")}
      subtitle={t("dashboard.user.stats.subtitle")}
    >
      <div className="general-stats-card__grid">
        {stats.map(({ key, icon, value, note }) => (
          <article className="general-stat" key={key}>
            <span className="general-stat__icon">
              {createElement(icon)}
            </span>

            <div>
              <small>{t(`dashboard.user.stats.${key}.label`)}</small>
              <strong>
                <bdi>{value}</bdi>
              </strong>
              {note && (
                <span className="general-stat__note">
                  <bdi>{note}</bdi>
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="general-stats-card__footnote">{t("dashboard.user.stats.transfersNote")}</p>
    </SectionCard>
  );
}
