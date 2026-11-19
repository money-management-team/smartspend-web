import { Link } from "react-router-dom";

import { formatDay, formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { activityDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import TransactionNow from "./TransactionNow.jsx";
import { BalanceNow } from "./TransferResult.jsx";

/*
 * A confirmed expense or income, as the server answered it (models/transactionResult.js): the amount, the account, the
 * category, the date and the status the server recorded, then the account's balance read again from the server. The
 * write's cached reads were dropped when the answer arrived (forms/useWorkflowSubmit.js), so Home, Accounts and Activity
 * read again too. Same card as the transfer's result.
 */
export default function TransactionResult({ result, outcomeRef, backTo, locale, t }) {
  const posted = formatMoment(result.postedAt, locale);
  const occurred = result.occurredAt ? formatDay(result.occurredAt, locale, "UTC") ?? result.occurredAt : null;
  const row = (name, label, value) => (value ? <div className="sm-stat" data-sm-result={name}><dt>{label}</dt><dd>{value}</dd></div> : null);

  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-transaction-result={result.id} data-sm-result-type={result.type} data-sm-replaces={result.replaces ?? undefined}>
      <h2 className="sm-card-title">{t(result.replaces ? "forms.entryResult.correctionTitle" : `forms.entryResult.${result.type}Title`)}</h2>
      <p className="sm-text sm-muted">{t(result.replaces ? "forms.entryResult.correctionBody" : "forms.entryResult.body")}</p>
      <p className="sm-transfer-result-amount" data-sm-result-amount>
        <Money className="sm-hero-money" value={result.amount} currency={result.currency} />
      </p>
      <dl className="sm-stats sm-stats-stacked">
        {row("account", t("forms.entryResult.account"), <bdi className="sm-user-text">{result.account.name ?? t("transfers.result.unnamed")}</bdi>)}
        {result.category && row("category", t("forms.fields.category_id"), <bdi className="sm-user-text">{result.category.name ?? t("forms.unnamed")}</bdi>)}
        {row("occurred", t("forms.fields.occurred_at"), occurred && <bdi>{occurred}</bdi>)}
        {row("description", t("forms.fields.description"), result.description && <bdi dir="auto" className="sm-user-text">{result.description}</bdi>)}
        {row("reference", t("forms.fields.reference_number"), result.reference && <bdi dir="auto" className="sm-user-text">{result.reference}</bdi>)}
        {result.replaces && <TransactionNow side="original" id={result.replaces} label={t("forms.entryResult.original")} t={t} />}
        {row("status", t("transfers.result.status"), result.status && t(`transfers.status.${result.status}`, { defaultValue: result.status }))}
        {row("posted", t("transfers.result.postedAt"), posted && <bdi>{posted}</bdi>)}
      </dl>

      <h3 className="sm-card-title sm-transfer-result-subtitle">{t("forms.entryResult.balanceTitle")}</h3>
      <p className="sm-text sm-muted sm-fine">{t("forms.entryResult.balanceHint")}</p>
      <dl className="sm-stats sm-stats-stacked">
        <BalanceNow side="account" account={result.account} label={t("forms.entryResult.account")} t={t} />
        {result.previousAccount && <BalanceNow side="previous" account={result.previousAccount} label={t("forms.entryResult.previousAccount")} t={t} />}
      </dl>

      <Link className="sm-link-row" to={activityDetailPath(result.id)} data-sm-action="open-transaction">
        <span>{t("forms.entryResult.open")}</span>
        <Chevron />
      </Link>
      {result.replaces && (
        <Link className="sm-link-row" to={activityDetailPath(result.replaces)} data-sm-action="open-original">
          <span>{t("forms.entryResult.openOriginal")}</span>
          <Chevron />
        </Link>
      )}
      <Link className="sm-link-row" to={backTo} data-sm-action="after-write">
        <span>{t("forms.outcome.back")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
