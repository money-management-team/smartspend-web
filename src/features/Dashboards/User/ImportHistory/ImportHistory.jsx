import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuArrowLeft, LuChevronLeft, LuChevronRight, LuRefreshCw } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { PATH } from "../../../../routes/Path";
import { ApiError, getStoredWorkspace } from "../api/apiClient";
import { importsApi } from "../api/importsApi";
import {
  IMPORTS_PER_PAGE,
  IMPORT_STATUSES,
  getImportErrorMessage,
  parseImportsPage,
} from "../Import/importHelpers";
import ImportHistoryRow from "./components/ImportHistoryRow/ImportHistoryRow";

import "./ImportHistory.css";

// Only the documented list filters. The workspace comes from storage.
const readFilters = (searchParams) => {
  const status = searchParams.get("status") ?? "";
  const accountId = searchParams.get("account_id") ?? "";
  const page = Number(searchParams.get("page"));

  return {
    status: IMPORT_STATUSES.includes(status) ? status : "",
    account_id: /^\d+$/.test(accountId) ? accountId : "",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
};

const filtersToSearchParams = (filters) => {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.page > 1) params.set("page", String(filters.page));

  return params;
};

/*
 * Import history (GET /imports). `data.imports` is a Laravel paginator, so
 * the rows are in `.data` and the page is a real backend page — never a
 * client-side slice of an array.
 *
 * Status and account filters live in the URL, so a filtered history can be
 * linked and survives a reload. Each row offers only the actions its status
 * actually allows (see `getImportNextAction`).
 */
export default function ImportHistory() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const filterKey = filtersToSearchParams(filters).toString();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const current = readFilters(new URLSearchParams(filterKey));

    importsApi
      .list(
        {
          workspace_id: getStoredWorkspace()?.id ?? undefined,
          status: current.status || undefined,
          account_id: current.account_id || undefined,
          per_page: IMPORTS_PER_PAGE,
          page: current.page > 1 ? current.page : undefined,
        },
        { signal: controller.signal },
      )
      .then((response) => {
        const page = parseImportsPage(response);

        setResult(
          page
            ? { key: requestKey, page, error: null }
            : { key: requestKey, page: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, page: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey]);

  const isLoading = result.key !== requestKey;
  const { page, error } = isLoading ? { page: null, error: null } : result;
  const rows = page?.items ?? [];
  const isFiltered = Boolean(filters.status || filters.account_id);

  const reload = () => setReloadKey((key) => key + 1);
  const updateStatus = (event) =>
    setSearchParams(filtersToSearchParams({ ...filters, status: event.target.value, page: 1 }));
  const clearFilters = () => setSearchParams(new URLSearchParams());
  const goToPage = (next) => setSearchParams(filtersToSearchParams({ ...filters, page: next }));

  return (
    <div className="import-history-page">
      <header className="import-history-page__header">
        <div>
          <Link to={PATH.USER.IMPORT} className="import-history-page__back">
            <LuArrowLeft aria-hidden="true" />
            {t("dashboard.importPage.history.back")}
          </Link>
          <h1>{t("dashboard.importPage.history.title")}</h1>
          <p>{t("dashboard.importPage.history.subtitle")}</p>
        </div>
        <button type="button" className="import-history-page__refresh" onClick={reload} disabled={isLoading}>
          <LuRefreshCw aria-hidden="true" />
          {t("dashboard.importPage.history.refresh")}
        </button>
      </header>

      <div className="import-history-page__filters">
        <label>
          <span>{t("dashboard.importPage.fields.status")}</span>
          <select value={filters.status} onChange={updateStatus}>
            <option value="">{t("dashboard.importPage.history.all")}</option>
            {IMPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`dashboard.importPage.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        {isFiltered && (
          <button type="button" className="import-history-page__clear" onClick={clearFilters}>
            {t("dashboard.importPage.history.clearFilters")}
          </button>
        )}
      </div>

      <section className="import-history-page__panel" aria-busy={isLoading}>
        {isLoading && <Loading message={t("dashboard.importPage.history.loading")} />}

        {!isLoading && error && (
          <div className="import-history-page__state import-history-page__state--error" role="alert">
            <p>{getImportErrorMessage(error, t, "list")}</p>
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="import-history-page__state">
            {page && page.total > 0 && page.page > 1 ? (
              <>
                <p>{t("dashboard.importPage.history.emptyPage")}</p>
                <button type="button" onClick={() => goToPage(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : (
              <>
                <p>
                  {isFiltered
                    ? t("dashboard.importPage.history.emptyFiltered")
                    : t("dashboard.importPage.history.empty")}
                </p>
                {isFiltered ? (
                  <button type="button" onClick={clearFilters}>
                    {t("dashboard.importPage.history.clearFilters")}
                  </button>
                ) : (
                  <Link to={PATH.USER.IMPORT}>{t("dashboard.importPage.history.startImport")}</Link>
                )}
              </>
            )}
          </div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="import-history-page__rows">
            {rows.map((record) => (
              <ImportHistoryRow key={record.id} importRecord={record} />
            ))}
          </div>
        )}

        {!isLoading && !error && page && page.lastPage > 1 && (
          <footer className="import-history-page__pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", { from: page.from, to: page.to, total: page.total })}
            </span>
            <div className="import-history-page__pages">
              <button
                type="button"
                onClick={() => goToPage(page.page - 1)}
                disabled={page.page <= 1}
                aria-label={t("dashboard.transactions.pagination.previous")}
              >
                <LuChevronLeft aria-hidden="true" />
              </button>
              <span aria-live="polite">
                {t("dashboard.transactions.pagination.page", { page: page.page, lastPage: page.lastPage })}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page.page + 1)}
                disabled={page.page >= page.lastPage}
                aria-label={t("dashboard.transactions.pagination.next")}
              >
                <LuChevronRight aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
