import { createElement } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowUpRight,
  LuArrowDownRight,
  LuArrowRightLeft,
} from "react-icons/lu";

import SectionCard from "../shared/SectionCard";
import { Link } from "react-router-dom";
import { PATH, getTransactionDetailsPath } from "../../../../../../routes/Path";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";

import "./RecentTransactions.css";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { getTransactionTitle, translateEnum } from "../../../FinancialOperations/transactionHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";

const icons = {
  income: LuArrowUpRight,
  expense: LuArrowDownRight,
  transfer: LuArrowRightLeft,
  fee: LuArrowDownRight,
  reversal: LuArrowRightLeft,
};

// Transfers keep the neutral tone and no sign: they are neither income nor
// expense.
export default function RecentTransactions({ transactions }) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;
  const visibleTransactions = transactions.slice(0, 6);

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
        {visibleTransactions.length === 0 && (
          <p className="recent-transactions-card__empty">{t("dashboard.user.recentTransactions.empty")}</p>
        )}

        {visibleTransactions.map((transaction) => {
          const tone = ["income", "expense", "transfer"].includes(transaction.type)
            ? transaction.type
            : "transfer";
          const title = getTransactionTitle(transaction, t, i18n);

          return (
            <article className="recent-transaction" key={transaction.id}>
              <span className={`recent-transaction__icon recent-transaction__icon--${tone}`}>
                {createElement(icons[transaction.type] ?? LuArrowRightLeft)}
              </span>

              <div className="recent-transaction__copy">
                <strong dir="auto">
                  {transaction.id != null ? (
                    <Link to={getTransactionDetailsPath(transaction.id)} className="recent-transaction__link">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </strong>
                <small>
                  {transaction.category?.name ||
                    translateEnum(t, i18n, "dashboard.transactions.types", transaction.type)}
                  {" · "}
                  <bdi>{formatDate(transaction.occurred_at, locale, timeZone)}</bdi>
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
