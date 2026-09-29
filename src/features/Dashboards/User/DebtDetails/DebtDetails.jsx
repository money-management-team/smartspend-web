import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { LuArchive, LuArrowLeft, LuHandCoins, LuInfo, LuPencil, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { PATH, getTransactionDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { debtsApi } from "../api/debtsApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import { translateEnum } from "../FinancialOperations/transactionHelpers";
import { UNKNOWN_OUTCOME_CODES } from "../Transfers/transferHelpers";
import ArchiveDebtDialog from "../Debts/components/ArchiveDebtDialog/ArchiveDebtDialog";
import DebtBadge from "../Debts/components/DebtBadge/DebtBadge";
import DebtEditForm from "../Debts/components/DebtEditForm/DebtEditForm";
import DebtPaymentForm from "../Debts/components/DebtPaymentForm/DebtPaymentForm";
import DebtPayments from "../Debts/components/DebtPayments/DebtPayments";
import ReverseDebtPaymentDialog from "../Debts/components/ReverseDebtPaymentDialog/ReverseDebtPaymentDialog";
import {
  getDebtActions,
  getDebtErrorMessage,
  getDebtLifecycle,
  getDebtStatus,
  getDueCountdown,
  getPaymentsCount,
  hasOpeningMovement,
  isDebtEntity,
  isOverdueDebt,
  mergeDebt,
  toDateOnly,
} from "../Debts/debtHelpers";
import { formatDate, formatDateTime, formatMoney } from "../utils/formatters";

import "./DebtDetails.css";

// After these a write may have been applied (or the debt changed meanwhile):
// the debt is refetched once the dialog showing the error closes.
const STALE_CODES = ["CONFLICT", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", ...UNKNOWN_OUTCOME_CODES];

const EMPTY_NOTICE = { key: null, type: null, status: null };

/*
 * One debt (GET /debts/{id}) with its payments. Every write returns the debt
 * in its new state (`data.debt`), which replaces what is shown: paid and
 * remaining amounts, status and settlement are never calculated here.
 * - Edit → PATCH /debts/{id}.
 * - Record payment → POST /debts/{id}/payments (Idempotency-Key).
 * - Reverse payment → POST /debt-payments/{paymentId}/reverse.
 * - Archive → DELETE /debts/{id}: the page stays on the now read-only debt,
 *   since its history is kept.
 * Account balances are never touched: the Accounts, Transactions and
 * Dashboard pages read the backend's ledger when they are opened.
 */
export default function DebtDetails() {
  const { debtId } = useParams();
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request, the page is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${debtId}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, debt: null, error: null });
  // "edit" | "payment" | "archive" | { type: "reverse", payment }
  const [dialog, setDialog] = useState(null);
  // One-time success message ({ key, type, status }) for the current request.
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  // Bumped after a payment or a reversal, so the history refetches.
  const [paymentsKey, setPaymentsKey] = useState(0);
  const saveRequestRef = useRef(null);
  // Set when a write learns the page may be out of date (409, unknown
  // outcome…); the debt is refetched once the dialog showing the error closes.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    debtsApi
      .get(debtId, { signal: controller.signal })
      .then((response) => {
        const debt = response?.data?.debt;

        setResult(
          isDebtEntity(debt)
            ? { key: requestKey, debt, error: null }
            : { key: requestKey, debt: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, debt: null, error });
      });

    return () => controller.abort();
  }, [debtId, requestKey]);

  const isLoading = result.key !== requestKey;
  const { debt, error } = isLoading ? { debt: null, error: null } : result;

  const reload = () => setReloadKey((key) => key + 1);

  // Once the debt is gone for this user (404), show the not-available state.
  const markUnavailable = (requestError) => {
    setDialog(null);
    setResult({ key: requestKey, debt: null, error: requestError });
  };

  const markStale = (requestError) => {
    if (STALE_CODES.includes(requestError?.code)) staleRef.current = true;
  };

  const closeDialog = () => {
    setDialog(null);

    if (staleRef.current) {
      staleRef.current = false;
      reload();
    }
  };

  const showNotice = (type, status = null) => setNotice({ key: requestKey, type, status });

  // Shows the debt a write returned; without a usable debt, everything is
  // refetched. Nothing is patched by hand.
  const applyDebt = (nextDebt) => {
    if (!isDebtEntity(nextDebt) || String(nextDebt.id) !== String(debtId)) {
      reload();
      return;
    }

    setResult((current) => ({ ...current, debt: mergeDebt(current.debt, nextDebt) }));
  };

  /* ---------- Edit ---------- */

  const handleSave = async (payload) => {
    if (saveRequestRef.current) return saveRequestRef.current;

    const saveRequest = (async () => {
      let response;

      try {
        response = await debtsApi.update(debt.id, payload);
      } catch (requestError) {
        if (requestError?.code === "NOT_FOUND") markUnavailable(requestError);
        else if (requestError?.code !== "VALIDATION_ERROR") markStale(requestError);
        throw requestError;
      }

      // A new original amount changes the remaining amount: the backend's
      // debt is shown as is.
      applyDebt(response?.data?.debt);
      setDialog(null);
      showNotice("updateSuccess");
    })();

    saveRequestRef.current = saveRequest;

    try {
      return await saveRequest;
    } finally {
      saveRequestRef.current = null;
    }
  };

  /* ---------- Payment ---------- */

  // The response carries the payment and the debt after the money moved.
  const handlePaymentCompleted = (data) => {
    staleRef.current = false;
    applyDebt(data?.debt);
    setPaymentsKey((key) => key + 1);
    setDialog(null);
    showNotice(
      debt.direction === "receivable" ? "collectionSuccess" : "paymentSuccess",
      data?.debt ? getDebtStatus(data.debt) : null,
    );
  };

  /* ---------- Reverse ---------- */

  // Called by ReverseDebtPaymentDialog with the PAYMENT; errors are shown in
  // the dialog.
  const handleReverse = async (payment, reason) => {
    let response;

    try {
      response = await debtsApi.reversePayment(payment.id, reason);
    } catch (requestError) {
      // The payment may be reversed or gone already: refetch on close.
      markStale(requestError);
      throw requestError;
    }

    applyDebt(response?.data?.debt);
    setPaymentsKey((key) => key + 1);
    setDialog(null);
    showNotice("reverseSuccess", response?.data?.debt ? getDebtStatus(response.data.debt) : null);
  };

  /* ---------- Archive ---------- */

  const handleArchive = async () => {
    let response;

    try {
      response = await debtsApi.archive(debt.id);
    } catch (requestError) {
      if (requestError?.code === "NOT_FOUND") markUnavailable(requestError);
      else markStale(requestError);
      throw requestError;
    }

    applyDebt(response?.data?.debt);
    setDialog(null);
    showNotice("archiveSuccess");
  };

  /* ---------- Render ---------- */

  const backLink = (
    <Link className="debt-details__back" to={PATH.USER.DEBTS}>
      <LuArrowLeft aria-hidden="true" />
      <span>{t("dashboard.debts.details.back")}</span>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="debt-details">
        {backLink}
        <Loading message={t("dashboard.debts.details.loading")} />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.code === "NOT_FOUND";

    return (
      <div className="debt-details">
        {backLink}

        <div className="debt-details__state" role="alert">
          <h1>{t(isNotFound ? "dashboard.debts.details.notFoundTitle" : "dashboard.debts.details.errorTitle")}</h1>
          <p>{getDebtErrorMessage(error, t)}</p>

          {!isNotFound && (
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const actions = getDebtActions(debt);
  const lifecycle = getDebtLifecycle(debt);
  const status = getDebtStatus(debt);
  const currency = debt.currency_code;
  const countdown = getDueCountdown(debt);
  const movement = hasOpeningMovement(debt);
  const paymentsCount = getPaymentsCount(debt);
  const name = debt.counterparty_name || `#${debt.id}`;

  const money = (value) =>
    value == null || value === "" ? "—" : <bdi dir="ltr">{formatMoney(value, currency, locale)}</bdi>;
  const date = (value) => {
    const day = toDateOnly(value);
    return day ? <bdi>{formatDate(day, locale)}</bdi> : null;
  };
  const dateTime = (value) => <bdi>{formatDateTime(value, locale, timeZone)}</bdi>;
  const countdownText = countdown
    ? t(`dashboard.debts.list.${countdown.key}`, { days: new Intl.NumberFormat(locale).format(countdown.days) })
    : "—";

  const noteKey =
    lifecycle === "archived"
      ? "archivedNote"
      : lifecycle === "paid"
        ? "paidNote"
        : isOverdueDebt(debt)
          ? "overdueNote"
          : null;

  const stats = [
    ["originalAmount", money(debt.original_amount)],
    ["paidAmount", money(debt.paid_amount)],
    ["remainingAmount", money(debt.remaining_amount)],
    ["paymentsCount", paymentsCount == null ? "—" : <bdi>{new Intl.NumberFormat(locale).format(paymentsCount)}</bdi>],
    ["daysUntilDue", countdownText],
  ];

  const openingValue =
    movement == null
      ? null
      : debt.opening_transaction_id != null
        ? (
            <Link to={getTransactionDetailsPath(debt.opening_transaction_id)}>
              {t("dashboard.debts.details.openingTransaction")} <bdi dir="ltr">#{debt.opening_transaction_id}</bdi>
            </Link>
          )
        : t(movement ? "dashboard.debts.list.withMovement" : "dashboard.debts.list.recordOnly");

  const rows = [
    ["counterparty", <bdi key="name">{name}</bdi>],
    ["direction", translateEnum(t, i18n, "dashboard.debts.direction", debt.direction) || "—"],
    ["currency", <bdi key="currency" dir="ltr">{currency || "—"}</bdi>],
    ["issuedAt", date(debt.issued_at) ?? "—"],
    ["dueDate", date(debt.due_date) ?? t("dashboard.debts.list.noDueDate")],
    ["status", translateEnum(t, i18n, "dashboard.debts.status", status) || "—"],
    lifecycle !== "unknown" &&
      lifecycle !== status && ["lifecycleStatus", translateEnum(t, i18n, "dashboard.debts.status", lifecycle)],
    debt.owner?.name && ["owner", <bdi key="owner">{debt.owner.name}</bdi>],
    openingValue && ["openingMovement", openingValue],
    debt.settled_at && ["settledAt", dateTime(debt.settled_at)],
    debt.archived_at && ["archivedAt", dateTime(debt.archived_at)],
    debt.notes && [
      "notes",
      <span className="debt-details__notes" dir="auto" key="notes">
        {debt.notes}
      </span>,
    ],
    debt.created_at && ["createdAt", dateTime(debt.created_at)],
    debt.updated_at && ["updatedAt", dateTime(debt.updated_at)],
  ].filter(Boolean);

  const reverseTarget = dialog?.type === "reverse" ? dialog.payment : null;

  return (
    <div className="debt-details">
      {backLink}

      {notice.key === requestKey && (
        <div className="debt-details__notice" role="status">
          <p dir="auto">
            {t(`dashboard.debts.notices.${notice.type}`, { name })}
            {notice.status && (
              <>
                {" "}
                {t("dashboard.debts.notices.statusNow", {
                  status: translateEnum(t, i18n, "dashboard.debts.status", notice.status),
                })}
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(EMPTY_NOTICE)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <header className="debt-details__header">
        <div className="debt-details__identity">
          <h1 dir="auto">{name}</h1>

          <div className="debt-details__chips">
            <DebtBadge kind="direction" value={debt.direction} />
            <DebtBadge kind="status" value={status} />
            {currency && (
              <span className="debt-details__chip">
                <bdi dir="ltr">{currency}</bdi>
              </span>
            )}
          </div>
        </div>

        <div className="debt-details__actions">
          {actions.canRecordPayment && (
            <button
              type="button"
              className="debt-details__action debt-details__action--primary"
              onClick={() => setDialog("payment")}
            >
              <LuHandCoins aria-hidden="true" />
              <span>
                {t(
                  debt.direction === "receivable"
                    ? "dashboard.debts.actions.recordCollection"
                    : "dashboard.debts.actions.recordPayment",
                )}
              </span>
            </button>
          )}
          {actions.canEdit && (
            <button type="button" className="debt-details__action" onClick={() => setDialog("edit")}>
              <LuPencil aria-hidden="true" />
              <span>{t("dashboard.debts.actions.edit")}</span>
            </button>
          )}
          {actions.canArchive && (
            <button
              type="button"
              className="debt-details__action debt-details__action--archive"
              onClick={() => setDialog("archive")}
            >
              <LuArchive aria-hidden="true" />
              <span>{t("dashboard.debts.actions.archive")}</span>
            </button>
          )}
        </div>
      </header>

      {noteKey && (
        <p className={`debt-details__note debt-details__note--${noteKey}`} role="note">
          <LuInfo aria-hidden="true" />
          <span>{t(`dashboard.debts.details.${noteKey}`)}</span>
        </p>
      )}

      <section className="debt-details__panel" aria-labelledby="debt-details-amounts-title">
        <h2 id="debt-details-amounts-title">{t("dashboard.debts.details.amountsTitle")}</h2>

        <dl className="debt-details__stats">
          {stats.map(([key, value]) => (
            <div className={`debt-details__stat debt-details__stat--${key}`} key={key}>
              <dt>{t(`dashboard.debts.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DebtPayments
        debt={debt}
        refreshKey={paymentsKey}
        onReverse={(payment) => setDialog({ type: "reverse", payment })}
      />

      <section className="debt-details__panel" aria-labelledby="debt-details-title">
        <h2 id="debt-details-title">{t("dashboard.debts.details.title")}</h2>

        <dl className="debt-details__list">
          {rows.map(([key, value]) => (
            <div className="debt-details__row" key={key}>
              <dt>{t(`dashboard.debts.fields.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {dialog === "edit" && actions.canEdit && (
        <DebtEditForm debt={debt} onSave={handleSave} onClose={closeDialog} />
      )}

      {dialog === "payment" && actions.canRecordPayment && (
        <DebtPaymentForm
          debt={debt}
          onCompleted={handlePaymentCompleted}
          onOutdated={markStale}
          onClose={closeDialog}
        />
      )}

      {reverseTarget && actions.canReversePayments && (
        <ReverseDebtPaymentDialog
          payment={reverseTarget}
          debt={debt}
          onConfirm={(reason) => handleReverse(reverseTarget, reason)}
          onClose={closeDialog}
        />
      )}

      {dialog === "archive" && actions.canArchive && (
        <ArchiveDebtDialog debt={debt} onConfirm={handleArchive} onClose={closeDialog} />
      )}
    </div>
  );
}
