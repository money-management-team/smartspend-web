# AI Expense Captures — Original receipt (source file)

`GET /ai/expense-captures/{id}/source` — the private file a capture was read from.

> ## ⚠ Blocked: the signed URL has no delivery mechanism
>
> The `/source` route requires a **signed** URL (`?expires=…&signature=…`) that only the backend can produce, on top of the bearer token.
>
> **Nothing in the documented contract hands that URL to the frontend.** The Show response (`GET /ai/expense-captures/{id}`) carries `source_type: "upload"` and no URL field of any kind. A repository-wide search for `source_url`, `signed_url`, `signed_source_url`, `download_url`, `receipt_url`, `expires` and `signature` found no capture-related producer — the only signed-link consumer in the project is `authApi.verifyEmail`, for emailed verification links.
>
> So the frontend **cannot reach this endpoint today**, and no signature is invented to get there. The receipt section renders only when a capture actually contains a URL, which means it currently never renders. There is no broken Preview button.
>
> **What the backend needs to add:** a signed URL for the receipt on the capture payload — `source_url` is the obvious name. Once it lands, the only change needed here is to narrow `CAPTURE_SOURCE_URL_FIELDS` to that one confirmed key; everything below already works with it.

## What is built

Infrastructure that is fully determined by the contract, and correct whatever the URL's eventual field name is:

| Piece | Where | Role |
| --- | --- | --- |
| `toApiRelativeUrl(url)` | `api/apiClient.js` | Turns a backend URL into an endpoint **without touching its query** |
| `aiExpenseCapturesApi.downloadSource(signedUrl, options)` | `api/aiExpenseCapturesApi.js` | Fetches the file as a Blob |
| `getCaptureSourceUrl(capture)` | `captureHelpers.js` | Reads a URL off a capture, or `null` |
| `isImageSource` / `isPdfSource` / `isSourceLinkExpired` | `captureHelpers.js` | MIME and expiry decisions |
| `CaptureSource` | `AiExpenseCaptures/components/CaptureSource/` | The receipt section |

Because no URL is ever produced, **this path has not been exercised against a real response**. It is written to the contract, not verified by it.

## Preserving the signature

A signature is computed over the query exactly as the backend wrote it. Re-encoding it, reordering its parameters, or round-tripping it through `createQueryString` would invalidate it.

So `toApiRelativeUrl` never parses the query: everything after `?` is carried across byte for byte, and the result is passed to `apiDownload` as part of the **endpoint**, with no `query` option. This is the same approach `authApi.verifyEmail` already uses for emailed signed links.

Nothing in the frontend builds, repairs, re-signs or extends `expires` / `signature`, and no storage path or disk name appears anywhere.

## Origin safety

`toApiRelativeUrl` returns `null` for any URL that is not on this API's origin, so a foreign host can never be sent the app's bearer token. Rejected:

- absolute URLs on another origin (including S3/CDN-style pre-signed links);
- prefix lookalikes such as `https://api.example.com.evil.com/…`;
- protocol-relative `//host/path` and `/\host/path`, which standard URL resolution reads as another origin.

A third-party pre-signed URL (one that carries its own auth in the query and needs no bearer token) would need a separate unauthenticated fetch path. None is built, because the contract describes this as our own authenticated route.

## Response handling

The response is a **file or stream, never the JSON envelope**, and is never parsed as JSON. `apiDownload` returns `{ blob, filename, contentType }` and treats a JSON body as a refusal — the same binary path the report exports use. No second binary client, Blob utility or HTTP client was introduced.

## Content type

What the backend streamed decides how the file is shown — never the extension, and never an assumption that a receipt is an image.

| `Content-Type` | Behaviour |
| --- | --- |
| `image/*` | Inline `<img>` preview with translated alt text |
| `application/pdf` | Inline `<object>` preview, plus "open in a new tab"; falls back to a message where the browser has no PDF viewer |
| anything else | No preview; the file is offered as a download |

The bytes are only ever treated as binary media. There is no `dangerouslySetInnerHTML` and no path by which returned content becomes markup. No PDF viewer dependency was added.

## Lazy loading and download

Opening the details page fetches **nothing**. The user presses **Load preview**, and **Download** is always an explicit action — a receipt can be large, and a details page should not pull one by itself. Once loaded, the blob is reused: pressing Download does not refetch.

The filename comes from `Content-Disposition` via `getContentDispositionFilename` (inside `apiDownload`) and is handed to `saveBlobAsFile`. A generic fallback is used only when the backend sent no filename.

## Object URL lifecycle

`URL.createObjectURL` is called only for a type that is actually previewed. The URL is held in a ref and revoked:

- before a new one replaces it;
- on unmount, via the effect's cleanup.

The section is keyed by the signed URL, so a refreshed link remounts it: the previous blob's URL is revoked by that unmount and no state survives from the link it belonged to. Object URLs are never persisted.

## Expiry and errors

| Code | Behaviour |
| --- | --- |
| `401` | Never surfaces here: `apiClient` ends the session and fires `smartspend:session-expired` |
| `403` | Treated as an expired or invalid signature: a "link expired" message with **Refresh link** |
| `404` | "This receipt file isn't available", with no retry — it won't change |
| other | `getApiErrorMessage(error, t)` with a retry button |

**Refresh link** refetches `GET /ai/expense-captures/{id}`, because a newly signed URL can only come from the backend. The frontend never re-signs, and an expired URL is never retried in a loop — one refresh, then the user decides.

## Security

- The signed URL is held in props for the life of the component and is **never** written to `localStorage`, `sessionStorage`, app-level state, a URL the app owns, this documentation, or any log.
- Nothing logs the signature, the full URL or the `Authorization` header.
- No `user_id` or `workspace_id` is sent; the backend owns authorization.

## Accessibility

Real `<button>` and `<a>` elements throughout — no clickable `div`s. The image preview has translated alt text, the PDF `<object>` an `aria-label`, the loading state reuses the shared `Loading` component (`role="status"`, `aria-live="polite"`), and errors are announced with `role="alert"`.
