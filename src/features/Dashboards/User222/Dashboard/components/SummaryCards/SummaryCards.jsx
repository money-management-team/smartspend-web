import { useTranslation } from "react-i18next";

import {
  LuCoins,
  LuLandmark,
  LuWalletCards,
  LuTrendingUp,
} from "react-icons/lu";

import "./SummaryCards.css";
import { formatMoney } from "../../../utils/formatters";

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
        const total = matchingAccounts.reduce(
          (sum, account) => sum + Number(account.current_balance || 0),
          0,
        );
        const currency = matchingAccounts[0]?.currency_code ?? accounts[0]?.currency_code ?? "ILS";

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

            <strong className="dashboard-summary-card__amount">
              {formatMoney(total, currency, locale)}
            </strong>

            <span className="dashboard-summary-card__change">
              <LuTrendingUp />

              <span>
                {matchingAccounts.length} {t("dashboard.user.money.accounts", { defaultValue: "accounts" })}
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
