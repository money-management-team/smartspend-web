import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuArrowLeft, LuChevronLeft, LuChevronRight, LuRefreshCw } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { PATH } from "../../../../routes/Path";
import { ApiError } from "../api/apiClient";
import { reportExportsApi } from "../api/reportExportsApi";
import { REPORT_NAMES } from "../Reports/reportHelpers";
import { parsePage } from "../SavingsGoals/savingsGoalHelpers";
import ExportHistoryRow from "./components/ExportHistoryRow/ExportHistoryRow";
import {
  EXPORT_FORMATS,
  EXPORT_STATUSES,
  exportFiltersToQuery,
  exportFiltersToSearchParams,
  getExportErrorMessage,
  hasActiveExportFilters,
  readExportFilters,
} from "./reportExportHelpers";

import "./ReportExports.css";

/*
 * Export history (GET /report-exports, Laravel paginator in
 * `data.report_exports`). Filters (status, report, format) and the page live
 * in the URL. Rows that are still queued or processing poll their own status;
 * actions update their row from the backend's answer.
 */
export default function ReportExports() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readExportFilters(searchParams);
  const filterKey = exportFiltersToSearchParams(filters).toString();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, page: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const query = exportFiltersToQuery(readExportFilters(new URLSearchParams(filterKey)));

    reportExportsApi
      .list(query, { signal: controller.signal })
      .then((response) => {
        const page = parsePage(response, "report_exports");

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
  const isFiltered = hasActiveExportFilters(filters);

  const reload = () => setReloadKey((key) => key + 1);
  const updateFilter = (name) => (event) =>
    setSearchParams(exportFiltersToSearchParams({ ...filters, [name]: event.target.value, page: 1 }));
  const clearFilters = () => setSearchParams(new URLSearchParams());
  const goToPage = (next) => setSearchParams(exportFiltersToSearchParams({ ...filters, page: next }));

  return (
    <div className="report-exports-page">
      <header className="report-exports-page__header">
        <div>
          <Link to={PATH.USER.REPORTS} className="report-exports-page__back">
            <LuArrowLeft aria-hidden="true" />
            {t("dashboard.reportExports.history.back")}
          </Link>
          <h1>{t("dashboard.reportExports.history.title")}</h1>
          <p>{t("dashboard.reportExports.history.subtitle")}</p>
        </div>
        <button type="button" className="report-exports-page__refresh" onClick={reload} disabled={isLoading}>
          <LuRefreshCw aria-hidden="true" />
          {t("dashboard.reportExports.history.refresh")}
        </button>
      </header>

      <div className="report-exports-page__filters">
        <label>
          <span>{t("dashboard.reportExports.fields.status")}</span>
          <select value={filters.status} onChange={updateFilter("status")}>
            <option value="">{t("dashboard.reportExports.history.all")}</option>
            {EXPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`dashboard.reportExports.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("dashboard.reportExports.fields.report")}</span>
          <select value={filters.report} onChange={updateFilter("report")}>
            <option value="">{t("dashboard.reportExports.history.all")}</option>
            {REPORT_NAMES.map((report) => (
              <option key={report} value={report}>
                {t(`dashboard.reports.names.${report}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("dashboard.reportExports.fields.format")}</span>
          <select value={filters.format} onChange={updateFilter("format")}>
            <option value="">{t("dashboard.reportExports.history.all")}</option>
            {EXPORT_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {isFiltered && (
          <button type="button" className="report-exports-page__clear" onClick={clearFilters}>
            {t("dashboard.reportExports.history.clearFilters")}
          </button>
        )}
      </div>

      <section className="report-exports-page__panel" aria-busy={isLoading}>
        {isLoading && <Loading message={t("dashboard.reportExports.history.loading")} />}

        {!isLoading && error && (
          <div className="report-exports-page__state report-exports-page__state--error" role="alert">
            <p>{getExportErrorMessage(error, t, "list")}</p>
            <button type="button" onClick={reload}>
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="report-exports-page__state">
            {page && page.total > 0 && page.page > 1 ? (
              <>
                <p>{t("dashboard.reportExports.history.emptyPage")}</p>
                <button type="button" onClick={() => goToPage(1)}>
                  {t("dashboard.transactions.pagination.first")}
                </button>
              </>
            ) : (
              <>
                <p>{isFiltered ? t("dashboard.reportExports.history.emptyFiltered") : t("dashboard.reportExports.history.empty")}</p>
                {isFiltered ? (
                  <button type="button" onClick={clearFilters}>
                    {t("dashboard.reportExports.history.clearFilters")}
                  </button>
                ) : (
                  <Link to={PATH.USER.REPORTS}>{t("dashboard.reportExports.history.back")}</Link>
                )}
              </>
            )}
          </div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <div className="report-exports-page__scroll">
            <table className="report-exports-page__table">
              <thead>
                <tr>
                  {["report", "format", "status", "created_at", "completed_at", "expires_at", "file_size", "download", "actions"].map(
                    (column) => (
                      <th scope="col" key={column}>
                        {t(`dashboard.reportExports.fields.${column}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ExportHistoryRow key={row.id} initialRecord={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && page && page.lastPage > 1 && (
          <footer className="report-exports-page__pagination">
            <span>
              {t("dashboard.transactions.pagination.summary", { from: page.from, to: page.to, total: page.total })}
            </span>
            <div className="report-exports-page__pages">
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
