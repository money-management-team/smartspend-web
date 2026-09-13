import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCoins,
  LuLandmark,
  LuPiggyBank,
  LuWalletCards,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { PATH, getAccountDetailsPath } from "../../../../../../routes/Path";

import SectionCard from "../shared/SectionCard";
import ProgressBar from "../shared/ProgressBar";

import "./MoneyDistribution.css";
import { ACCOUNT_TYPES, getDisplayLocale } from "../../../Accounts/accountHelpers";
import { translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatOptionalMoney } from "../../dashboardHelpers";

const TYPE_ICONS = {
  cash: LuCoins,
  bank: LuLandmark,
  savings: LuPiggyBank,
  wallet: LuWalletCards,
  custom: LuWalletCards,
};

// Accounts grouped by type and currency, in the usual type order (unknown
// types last). Nothing is summed: each account shows the balance the backend
// sent, and a group only says how many accounts it holds.
function groupAccounts(accounts) {
  const groups = new Map();

  accounts.forEach((account) => {
    const key = `${account.type ?? "custom"}|${account.currency_code ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), account]);
  });

  const typeOrder = (type) => {
    const index = ACCOUNT_TYPES.indexOf(type);
    return index === -1 ? ACCOUNT_TYPES.length : index;
  };

  return Array.from(groups, ([key, items]) => {
    const [type, currency] = key.split("|");
    return { key, type, currency, items };
  }).sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
}

// Bar length relative to the largest balance of the group (display only).
const barWidth = (balance, largest) =>
  largest > 0 ? (Math.abs(Number(balance) || 0) / largest) * 100 : 0;

export default function MoneyDistribution({ accounts }) {
  const { t, i18n } = useTranslation();
  const locale = getDisplayLocale(i18n.language);
  const groups = groupAccounts(accounts);

  return (
    <SectionCard
      className="money-distribution"
      title={t("dashboard.user.money.title")}
      subtitle={t("dashboard.user.money.subtitle")}
      action={
        <Link to={PATH.USER.ACCOUNTS} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      {groups.length === 0 ? (
        <p className="money-distribution__empty">{t("dashboard.user.money.empty")}</p>
      ) : (
        <div className="money-distribution__grid">
          {groups.map(({ key, type, currency, items }) => {
            const largest = Math.max(...items.map((account) => Math.abs(Number(account.current_balance) || 0)));

            return (
              <article className="money-account" key={key}>
                <div className="money-account__heading">
                  <span className="money-account__icon">
                    {createElement(TYPE_ICONS[type] ?? LuWalletCards)}
                  </span>

                  <div className="money-account__heading-copy">
                    <small>
                      {translateEnum(t, i18n, "dashboard.accounts.types", type)}
                      {currency && " · "}
                      {currency && <bdi>{currency}</bdi>}
                    </small>
                    <span className="money-account__count">
                      {t("dashboard.user.money.accountsCount", { count: items.length })}
                    </span>
                  </div>
                </div>

                {items.map((account) => (
                  <div className="money-account__line" key={account.id ?? account.name}>
                    <div className="money-account__line-meta">
                      <div>
                        {account.id != null ? (
                          <Link to={getAccountDetailsPath(account.id)} className="money-account__name">
                            {account.name}
                          </Link>
                        ) : (
                          <span>{account.name}</span>
                        )}
                        {account.status && account.status !== "active" && (
                          <small>{translateEnum(t, i18n, "dashboard.accounts.status", account.status)}</small>
                        )}
                      </div>
                      <strong>
                        {formatOptionalMoney(account.current_balance, account.currency_code, locale)}
                      </strong>
                    </div>

                    <ProgressBar value={barWidth(account.current_balance, largest)} />
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
