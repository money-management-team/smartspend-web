import { LuChevronLeft, LuChevronRight, LuUndo2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import Loading from "../../../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../../../contexts/auth/useAuthContext";
import { getTransactionDetailsPath } from "../../../../../../routes/Path";
import { getApiErrorMessage } from "../../../api/apiClient";
import { getDisplayLocale } from "../../../Accounts/accountHelpers";
import { formatDate, formatMoney } from "../../../utils/formatters";
import TransactionFilters from "../TransactionFilters/TransactionFilters";
import TransactionStatusBadge from "../TransactionStatusBadge/TransactionStatusBadge";
import {
  TYPE_FILTERS,
  canChangeTransaction,
  getAmountSign,
  getAmountTone,
  getPrimaryAccount,
  getTransactionTitle,
  hasActiveFilters,
  isReversalRecord,
  isTransferTransaction,
  renderTransactionIcon,
  translateEnum,
} from "../../transactionHelpers";

import "./Ledger.css";

/*
 * Server-paginated transactions list (GET /transactions). Filters, sort and
 * page live in the URL; reversed transactions stay listed as history.
 */
export default function Ledger({
  page,
  isLoading,
  error,
  filters,
  accounts,
  categories,
  listSearch,
  onFiltersChange,
  onClearFilters,
  onPageChange,
  onRetry,
  onReverse,
}) {
  const { t, i18n } = useTranslation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;
  const items = page?.items ?? [];
  const filtered = hasActiveFilters(filters);

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <header className="ledger__header">
        <div className="ledger__title">
          <span className="ledger__kicker">
            {t("dashboard.financialOperations.ledger.kicker")}
          </span>

          <h2 id="ledger-title">
            {t("dashboard.transactions.title")}
            {page && !isLoading && <span className="ledger__count">{page.total}</span>}
          </h2>
        </div>

        <div className="ledger__filters" role="group" aria-label={t("dashboard.transactions.fields.type")}>
          {TYPE_FILTERS.map((item) => {
            const isActive = (filters.type || "all") === item;

            return (
              <button
                type="button"
                key={item}
                aria-pressed={isActive}
                className={isActive ? "ledger__filter ledger__filter--active" : "ledger__filter"}
                onClick={() => onFiltersChange({ type: item === "all" ? "" : item })}
              >
                {t(`dashboard.transactions.filters.types.${item}`)}
              </button>
            );
          })}
        </div>
      </header>

      <TransactionFilters
        filters={filters}
        accounts={accounts}
        categories={categories}
        onChange={onFiltersChange}
        onClear={onClearFilters}
      />

      <div className="ledger__list">
        {isLoading && <Loading message={t("dashboard.transactions.states.loading")} />}

        {!isLoading && error && (
          <div className="ledger__state ledger__state--error" role="alert">
            <p>{getApiErrorMessage(error, t)}</p>
            <div className="ledger__state-actions">
              <button type="button" onClick={onRetry}>{t("common.retry")}</button>
              {filtered && (
                <button type="button" onClick={onClearFilters}>
                  {t("dashboard.transactions.filters.clear")}
                </button>
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="ledger__state">
            {page && page.total > 0 && page.page > 1 ? (
              <>
                <p>{t("dashboard.transactions.states.emptyPage")}</p>
                <button type="button" onClick={() => onPageChange(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : filtered ? (
              <>
                <p>{t("dashboard.transactions.states.emptyFiltered")}</p>
                <button type="button" onClick={onClearFilters}>
                  {t("dashboard.transactions.filters.clear")}
                </button>
              </>
            ) : (
              <p>{t("dashboard.transactions.states.empty")}</p>
            )}
          </div>
        )}

        {!isLoading && !error && items.map((transaction) => {
          const tone = getAmountTone(transaction);
          const account = getPrimaryAccount(transaction);
          const isReversed = transaction.status === "reversed";
          const amount = String(transaction.amount ?? "").replace(/^-/, "");
          const meta = [
            transaction.category?.name,
            account?.name,
            formatDate(transaction.occurred_at, locale, timeZone),
          ].filter(Boolean);

          return (
            <article
              className={`ledger-row${isReversed ? " ledger-row--reversed" : ""}`}
              key={transaction.id}
            >
              <span className={`ledger-row__icon ledger-row__icon--${tone}`} aria-hidden="true">
                {renderTransactionIcon(transaction)}
              </span>

              <div className="ledger-row__copy">
                {/* Stretched over the row: the row opens the details page. */}
                <Link
                  className="ledger-row__link"
                  to={getTransactionDetailsPath(transaction.id)}
                  state={{ from: listSearch }}
                >
                  <strong dir="auto">{getTransactionTitle(transaction, t, i18n)}</strong>
                </Link>
                <small>
                  {translateEnum(t, i18n, "dashboard.transactions.types", transaction.type)}
                  {meta.map((part, index) => (
                    <span key={index}>
                      {" · "}
                      <bdi>{part}</bdi>
                    </span>
                  ))}
                </small>
              </div>

              <div className="ledger-row__side">
                <strong className={`ledger-row__amount ledger-row__amount--${tone}`} dir="ltr">
                  {getAmountSign(transaction)}
                  {formatMoney(amount, transaction.currency_code, locale)}
                </strong>

                <div className="ledger-row__badges">
                  {transaction.status !== "posted" && (
                    <TransactionStatusBadge status={transaction.status} />
                  )}
                  {isReversalRecord(transaction) && (
                    <span className="ledger-row__chip">{t("dashboard.transactions.chips.reversal")}</span>
                  )}
                  {transaction.related_transaction_id != null && !isReversalRecord(transaction) && (
                    <span className="ledger-row__chip">{t("dashboard.transactions.chips.correction")}</span>
                  )}
                  {isTransferTransaction(transaction) && transaction.type !== "transfer" && (
                    <span className="ledger-row__chip">{t("dashboard.transactions.chips.transfer")}</span>
                  )}
                </div>
              </div>

              {canChangeTransaction(transaction) ? (
                <button
                  type="button"
                  className="ledger-row__reverse"
                  onClick={() => onReverse(transaction)}
                  aria-label={t("dashboard.transactions.actions.reverseNamed", {
                    name: getTransactionTitle(transaction, t, i18n),
                  })}
                  title={t("dashboard.transactions.actions.reverse")}
                >
                  <LuUndo2 aria-hidden="true" />
                </button>
              ) : (
                <span className="ledger-row__reverse-placeholder" aria-hidden="true" />
              )}
            </article>
          );
        })}
      </div>

      {!isLoading && !error && page && page.lastPage > 1 && (
        <footer className="ledger__pagination">
          <span>
            {t("dashboard.transactions.pagination.summary", {
              from: page.from,
              to: page.to,
              total: page.total,
            })}
          </span>

          <div className="ledger__pages">
            <button
              type="button"
              onClick={() => onPageChange(page.page - 1)}
              disabled={page.page <= 1}
              aria-label={t("dashboard.transactions.pagination.previous")}
            >
              <LuChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {t("dashboard.transactions.pagination.page", {
                page: page.page,
                lastPage: page.lastPage,
              })}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page.page + 1)}
              disabled={page.page >= page.lastPage}
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
