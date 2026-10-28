import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { getDebtDetailsPath } from "../../routes/Path.js";
import { debtLoader, keys, paymentsLoader } from "../data/loaders.js";
import { PAYMENTS_PER_PAGE } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildDebtDetail, buildPaymentsPage } from "../models/debts.js";
import { MOBILE_DEBTS, activityDetailPath } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import StateChip, { Fact } from "../ui/StateChip.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";
import { DEBT_TONES, PAYMENT_TONES } from "./debtTones.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * The latest payments of a debt (GET /debts/{id}/payments, the first page).
 * A reversed payment stays listed and says so; the full history is in the full version.
 */
function Payments({ debt, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const loader = useMemo(() => paymentsLoader(debt.id, 1), [debt.id]);
  const resource = useResource(keys.payments(debt.id, 1), loader);
  const page = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildPaymentsPage(resource.data, { page: 1, perPage: PAYMENTS_PER_PAGE }, debt.id, debt.currency);
    } catch {
      return null;
    }
  }, [resource.data, debt.id, debt.currency]);

  let body;
  if (resource.loading) body = <Skeleton lines={2} label={t("debts.payments.loading")} />;
  else if (!page) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} />;
  else if (page.rows.length === 0) body = <p className="sm-text sm-muted" data-sm-payments="none">{t("debts.payments.none")}</p>;
  else {
    body = (
      <>
        <ul className="sm-list" data-sm-payments={page.rows.length}>
          {page.rows.map((payment) => (
            <li key={payment.id} className="sm-row" data-sm-payment={payment.id} data-sm-status={payment.status ?? "none"}>
              <span className="sm-row-main">
                <span className="sm-row-title"><Money plain value={payment.amount} currency={payment.currency} /></span>
                <span className="sm-row-meta">
                  {formatDay(payment.paidAt, locale) && <bdi>{formatDay(payment.paidAt, locale)}</bdi>}
                  {payment.account?.name && <> · <bdi className="sm-user-text">{payment.account.name}</bdi></>}
                </span>
                <span className="sm-chips-inline"><StateChip state={payment.status} known={payment.statusKnown} labels="debts.paymentStatus" tones={PAYMENT_TONES} /></span>
                {payment.transactionId && (
                  <Link className="sm-note-link" to={activityDetailPath(payment.transactionId)}>{t("debts.payments.movement")}</Link>
                )}
              </span>
            </li>
          ))}
        </ul>
        {page.total > page.rows.length && <p className="sm-text sm-muted sm-fine">{t("debts.payments.more", { shown: page.rows.length, total: page.total })}</p>}
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-debt-payments">
      <h2 id="sm-debt-payments" className="sm-card-title">{t("debts.payments.title")}</h2>
      {body}
    </section>
  );
}

function Detail({ debt, locale }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const direction = debt.direction ? t(`debts.direction.${debt.direction}`) : t("debts.direction.unknown");
  const day = (value) => formatDay(value, locale);

  return (
    <>
      <section className="sm-card sm-hero" aria-labelledby="sm-debt-title">
        <h2 id="sm-debt-title" className="sm-card-title sm-user-text">{debt.counterparty ?? t("debts.unnamed")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip">{direction}</span>
          <StateChip state={debt.status} known={debt.statusKnown} labels="debts.status" tones={DEBT_TONES} />
        </p>
        <p className="sm-balance-label">{t(debt.direction === "receivable" ? "debts.remainingReceivable" : "debts.remaining")}</p>
        <Money className="sm-hero-money" value={debt.remaining} currency={debt.currency} />
        <p className="sm-hero-note">{t("debts.original")} <Money value={debt.original} currency={debt.currency} /> · {t("debts.paid")} <Money value={debt.paid} currency={debt.currency} /></p>
        <p className="sm-text sm-muted sm-fine">{t("debts.backendFigures")}</p>
      </section>

      <section className="sm-card" aria-labelledby="sm-debt-facts">
        <h2 id="sm-debt-facts" className="sm-card-title">{t("debts.details")}</h2>
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("debts.directionLabel")}>{direction}</Fact>
          {debt.currency && <Fact label={t("debts.currency")}><bdi dir="ltr">{debt.currency}</bdi></Fact>}
          {day(debt.issuedAt) && <Fact label={t("debts.issued")}><bdi>{day(debt.issuedAt)}</bdi></Fact>}
          <Fact label={t("debts.due")}>{day(debt.dueDate) ? <bdi>{day(debt.dueDate)}</bdi> : t("debts.noDue")}</Fact>
          {debt.daysUntilDue !== null && debt.status !== "paid" && debt.status !== "archived" && <Fact label={t("debts.daysUntilDue")}><bdi dir="ltr">{debt.daysUntilDue}</bdi></Fact>}
          {debt.lifecycle && debt.lifecycle !== debt.status && <Fact label={t("debts.lifecycle")}><StateChip state={debt.lifecycle} known={debt.lifecycleKnown} labels="debts.status" tones={DEBT_TONES} /></Fact>}
          {debt.paymentsCount !== null && <Fact label={t("debts.paymentsCount")}><bdi dir="ltr">{debt.paymentsCount}</bdi></Fact>}
          <Fact label={t("debts.opening")}>
            {debt.openingTransactionId ? <Link to={activityDetailPath(debt.openingTransactionId)}>{t("debts.openingMoved")}</Link> : debt.hasMovement === false ? t("debts.recordOnly") : t("debts.notStated")}
          </Fact>
          {day(debt.settledAt) && <Fact label={t("debts.settled")}><bdi>{day(debt.settledAt)}</bdi></Fact>}
          {day(debt.archivedAt) && <Fact label={t("debts.archived")}><bdi>{day(debt.archivedAt)}</bdi></Fact>}
        </dl>
      </section>

      {debt.notes && (
        <section className="sm-card" aria-labelledby="sm-debt-notes">
          <h2 id="sm-debt-notes" className="sm-card-title">{t("planning.notes")}</h2>
          <p className="sm-text sm-user-text">{debt.notes}</p>
        </section>
      )}

      <Payments debt={debt} locale={locale} />

      <section className="sm-card" aria-labelledby="sm-debt-changes">
        <h2 id="sm-debt-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <WriteClosedNotice operation="debt.payment" compact />
        <Link className="sm-link-row" to={getDebtDetailsPath(debt.id)}>
          <span>{t("debts.openFullOne")}</span>
          <Chevron />
        </Link>
      </section>
    </>
  );
}

/* One debt, read-only (GET /debts/{id}); the page rules are RecordScreen's. */
export default function MobileDebtDetail() {
  const { debtId } = useParams();
  const { i18n } = useTranslation(MOBILE_NAMESPACE);
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";

  return <RecordScreen screen="debt" recordId={debtId} keyOf={keys.debt} loaderOf={debtLoader} build={buildDebtDetail} backFallback={MOBILE_DEBTS} strings="debts" render={(debt) => <Detail debt={debt} locale={locale} />} />;
}
