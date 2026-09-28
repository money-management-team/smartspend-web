import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { LuFileDown, LuHistory } from "react-icons/lu";

import Loading from "../../../../components/Loading/Loading";
import { PATH } from "../../../../routes/Path";
import { ApiError, saveBlobAsFile } from "../api/apiClient";
import { resolveWorkspaceId } from "../api/dashboardApi";
import { reportExportsApi } from "../api/reportExportsApi";
import { getReport } from "../api/reportsApi";
import { getDisplayLocale } from "../Accounts/accountHelpers";
import ExportFormatDialog from "../ReportExports/components/ExportFormatDialog/ExportFormatDialog";
import ExportTracker from "../ReportExports/components/ExportTracker/ExportTracker";
import {
  DEFAULT_EXPORT_FORMAT,
  getExportErrorMessage,
  getReportName,
  parseExport,
} from "../ReportExports/reportExportHelpers";
import { formatDate } from "../utils/formatters";
import ReportAnalytics from "./components/ReportAnalytics/ReportAnalytics";
import ReportFilters from "./components/ReportFilters/ReportFilters";
import ReportItemsTable from "./components/ReportItemsTable/ReportItemsTable";
import ReportPagination from "./components/ReportPagination/ReportPagination";
import ReportPeriod from "./components/ReportPeriod/ReportPeriod";
import ReportSection from "./components/ReportSection/ReportSection";
import ReportsHeader from "./components/ReportsHeader/ReportsHeader";
import ReportSummary from "./components/ReportSummary/ReportSummary";
import ReportTabs from "./components/ReportTabs/ReportTabs";
import { REPORT_DEFINITIONS } from "./reportDefinitions";
import {
  getCurrencyOptions,
  getReportErrorMessage,
  getReportFieldErrors,
  getWorkspaceTimezone,
  isCurrencyCode,
  isEmptyValue,
  parseReport,
  readReportFilters,
  reportFiltersToQuery,
  reportFiltersToSearchParams,
  reportHasItems,
} from "./reportHelpers";

import "./Reports.css";

// Analytics worth showing: anything besides the period / flag metadata.
const METADATA_KEYS = new Set(["previous_period", "actual_source", "templates_are_forecast_only"]);
const hasAnalytics = (analytics) =>
  Object.entries(analytics).some(([key, value]) => !METADATA_KEYS.has(key) && !isEmptyValue(value));

/*
 * Sprint 6 reports (GET /reports/*), one page with a tab per report. The
 * report, period, currency, grouping, page size and page live in the URL, so
 * switching reports keeps the shared filters and a report can be linked.
 *
 * Every figure is the backend's: the page never adds report amounts, never
 * merges currencies, and builds Overview from GET /reports/overview alone.
 * A result is tied to the request that produced it (`key`): while filters,
 * report or page change, the previous numbers are hidden and the stale
 * request is aborted.
 */
export default function Reports() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const timeZone = getWorkspaceTimezone();
  const filters = readReportFilters(searchParams, timeZone);
  const filterKey = reportFiltersToSearchParams(filters).toString();

  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${filterKey}:${reloadKey}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const current = readReportFilters(new URLSearchParams(filterKey), timeZone);

    getReport(current.report, reportFiltersToQuery(current), { signal: controller.signal })
      .then((response) => {
        const parsed = parseReport(response);

        setResult(
          parsed
            ? { key: requestKey, data: parsed, error: null }
            : { key: requestKey, data: null, error: new ApiError("", { code: "MALFORMED_RESPONSE" }) },
        );
      })
      .catch((error) => {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        setResult({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [filterKey, requestKey, timeZone]);

  const isLoading = result.key !== requestKey;
  const report = isLoading ? null : result.data;
  const error = isLoading ? null : result.error;
  const definition = REPORT_DEFINITIONS[filters.report];
  const showItems = reportHasItems(filters.report);
  const currencies = getCurrencyOptions(filters.currency, ...(report?.summary ?? []).map((row) => row.currency_code));
  const fieldErrors = getReportFieldErrors(error);
  const isEmpty =
    report != null &&
    report.summary.length === 0 &&
    (!showItems || report.items.length === 0) &&
    !hasAnalytics(report.analytics);

  const navigate = (next) => setSearchParams(reportFiltersToSearchParams(next));
  const selectReport = (name) => {
    if (name !== filters.report) navigate({ ...filters, report: name, page: 1 });
  };
  const applyFilters = (draft) => navigate({ ...filters, ...draft, page: 1 });
  const resetFilters = () =>
    navigate(readReportFilters(new URLSearchParams({ report: filters.report }), timeZone));
  const goToPage = (page) => navigate({ ...filters, page });
  const retry = () => setReloadKey((key) => key + 1);

  /* ---------- Export (POST /report-exports) ---------- */

  // The export being followed on this page; its tracker polls the status.
  const [trackedExport, setTrackedExport] = useState(null);
  const [exportRequest, setExportRequest] = useState({ pending: false, error: null });
  const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
  // The last format chosen, preselected the next time the dialog opens.
  const [exportFormat, setExportFormat] = useState(DEFAULT_EXPORT_FORMAT);
  const exportPendingRef = useRef(false);
  const exportButtonRef = useRef(null);

  /*
   * POST /report-exports. One request at a time (the ref survives a double
   * click before React re-renders). The response is a queued export, not a
   * file: the tracker follows it and enables Download only once the backend
   * reports `download_available`. Resolves to whether it was queued.
   */
  const createExport = async ({ report: reportName, format, exportFilters }) => {
    if (exportPendingRef.current) return false;

    exportPendingRef.current = true;
    setExportRequest({ pending: true, error: null });

    try {
      const workspaceId = exportFilters.workspace_id ?? (await resolveWorkspaceId());
      const response = await reportExportsApi.create({
        report: reportName,
        format,
        filters: { ...exportFilters, workspace_id: workspaceId },
      });
      const created = parseExport(response);
      if (!created) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

      setTrackedExport(created);
      setExportRequest({ pending: false, error: null });
      return true;
    } catch (exportError) {
      setExportRequest({ pending: false, error: exportError });
      return false;
    } finally {
      exportPendingRef.current = false;
    }
  };

  const openFormatDialog = () => {
    setExportRequest({ pending: false, error: null });
    setIsFormatDialogOpen(true);
  };

  const closeFormatDialog = () => {
    // A create error belongs to the dialog; it is not carried onto the page.
    setExportRequest((current) => (current.pending ? current : { pending: false, error: null }));
    setIsFormatDialogOpen(false);
    exportButtonRef.current?.focus();
  };

  // Aborts a PDF still being built when the user leaves the page.
  const pdfControllerRef = useRef(null);
  useEffect(() => () => pdfControllerRef.current?.abort(), []);

  /*
   * PDF: built here, not queued. The report is read again with every page of
   * its rows (same GET /reports/* call and filters as on screen), laid out
   * with the Smart Spend PDF design and downloaded at once. The PDF library
   * is loaded only now, so it never weighs on the page itself. Resolves to
   * whether the file was saved.
   */
  const downloadPdf = async () => {
    if (exportPendingRef.current) return false;

    exportPendingRef.current = true;
    setExportRequest({ pending: true, error: null });
    const controller = new AbortController();
    pdfControllerRef.current = controller;

    try {
      const { generateReportPdf } = await import("./pdf/generateReportPdf");
      const { blob, filename } = await generateReportPdf({ filters, t, i18n, signal: controller.signal });

      saveBlobAsFile(blob, filename);
      setExportRequest({ pending: false, error: null });
      return true;
    } catch (pdfError) {
      if (pdfError.name === "AbortError" || controller.signal.aborted) return false;

      // API errors keep their own wording; a layout or rendering failure
      // gets a plain "could not be created".
      setExportRequest({
        pending: false,
        error:
          pdfError instanceof ApiError
            ? pdfError
            : new ApiError(t("dashboard.reportExports.errors.pdfFailed"), { code: "PDF_FAILED", cause: pdfError }),
      });
      return false;
    } finally {
      exportPendingRef.current = false;
      pdfControllerRef.current = null;
    }
  };

  // The report with the filters applied on screen: the export covers the
  // same period the user is looking at, read from the same URL state.
  const exportCurrentReport = async (format) => {
    setExportFormat(format);

    if (format === "pdf") {
      if (await downloadPdf()) closeFormatDialog();
      return;
    }

    const queued = await createExport({
      report: filters.report,
      format,
      exportFilters: {
        from: filters.from,
        to: filters.to,
        currency: filters.currency || undefined,
        group_by: filters.group_by,
        timezone: report?.period?.timezone ?? timeZone ?? undefined,
      },
    });

    if (queued) closeFormatDialog();
  };

  // A failed export is retried as a new export of the same report, format
  // and filters it was created with, not whatever is on screen now.
  const retryExport = (failed) =>
    createExport({
      report: failed.report ?? filters.report,
      format: failed.format ?? DEFAULT_EXPORT_FORMAT,
      exportFilters: failed.filters ?? { from: filters.from, to: filters.to },
    });

  const locale = getDisplayLocale(i18n.language);
  const exportPeriod =
    filters.from && filters.to
      ? t("dashboard.reports.period.range", {
          from: formatDate(filters.from, locale),
          to: formatDate(filters.to, locale),
        })
      : null;

  return (
    <div className="reports-page">
      <ReportsHeader
        actions={
          <>
            <Link to={PATH.USER.REPORT_EXPORTS} className="reports-page__history-link">
              <LuHistory aria-hidden="true" />
              <span>{t("dashboard.reportExports.history.title")}</span>
            </Link>
            <button
              ref={exportButtonRef}
              type="button"
              className="reports-page__export"
              onClick={openFormatDialog}
              disabled={exportRequest.pending}
              aria-busy={exportRequest.pending}
              aria-haspopup="dialog"
            >
              <LuFileDown aria-hidden="true" />
              <span>
                {exportRequest.pending
                  ? t("dashboard.reportExports.actions.queueing")
                  : t("dashboard.reportExports.actions.exportReport")}
              </span>
            </button>
          </>
        }
      />

      {isFormatDialogOpen && (
        <ExportFormatDialog
          reportName={getReportName(filters.report, t)}
          period={exportPeriod}
          initialFormat={exportFormat}
          pending={exportRequest.pending}
          error={exportRequest.error}
          onSubmit={exportCurrentReport}
          onClose={closeFormatDialog}
        />
      )}

      {exportRequest.error && !isFormatDialogOpen && (
        <p className="reports-page__export-error" role="alert">
          {getExportErrorMessage(exportRequest.error, t, "create")}
        </p>
      )}

      {trackedExport && (
        <ExportTracker
          key={trackedExport.id}
          initialRecord={trackedExport}
          onDismiss={() => setTrackedExport(null)}
          onRetry={retryExport}
          isRetrying={exportRequest.pending}
        />
      )}

      <ReportTabs activeReport={filters.report} onChange={selectReport} />

      <ReportFilters
        key={filterKey}
        filters={filters}
        currencies={currencies}
        showPerPage={showItems}
        timeZone={timeZone}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <div className="reports-page__content" aria-busy={isLoading}>
        {isLoading && <Loading message={t("dashboard.reports.states.loading")} />}

        {error && (
          <div className="reports-page__state reports-page__state--error" role="alert">
            <p className="reports-page__state-title">{t("dashboard.reports.states.failed")}</p>
            <p>{getReportErrorMessage(error, t)}</p>
            {fieldErrors.length > 0 && (
              <ul className="reports-page__field-errors">
                {fieldErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            <div className="reports-page__state-actions">
              <button type="button" onClick={retry}>
                {t("common.retry")}
              </button>
              {error.code === "VALIDATION_ERROR" && (
                <button type="button" className="reports-page__secondary" onClick={resetFilters}>
                  {t("dashboard.reports.filters.reset")}
                </button>
              )}
            </div>
          </div>
        )}

        {report && (
          <>
            <ReportPeriod
              report={filters.report}
              period={report.period}
              previousPeriod={report.analytics.previous_period}
              filters={report.filters}
              notes={definition.notes}
            />

            {isEmpty ? (
              <div className="reports-page__state">
                <p className="reports-page__state-title">{t("dashboard.reports.states.empty")}</p>
                <p>{t("dashboard.reports.states.emptyHint")}</p>
              </div>
            ) : (
              <>
                <div className="reports-page__summary">
                  <ReportSummary rows={report.summary} groups={definition.summary} />
                </div>

                <ReportAnalytics
                  definition={definition}
                  analytics={report.analytics}
                  summary={report.summary}
                  groupBy={report.filters?.group_by ?? filters.group_by}
                />

                {showItems && (
                  <div className="reports-page__items">
                    <ReportSection
                      title={t(`dashboard.reports.itemsTitle.${filters.report}`)}
                      hint={t("dashboard.reports.sections.itemsHint")}
                    >
                      {report.items.length > 0 ? (
                        <ReportItemsTable
                          columns={definition.columns}
                          rows={report.items}
                          fallbackCurrency={isCurrencyCode(filters.currency) ? filters.currency : null}
                        />
                      ) : report.pagination && report.pagination.total > 0 && filters.page > 1 ? (
                        <div className="reports-page__inline-state">
                          <p>{t("dashboard.reports.states.emptyPage")}</p>
                          <button type="button" onClick={() => goToPage(1)}>
                            {t("dashboard.transactions.pagination.first")}
                          </button>
                        </div>
                      ) : (
                        <p className="reports-page__inline-state">{t("dashboard.reports.states.emptyItems")}</p>
                      )}

                      <ReportPagination pagination={report.pagination} onPageChange={goToPage} />
                    </ReportSection>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
