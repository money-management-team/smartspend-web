# Phase 6UI.5C6 — Exports & Imports (Mobile)

Read-only. `APPROVED = Object.freeze([])` is unchanged: nothing on these pages creates an export, uploads a statement, confirms, cancels or reverses an import, or sends any write.
Backend reference: `fix/financial-idempotency-p0 @ 6b696d72`, read with `git show` only (`ReportExportResource`, `ImportBatchResource`, `ImportRowResource`, the two controllers, the enums, `ReportExportPolicy`, the filter requests).

## Audit: Desktop vs Mobile against the backend's GET contracts

| What | Backend GET | Mobile before | Mobile now |
|---|---|---|---|
| Export history, status filter | `GET /report-exports?status=` (all six statuses accepted) | four statuses in the filter | all six: waiting, being built, ready, failed, expired, cancelled |
| Which exports are waiting, being built, ready or failed | `status` + `download_available` | status chip only; "completed" read as "Ready" even without a file | one stage chip and one plain sentence per export; "completed" without the backend's flag is "File no longer available" |
| Why an export failed | `error.{code,message}` (failed only) | **missing** | the backend's message in the row and on the export's page, with its reference code |
| File size, how long the file is available | `file_size`, `expires_at` (completed) | **missing** | shown only for an export that can be downloaded |
| One export | `GET /report-exports/{id}` | **missing** | export page: report, format, period, currency, requested / started / finished / available until / cancelled, file name and size, failure reason; "Check again" while waiting or being built |
| Download | `GET /report-exports/{id}/download`, own exports only (`ReportExportPolicy`) | button on the history row | unchanged contract; also on the export's page, through one shared hook |
| Import history, status filter | `GET /imports?status=` (eleven statuses) | five statuses | all eleven, in the order a statement moves through them |
| Who is to move next | `status` | status chip only | a second chip: "Waiting for you" (map, review, confirm: full version) or "SmartSpend is working"; one sentence per status |
| One import: counts, file, times | `GET /imports/{id}` | counts without `failed`; uploaded and finished times | `failed` count, file type and size, whether SmartSpend still keeps the original, and the timeline (uploaded, columns mapped, rows checked, confirmed, finished, cancelled, reversed) |
| Row history of an import | `GET /imports/{id}/preview?status=&page=&per_page=` | **missing** | "Rows" card: nine tabs (All + the eight row statuses), paging, each row's own date, type, category, amount and currency, the backend's validation messages, links to the movement an imported row made and to the movement a duplicate may repeat |
| Upload, map, validate, fix rows, confirm, cancel, reverse; create / cancel / revoke an export | POST / PATCH / DELETE | closed | unchanged — still closed notes, never sent |

## What was added

- **Reads** (`data/readApi.js`): `readExport` (`GET /report-exports/{id}`) and `readImportRows` (`GET /imports/{id}/preview`, 10 per page, optional `status` and `page`). Both go through the existing wrappers (`reportExportsApi.get`, `importsApi.preview`); the read-only allow-list test names them.
- **Export stage** (`models/exportsImports.js`): `normalizeExport` derives `stage` from the backend's status and its own `download_available` flag only: `pending`, `processing`, `ready`, `unavailable`, `failed`, `ended`. A status Mobile does not know has no stage and is shown as sent, with no sentence invented for it. The download button follows the flag (`downloadable`), never the stage or the status.
- **Import stage**: `pending` (uploaded, mapping required, ready for review, partly valid: the person's turn), `processing` (checking rows, confirmed, processing: SmartSpend's turn), `done` (only `completed`), `failed`, `ended` (cancelled, reversed). A processing import is never called finished.
- **Rows** are strict (`normalizeImportRow`, `buildImportRowsPage`): a page about another import, a row of another import, a repeated row, a row without a number, or (with a status asked for) a row of another status refuses the whole page. A row's amount is its own, in its own currency; an amount the backend could not read is unavailable, never `0.00`. The statement's own cells (`raw`) are never read or shown. Rows are only asked for once the statement has been checked (`ready_for_review`, `partially_valid`, `completed`, `failed`, `reversed`, as the full version does); before that the card says rows appear after the check.
- **Screens**: `reports/MobileExports.jsx` (history), `reports/MobileExportDetail.jsx` (new, `/m/exports/:id`), `reports/ExportStageChip.jsx`, `reports/useExportDownload.jsx` (the one place a file is fetched, moved out of the history screen unchanged: safe file name, identity guard, denied / gone / failed in words), `imports/MobileImports.jsx` (list and page), `imports/ImportRows.jsx` (new). `RecordScreen` hands its `render` a `{ reload, refreshing }` handle for "Check again"; existing pages ignore it.
- **Address**: row tab and page are `?rows=` and `?rp=`, as `Link`s with `replace`; changing the tab drops the page. An address past the last page leads back.
- **Check again** is a Read, offered only while an export is waiting or being built, or an import is being processed. Nothing polls.
- Strings: `i18n/sections/exportsImportsView.js` (`exportView`, `importView`), EN and AR, parity-checked; `imports.count.failed` added.

## What stays gated

- Creating, cancelling and revoking exports (`POST` / `DELETE /report-exports`), and everything that changes an import (`POST /imports`, `/mapping`, `/validate`, `/confirm`, `/cancel`, `/reverse`, `PATCH` / `POST` on rows). The screens render closed notes and full-version links, and no control that could send them.
- **Download** is a read, so it is offered, but only when the backend's `download_available` is `true` for that export. Exports are visible only to their owner (`ReportExportPolicy`), so there is no permission Mobile could widen; a 403 or an expired file says so in words.
- **There is no download of an import's original file**: the backend has no GET for it (`file_available` only says whether SmartSpend still keeps it), so none is offered.

## Limits (deliberate)

- No progress percentage for an export or an import: the backend sends none.
- No counts of "how many exports are ready" across pages: only what a page holds is shown, nothing is totalled in the browser.
- Import rows' validation messages are the backend's English text; they are shown as sent. Mobile labels (statuses, types, tabs) are translated.
- No account filter on the import list (the backend supports one).
- Real-device behaviour of saving a file is still the browser's choice (unchanged; see `PWA-AND-DEVICE-QA.md`).

## Safeguards kept

- Only GET requests. `tests/mobileReadOnly.test.mjs` names `reportExportsApi.get`, `importsApi.preview` and the two new facade exports; the screens render no input or form, and the only buttons are Download and "Check again".
- Currency is part of every figure; rows are never added up.
- A failed read of the rows, or of one export, shows its own error with Retry and leaves the rest of the page.
- Flag-off builds still contain no Mobile code (`mobileBundle`).
- RTL: dates, amounts, formats and file names are `bdi`; the row tabs wrap instead of clipping; no media queries.

## Tests

`tests/mobileExportsImports.test.mjs`: model strictness (stages, flag-only download, rows), export history and its six filters, the export page (facts, safe-name download, denied / gone / failed, no download without the flag, failure reason, Check again, another export refused, closed notes, Arabic), imports (stages, eleven filters, empty and error, page facts and timeline, per-status sentences, Check again, no rows before the check), and the rows (order, own currency and amount, messages, no raw cells, links, tabs and paging in the address, past-end, refusal, retry, read-only, Arabic). Fixtures: `tests/helpers/exportsImportsFixture.mjs`. Existing expectations updated for the two new GET reads and the "no file yet" wording.

## Visual QA

Local GET-only fixture (fictional data, no production or staging API), 320 px and 390 px, EN and AR (RTL), light and dark. The fixture server answers populated, empty and error states for the export history and the imports; missing fixture endpoints are fixture gaps, not product defects. Captures live outside the repository in `SmartSpend-Mobile-QA/phase-6ui-5c6/`.
