# Report exports — the binary download

`GET /report-exports/{id}/download` returns **the file**, not the `{ status, data, message }` envelope. Parsing it as JSON would corrupt it, so it does not go through `apiRequest`.

## `apiDownload` in `apiClient.js`

A second entry point next to `apiRequest`, sharing its transport (`sendRequest`) and its error handling (`createResponseError`):

- same `Authorization: Bearer` token and `Accept-Language` header;
- `Accept: */*` instead of JSON;
- its own 60 s timeout (`DOWNLOAD_TIMEOUT_MS`) — a file takes longer than a JSON call;
- the same 401 handling: the session is cleared and `smartspend:session-expired` dispatched;
- a successful body is read with `response.blob()` and **never** with `.json()`.

It resolves to `{ blob, filename, contentType }`.

### Errors still read as JSON

A failed download still answers with the normal envelope, so its `message` reaches the user:

- **not OK** → the body is parsed as JSON where possible and turned into the usual `ApiError` with its code;
- **OK but `Content-Type: application/json`** → the backend refused the file rather than sending one. This is treated as an error (`status: false` → the envelope's error, otherwise `MALFORMED_RESPONSE`), never handed to the user as a "file".

## Filename

`getContentDispositionFilename` parses `Content-Disposition`, preferring the RFC 5987 `filename*` form (percent-decoded) and falling back to the plain quoted `filename`. A malformed encoding falls back rather than throwing.

`getExportFilename(record, headerFilename)` then picks, in order:

1. the `Content-Disposition` name;
2. the export's own `file_name`;
3. a built name — `smartspend-{report}-{id}.{format}`.

The header is not always readable: a cross-origin response only exposes it when the backend sends `Access-Control-Expose-Headers: Content-Disposition`. `filename` is `null` in that case, which is why the fallbacks exist.

## Handing the file to the browser

```js
export function saveBlobAsFile(blob, filename) { … }
```

Creates an object URL, clicks a hidden `<a download>`, removes the link, and revokes the URL after 1 s. The delay is deliberate: some browsers (Safari) start the download asynchronously after the click and fail if the URL is already gone. One URL per click, always revoked, so none leak.

## In the UI

`ExportActions` enables Download only when `canDownloadExport(record)` — the backend's `download_available` flag — is true, guards against a double click with its own pending state, and shows `getExportErrorMessage(error, t, "download")` on failure. The export record itself is not changed by a download.
