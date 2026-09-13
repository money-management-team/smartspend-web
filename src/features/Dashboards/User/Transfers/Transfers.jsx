import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  LuArrowRightLeft,
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuX,
} from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { useAuthContext } from "../../../../contexts/auth/useAuthContext";
import { getTransferDetailsPath } from "../../../../routes/Path";
import { accountsApi } from "../api/accountsApi";
import { ApiError, getStoredWorkspace } from "../api/apiClient";
import { transfersApi } from "../api/transfersApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import TransactionStatusBadge from "../FinancialOperations/components/TransactionStatusBadge/TransactionStatusBadge";
import { formatDate, formatMoney } from "../utils/formatters";
import TransferFilters from "./components/TransferFilters/TransferFilters";
import TransferForm from "./components/TransferForm/TransferForm";
import {
  getAccountLabel,
  getFromAccount,
  getToAccount,
  getTransferErrorMessage,
  hasActiveTransferFilters,
  hasTransferFee,
  parseTransferPage,
  readTransferFilters,
  transferFiltersToQuery,
  transferFiltersToSearchParams,
} from "./transferHelpers";

import "./Transfers.css";

// Built from the live URL, not the last render: two quick filter changes must
// not overwrite each other.
const readCurrentFilters = () =>
  readTransferFilters(new URLSearchParams(window.location.search));

/*
 * Transfers between the user's own accounts (GET /transfers). A transfer is
 * neither income nor expense, so it is listed here rather than in the
 * transactions ledger; its amount is shown without a +/− sign and nothing on
 * this page adds transfer amounts up. Reversal and the full movement live on
 * the details page.
 */
export default function Transfers() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user, workspace } = useAuthContext();
  const locale = getDisplayLocale(i18n.language);
  const timeZone = user?.timezone ?? workspace?.timezone;

  const [searchParams, setSearchParams] = useSearchParams();
  // Filters and page live in the URL, so the details page's back link (and
  // the browser's) return to the same view.
  const filters = useMemo(() => readTransferFilters(searchParams), [searchParams]);
  const query = useMemo(() => transferFiltersToQuery(filters), [filters]);
  const isFiltered = hasActiveTransferFilters(filters);
  // `?new=1` (the dashboard's Transfer action) opens the form once; the flag
  // is then dropped so a reload doesn't reopen it.
  const [isCreating, setIsCreating] = useState(() => searchParams.has("new"));
  // { key: "created" | "reversed", transferId }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (searchParams.has("new")) {
      setSearchParams(transferFiltersToSearchParams(readTransferFilters(searchParams)), {
        replace: true,
      });
    }
  }, [searchParams, setSearchParams]);

  /* ---------- Accounts (filter options) ---------- */

  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    // Same call as the transfer form: the session workspace's active accounts.
    // A failure only leaves the account filters with "All accounts".
    accountsApi
      .list({ id_workspace: getStoredWorkspace()?.id }, { signal: controller.signal })
      .then((response) => {
        const list = response.data?.accounts;
        setAccounts(Array.isArray(list) ? list.filter((account) => account?.id != null) : []);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  /* ---------- Filters ---------- */

  const updateFilters = (changes) => {
    const next = { ...readCurrentFilters(), ...changes, page: changes.page ?? 1 };

    // Keep the range valid (date_to ≥ date_from) instead of sending a 422.
    if (next.date_from && next.date_to && next.date_to < next.date_from) {
      if ("date_from" in changes) next.date_to = "";
      else next.date_from = "";
    }

    setSearchParams(transferFiltersToSearchParams(next), { replace: true });
  };

  const clearFilters = () =>
    setSearchParams(transferFiltersToSearchParams(readTransferFilters(new URLSearchParams())), {
      replace: true,
    });

  /* ---------- List ---------- */

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${JSON.stringify(query)}#${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    transfersApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parseTransferPage(response);

        setResult(
          parsed
            ? { key: requestKey, page: parsed, error: null }
            : {
                key: requestKey,
                page: null,
                error: new ApiError("", { code: "MALFORMED_RESPONSE" }),
              },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [query, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];

  const goToPage = (next) =>
    setSearchParams(transferFiltersToSearchParams({ ...readCurrentFilters(), page: next }), {
      replace: false,
    });

  // The backend ledger is the source of truth: after money moved, the list is
  // refetched instead of being patched locally.
  const handleCreated = (transfer) => {
    setIsCreating(false);
    setNotice({ key: "created", transferId: transfer?.id ?? null });
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="transfers-page">
      <header className="transfers-page__header">
        <div className="transfers-page__copy">
          <h1>{t("dashboard.transfers.title")}</h1>
          <p>{t("dashboard.transfers.subtitle")}</p>
        </div>

        <button
          type="button"
          className="transfers-page__add"
          onClick={() => setIsCreating(true)}
        >
          <LuPlus aria-hidden="true" />
          <span>{t("dashboard.transfers.add")}</span>
        </button>
      </header>

      {notice && (
        <div className="transfers-page__notice" role="status">
          <p dir="auto">
            {t(`dashboard.transfers.messages.${notice.key}`)}
            {notice.transferId != null && (
              <>
                {" "}
                <Link to={getTransferDetailsPath(notice.transferId)}>
                  {t("dashboard.transfers.messages.viewTransfer")}
                </Link>
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="transfers-page__panel" aria-labelledby="transfers-list-title">
        <header className="transfers-page__panel-head">
          <h2 id="transfers-list-title">
            {t("dashboard.transfers.listTitle")}
            {listPage && !isLoading && (
              <span className="transfers-page__count">{listPage.total}</span>
            )}
          </h2>
        </header>

        <TransferFilters
          filters={filters}
          accounts={accounts}
          onChange={updateFilters}
          onClear={clearFilters}
        />

        <div className="transfers-page__list">
          {isLoading && <Loading message={t("dashboard.transfers.states.loading")} />}

          {!isLoading && error && (
            <div className="transfers-page__state transfers-page__state--error" role="alert">
              <p>{getTransferErrorMessage(error, t)}</p>
              <div className="transfers-page__state-actions">
                <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                  {t("common.retry")}
                </button>
                {isFiltered && (
                  <button type="button" onClick={clearFilters}>
                    {t("dashboard.transactions.filters.clear")}
                  </button>
                )}
              </div>
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="transfers-page__state">
              {listPage && listPage.total > 0 && listPage.page > 1 ? (
                <>
                  <p>{t("dashboard.transfers.states.emptyPage")}</p>
                  <button type="button" onClick={() => goToPage(1)}>
                    {t("dashboard.transactions.pagination.first")}
                  </button>
                </>
              ) : isFiltered ? (
                <>
                  <p>{t("dashboard.transfers.states.emptyFiltered")}</p>
                  <button type="button" onClick={clearFilters}>
                    {t("dashboard.transactions.filters.clear")}
                  </button>
                </>
              ) : (
                <>
                  <p>{t("dashboard.transfers.states.empty")}</p>
                  <button type="button" onClick={() => setIsCreating(true)}>
                    {t("dashboard.transfers.add")}
                  </button>
                </>
              )}
            </div>
          )}

          {!isLoading &&
            !error &&
            items.map((transfer) => {
              const from = getAccountLabel(getFromAccount(transfer), transfer.from_account_id);
              const to = getAccountLabel(getToAccount(transfer), transfer.to_account_id);
              const isReversed = transfer.status === "reversed";

              return (
                <article
                  className={`transfer-row${isReversed ? " transfer-row--reversed" : ""}`}
                  key={transfer.id}
                >
                  <span className="transfer-row__icon" aria-hidden="true">
                    <LuArrowRightLeft />
                  </span>

                  <div className="transfer-row__copy">
                    {/* Stretched over the row: the row opens the details page. */}
                    <Link
                      className="transfer-row__link"
                      to={getTransferDetailsPath(transfer.id)}
                      state={{ from: location.search }}
                    >
                      <strong dir="auto">
                        <bdi>{from}</bdi>
                        {" → "}
                        <bdi>{to}</bdi>
                      </strong>
                    </Link>
                    <small>
                      <bdi dir="ltr">#{transfer.id}</bdi>
                      {" · "}
                      <bdi>{formatDate(transfer.occurred_at, locale, timeZone)}</bdi>
                      {hasTransferFee(transfer) && (
                        <>
                          {" · "}
                          <bdi>
                            {t("dashboard.transfers.fields.fee")}{" "}
                            {formatMoney(transfer.fee_amount, transfer.currency_code, locale)}
                          </bdi>
                        </>
                      )}
                    </small>
                  </div>

                  <div className="transfer-row__side">
                    {/* A transfer is neither income nor expense: no sign. */}
                    <strong className="transfer-row__amount" dir="ltr">
                      {formatMoney(transfer.amount, transfer.currency_code, locale)}
                    </strong>
                    <TransactionStatusBadge
                      status={transfer.status}
                      labelsKey="dashboard.transfers.statuses"
                    />
                  </div>
                </article>
              );
            })}
        </div>

        {!isLoading && !error && listPage && listPage.lastPage > 1 && (
          <footer className="transfers-page__pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", {
                from: listPage.from,
                to: listPage.to,
                total: listPage.total,
              })}
            </span>

            <div className="transfers-page__pages">
              <button
                type="button"
                onClick={() => goToPage(listPage.page - 1)}
                disabled={listPage.page <= 1}
                aria-label={t("dashboard.transactions.pagination.previous")}
              >
                <LuChevronLeft aria-hidden="true" />
              </button>
              <span aria-live="polite">
                {t("dashboard.transactions.pagination.page", {
                  page: listPage.page,
                  lastPage: listPage.lastPage,
                })}
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

      {isCreating && (
        <TransferForm onCreated={handleCreated} onClose={() => setIsCreating(false)} />
      )}
    </div>
  );
}
