# AI Expense Captures — Uploading a receipt

`POST /ai/expense-captures` and the receipt panel in Financial Operations.

> ## ⚠ This endpoint is not in the documented Sprint 7 contract
>
> Sprint 7 documents seven endpoints and **this is not one of them**. Task 1 explicitly instructed that `POST /ai/expense-captures` must not be invented, and it was not — until the product flow diagram described it as part of the intended journey and the implementation was requested directly.
>
> Its **path, multipart field name, response shape and initial status are assumptions**, not verified backend facts. They are collected in `captureConstants.js` so a single edit corrects them once the real contract arrives.
>
> If the route does not exist, the upload answers 404/405 and the UI says the service isn't available — it does not blame the file. That failure is also the cheapest way to learn the route's real name.

## What rests on what

| Value | Basis | Confidence |
|---|---|---|
| `POST /ai/expense-captures` | The product flow diagram | Stated, not verified |
| File field `file` | `importsApi.upload`, the project's only multipart precedent | Project convention |
| Response at `data.capture` | Every other Sprint 7 endpoint | Project convention |
| Accepted types (JPG/PNG/WEBP/HEIC) | The picker's existing `accept="image/*"` | Frontend choice |
| 10 MB limit | A conservative local guard | **Frontend choice, not a backend mirror** |
| Initial status | **Nothing is assumed** — whatever the backend returns is shown | n/a |

## Request

```
POST /ai/expense-captures
Content-Type: multipart/form-data; boundary=…
Idempotency-Key: ai-capture-upload-…        (optional)

file: <the chosen image>
```

**The FormData carries the file and nothing else.** No `account_id`, no `workspace_id`, no `user_id`: the account is chosen later during review, and ownership is the backend's from the bearer token.

`apiRequest` leaves a `FormData` body alone — it skips the JSON `Content-Type` so the browser writes the multipart header with its own boundary. The upload uses a 60s timeout rather than the default, because a receipt on a slow connection is not a JSON request.

### Idempotency

Optional, like retry's and discard's. One key per chosen file, fingerprinted on name + size + last-modified, so a retry after a timeout replays that upload instead of creating a second capture of the same receipt. Picking a different file is a different upload. Nothing financial is created either way.

## Response

Expected `data.capture`, parsed with the shared `parseCaptureResponse`. Anything else is treated as `MALFORMED_RESPONSE` rather than a half-success.

On success the user is sent straight to `/dashboard/ai-expense-captures/{id}`. **No status is assumed on the way**: the details page shows whatever the backend returned, and its poller follows `uploaded` → `queued` → `processing` → `ready_for_review` on its own.

## Nothing is recorded

Uploading creates a **draft**. No transaction, no ledger entry, no balance change, no budget change. The expense exists only after the user reviews the draft and confirms it — see [confirm.md](confirm.md).

## Validation before sending

A local courtesy so an obviously wrong file fails instantly instead of after a slow upload; the backend remains the authority and may refuse a file this accepts.

| Check | Behaviour |
|---|---|
| No file | "Choose a receipt image first." |
| Type not in `CAPTURE_UPLOAD_TYPES` | Names the accepted formats. Skipped when the browser reports an empty `type` |
| Larger than `CAPTURE_UPLOAD_MAX_BYTES` | Names the limit, taken from the constant rather than typed into the message |

## Errors

| Code | Behaviour |
|---|---|
| `401` | Never surfaces: `apiClient` ends the session and `AuthProvider` signs the user out |
| `404` / `405` | **The route doesn't exist.** "Not connected yet — use manual entry", never a complaint about the file |
| `422` | The backend's own message, which is how the real field rules will first become visible |
| everything else | `getApiErrorMessage`, plus the manual-entry escape |

Manual entry stays one click away whatever goes wrong.

## Double submission

The button is disabled while uploading **and** a synchronous `pendingRef` blocks a second call that fires before React re-renders, so a double click cannot create two captures.

## Accessibility

Real `<button>` elements, `aria-busy` while uploading, a `role="status"` line announcing the upload rather than conveying it through a disabled attribute alone, and `role="alert"` for both the file error and the request error.

## What the backend must confirm

1. The exact method and path.
2. The exact multipart field name, and any other required parts.
3. The success status code and full response body — is the capture at `data.capture`?
4. The initial status: `uploaded` or `queued`?
5. Whether AI processing is enqueued automatically.
6. Accepted MIME types and the real maximum size.
7. Whether `Idempotency-Key` is honoured.

Until 1–4 are answered, this path is **wired but unverified**: it has never completed against a real backend.
