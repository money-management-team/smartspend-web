# Report exports — overview

Report exports turn a report and its applied filters into a downloadable file. Exports are **asynchronous**: creating one only queues a job, and the file exists later.

An export is started from the Reports page (`/dashboard/reports`) with the filters currently applied, and every export is listed on the export history page (`/dashboard/reports/exports`, `PATH.USER.REPORT_EXPORTS`), which is linked from the Reports header.

## Endpoints

| Action | Endpoint | Module function |
|---|---|---|
| Queue an export | `POST /report-exports` | `reportExportsApi.create` |
| History | `GET /report-exports` | `reportExportsApi.list` |
| One export's status | `GET /report-exports/{id}` | `reportExportsApi.get` |
| Download the file | `GET /report-exports/{id}/download` | `reportExportsApi.download` |
| Cancel or revoke | `DELETE /report-exports/{id}` | `reportExportsApi.cancel` |

All in `src/features/Dashboards/User/api/reportExportsApi.js`.

## Envelopes

- **create / get / cancel** — `data` is the export itself: `{ id, report, format, status, filters, file_name, file_size, created_at, started_at, completed_at, expires_at, cancelled_at, download_available }`.
- **list** — `data.report_exports`, a Laravel paginator with the rows in `.data`.
- **download** — the binary file, *not* the JSON envelope.

## Files

| Path | Responsibility |
|---|---|
| `ReportExports/ReportExports.jsx` | History page: filters, paginator, rows |
| `ReportExports/reportExportHelpers.js` | Statuses, poll timing, filename, size, error wording |
| `ReportExports/useReportExport.js` | Status polling for one export |
| `ReportExports/components/ExportFormatDialog/` | Format picker opened by the Reports page's Export button |
| `ReportExports/components/ExportTracker/` | The export just queued from the Reports page |
| `ReportExports/components/ExportHistoryRow/` | One row of the history |
| `ReportExports/components/ExportActions/` | Download and cancel / revoke |
| `ReportExports/components/ExportStatusBadge/` | Status pill |
| `ReportExports/components/ExportFormatBadge/` | CSV / XLSX / PDF pill |

See [lifecycle.md](lifecycle.md) for statuses and polling, and [download.md](download.md) for the binary download.

## Creating an export

`POST /report-exports` with:

```json
{
  "report": "income-expense",
  "format": "pdf",
  "filters": { "workspace_id": 1, "from": "…", "to": "…", "currency": "ILS", "group_by": "month", "timezone": "…" }
}
```

Only the keys in `EXPORT_FILTER_KEYS` are sent, and empty ones (for example "all currencies") are dropped rather than sent as `""`. `per_page` and `page` never belong to an export — an export is the whole report, not a page of it.

The response is a queued export, which the Reports page hands to `ExportTracker`. It is **not** a file: nothing is downloadable until the backend reports `download_available`.

## Formats

`EXPORT_FORMATS` in `reportExportHelpers.js` is `["csv", "xlsx", "pdf"]`, and these exact strings are sent as `format`. Never `excel`, `xls`, uppercase values or `docx` — Word is not a supported format and is offered nowhere.

| Choice | `format` sent | Downloaded file |
|---|---|---|
| CSV | `csv` | `.csv` |
| Excel (.xlsx) | `xlsx` | `.xlsx` |
| PDF | `pdf` | `.pdf` |

CSV and Excel follow the queued lifecycle below: the backend builds the file. **PDF is the exception**: choosing it in the dialog builds the document in the browser from the report data, with the Smart Spend PDF design, and downloads it directly — see [../reports/pdf-export.md](../reports/pdf-export.md). `"pdf"` stays in `EXPORT_FORMATS` so the history can filter and download PDF exports queued earlier, and a failed queued PDF can still be retried through the queue.

## Choosing a format — `ExportFormatDialog`

The Reports header's **Export report** button (`aria-haspopup="dialog"`) opens a modal with the three formats as native radio buttons (arrow keys move between them), each with an icon and a one-line "best for" hint, plus Cancel / **Export {format}**.

- The subtitle shows the report name and the period on screen. The export is built from the page's own URL filters (`from`, `to`, `currency`, `group_by`, plus `workspace_id` from `resolveWorkspaceId()` and the report's time zone); there is no second copy of the filter state.
- While `POST /report-exports` is in flight (or the PDF is being built) the dialog cannot be closed or resubmitted, and a live region reads "Preparing your Excel report…" / "Building your PDF…". The note under the formats changes with the choice: queued in the background for CSV / Excel, built on this device for PDF. `createExport` and `downloadPdf` in `Reports.jsx` share one ref guard, so a double click cannot start two exports.
- A create failure stays inside the dialog (`getExportErrorMessage(…, "create")`) so the user can retry without choosing again. On success the dialog closes, focus returns to the Export button, and the tracker appears.
- The last chosen format is preselected the next time the dialog opens (page state only, not persisted).
- Escape or a backdrop click closes it (except while the request is pending). On narrow screens (≤ 560 px) it becomes a bottom sheet with full-width buttons.

## History

`GET /report-exports` with `status`, `report`, `format`, `per_page`, `page`. The filters and the page live in the URL, so a filtered history can be linked and survives a reload. `data.report_exports.data` holds the rows and paging is the backend's.

Each row shows the report, a format badge, the period it was exported for (`filters.from` – `filters.to` from the export record, via `getExportPeriod`), status, requested / completed / expiry times, file size and the Download / cancel actions. The format filter offers all three formats.
