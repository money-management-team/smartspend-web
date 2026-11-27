import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import DraftLinks from "../forms/DraftLinks.jsx";

import { getTransferDetailsPath } from "../../routes/Path.js";
import { keys, transferLoader } from "../data/loaders.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatMoment } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildTransferDetail } from "../models/transfers.js";
import { MOBILE_TRANSFERS, activityDetailPath } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import Chevron from "../ui/Chevron.jsx";
import StateChip, { Fact } from "../ui/StateChip.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";
import { TRANSFER_TONES } from "./transferTones.js";

const TX_TYPES = ["transfer", "fee", "reversal"];

function Detail({ transfer, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const name = (account) => account?.name ?? (account?.id ? t("transfers.accountNumber", { id: account.id }) : t("transfers.accountUnknown"));
  const nameOfAccount = (id) => [transfer.from, transfer.to].find((account) => account?.id === id)?.name ?? t("transfers.accountNumber", { id });

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-transfer-title">
        <h2 id="sm-transfer-title" className="sm-card-title">
          <bdi className="sm-user-text">{name(transfer.from)}</bdi> <span aria-hidden="true">→</span><span className="sm-sr">{t("transfers.to")}</span> <bdi className="sm-user-text">{name(transfer.to)}</bdi>
        </h2>
        <p className="sm-chips-inline"><StateChip state={transfer.status} known={transfer.statusKnown} labels="transfers.status" tones={TRANSFER_TONES} /></p>
        <p className="sm-balance-label">{t("transfers.amount")}</p>
        <Money className="sm-hero-money" value={transfer.amount} currency={transfer.currency} />
        {transfer.hasFee && <p className="sm-hero-note">{t("transfers.fee")} <Money value={transfer.fee} currency={transfer.currency} />{transfer.feeCategory && <> · <bdi className="sm-user-text">{transfer.feeCategory}</bdi></>}</p>}
      </section>

      <section className="sm-card" aria-labelledby="sm-transfer-facts">
        <h2 id="sm-transfer-facts" className="sm-card-title">{t("transfers.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("transfers.fromLabel")}><bdi className="sm-user-text">{name(transfer.from)}</bdi></Fact>
          <Fact label={t("transfers.toLabel")}><bdi className="sm-user-text">{name(transfer.to)}</bdi></Fact>
          {formatMoment(transfer.occurredAt, locale) && <Fact label={t("transfers.occurred")}><bdi>{formatMoment(transfer.occurredAt, locale)}</bdi></Fact>}
          {formatMoment(transfer.postedAt, locale) && <Fact label={t("transfers.posted")}><bdi>{formatMoment(transfer.postedAt, locale)}</bdi></Fact>}
          {transfer.description && <Fact label={t("transfers.description")}><bdi className="sm-user-text">{transfer.description}</bdi></Fact>}
          {transfer.reference && <Fact label={t("transfers.reference")}><bdi dir="ltr" className="sm-user-text">{transfer.reference}</bdi></Fact>}
        </dl>
      </section>

      {transfer.transactions.length > 0 && (
        <section className="sm-card" aria-labelledby="sm-transfer-ledger">
          <h2 id="sm-transfer-ledger" className="sm-card-title">{t("transfers.ledgerTitle")}</h2>
          <p className="sm-text sm-muted sm-fine">{t("transfers.ledgerHint")}</p>
          <ul className="sm-list">
            {transfer.transactions.map((transaction) => (
              <li key={transaction.id} className="sm-row" data-sm-tx={transaction.id} data-sm-type={transaction.type ?? "none"}>
                <span className="sm-row-main">
                  <span className="sm-row-title">{TX_TYPES.includes(transaction.type) ? t(`transfers.txType.${transaction.type}`) : t("planning.state.unknown", { status: transaction.type ?? "?" })}</span>
                  {transaction.entries.map((entry) => (
                    <span key={`${entry.accountId}:${entry.role}`} className="sm-row-meta">
                      <bdi className="sm-user-text">{nameOfAccount(entry.accountId)}</bdi> <Money plain plus value={entry.amount} currency={transfer.currency} />
                    </span>
                  ))}
                  <Link className="sm-note-link" to={activityDetailPath(transaction.id)}>{t("transfers.openTransaction")}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sm-card" aria-labelledby="sm-transfer-changes">
        <h2 id="sm-transfer-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <WriteClosedNotice operation="transfer.reverse" compact />
        <DraftLinks ids={{ transferId: transfer.id }} actions={transfer.status === "posted" ? ["transfer-reverse"] : []} />
        <Link className="sm-link-row" to={getTransferDetailsPath(transfer.id)}>
          <span>{t("transfers.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One transfer, read-only (GET /transfers/{id}); the page rules are RecordScreen's. */
export default function MobileTransferDetail() {
  const { transferId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="transfer" recordId={transferId} keyOf={keys.transfer} loaderOf={transferLoader} build={buildTransferDetail} backFallback={MOBILE_TRANSFERS} strings="transfers" render={(transfer) => <Detail transfer={transfer} locale={locale} />} />;
}
