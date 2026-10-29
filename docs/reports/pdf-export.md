# Reports — PDF export

Choosing **PDF** in the Export dialog builds the PDF **in the browser** from the report data and downloads it at once. CSV and Excel still go through the backend export queue ([../report-exports/overview.md](../report-exports/overview.md)). No backend endpoint or contract changed for this.

## Flow

```
Export report → dialog → PDF → Export PDF
  └─ Reports.jsx downloadPdf()
       ├─ import("./pdf/generateReportPdf")        lazy chunk, loaded on first PDF export only
       ├─ fetchReportForPdf(filters)                GET /reports/{report} — same call and filters as on screen,
       │                                            per_page 50, every page of rows (max 2,000)
       ├─ buildReportPdfModel(...)                  display model: formatted text, tones, column widths
       ├─ pdf(<ReportPdfDocument/>).toBlob()        @react-pdf/renderer
       └─ saveBlobAsFile(blob, filename)            same helper as the export downloads
```

- The export button and dialog are locked while the PDF is being built (the same `exportPendingRef` guard as queued exports), so a double click never builds two files.
- Leaving the page aborts the report requests (`AbortController` in `Reports.jsx`).
- Errors: an API error keeps its usual wording (`getExportErrorMessage` → `getApiErrorMessage`); a layout or rendering failure shows `dashboard.reportExports.errors.pdfFailed`. The message stays in the dialog so the user can retry.
- Because the file is not queued, a PDF built this way does not appear in the export history. Older backend PDF exports there still download as before.

## Files

All under `src/features/Dashboards/User/Reports/pdf/`:

| File | Responsibility |
|---|---|
| `generateReportPdf.js` | Entry point: fetch every row page, build the model, render the Blob, file name |
| `reportPdfModel.js` | Report → display model. Reuses `REPORT_DEFINITIONS` and the `reportHelpers` parsers (summary groups, comparison, trend, ranked categories, transactions, distributions, generic metrics, items columns) |
| `pdfFormatters.js` | `formatPdfMoney`, `formatPdfAmount`, `formatPdfNumber`, `formatPdfPercentage`, `formatPdfDate(Time)`, `getMoneyTone`, `getStatusTone`, `getPdfFileName` |
| `pdfTheme.js` | `PDF_COLORS`, `PDF_TONES`, `PDF_FONTS`, `PDF_PAGE`, `registerPdfFonts` |
| `pdfAssets.js` | Font and logo URLs emitted by Vite |
| `pdfDirection.js` | RTL context and layout helpers (`usePdfDirection`) |
| `components/ReportPdfDocument.jsx` | Document composition |
| `components/PdfHeader.jsx` | Logo, brand, generated time, title, description, applied filters, notes |
| `components/PdfPageChrome.jsx` | Running title (page 2+) and footer with "Page X of Y" |
| `components/PdfSummary.jsx`, `PdfStatCard.jsx`, `PdfKeyValueList.jsx` | Key figures per currency and grouped figures |
| `components/PdfSection.jsx`, `PdfSectionTitle.jsx`, `PdfCaption.jsx` | Sections, titles, currency captions |
| `components/PdfTable.jsx`, `PdfBadge.jsx` | Data tables and status pills |
| `components/PdfEmptyState.jsx` | "No data available for the selected filters." |
| `components/PdfText.jsx` | Text with the correct Arabic paragraph direction |

The column-visibility logic of the web items table (`getVisibleColumns`, `pickScalar`, `getRowCurrency`) moved into `reportHelpers.js` so the table on screen and the PDF use the same rules.

## Design

Tokens come from `src/index.css` (light theme) and live only in `pdfTheme.js`:

| Token | Value | Used for |
|---|---|---|
| `primary` | `#2563EB` | Section accents, header rule, table header rule, neutral KPI accent, progress default |
| `success` | `#16A34A` | Income, positive signed results, safe/paid/completed |
| `warning` | `#EA580C` | Warning / near limit / pending / forecast badges |
| `danger` | `#DC2626` | Negative signed results, exceeded / overdue / failed |
| `insights` | `#9333EA` | Reserved for AI insights (the reports API returns none today) |
| neutrals | `#F9FAFB` `#FFFFFF` `#F3F4F6` `#E5E7EB` `#111827` `#374151` `#4B5563` `#6B7280` | Surfaces, borders, text |

The `*Soft` tints are the theme's `--*-soft` alpha colours flattened onto white, so they print identically.

- **Typography** — Tajawal (700/800) for the title, section titles and key figures; Cairo (400/600/700) for everything else. Both ship in `src/assets/fonts` (SIL OFL 1.1, licence files alongside) and are registered from local files, never Google Fonts.
- **Page** — A4 portrait, 34 pt top / 32 pt sides / 56 pt bottom. A report whose items table has 8 or more visible columns (budgets, savings goals, debts, accounts, recurring) switches to landscape.
- **Header** (first page) — logo (`smart-spend-logo-pdf.png`, a 319 × 309 copy of the app logo, drawn at its own ratio), brand, "Generated" time, a short primary rule, the report title and description, then one strip with only the filters that apply: period, currency (or "All currencies"), grouping, time zone. The report's own notes and flags follow in small muted text.
- **Summary** — one block per currency, labelled with its code. The report's first summary group becomes key-figure cards (white, light border, 2 pt top accent in the figure's tone); the remaining groups become two-column label/value cards. Currencies are never added together.
- **Tables** — light blue header with a primary rule; white rows with hair-line separators and a subtle alternate row; text columns start-aligned, numbers end-aligned; column widths follow content weights (names wide, counts narrow). When every row shares one currency, the code moves to the column header ("Amount (ILS)") and cells show numbers only.
- **Semantics** — colour only where it means something, always with text: signed results (net, remaining, change) are green/red by sign, income green, status pills tinted by status, budget/savings progress bars coloured by their `progress_status`.
- **Footer** — hair-line rule, "Smart Spend · Report generated on …" and "Page X of Y" on every page; from page 2 a muted running title repeats the report name.
- **Empty report** — the header (report, period, filters) followed by one quiet panel: "No data available for the selected filters." Empty sections are simply not printed.

## Values

- Money is formatted from the backend's decimal string with BigInt rounding (`formatPdfAmount`): no floating-point step, thousands separators, two decimals, English digits, and the currency code **after** the amount in both languages (`12,500.50 ILS`). Missing values print `—`, never `null`, `undefined` or `NaN`.
- Counts and percentages use English digits (`en-US`).
- Dates use the existing `formatDate` / `formatDateTime` with `en-US` or `ar-u-nu-latn` (Arabic month names, Latin digits).

## Arabic / RTL

react-pdf shapes Arabic correctly with the bundled fonts but has no logical CSS, so layout is mirrored deliberately through `usePdfDirection()`:

- rows use `row-reverse`, text aligns to the reading start, numbers to the reading end, badges and progress bars start from the right;
- the running title reads "report · Smart Spend".

Three react-pdf behaviours shaped the implementation:

1. **Base direction** — react-pdf takes a line's direction from its first character, so "1 أغسطس 2026" would be laid out left to right. `PdfText` prefixes Arabic text with an invisible U+200F RIGHT-TO-LEFT MARK. A `direction: "rtl"` style is not used: it also flips the element's layout and displaced titles. Text without Arabic letters (amounts, codes, English names) is left untouched, so `1,250.00 ILS` never flips.
2. **Font state between documents** — reusing loaded fonts across renders dropped letters in later PDFs (the initial "ت" of "تحويل"). `registerPdfFonts` therefore runs before every document and calls `Font.clear()` before registering again (restoring the built-in Helvetica that `clear()` removes). `Font.reset()` cannot be used: it keeps the cached load, so nothing reloads.
3. **Footer position** — a fixed element holding a `render` text (the page number) disappears when anchored with `bottom`, so the footer is placed with `top` from the page height of the current orientation.

In Cairo, the tail of a final "ر" can swallow the following space ("التقرير في" reads as one word), so the Arabic footer is worded "Smart Spend · تاريخ الإنشاء …".

## Pagination

- Table header rows are `fixed`: they repeat on every page the table continues on, and keep at least one row with them (`minPresenceAhead`).
- Rows never split across pages (`wrap={false}`).
- A section title moves to the next page together with its first block when that block is short (a list, or a table of up to 8 rows); longer tables start under their title and continue.
- The summary's section title, currency caption and key figures move as one piece.
- Rows are capped at 2,000 (`MAX_PDF_ROWS`); beyond that a notice states how many rows were printed out of how many, and points to CSV / Excel for the full list.

## File name

`getPdfFileName(report, from, to)`: `smart-spend-income-expense-report-2026-09.pdf` for a period inside one month, `smart-spend-budgets-report-2026-07-01-to-2026-09-30.pdf` otherwise; slugged to `[a-z0-9-]`.

## Bundle

`@react-pdf/renderer` (4.9) and the PDF components are a separate chunk (~1.2 MB, ~450 kB gzipped) fetched only when a PDF is first exported. The fonts (~390 kB) and the PDF logo (57 kB) are separate assets, also fetched only then. The main bundle is unaffected.

In the browser, react-pdf logs `Buffer is not defined` once per image: its layout step checks `Buffer.isBuffer` after the image has loaded. The warning is harmless — the logo is embedded.

## Translations

`dashboard.reports.pdf.*` (brand, tagline, generated, footer, page, trendHint, truncated, emptyTitle) and `dashboard.reportExports.dialog.notePdf / building`, `dashboard.reportExports.errors.pdfFailed`, in both locales. Everything else reuses the existing report labels (`names`, `descriptions`, `fields`, `values`, `summaryGroups`, `sections`, `comparison`, `notes`, `flags`).
