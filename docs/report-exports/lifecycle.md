# Report exports — statuses, polling, cancel and revoke

## Statuses

`EXPORT_STATUSES` in `reportExportHelpers.js`:

| Status | Meaning | Polled | Download | `DELETE` does |
|---|---|---|---|---|
| `queued` | waiting to be built | yes | no | **cancel** |
| `processing` | being built | yes | no | **cancel** |
| `completed` | file ready | no | when `download_available` | **revoke** |
| `failed` | could not be built | no | no | nothing |
| `expired` | file removed | no | no | nothing |
| `cancelled` | cancelled by the user | no | no | nothing |

An unrecognised status is reported as `unknown` by `getExportStatus` and shown neutrally rather than reinterpreted.

## `download_available` decides, not the status

```js
export const canDownloadExport = (record) => record?.download_available === true;
```

The backend's flag is the only thing that enables the Download button. A `completed` status alone never does — the file may already have expired or been revoked. This is why `ExportTracker` waits for the flag rather than for `completed`.

## Polling — `GET /report-exports/{id}`

`useReportExport(initialRecord)` follows one export:

- polls only while the status is `queued` or `processing` (`ACTIVE_EXPORT_STATUSES`);
- one timer, one in-flight request, and it never re-creates the export;
- growing delay from `getPollDelay`: 2, 3, 4, 5, 5, 8 s, then every 10 s;
- stops on any final status, on a fatal code (`NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED`), and after `MAX_POLLS` (40) checks — about six minutes — after which the user is told the report is taking longer than expected and gets a **Check again** button (and the export history link);
- a failed check (network, timeout, 5xx, 429) is retried on the same schedule and is **not** shown at once: `pollError` is only exposed after `POLL_ERROR_THRESHOLD` (2) failures in a row, or when the error is fatal;
- staying `queued` is never treated as an error — the queue may simply be busy;
- clears its timer and aborts its request on unmount.

Mount one instance per export, keyed by id, so an export never has two timers. Both `ExportTracker` (the export just queued) and every `ExportHistoryRow` use the same hook, so a history page of queued exports polls each row independently and correctly.

## What the tracker shows

`ExportTracker` renders the backend's statuses as three steps — **Waiting to start → Generating → Ready** — with a check mark for finished steps and a spinner on the current one (`aria-current="step"`). There is no percentage: the backend reports none, so none is invented. Every state has text, never colour alone.

| Status | Line under the steps (announced via `aria-live="polite"`) |
|---|---|
| `queued` | Your report is waiting to be processed. |
| `processing` | Generating your PDF report… |
| `completed` | Your PDF report is ready. + **Download PDF** |
| `failed` | The backend's `failure_reason` / `error_message` when present, otherwise "Report generation failed. Please try again." + **Try again** |

**Try again** queues a *new* export with the failed export's own `report`, `format` and `filters` (not whatever is on screen now), through the same guarded `createExport`. A retry failure is shown under the header.

Dismissing the tracker or leaving the page unmounts it, which clears its timer and aborts its request.

## `DELETE /report-exports/{id}` — cancel *or* revoke

The same endpoint does two different things, and the UI labels it by what it will actually do:

```js
export function getExportStopAction(record) {
  if (isActiveExport(record)) return "cancel";   // queued / processing
  if (record?.status === "completed") return "revoke";
  return null;                                    // nothing to stop
}
```

- **Cancel** (`queued` / `processing`) — the job is stopped and the file is never built.
- **Revoke** (`completed`) — the private file is removed and the export becomes `expired`.

Neither is presented as a plain "delete", and the button is hidden entirely when there is nothing to stop. `ExportActions` asks for confirmation inline first, with wording specific to the action (`confirm.cancel` / `confirm.revoke`).

The export the backend returns replaces the row, so the UI shows the real resulting status rather than assuming one. A `409` means the export moved on meanwhile (for example it finished while the user was deciding), so the row is re-read through `GET /report-exports/{id}` instead of being retried.

## Errors

`getExportErrorMessage(error, t, context)` — `context` is `create`, `list`, `download` or `cancel` — gives export-specific wording for `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, not-ready and expired cases. A download that fails for a network, timeout, server or malformed-response reason reads "The report was generated, but the download could not be completed. Please try again." Everything else falls back to `getApiErrorMessage`.

A 401 at any point (create, poll, download) goes through `apiClient`'s session-expired flow: the session is cleared, the user is signed out, and polling stops.
