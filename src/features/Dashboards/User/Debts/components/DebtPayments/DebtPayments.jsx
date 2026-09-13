import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuUndo2 } from "react-icons/lu";

import Loading from "../../../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { getAccountDetailsPath, getTransactionDetailsPath } from "../../../../../../routes/Path";
import { ApiError } from "../../../api/apiClient";
import { debtsApi } from "../../../api/debtsApi";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate, formatDateTime, formatMoney } from "../../../utils/formatters";
import {
  PAYMENTS_PER_PAGE,
  canReversePayment,
  getDebtErrorMessage,
  isReversedPayment,
  parsePage,
  toDateOnly,
} from "../../debtHelpers";
import DebtBadge from "../DebtBadge/DebtBadge";

import "./DebtPayments.css";

// From the payment account's point of view: paying a payable debt takes the
// money out of it, collecting a receivable brings it in.
const SIGNS = { payable: "−", receivable: "+" };

const transactionLink = (id) =>
  id == null ? null : (
    <Link to={getTransactionDetailsPath(id)}>
      <bdi dir="ltr">#{id}</bdi>
    </Link>
  );

/*
 * The debt's payments (GET /debts/{id}/payments, `data.payments` paginator),
 * in the backend's order. Reversed payments stay listed, marked as reversed,
 * with their reversal transaction. Each payment links to its transaction and
 * account. `refreshKey` changes after a payment or a reversal, which refetches
 * from the first page. `onReverse(payment)` opens the reverse dialog; it is
 * only offered for posted, not-yet-reversed payments of a non-archived debt.
 */
export default function DebtPayments({ debt, refreshKey = 0, onReverse }) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;
  const debtId = debt.id;

  // The page belongs to the refresh it was chosen in: a new refresh starts
  // again from page 1.
  const [pageState, setPageState] = useState({ refreshKey, page: 1 });
  const page = pageState.refreshKey === refreshKey ? pageState.page : 1;
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${debtId}:${page}:${refreshKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    debtsApi
      .listPayments(
        debtId,
        { per_page: PAYMENTS_PER_PAGE, page: page > 1 ? page : undefined },
        { signal: controller.signal },
      )
      .then((response) => {
        const parsed = parsePage(response, "payments");

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : { key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [debtId, page, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];

  const goToPage = (next) => setPageState({ refreshKey, page: next });

  const money = (payment) => formatMoney(payment.amount, payment.currency_code || debt.currency_code, locale);
  const dateTime = (value) => (value ? <bdi>{formatDateTime(value, locale, timeZone)}</bdi> : "—");

  return (
    <section className="debt-payments" aria-labelledby="debt-payments-title">
      <header className="debt-payments__head">
        <div>
          <h2 id="debt-payments-title">
            {t("dashboard.debts.payments.title")}
            {listPage && !isLoading && <span className="debt-payments__count">{listPage.total}</span>}
          </h2>
          <p>{t("dashboard.debts.payments.subtitle")}</p>
        </div>
      </header>

      {isLoading && <Loading size="small" message={t("dashboard.debts.payments.loading")} />}

      {!isLoading && error && (
        <div className="debt-payments__state debt-payments__state--error" role="alert">
          <p>{getDebtErrorMessage(error, t)}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="debt-payments__state">
          <p>
            {listPage && listPage.total > 0 && listPage.page > 1
              ? t("dashboard.debts.payments.emptyPage")
              : t("dashboard.debts.payments.empty")}
          </p>
          {listPage && listPage.total > 0 && listPage.page > 1 && (
            <button type="button" onClick={() => goToPage(1)}>
              {t("dashboard.transactions.pagination.first")}
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="debt-payments__table-wrap">
          <table className="debt-payments__table">
            <caption className="debt-payments__caption">{t("dashboard.debts.payments.caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("dashboard.debts.payments.fields.paidAt")}</th>
                <th scope="col" className="debt-payments__amount">
                  {t("dashboard.debts.payments.fields.amount")}
                </th>
                <th scope="col">{t("dashboard.debts.payments.fields.account")}</th>
                <th scope="col">{t("dashboard.debts.payments.fields.status")}</th>
                <th scope="col">{t("dashboard.debts.payments.fields.transaction")}</th>
                <th scope="col">{t("dashboard.debts.payments.fields.notes")}</th>
                <th scope="col">{t("dashboard.debts.payments.fields.createdAt")}</th>
                <th scope="col">
                  <span className="debt-payments__caption">{t("dashboard.debts.payments.fields.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((payment, index) => {
                const isReversed = isReversedPayment(payment);
                const account = payment.account && typeof payment.account === "object" ? payment.account : null;
                const paidAt = toDateOnly(payment.paid_at);

                return (
                  <tr
                    key={payment.id ?? `${payment.transaction_id}-${index}`}
                    className={isReversed ? "debt-payments__row--reversed" : undefined}
                  >
                    <td>
                      <bdi>{paidAt ? formatDate(paidAt, locale) : formatDate(payment.paid_at, locale, timeZone)}</bdi>
                    </td>
                    <td className="debt-payments__amount">
                      <bdi dir="ltr" className={`debt-payments__value debt-payments__value--${debt.direction}`}>
                        {SIGNS[debt.direction] ?? ""}
                        {money(payment)}
                      </bdi>
                    </td>
                    <td>
                      {account?.id != null ? (
                        <Link to={getAccountDetailsPath(account.id)}>
                          <bdi>{account.name ?? `#${account.id}`}</bdi>
                        </Link>
                      ) : (
                        <bdi>{account?.name ?? "—"}</bdi>
                      )}
                    </td>
                    <td>
                      <DebtBadge kind="payment" value={isReversed ? "reversed" : payment.status} />
                      {isReversed && payment.reversed_at && (
                        <small className="debt-payments__meta">
                          {t("dashboard.debts.payments.reversedOn")} {dateTime(payment.reversed_at)}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="debt-payments__links">
                        {transactionLink(payment.transaction_id) ?? "—"}
                        {payment.reversal_transaction_id != null && (
                          <small className="debt-payments__meta">
                            {t("dashboard.debts.payments.reversal")} {transactionLink(payment.reversal_transaction_id)}
                          </small>
                        )}
                      </span>
                    </td>
                    <td className="debt-payments__notes">
                      {payment.notes ? <span dir="auto">{payment.notes}</span> : "—"}
                    </td>
                    <td>{dateTime(payment.created_at)}</td>
                    <td className="debt-payments__actions">
                      {canReversePayment(payment, debt) && (
                        <button type="button" className="debt-payments__reverse" onClick={() => onReverse(payment)}>
                          <LuUndo2 aria-hidden="true" />
                          <span>{t("dashboard.debts.actions.reversePayment")}</span>
                        </button>
                      )}
                      {isReversed && (
                        <span className="debt-payments__muted">{t("dashboard.debts.payments.alreadyReversed")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && listPage && listPage.lastPage > 1 && (
        <footer className="debt-payments__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: listPage.from,
              to: listPage.to,
              total: listPage.total,
            })}
          </span>

          <div className="debt-payments__pages">
            <button
              type="button"
              onClick={() => goToPage(listPage.page - 1)}
              disabled={listPage.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", { page: listPage.page, lastPage: listPage.lastPage })}
            </span>
            <button
              type="button"
              onClick={() => goToPage(listPage.page + 1)}
              disabled={listPage.page >= listPage.lastPage}
              aria-label={t("dashboard.transactions.pagination.next")}
            >
              <LuChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
