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
- stops on any final status, on a fatal code (`NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED`), and after `MAX_POLLS` (40) checks — about six minutes — after which the user gets a "still being built — check again" button;
- clears its timer and aborts its request on unmount.

Mount one instance per export, keyed by id, so an export never has two timers. Both `ExportTracker` (the export just queued) and every `ExportHistoryRow` use the same hook, so a history page of queued exports polls each row independently and correctly.

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

`getExportErrorMessage(error, t, context)` — `context` is `create`, `list`, `download` or `cancel` — gives export-specific wording for `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, not-ready and expired cases, and otherwise falls back to `getApiErrorMessage`.
