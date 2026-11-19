import { Link } from "react-router-dom";

import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { MOBILE_ACCOUNTS, accountDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/*
 * A confirmed account write, as the server answered it (models/accountResult.js): the account's own name, type, currency
 * and settings, and its balance as the server computed it (the closing balance, for an archive). The write's cached reads
 * were dropped when the answer arrived (forms/useWorkflowSubmit.js), so the Accounts list and every balance read again.
 * Hide-amounts masks the figures.
 */
export default function AccountResult({ result, outcomeRef, backTo, locale, t }) {
  const archivedAt = formatMoment(result.archivedAt, locale);
  const row = (name, label, value) => (value ? <div className="sm-stat" data-sm-result={name}><dt>{label}</dt><dd>{value}</dd></div> : null);

  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-account-result={result.id} data-sm-result-kind={result.kind}>
      <h2 className="sm-card-title">{t(`forms.accountResult.${result.kind}Title`)}</h2>
      <p className="sm-text sm-muted">{t(`forms.accountResult.${result.kind}Body`)}</p>
      {result.balance && (
        <p className="sm-transfer-result-amount" data-sm-result-amount>
          <Money className="sm-hero-money" value={result.balance} currency={result.currency} />
        </p>
      )}
      <dl className="sm-stats sm-stats-stacked">
        {row("name", t("forms.fields.name"), result.name && <bdi className="sm-user-text">{result.name}</bdi>)}
        {row("type", t("forms.fields.accountType"), result.type && t(`forms.options.accountType.${result.type}`, { defaultValue: result.type }))}
        {row("currency", t("forms.fields.currency_code"), result.currency && <bdi dir="ltr">{result.currency}</bdi>)}
        {row("opening", t("forms.fields.opening_balance"), result.openingBalance && <Money plain value={result.openingBalance} currency={result.currency} />)}
        {result.allowsNegative !== null && row("negative", t("forms.fields.allow_negative_balance"), t(result.allowsNegative ? "forms.yes" : "forms.no"))}
        {row("status", t("transfers.result.status"), result.status && t(result.status === "archived" ? "detail.statusArchived" : "detail.statusActive"))}
        {row("archivedAt", t("forms.accountResult.archivedAt"), archivedAt && <bdi>{archivedAt}</bdi>)}
      </dl>

      <Link className="sm-link-row" to={accountDetailPath(result.id)} data-sm-action="open-account">
        <span>{t("forms.accountResult.open")}</span>
        <Chevron />
      </Link>
      <Link className="sm-link-row" to={backTo ?? MOBILE_ACCOUNTS} data-sm-action="after-write">
        <span>{t("forms.outcome.back")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
