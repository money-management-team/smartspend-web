import { useTranslation } from "react-i18next";
import {
  LuArrowUpRight,
  LuArrowDownRight,
  LuArrowRightLeft,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";

import "./RecentTransactions.css";

const transactions = [
  { key: "retainer", type: "income" },
  { key: "wholefoods", type: "expense" },
  { key: "transfer", type: "transfer" },
  { key: "figma", type: "expense" },
  { key: "uber", type: "expense" },
  { key: "dividend", type: "income" },
];

const icons = {
  income: LuArrowUpRight,
  expense: LuArrowDownRight,
  transfer: LuArrowRightLeft,
};

export default function RecentTransactions() {
  const { t } = useTranslation();

  return (
    <SectionCard
      className="recent-transactions-card"
      title={t("dashboard.user.recentTransactions.title")}
      action={
        <button type="button" className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </button>
      }
    >
      <div className="recent-transactions-card__list">
        {transactions.map(({ key, type }) => {
          const Icon = icons[type];

          return (
            <article className="recent-transaction" key={key}>
              <span className={`recent-transaction__icon recent-transaction__icon--${type}`}>
                <Icon />
              </span>

              <div className="recent-transaction__copy">
                <strong>{t(`dashboard.user.recentTransactions.items.${key}.name`)}</strong>
                <small>
                  {t(`dashboard.user.recentTransactions.items.${key}.meta`)}
                </small>
              </div>

              <strong className={`recent-transaction__amount recent-transaction__amount--${type}`}>
                {t(`dashboard.user.recentTransactions.items.${key}.amount`)}
              </strong>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
