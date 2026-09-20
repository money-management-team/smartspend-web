# Statement imports — errors and edge cases

All import errors go through `getImportErrorMessage(error, t, context)` in `importHelpers.js`, which falls back to the shared `getApiErrorMessage`. `context` is one of `upload`, `mapping`, `validate`, `preview`, `row`, `ignore`, `confirm`, `reverse`, `cancel`, `resume`, `list`.

Raw backend stack traces are never shown: only the envelope's `message`, the 422 field messages, or a translated fallback.

## Documented error scenarios

### Unsupported file — `POST /imports` → 422

```json
{ "status": false, "message": "Only CSV and XLSX files can be imported." }
```

The file input accepts only `.csv,.xlsx` and `validateImportFile` rejects a wrong extension or an empty file before sending, with a localized message (`upload.errors.type` / `.empty`). If the backend still refuses it, the 422 keeps **its own message**, so the exact sentence above reaches the user. The rejected file stays selected so it can be replaced rather than re-picked.

### Missing date column — `POST /imports/{id}/mapping` → 422

```json
{ "status": false, "message": "A date column is required." }
```

`validateMappingForm` catches this before sending (`mapping.errors.dateRequired`). A 422 from the backend keeps its message, and `splitMappingErrors` puts field messages such as `mapping.date` or `account_id` back on the right form control; anything else is listed as a general error.

### Already confirmed — `POST /imports/{id}/confirm` → 409

```json
{ "status": false, "message": "This import has already been confirmed." }
```

The message is shown as-is, a hint explains that the import was reloaded, and `GET /imports/{id}` is called to show its real state. **No second confirmation is sent and no new idempotency key is minted.** See [idempotency.md](idempotency.md).

### Another user's import — `GET /imports/{id}` → 404

```json
{ "status": false, "message": "The requested resource was not found." }
```

The backend deliberately answers **404, not 403**, so an import's existence is not leaked. This is expected behaviour, not a bug. `NOT_FOUND` maps to a plain "not found" message (`errors.notFound`) and the resume screen offers Retry and Start over. `FORBIDDEN` has its own separate wording for the cases where the backend does send a 403.

## Other cases

| Case | Behaviour |
|---|---|
| **401** | `apiRequest` clears the session and dispatches `smartspend:session-expired`; `AuthProvider` logs the user out. Nothing import-specific. |
| **413 / 415** | Raised by the web server before the backend validates. Mapped to `errors.tooLarge` / `errors.unsupported`. |
| **429** | Falls through to `getApiErrorMessage`, which shows the rate-limit message with `Retry-After`. |
| **Network / timeout / 5xx** | `getApiErrorMessage` wording. For confirm and reverse the idempotency key is **kept**, so the retry is safe. |
| **Malformed envelope** | Every parser returns `null` on an unexpected shape and the caller throws `ApiError` with `MALFORMED_RESPONSE` rather than rendering `undefined`. |
| **Stale page of rows** | If a page of the preview comes back empty but the paginator reports rows, the user is offered a jump back to page 1. |
| **Reverse reason** | Required and capped at `REVERSE_REASON_MAX` (500). `validateReverseReason` returns `required` / `tooLong`, both localized. |
| **Cancel raced by confirm** | A 409 on cancel re-reads the import and shows its actual state. |
| **Import edited after it locked** | `canEditImport` honours the backend's `is_editable` when present, and otherwise treats anything posted or final as read-only. The edit and ignore controls disappear. |

## Polling safety

`useImportStatus` polls `GET /imports/{id}` only while the status is `validating`, `confirmed` or `processing`:

- one timer and one in-flight request at a time;
- a growing delay (1.5 s → 10 s) from `getImportPollDelay`;
- stops on any final status, so a completed import is **never** polled again;
- stops on a fatal code (`NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED`) and after `MAX_IMPORT_POLLS` (40) checks, after which the user gets a "still working — check again" button;
- clears its timer and aborts its request on unmount.

Mount one instance per import (it is keyed by id) so an import can never have two timers.

## RTL and i18n

Every string is a translation key under `dashboard.importPage.*`, present in both `en.json` and `ar.json` in exact parity. Counts, sizes, dates and amounts are wrapped in `<bdi dir="ltr">` inside RTL text; user content (file names, descriptions, reasons) uses `dir="auto"`. Directional icons are flipped with `[dir="rtl"]` rules, and the spinner and hover transforms honour `prefers-reduced-motion`.
