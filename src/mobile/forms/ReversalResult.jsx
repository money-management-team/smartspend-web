import { Link } from "react-router-dom";

import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { activityDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import TransactionNow from "./TransactionNow.jsx";
import { BalanceNow } from "./TransferResult.jsx";

/*
 * A confirmed reversal, as the server answered it (models/transactionResult.js buildReversalResult): the original is now
 * reversed and a reversal entry exists. Then the original's status and the affected account balances, each read again from
 * the server (the answer carries no balance, and the status is shown as read, not as assumed). The write's cached reads
 * were dropped when the answer arrived, so Home, Accounts and Activity read again too.
 */
export default function ReversalResult({ result, outcomeRef, backTo, locale, t }) {
  const reversedAt = formatMoment(result.reversedAt, locale);

  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-reversal-result={result.id}>
      <h2 className="sm-card-title">{t("forms.entryResult.reversalTitle")}</h2>
      <p className="sm-text sm-muted">{t("forms.entryResult.reversalBody")}</p>
      <p className="sm-transfer-result-amount" data-sm-result-amount>
        <Money className="sm-hero-money" value={result.amount} currency={result.currency} />
      </p>
      <dl className="sm-stats sm-stats-stacked">
        {reversedAt && <div className="sm-stat" data-sm-result="reversedAt"><dt>{t("forms.entryResult.reversedAt")}</dt><dd><bdi>{reversedAt}</bdi></dd></div>}
        {result.reason && <div className="sm-stat" data-sm-result="reason"><dt>{t("forms.fields.reason")}</dt><dd><bdi dir="auto" className="sm-user-text">{result.reason}</bdi></dd></div>}
        <TransactionNow side="original" id={result.id} label={t("forms.entryResult.original")} t={t} />
        {result.reversalIds.map((id) => (
          <div key={id} className="sm-stat" data-sm-result="reversal"><dt>{t("forms.entryResult.reversalEntry")}</dt><dd><Link to={activityDetailPath(id)}>#{id}</Link></dd></div>
        ))}
      </dl>

      {result.accounts.length > 0 && (
        <>
          <h3 className="sm-card-title sm-transfer-result-subtitle">{t("forms.entryResult.balancesTitle")}</h3>
          <p className="sm-text sm-muted sm-fine">{t("forms.entryResult.balancesHint")}</p>
          <dl className="sm-stats sm-stats-stacked">
            {result.accounts.map((account) => <BalanceNow key={account.id} side={account.id} account={account} label={t("forms.entryResult.account")} t={t} />)}
          </dl>
        </>
      )}

      <Link className="sm-link-row" to={activityDetailPath(result.id)} data-sm-action="open-transaction">
        <span>{t("forms.entryResult.openOriginal")}</span>
        <Chevron />
      </Link>
      <Link className="sm-link-row" to={backTo} data-sm-action="after-write">
        <span>{t("forms.outcome.back")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
