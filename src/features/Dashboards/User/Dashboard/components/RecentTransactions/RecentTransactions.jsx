import { useTranslation } from "react-i18next";
import {
  LuArrowUpRight,
  LuArrowDownRight,
  LuArrowRightLeft,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";
import { Link } from "react-router-dom";
import { PATH } from "../../../../../../routes/Path";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";

import "./RecentTransactions.css";
import { formatDate, formatMoney } from "../../../utils/formatters";

const icons = {
  income: LuArrowUpRight,
  expense: LuArrowDownRight,
  transfer: LuArrowRightLeft,
  fee: LuArrowDownRight,
  reversal: LuArrowRightLeft,
};

export default function RecentTransactions({ transactions }) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;

  return (
    <SectionCard
      className="recent-transactions-card"
      title={t("dashboard.user.recentTransactions.title")}
      action={
        <Link to={PATH.USER.FINANCIAL_OPERATIONS} className="dashboard-section-link">
          {t("dashboard.user.common.viewAll")}
        </Link>
      }
    >
      <div className="recent-transactions-card__list">
        {transactions.slice(0, 6).map((transaction) => {
          const Icon = icons[transaction.type] ?? LuArrowRightLeft;
          const tone = ["income", "expense", "transfer"].includes(transaction.type)
            ? transaction.type
            : "transfer";

          return (
            <article className="recent-transaction" key={transaction.id}>
              <span className={`recent-transaction__icon recent-transaction__icon--${tone}`}>
                <Icon />
              </span>

              <div className="recent-transaction__copy">
                <strong>
                  {transaction.description || transaction.category?.name || transaction.type}
                </strong>
                <small>
                  {transaction.category?.name || transaction.status} · {formatDate(transaction.occurred_at, locale, timeZone)}
                </small>
              </div>

              <strong className={`recent-transaction__amount recent-transaction__amount--${tone}`}>
                {transaction.type === "income" ? "+" : transaction.type === "expense" || transaction.type === "fee" ? "-" : ""}
                {formatMoney(transaction.amount, transaction.currency_code, locale)}
              </strong>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
