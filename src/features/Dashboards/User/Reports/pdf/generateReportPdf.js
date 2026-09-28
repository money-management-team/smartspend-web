import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";

import { ApiError } from "../../api/apiClient";
import { getReport } from "../../api/reportsApi";
import { parseReport, reportFiltersToQuery, reportHasItems } from "../reportHelpers";
import ReportPdfDocument from "./components/ReportPdfDocument";
import { PDF_FONT_FILES, PDF_LOGO_URL } from "./pdfAssets";
import { getPdfFileName } from "./pdfFormatters";
import { registerPdfFonts } from "./pdfTheme";
import { buildReportPdfModel } from "./reportPdfModel";

// Rows per request (the largest page size the reports API accepts) and the
// most rows one PDF prints. Beyond that the PDF says how many were left out
// and points to CSV / Excel for the full list.
const PDF_PAGE_SIZE = 50;
export const MAX_PDF_ROWS = 2000;

/*
 * The report exactly as on screen (same report, period, currency and
 * grouping, via the same GET /reports/* call), with every page of its rows
 * instead of the one page shown. Returns { report, totalRows }.
 */
export async function fetchReportForPdf(filters, { signal } = {}) {
  const query = reportFiltersToQuery({ ...filters, per_page: PDF_PAGE_SIZE, page: 1 });
  const first = parseReport(await getReport(filters.report, query, { signal }));
  if (!first) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

  if (!reportHasItems(filters.report) || !first.pagination) {
    return { report: first, totalRows: first.items.length };
  }

  const items = [...first.items];
  let pagination = first.pagination;

  while (pagination?.hasMore && items.length < MAX_PDF_ROWS) {
    const next = parseReport(await getReport(filters.report, { ...query, page: pagination.page + 1 }, { signal }));
    if (!next) throw new ApiError("", { code: "MALFORMED_RESPONSE" });

    items.push(...next.items);
    // A page that does not advance would loop forever: stop instead.
    if (!next.pagination || next.pagination.page <= pagination.page || next.items.length === 0) break;
    pagination = next.pagination;
  }

  return {
    report: { ...first, items: items.slice(0, MAX_PDF_ROWS) },
    totalRows: Math.max(first.pagination.total, items.length),
  };
}

/*
 * Builds the PDF of the report on screen, in the current UI language, and
 * returns { blob, filename }. Nothing is sent to the export queue: the file
 * is produced here from the report data the API returns.
 */
export async function generateReportPdf({ filters, t, i18n, signal }) {
  const { report, totalRows } = await fetchReportForPdf(filters, { signal });

  registerPdfFonts(PDF_FONT_FILES);

  const model = buildReportPdfModel({ report, filters, totalRows, t, i18n, generatedAt: new Date() });
  const blob = await pdf(createElement(ReportPdfDocument, { model, logo: PDF_LOGO_URL })).toBlob();

  if (signal?.aborted) throw new DOMException("The PDF export was cancelled.", "AbortError");

  return {
    blob,
    filename: getPdfFileName(
      report.report ?? filters.report,
      report.period?.date_from ?? filters.from,
      report.period?.date_to ?? filters.to,
    ),
  };
}
