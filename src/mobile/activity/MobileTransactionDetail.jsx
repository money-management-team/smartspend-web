import { useMemo } from "react";
import { LuArrowRightLeft, LuCircleHelp, LuClock, LuPencilLine, LuUndo2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";
import { DEBT_TYPES, eligibleToCorrect, eligibleToReverse, isStatementSource } from "../forms/workflows.js";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { getTransactionDetailsPath } from "../../routes/Path.js";
import { typeKey } from "../accounts/typeKey.js";
import { keys, transactionLoader } from "../data/loaders.js";
import { isAccountId } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildTransactionDetail } from "../models/activity.js";
import { MOBILE_ACTIVITY, accountDetailPath, activityDetailPath, backPathFrom, backStateFrom, transferDetailPath } from "../navigation.js";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import StatusChip from "./StatusChip.jsx";
import TypeIcon from "./TypeIcon.jsx";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });
const NOT_FOUND = Object.freeze({ code: "NOT_FOUND" });
const ROLES = ["income", "expense", "source", "destination", "fee", "debit", "credit"];

function Fact({ label, children }) {
  return (
    <div className="sm-stat">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* One line about a transaction's situation: what it reverses, replaces or is part of. A note, never a button. */
function NoteRow({ icon: Icon, note, children }) {
  return (
    <p className="sm-tx-note" role="note" data-sm-note={note}>
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// What the Correct and Reverse forms check (forms/workflows.js), from the transaction as this page read it.
const changeable = (transaction) => ({ status: transaction.status, type: transaction.type, isReversal: transaction.isReversal, isTransfer: transaction.isTransfer, isImported: isStatementSource(transaction.source), isDebtMoney: DEBT_TYPES.includes(transaction.type) });

function Detail({ transaction, resource, backTo, backState, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const from = backTo;
  const kind = t(`types.${typeKey(transaction.type)}`);
  const moment = (value) => formatMoment(value, locale, timeZone);
  const link = (id) => (
    <Link className="sm-note-link" to={activityDetailPath(id)} state={{ from, pages: backState?.pages }}>
      <bdi dir="ltr">#{id}</bdi>
    </Link>
  );
  const title = transaction.title ?? kind;
  const knownStatus = transaction.statusKnown;
  const notPosted = transaction.status && transaction.status !== "posted" && !transaction.reversed && knownStatus;
  const accountNames = transaction.accounts.map((account) => account.name).filter(Boolean);
  const hasRecord = Boolean(moment(transaction.postedAt) || transaction.source || transaction.creatorName || transaction.transferId || transaction.reversalOfId || (transaction.relatedId && !transaction.isReversal));
  const hasNotes = Boolean(transaction.reversed || transaction.isReversal || (transaction.relatedId && !transaction.isReversal) || (transaction.isTransfer && !transaction.isReversal) || notPosted || !knownStatus);

  return (
    <section className="sm-page" data-sm-screen="transaction" data-sm-transaction={transaction.id} data-sm-status={transaction.status ?? "none"} data-sm-state={resource.stale ? "stale" : "ready"} data-sm-stale={resource.stale ? "true" : undefined}>
      <Link className="sm-link-row sm-back" to={from} state={backState}>
        <Chevron back />
        <span>{t("tx.back")}</span>
      </Link>

      {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}

      <section className="sm-card sm-hero sm-detail-hero" aria-labelledby="sm-tx-title">
        <div className="sm-tx-head">
          <TypeIcon transaction={transaction} />
          <h2 id="sm-tx-title" className="sm-card-title sm-user-text">{title}</h2>
        </div>
        <p className="sm-chips-inline">
          <span className="sm-chip">{kind}</span>
          <StatusChip status={transaction.status} known={knownStatus} />
          {transaction.isReversal && <span className="sm-chip">{t("activity.reversalChip")}</span>}
          {transaction.relatedId && !transaction.isReversal && <span className="sm-chip">{t("activity.correctionChip")}</span>}
        </p>
        <p className="sm-balance-label">{t("tx.amount")}</p>
        <span className={transaction.reversed ? "sm-struck" : undefined}>
          <Money className="sm-hero-money" plus={transaction.direction === "income"} value={transaction.amount} currency={transaction.currency} />
          {transaction.reversed && <span className="sm-sr"> {t("status.reversed")}</span>}
        </span>
        {(moment(transaction.occurredAt) || accountNames.length > 0) && (
          <p className="sm-hero-note">
            {moment(transaction.occurredAt)}
            {moment(transaction.occurredAt) && accountNames.length > 0 ? " · " : ""}
            {/* Each name is its own isolate and the arrow sits in the page's own direction, so it points from the source to the destination in either language. */}
            {accountNames.map((name, index) => (
              <span key={`${name}:${index}`}>
                {index > 0 ? (locale === "ar" ? " ← " : " → ") : ""}
                <bdi dir="auto">{name}</bdi>
              </span>
            ))}
          </p>
        )}
      </section>

      {hasNotes && (
        <section className="sm-card sm-tx-notes" aria-label={t("txView.notes")}>
          {transaction.reversed && <NoteRow icon={LuUndo2} note="reversed">{t("tx.reversedNote")}</NoteRow>}
          {transaction.isReversal && <NoteRow icon={LuUndo2} note="reversal">{t("tx.reversalNote")} {transaction.reversalOfId && link(transaction.reversalOfId)}</NoteRow>}
          {transaction.relatedId && !transaction.isReversal && <NoteRow icon={LuPencilLine} note="correction">{t("tx.correctionNote")} {link(transaction.relatedId)}</NoteRow>}
          {transaction.isTransfer && !transaction.isReversal && <NoteRow icon={LuArrowRightLeft} note="transfer">{t("tx.transferNote")}</NoteRow>}
          {notPosted && <NoteRow icon={LuClock} note="not-posted">{t("tx.notPostedNote")}</NoteRow>}
          {!knownStatus && <NoteRow icon={LuCircleHelp} note="unknown-status">{t("tx.unknownStatusNote")}</NoteRow>}
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-tx-facts">
        <h2 id="sm-tx-facts" className="sm-card-title">{t("tx.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("tx.type")}>{kind}</Fact>
          <Fact label={t("tx.status")}><StatusChip status={transaction.status} known={knownStatus} /></Fact>
          {transaction.currency && <Fact label={t("detail.currency")}><bdi dir="ltr">{transaction.currency}</bdi></Fact>}
          {transaction.accounts.length > 0 && (
            <Fact label={t(transaction.accounts.length > 1 ? "tx.accounts" : "tx.account")}>
              <span className="sm-links">
                {transaction.accounts.map((account) =>
                  isAccountId(account.id) ? (
                    <Link key={account.id} to={accountDetailPath(account.id)} state={{ from: `${location.pathname}${location.search}` }}>
                      <bdi className="sm-user-text">{account.name ?? t("filter.accountId", { id: account.id })}</bdi>
                    </Link>
                  ) : null,
                )}
              </span>
            </Fact>
          )}
          <Fact label={t("tx.category")}>{transaction.categoryName ? <bdi className="sm-user-text">{transaction.categoryName}</bdi> : t("tx.none")}</Fact>
          {transaction.description && <Fact label={t("tx.description")}><bdi className="sm-user-text">{transaction.description}</bdi></Fact>}
          {transaction.referenceNumber && <Fact label={t("tx.reference")}><bdi dir="ltr">{transaction.referenceNumber}</bdi></Fact>}
          {moment(transaction.occurredAt) && <Fact label={t("tx.date")}><bdi>{moment(transaction.occurredAt)}</bdi></Fact>}
          {moment(transaction.reversedAt) && <Fact label={t("tx.reversedAt")}><bdi>{moment(transaction.reversedAt)}</bdi></Fact>}
          {transaction.reversalReason && <Fact label={t("tx.reversalReason")}><bdi className="sm-user-text">{transaction.reversalReason}</bdi></Fact>}
        </dl>
        {hasRecord && (
          <details className="sm-more-details" data-sm-section="record">
            <summary>{t("txView.more")}</summary>
            <dl className="sm-stats sm-stats-stacked">
              {moment(transaction.postedAt) && <Fact label={t("tx.posted")}><bdi>{moment(transaction.postedAt)}</bdi></Fact>}
              {transaction.source && <Fact label={t("tx.source")}>{transaction.source.replace(/_/g, " ")}</Fact>}
              {transaction.creatorName && <Fact label={t("tx.creator")}><bdi className="sm-user-text">{transaction.creatorName}</bdi></Fact>}
              {transaction.transferId && (
                <Fact label={t("tx.transfer")}>
                  {isAccountId(transaction.transferId) ? (
                    <Link className="sm-note-link" to={transferDetailPath(transaction.transferId)} state={{ from: `${location.pathname}${location.search}` }}><bdi dir="ltr">#{transaction.transferId}</bdi></Link>
                  ) : (
                    <bdi dir="ltr">#{transaction.transferId}</bdi>
                  )}
                </Fact>
              )}
              {transaction.reversalOfId && <Fact label={t("tx.reversalOf")}>{link(transaction.reversalOfId)}</Fact>}
              {transaction.relatedId && !transaction.isReversal && <Fact label={t("tx.replaces")}>{link(transaction.relatedId)}</Fact>}
            </dl>
          </details>
        )}
      </section>

      {transaction.entries.length > 0 && (
        <section className="sm-card" aria-labelledby="sm-tx-entries">
          <h2 id="sm-tx-entries" className="sm-card-title">{t("tx.entries")}</h2>
          <p className="sm-text sm-muted sm-fine">{t("tx.entriesHint")}</p>
          <ul className="sm-list">
            {transaction.entries.map((entry) => (
              <li key={entry.key} className="sm-row sm-row-static" data-sm-entry={entry.key}>
                <span className="sm-row-main">
                  <span className="sm-row-title sm-user-text">
                    {isAccountId(entry.accountId) ? (
                      <Link to={accountDetailPath(entry.accountId)} state={{ from: `${location.pathname}${location.search}` }}>{entry.accountName ?? t("filter.accountId", { id: entry.accountId })}</Link>
                    ) : (
                      entry.accountName ?? (entry.accountId ? t("filter.accountId", { id: entry.accountId }) : "—")
                    )}
                  </span>
                  <span className="sm-row-meta">{entry.role ? (ROLES.includes(entry.role) ? t(`tx.role.${entry.role}`) : entry.role.replace(/_/g, " ")) : "—"}</span>
                </span>
                <span className="sm-row-amount">
                  <Money plain plus value={entry.amount} currency={entry.currency} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-tx-changes">
        <h2 id="sm-tx-changes" className="sm-card-title">{t("tx.changesTitle")}</h2>
        <p className="sm-text sm-muted">{t("tx.changesBody")}</p>
        <DraftLinks ids={{ transactionId: transaction.id }} actions={[...(eligibleToCorrect(changeable(transaction)) === null ? ["transaction-correct"] : []), ...(eligibleToReverse(changeable(transaction)) === null ? ["transaction-reverse"] : [])]} />
        <Link className="sm-link-row" to={getTransactionDetailsPath(transaction.id)}>
          <span>{t("detail.openFull")}</span>
          <Chevron />
        </Link>
      </section>
    </section>
  );
}

/*
 * One transaction, read-only (GET /transactions/{id}). The response must be
 * for the transaction in the address, or it is refused. A record the person may
 * not see and one that does not exist are reported in the same words, so the
 * screen never says which. No balance is calculated; the ledger entries are the
 * backend's own signed lines.
 *
 * Correct and Reverse are not here: they move money, and Mobile does not yet.
 * The page says so in words and links to the full version; it has no disabled
 * buttons that look like features.
 */
export default function MobileTransactionDetail() {
  const { transactionId } = useParams();
  const { t, i18n } = useTranslation(MOBILE_NAMESPACE);
  const { user, workspace } = useAuthContext();
  const location = useLocation();
  const valid = isAccountId(transactionId);
  const loader = useMemo(() => transactionLoader(transactionId), [transactionId]);
  const resource = useResource(keys.transaction(transactionId), loader, { enabled: valid });
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;
  const transaction = useMemo(() => (valid && resource.data !== undefined ? buildTransactionDetail(resource.data, transactionId, { timeZone }) : null), [valid, resource.data, transactionId, timeZone]);
  const backTo = backPathFrom(location.state, MOBILE_ACTIVITY);
  const backState = backStateFrom(location.state);
  const back = (
    <Link className="sm-link-row sm-back" to={backTo} state={backState}>
      <Chevron back />
      <span>{t("tx.back")}</span>
    </Link>
  );

  if (!valid) {
    return (
      <section className="sm-page" data-sm-screen="transaction" data-sm-state="error">
        <ErrorPanel error={NOT_FOUND} />
        {back}
      </section>
    );
  }

  if (resource.loading) {
    return (
      <section className="sm-page" data-sm-screen="transaction" data-sm-state="loading" aria-busy="true">
        <Skeleton lines={5} label={t("tx.loading")} />
      </section>
    );
  }

  if (resource.status === "error" || !transaction) {
    return (
      <section className="sm-page" data-sm-screen="transaction" data-sm-state="error">
        <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} hideExistence />
        {back}
      </section>
    );
  }

  return <Detail transaction={transaction} resource={resource} backTo={backTo} backState={backState} locale={locale} timeZone={timeZone} />;
}
