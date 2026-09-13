import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { getDebtDetailsPath } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { debtsApi } from "../api/debtsApi";
import DebtFilters from "./components/DebtFilters/DebtFilters";
import DebtForm from "./components/DebtForm/DebtForm";
import DebtList from "./components/DebtList/DebtList";
import DebtSummary from "./components/DebtSummary/DebtSummary";
import DebtsHeader from "./components/DebtsHeader/DebtsHeader";
import {
  debtFiltersToQuery,
  debtFiltersToSearchParams,
  getCurrencyOptions,
  getDebtErrorMessage,
  hasActiveDebtFilters,
  isDebtEntity,
  parsePage,
  parseSummary,
  readDebtFilters,
  summaryQuery,
} from "./debtHelpers";

import "./Debts.css";

/*
 * Debts list (GET /debts, paginated and filtered) with the per-currency
 * summary (GET /debts/summary). Creating happens in a modal; every other
 * action lives on the debt's details page. The backend is the source of
 * truth: after a create both requests are refetched instead of patching the
 * list, and the page refetches both whenever it is opened again (e.g. back
 * from a details page after a payment or an archive).
 */
export default function Debts() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readDebtFilters(searchParams);
  const filterKey = debtFiltersToSearchParams(filters).toString();

  // `key` ties a result to the request that produced it; while it doesn't
  // match the current request (filters, page or retry changed), it is loading.
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [summary, setSummary] = useState({ key: null, rows: null, error: null });

  const [isFormOpen, setIsFormOpen] = useState(false);
  // One-time success message: { name, debtId }.
  const [notice, setNotice] = useState(null);
  // Set when a create failed with an unknown outcome; both requests are
  // refetched when the form closes, so a debt that was recorded shows up.
  const staleRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = debtFiltersToQuery(readDebtFilters(new URLSearchParams(filterKey)));

    debtsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const parsed = parsePage(response, "debts");

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
  }, [filterKey, requestKey]);

  useEffect(() => {
    const controller = new AbortController();

    debtsApi
      .summary(summaryQuery(), { signal: controller.signal })
      .then((response) => {
        const rows = parseSummary(response);

        setSummary(
          rows
            ? { key: summaryReloadKey, rows, error: null }
            : { key: summaryReloadKey, rows: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setSummary({ key: summaryReloadKey, rows: null, error });
      });

    return () => controller.abort();
  }, [summaryReloadKey]);

  const isLoading = result.key !== requestKey;
  const { page: listPage, error } = isLoading ? { page: null, error: null } : result;
  const items = listPage?.items ?? [];
  const isFiltered = hasActiveDebtFilters(filters);
  const isSummaryLoading = summary.key !== summaryReloadKey;

  const reloadList = () => setReloadKey((key) => key + 1);
  const reloadSummary = () => setSummaryReloadKey((key) => key + 1);
  const reloadAll = () => {
    reloadList();
    reloadSummary();
  };

  const updateFilters = (changes) =>
    setSearchParams(debtFiltersToSearchParams({ ...filters, ...changes, page: 1 }));

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const goToPage = (page) => setSearchParams(debtFiltersToSearchParams({ ...filters, page }));

  /* ---------- Create ---------- */

  // Called by DebtForm; errors are shown in the form.
  const handleSave = async (payload) => {
    const workspaceId = await resolveWorkspaceId();
    const response = await debtsApi.create({ ...payload, workspace_id: workspaceId });
    const createdDebt = response?.data?.debt;

    staleRef.current = false;
    setIsFormOpen(false);
    setNotice({
      name: createdDebt?.counterparty_name ?? payload.counterparty_name,
      debtId: isDebtEntity(createdDebt) ? createdDebt.id : null,
    });
    // Its place in the list and the new totals are the backend's to decide.
    reloadAll();
  };

  const closeForm = () => {
    setIsFormOpen(false);

    if (staleRef.current) {
      staleRef.current = false;
      reloadAll();
    }
  };

  /* ---------- Render ---------- */

  const openForm = () => setIsFormOpen(true);

  return (
    <div className="debts-page">
      <DebtsHeader onNewDebt={openForm} />

      {notice && (
        <div className="debts-page__notice" role="status">
          <p dir="auto">
            {t("dashboard.debts.notices.createSuccess", { name: notice.name })}
            {notice.debtId != null && (
              <>
                {" "}
                <Link to={getDebtDetailsPath(notice.debtId)}>{t("dashboard.debts.notices.viewDebt")}</Link>
              </>
            )}
          </p>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("common.close")}>
            <LuX aria-hidden="true" />
          </button>
        </div>
      )}

      <DebtSummary
        rows={isSummaryLoading ? null : summary.rows}
        isLoading={isSummaryLoading}
        error={isSummaryLoading ? null : summary.error}
        onRetry={reloadSummary}
      />

      <section className="debts-page__list" aria-labelledby="debts-page-list-title">
        <h2 id="debts-page-list-title" className="debts-page__list-title">
          {t("dashboard.debts.list.title")}
        </h2>

        <DebtFilters
          filters={filters}
          currencies={getCurrencyOptions(filters.currency_code)}
          onChange={updateFilters}
          onClear={clearFilters}
          disabled={isLoading}
        />

        {isLoading && <Loading message={t("dashboard.debts.states.loading")} />}

        {!isLoading && error && (
          <div className="debts-page__state debts-page__state--error" role="alert">
            <p>{getDebtErrorMessage(error, t)}</p>
            <button type="button" onClick={reloadList}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="debts-page__state">
            {listPage && listPage.total > 0 && listPage.page > 1 ? (
              <>
                <p>{t("dashboard.debts.states.emptyPage")}</p>
                <button type="button" onClick={() => goToPage(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : isFiltered ? (
              <>
                <p>{t("dashboard.debts.states.emptyFiltered")}</p>
                <button type="button" onClick={clearFilters}>
                  {t("dashboard.debts.filters.clear")}
                </button>
              </>
            ) : (
              <>
                <p>{t("dashboard.debts.states.empty")}</p>
                <button type="button" onClick={openForm}>
                  {t("dashboard.debts.newDebt")}
                </button>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && items.length > 0 && <DebtList debts={items} />}

        {!isLoading && !error && listPage && listPage.lastPage > 1 && (
          <footer className="debts-page__pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", {
                from: listPage.from,
                to: listPage.to,
                total: listPage.total,
              })}
            </span>

            <div className="debts-page__pages">
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

      {isFormOpen && (
        <DebtForm
          onSave={handleSave}
          onOutdated={() => {
            staleRef.current = true;
          }}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
