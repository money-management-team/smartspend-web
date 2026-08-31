import { useTranslation } from "react-i18next";

import {
  LuCoins,
  LuLandmark,
  LuWalletCards,
  LuTrendingUp,
} from "react-icons/lu";

import "./SummaryCards.css";
import { formatMoney, sumMoney } from "../../../utils/formatters";

function totalsByCurrency(accounts) {
  const grouped = new Map();

  accounts.forEach((account) => {
    const currency = account.currency_code ?? "ILS";
    const balances = grouped.get(currency) ?? [];
    balances.push(account.current_balance ?? "0.0000");
    grouped.set(currency, balances);
  });

  return Array.from(grouped, ([currency, balances]) => ({
    currency,
    total: sumMoney(balances),
  }));
}

const cards = [
  {
    key: "cash",
    icon: LuCoins,
    types: ["cash"],
  },
  {
    key: "bank",
    icon: LuLandmark,
    types: ["bank", "savings"],
  },
  {
    key: "wallets",
    icon: LuWalletCards,
    types: ["wallet", "custom"],
  },
];

export default function SummaryCards({ accounts }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";

  return (
    <section className="dashboard-summary-cards">
      {cards.map(({ key, icon: Icon, types }) => {
        const matchingAccounts = accounts.filter((account) => types.includes(account.type));
        const totals = totalsByCurrency(matchingAccounts);

        return (
        <article
          className="dashboard-summary-card"
          key={key}
        >
          {/* Content */}
          <div className="dashboard-summary-card__content">
            <span className="dashboard-summary-card__label">
              {t(
                `dashboard.user.summary.${key}.label`,
              )}
            </span>

            <div className="dashboard-summary-card__amount">
              {(totals.length > 0
                ? totals
                : [{ currency: "ILS", total: "0.0000" }]
              ).map(({ currency, total }) => (
                <strong key={currency}>{formatMoney(total, currency, locale)}</strong>
              ))}
            </div>

            <span className="dashboard-summary-card__change">
              <LuTrendingUp />

              <span>
                {t("dashboard.user.money.accountsCount", {
                  count: matchingAccounts.length,
                })}
              </span>
            </span>
          </div>

          {/* Icon */}
          <span className="dashboard-summary-card__icon">
            <Icon />
          </span>
        </article>
        );
      })}
    </section>
  );
}
