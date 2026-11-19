import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { actionPath } from "../forms/actionRoutes.js";
import DraftLinks from "../forms/DraftLinks.jsx";

import { useAuthContext } from "../../contexts/auth/useAuthContext";
import { getDebtDetailsPath } from "../../routes/Path.js";
import { debtLoader, keys, paymentsLoader } from "../data/loaders.js";
import { PAYMENTS_PER_PAGE, isAccountId } from "../data/readApi.js";
import { useResource } from "../data/useResource.js";
import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import { formatDay } from "../money/format.js";
import Money from "../money/Money.jsx";
import { buildDebtDetail, buildPaymentsPage } from "../models/debts.js";
import { MOBILE_DEBTS, accountDetailPath, activityDetailPath } from "../navigation.js";
import RecordScreen from "../planning/RecordScreen.jsx";
import Chevron from "../ui/Chevron.jsx";
import ErrorPanel from "../ui/ErrorPanel.jsx";
import PageLinks from "../ui/PageLinks.jsx";
import { readPageParam, withParam } from "../ui/pageParam.js";
import Skeleton from "../ui/Skeleton.jsx";
import StaleNotice from "../ui/StaleNotice.jsx";
import StateChip, { Fact } from "../ui/StateChip.jsx";
import WriteClosedNotice from "../ui/WriteClosedNotice.jsx";
import { DEBT_TONES, PAYMENT_TONES } from "./debtTones.js";

const MALFORMED = Object.freeze({ code: "MALFORMED_RESPONSE" });

/*
 * A debt's payments, read-only (GET /debts/{id}/payments): the whole history a page at a time, newest first as the
 * backend orders it. The page lives in the address (`?pp=`), so Back and a shared link show the same slice. A reversed
 * payment stays listed, struck through and marked, with the day it was reversed and a link to the reversal. Amounts are
 * the backend's, in the debt's currency; a payment in another currency makes the history unavailable, never mixed in.
 */
function Payments({ debt, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const page = readPageParam(new URLSearchParams(location.search), "pp");
  const loader = useMemo(() => paymentsLoader(debt.id, page), [debt.id, page]);
  const resource = useResource(keys.payments(debt.id, page), loader);
  const built = useMemo(() => {
    if (resource.data === undefined) return null;
    try {
      return buildPaymentsPage(resource.data, { page, perPage: PAYMENTS_PER_PAGE }, debt.id, debt.currency);
    } catch {
      return null;
    }
  }, [resource.data, page, debt.id, debt.currency]);

  const here = `${location.pathname}${location.search}`;
  const linkState = { from: here };

  let body;
  if (resource.loading) body = <Skeleton lines={2} label={t("debts.payments.loading")} />;
  else if (!built) body = <ErrorPanel error={resource.error ?? MALFORMED} onRetry={resource.reload} retrying={resource.refreshing} compact />;
  else if (built.rows.length === 0 && built.total > 0) {
    // An address that asks for a page past the end: the payments exist, so say so and lead back to the newest.
    body = <Link className="sm-card-link" to={withParam(location, "pp", null)} replace state={location.state} data-sm-payments="past-end">{t("debtView.payments.newer")}</Link>;
  } else if (built.rows.length === 0) body = <p className="sm-text sm-muted" data-sm-payments="none">{t("debts.payments.none")}</p>;
  else {
    body = (
      <>
        {resource.stale && <StaleNotice error={resource.error} updatedAt={resource.updatedAt} onRetry={resource.reload} retrying={resource.refreshing} />}
        <p className="sm-text sm-muted sm-fine" data-sm-payments-total={built.total}>{t("debtView.payments.total", { n: built.total })}</p>
        <ul className="sm-list" data-sm-payments={built.rows.length} data-sm-page={built.page}>
          {built.rows.map((payment) => {
            const paid = formatDay(payment.paidAt, locale);
            const reversedDay = formatDay(payment.reversedAt, locale, timeZone);

            return (
              <li key={payment.id} className="sm-row" data-sm-payment={payment.id} data-sm-status={payment.status ?? "none"} data-sm-reversed={payment.reversed ? "true" : undefined}>
                <span className="sm-row-main">
                  <span className="sm-row-title">
                    <span className={payment.reversed ? "sm-struck" : undefined}><Money plain value={payment.amount} currency={payment.currency} /></span>
                    {payment.reversed && <span className="sm-sr"> {t("debts.paymentStatus.reversed")}</span>}
                  </span>
                  <span className="sm-row-meta">
                    {paid && <bdi>{paid}</bdi>}
                    {payment.account?.name && (
                      <>
                        {paid && " · "}
                        {isAccountId(payment.account.id) ? (
                          <Link to={accountDetailPath(payment.account.id)} state={linkState}><bdi className="sm-user-text">{payment.account.name}</bdi></Link>
                        ) : (
                          <bdi className="sm-user-text">{payment.account.name}</bdi>
                        )}
                      </>
                    )}
                  </span>
                  <span className="sm-chips-inline"><StateChip state={payment.status} known={payment.statusKnown} labels="debts.paymentStatus" tones={PAYMENT_TONES} /></span>
                  {payment.reversed && reversedDay && <span className="sm-row-meta">{t("debtView.payments.reversedOn")} <bdi>{reversedDay}</bdi></span>}
                  {payment.notes && <span className="sm-text sm-user-text sm-fine sm-payment-note">{payment.notes}</span>}
                  {!payment.reversed && debt.lifecycle !== "archived" && <Link className="sm-note-link" to={actionPath("debt-payment-reverse", { debtId: debt.id, paymentId: payment.id })} data-sm-action="debt-payment-reverse">{t("forms.flows.debt-payment-reverse.link")}</Link>}
                  {payment.transactionId && (
                    <Link className="sm-note-link" to={activityDetailPath(payment.transactionId)} state={linkState} data-sm-link="payment-movement">{t("debts.payments.movement")}</Link>
                  )}
                  {payment.reversalTransactionId && (
                    <Link className="sm-note-link" to={activityDetailPath(payment.reversalTransactionId)} state={linkState} data-sm-link="payment-reversal">{t("debtView.payments.reversal")}</Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <PageLinks
          label={t("debts.payments.title")}
          name="payments"
          current={built.page}
          lastPage={built.lastPage}
          hrefFor={(next) => withParam(location, "pp", next > 1 ? next : null)}
          state={location.state}
          newer={t("debtView.payments.newer")}
          older={t("debtView.payments.older")}
          pageText={t("debtView.payments.page", { page: built.page, pages: built.lastPage })}
        />
      </>
    );
  }

  return (
    <section className="sm-card" aria-labelledby="sm-debt-payments" data-sm-section="debt-payments">
      <h2 id="sm-debt-payments" className="sm-card-title">{t("debts.payments.title")}</h2>
      <p className="sm-text sm-muted sm-fine">{t("debtView.payments.hint")}</p>
      {body}
    </section>
  );
}

/* The due date in words, from the backend's own day count: days left, due today, or days past. Nothing is worked out from dates. */
function Countdown({ debt, t }) {
  if (debt.daysUntilDue === null || debt.status === "paid" || debt.status === "archived") return null;

  const days = debt.daysUntilDue;

  return (
    <Fact label={t(days >= 0 ? "debtView.daysUntil" : "debtView.daysOverdue")}>
      {days === 0 ? t("debtView.dueToday") : <bdi dir="ltr">{Math.abs(days)}</bdi>}
    </Fact>
  );
}

function Detail({ debt, locale, timeZone }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const direction = debt.direction ? t(`debts.direction.${debt.direction}`) : t("debts.direction.unknown");
  const day = (value) => formatDay(value, locale);
  const noteKey = debt.lifecycle === "archived" ? "archived" : debt.status === "paid" ? "paid" : debt.overdue === true || debt.status === "overdue" ? "overdue" : null;

  return (
    <>
      <section className="sm-card sm-hero sm-detail-hero" aria-labelledby="sm-debt-title" data-sm-status={debt.status ?? "none"} data-sm-direction={debt.direction ?? "none"}>
        <h2 id="sm-debt-title" className="sm-card-title sm-user-text">{debt.counterparty ?? t("debts.unnamed")}</h2>
        <p className="sm-chips-inline">
          <span className="sm-chip">{direction}</span>
          <StateChip state={debt.status} known={debt.statusKnown} labels="debts.status" tones={DEBT_TONES} />
        </p>
        <p className="sm-balance-label">{t(debt.direction === "receivable" ? "debts.remainingReceivable" : "debts.remaining")}</p>
        <Money className="sm-hero-money" value={debt.remaining} currency={debt.currency} />
        {/* The original and what was paid, under the outstanding figure: the backend's own. */}
        <dl className="sm-debt-figures">
          <div data-sm-figure="original"><dt>{t("debts.original")}</dt><dd><Money plain value={debt.original} currency={debt.currency} /></dd></div>
          <div data-sm-figure="paid"><dt>{t("debts.paid")}</dt><dd><Money plain value={debt.paid} currency={debt.currency} /></dd></div>
        </dl>
        {/* When: the due date and the backend's own day count. */}
        <dl className="sm-debt-when">
          <Fact label={t("debts.due")}>{day(debt.dueDate) ? <bdi>{day(debt.dueDate)}</bdi> : t("debts.noDue")}</Fact>
          <Countdown debt={debt} t={t} />
        </dl>
        <p className="sm-text sm-muted sm-fine">{t("debts.backendFigures")}</p>
      </section>

      {noteKey && (
        <div className="sm-card" role="note" data-sm-note={`debt-${noteKey}`}>
          <p className="sm-text">{t(`debtView.note.${noteKey}`)}</p>
        </div>
      )}

      <section className="sm-card" aria-labelledby="sm-debt-facts">
        <h2 id="sm-debt-facts" className="sm-card-title">{t("debts.details")}</h2>
        {/* The due date and its countdown are in the summary above. */}
        <dl className="sm-stats sm-stats-stacked">
          <Fact label={t("debts.directionLabel")}>{direction}</Fact>
          {debt.currency && <Fact label={t("debts.currency")}><bdi dir="ltr">{debt.currency}</bdi></Fact>}
          {day(debt.issuedAt) && <Fact label={t("debts.issued")}><bdi>{day(debt.issuedAt)}</bdi></Fact>}
          {debt.lifecycle && debt.lifecycle !== debt.status && <Fact label={t("debts.lifecycle")}><StateChip state={debt.lifecycle} known={debt.lifecycleKnown} labels="debts.status" tones={DEBT_TONES} /></Fact>}
          {debt.paymentsCount !== null && <Fact label={t("debts.paymentsCount")}><bdi dir="ltr">{debt.paymentsCount}</bdi></Fact>}
          <Fact label={t("debts.opening")}>
            {debt.openingTransactionId ? <Link to={activityDetailPath(debt.openingTransactionId)}>{t("debts.openingMoved")}</Link> : debt.hasMovement === false ? t("debts.recordOnly") : t("debts.notStated")}
          </Fact>
          {debt.owner && <Fact label={t("debtView.owner")}><bdi className="sm-user-text">{debt.owner}</bdi></Fact>}
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

      <Payments debt={debt} locale={locale} timeZone={timeZone} />

      <section className="sm-card" aria-labelledby="sm-debt-changes">
        <h2 id="sm-debt-changes" className="sm-card-title">{t("planning.changesTitle")}</h2>
        <WriteClosedNotice operation="debt.payment" compact />
        <DraftLinks ids={{ debtId: debt.id }} actions={["archived", "paid"].includes(debt.status) || debt.lifecycle === "archived" ? [] : ["debt-payment", "debt-edit"]} />
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
  const { user, workspace } = useAuthContext();
  const locale = i18n.resolvedLanguage?.startsWith("ar") ? "ar" : "en";
  const timeZone = user?.timezone ?? workspace?.timezone;

  return <RecordScreen screen="debt" recordId={debtId} keyOf={keys.debt} loaderOf={debtLoader} build={buildDebtDetail} backFallback={MOBILE_DEBTS} strings="debts" render={(debt) => <Detail debt={debt} locale={locale} timeZone={timeZone} />} />;
}
