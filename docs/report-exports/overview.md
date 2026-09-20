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
| `ReportExports/components/ExportTracker/` | The export just queued from the Reports page |
| `ReportExports/components/ExportHistoryRow/` | One row of the history |
| `ReportExports/components/ExportActions/` | Download and cancel / revoke |
| `ReportExports/components/ExportStatusBadge/` | Status pill |

See [lifecycle.md](lifecycle.md) for statuses and polling, and [download.md](download.md) for the binary download.

## Creating an export

`POST /report-exports` with:

```json
{
  "report": "income-expense",
  "format": "csv",
  "filters": { "workspace_id": 1, "from": "…", "to": "…", "currency": "ILS", "group_by": "month", "timezone": "…" }
}
```

Only the keys in `EXPORT_FILTER_KEYS` are sent, and empty ones (for example "all currencies") are dropped rather than sent as `""`. `per_page` and `page` never belong to an export — an export is the whole report, not a page of it.

The response is a queued export, which the Reports page hands to `ExportTracker`. The Export button is disabled while the request is in flight, guarded by a ref so a double click cannot queue two jobs.

`csv` is the only documented format (`EXPORT_FORMATS`), so it is the only one offered.

## History

`GET /report-exports` with `status`, `report`, `format`, `per_page`, `page`. The filters and the page live in the URL, so a filtered history can be linked and survives a reload. `data.report_exports.data` holds the rows and paging is the backend's.
