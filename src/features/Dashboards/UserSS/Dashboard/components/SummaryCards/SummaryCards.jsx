import { useTranslation } from "react-i18next";

import {
  LuCoins,
  LuLandmark,
  LuWalletCards,
  LuTrendingUp,
} from "react-icons/lu";

import "./SummaryCards.css";

const cards = [
  {
    key: "cash",
    icon: LuCoins,
  },
  {
    key: "bank",
    icon: LuLandmark,
  },
  {
    key: "wallets",
    icon: LuWalletCards,
  },
];

export default function SummaryCards() {
  const { t } = useTranslation();

  return (
    <section className="dashboard-summary-cards">
      {cards.map(({ key, icon: Icon }) => (
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
              {t(
                `dashboard.user.summary.${key}.amount`,
              )}
            </strong>

            <span className="dashboard-summary-card__change">
              <LuTrendingUp />

              <span>
                {t(
                  `dashboard.user.summary.${key}.change`,
                )}
              </span>
            </span>
          </div>

          {/* Icon */}
          <span className="dashboard-summary-card__icon">
            <Icon />
          </span>
        </article>
      ))}
    </section>
  );
}