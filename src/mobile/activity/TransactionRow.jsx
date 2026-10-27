import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { typeKey } from "../accounts/typeKey.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Money from "../money/Money.jsx";
import { activityDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import StatusChip from "./StatusChip.jsx";
import TypeIcon from "./TypeIcon.jsx";

/*
 * One transaction in the Activity list: a row, not a card. The whole row opens
 * the transaction; its name reads title, kind, accounts, amount in words and
 * status, in that order. The amount's sign comes from the transaction's type
 * (models/activity.js), it is never green, and a reversed transaction's amount
 * is struck through and says so.
 */
export default function TransactionRow({ transaction }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const kind = t(`types.${typeKey(transaction.type)}`);
  const title = transaction.title ?? kind;
  const accounts = transaction.accounts.map((account) => account.name ?? t("filter.accountId", { id: account.id }));
  // Each part is isolated, so a Latin account name inside Arabic text (or the other way round) keeps its own order.
  const meta = [
    transaction.title ? kind : null,
    transaction.isReversal ? t("activity.reversalChip") : null,
    transaction.relatedId && !transaction.isReversal ? t("activity.correctionChip") : null,
    transaction.title && transaction.categoryName && transaction.categoryName !== transaction.title ? transaction.categoryName : null,
    accounts.length ? accounts.join(" · ") : null,
  ].filter((part, index, all) => part && part !== title && all.indexOf(part) === index);

  return (
    <Link className="sm-row sm-tx" to={activityDetailPath(transaction.id)} state={{ from: `${location.pathname}${location.search}`, pages: location.state?.pages }} data-sm-tx={transaction.id} data-sm-reversed={transaction.reversed ? "true" : undefined}>
      <TypeIcon transaction={transaction} />
      <span className="sm-row-main">
        <span className="sm-row-title sm-user-text">{title}</span>
        <span className="sm-row-meta">{meta.map((part, index) => <span key={part}>{index > 0 && " · "}<bdi>{part}</bdi></span>)}</span>
        {transaction.status && transaction.status !== "posted" && <StatusChip status={transaction.status} known={transaction.statusKnown} />}
      </span>
      <span className="sm-row-end">
        <span className={`sm-row-amount${transaction.reversed ? " sm-struck" : ""}`}>
          <Money plain plus={transaction.direction === "income"} value={transaction.amount} currency={transaction.currency} />
          {transaction.reversed && <span className="sm-sr"> {t("status.reversed")}</span>}
        </span>
        <Chevron />
      </span>
    </Link>
  );
}
