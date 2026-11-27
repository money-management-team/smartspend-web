import { useMemo } from "react";
import { Link } from "react-router-dom";

import { accountLoader, keys } from "../data/loaders.js";
import { useResource } from "../data/useResource.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildAccountDetail } from "../models/accounts.js";
import { accountDetailPath, transferDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";

/* One account's balance as SmartSpend reads it now (GET /accounts/{id}); never derived from the transfer. */
export function BalanceNow({ side, account, label, t }) {
  const loader = useMemo(() => accountLoader(account.id), [account.id]);
  const resource = useResource(keys.account(account.id), loader);
  const detail = useMemo(() => (resource.data !== undefined ? buildAccountDetail(resource.data, account.id) : null), [resource.data, account.id]);
  const loading = resource.loading;

  return (
    <div className="sm-stat" data-sm-balance-now={side} data-sm-state={loading ? "loading" : detail?.balance ? "ready" : "unavailable"}>
      <dt>
        {label} · <Link to={accountDetailPath(account.id)}><bdi className="sm-user-text">{detail?.name ?? account.name ?? t("transfers.result.unnamed")}</bdi></Link>
      </dt>
      <dd>{loading ? <span className="sm-muted">{t("transfers.result.loadingBalances")}</span> : detail?.balance ? <Money value={detail.balance} currency={detail.currency} /> : <span className="sm-muted">{t("transfers.result.balanceUnavailable")}</span>}</dd>
    </div>
  );
}

/*
 * A confirmed transfer, as the server answered it (models/transferResult.js): the amount, the two accounts, the fee and
 * the status the server recorded, then both balances read again from the server. The write's cached reads were dropped
 * when the answer arrived (forms/useWorkflowSubmit.js), so these are fresh GETs.
 */
export default function TransferResult({ result, outcomeRef, backTo, locale, t }) {
  const posted = formatMoment(result.postedAt, locale);

  return (
    <div className="sm-card sm-transfer-result" role="status" tabIndex={-1} ref={outcomeRef} data-sm-outcome="confirmed" data-sm-transfer-result={result.id}>
      <h2 className="sm-card-title">{t("transfers.result.title")}</h2>
      <p className="sm-text sm-muted">{t("transfers.result.body")}</p>
      <p className="sm-transfer-result-amount" data-sm-result-amount>
        <Money className="sm-hero-money" value={result.amount} currency={result.currency} />
      </p>
      <dl className="sm-stats sm-stats-stacked">
        <div className="sm-stat" data-sm-result="from"><dt>{t("transfers.result.from")}</dt><dd><bdi className="sm-user-text">{result.from.name ?? t("transfers.result.unnamed")}</bdi></dd></div>
        <div className="sm-stat" data-sm-result="to"><dt>{t("transfers.result.to")}</dt><dd><bdi className="sm-user-text">{result.to.name ?? t("transfers.result.unnamed")}</bdi></dd></div>
        {result.fee && <div className="sm-stat" data-sm-result="fee"><dt>{t("transfers.result.fee")}</dt><dd><Money plain value={result.fee} currency={result.currency} /></dd></div>}
        {result.status && <div className="sm-stat" data-sm-result="status"><dt>{t("transfers.result.status")}</dt><dd>{t(`transfers.status.${result.status}`, { defaultValue: result.status })}</dd></div>}
        {posted && <div className="sm-stat" data-sm-result="posted"><dt>{t("transfers.result.postedAt")}</dt><dd><bdi>{posted}</bdi></dd></div>}
      </dl>

      <h3 className="sm-card-title sm-transfer-result-subtitle">{t("transfers.result.balancesTitle")}</h3>
      <p className="sm-text sm-muted sm-fine">{t("transfers.result.balancesHint")}</p>
      <dl className="sm-stats sm-stats-stacked">
        <BalanceNow side="from" account={result.from} label={t("transfers.result.from")} t={t} />
        <BalanceNow side="to" account={result.to} label={t("transfers.result.to")} t={t} />
      </dl>

      <Link className="sm-link-row" to={transferDetailPath(result.id)} data-sm-action="open-transfer">
        <span>{t("transfers.result.open")}</span>
        <Chevron />
      </Link>
      <Link className="sm-link-row" to={backTo} data-sm-action="after-write">
        <span>{t("forms.outcome.back")}</span>
        <Chevron />
      </Link>
    </div>
  );
}
