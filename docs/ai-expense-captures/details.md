# AI Expense Captures — Details / Review screen

`GET /ai/expense-captures/{id}` and the page that consumes it: `/dashboard/ai-expense-captures/:captureId`.

> **Updated in Tasks 5, 6, 7 and 8.** A `ready_for_review` capture's Review values section is now an editable form that saves with `PATCH /ai/expense-captures/{id}` — see [editing.md](editing.md). That is the page's only write, and it saves a draft: no transaction, no ledger entry, no balance change. Every other status stays read-only with no Save action. Task 6 added the second write, `POST /ai/expense-captures/{id}/retry`, on a `failed` capture — it requeues AI processing and creates nothing; see [retry.md](retry.md). Task 7 added the money-moving one, `POST /ai/expense-captures/{id}/confirm`, on a `ready_for_review` capture; see [confirm.md](confirm.md). Task 8 added `DELETE /ai/expense-captures/{id}` for a discardable draft; see [discard.md](discard.md).

## Endpoint

`aiExpenseCapturesApi.get(captureId, { signal })` → `apiRequest("/ai/expense-captures/{id}")`. Fetch-based, no axios. `VITE_API_BASE_URL` already ends in `/api`, so the module's path carries no `/api` prefix of its own.

The id is `encodeURIComponent`-ed by the path builder in the API module. No query is sent at all: **no `user_id`, no `workspace_id`** — authorization and workspace scoping belong to the backend, which answers 403 or 404 for a capture that isn't the caller's.

## Response

The capture is at **`data.capture`**, never at `data` itself. `parseCaptureResponse(response)` returns it only when it looks like an entity, otherwise `null`, which the page turns into a `MALFORMED_RESPONSE` error rather than rendering half a capture.

```json
{ "status": true, "data": { "capture": {
  "id": 15, "source_type": "upload", "status": "ready_for_review", "review_version": 2,
  "ai_suggested_values": { "merchant_name": { "value": "AI Grocery", "confidence": 0.95 } },
  "review_values": { "account_id": 3, "amount": "25.0000", "currency_code": "ILS" },
  "warnings": [], "confirmed_transaction_id": null } } }
```

## AI suggestions

Rendered by `AiSuggestions` from `getSuggestionEntries(capture)`, which handles the object defensively:

- The documented shape is `{ field: { value, confidence } }`; a bare scalar is accepted too.
- Keys are the **AI's own field names** and need not match the review fields — the contract's own example pairs the suggestion `total_amount` with the review field `amount`. A key with no translation is humanised (`vat_id` → "Vat id") rather than dropped, so a new suggestion type appears instead of breaking the page.
- A nested object value is stringified rather than crashing the render.
- Empty values are skipped; an empty object shows a plain "no suggestions" line.

Nothing here is editable, sent back, or copied into `review_values` — **not even at high confidence**.

## Confidence

`toConfidence(value)` accepts a finite number in **0–1** and returns `null` for anything else. A value like `95` is **rejected, not rescaled**: deciding it meant `0.95` would invent precision the contract doesn't give.

It is displayed as a percentage in plain secondary text — no success colour, no badge, no threshold. Confidence says how sure the model was; it is **not** a sign that a value is correct, approved, valid or safe, and nothing in the UI acts on it.

## Review values

Rendered by `ReviewValues` from `getReviewValueEntries(capture)`: the documented fields in `CAPTURE_REVIEW_FIELDS` order first, then any other key the backend sent, so nothing is hidden. Empty values are skipped.

For every status except `ready_for_review` this stays a read-only `<dl>` with no Save action. For `ready_for_review` the same component renders the editable form instead; see [editing.md](editing.md).

### Money

`amount`, `tax_amount` and `fee_amount` stay the backend's decimal strings (`"25.0000"`) in state. `formatMoney(value, currency, locale)` is display only; the stored value is never replaced by a float, so nothing here can lose precision.

### Account and category

The contract returns `account_id` and `category_id` and does **not** guarantee embedded objects. The page therefore:

- fetches the existing `accountsApi.list` / `categoriesApi.list` (read-only, no new endpoints, no financial state touched) — for a name on an id here, and for the selectors when the draft is editable;
- falls back to `#3` when the lists haven't loaded or the id isn't in them;
- never fabricates a name. A failed lookup never blocks the read-only page; on the editable form it shows a message with a retry, because there the lists are choices rather than labels.

## review_version

Read with `getReviewVersion(capture)` and displayed in the summary. A missing version stays **unavailable** — it is never defaulted to `0`, because `0` is a legitimate version and claiming one the backend didn't send would later be submitted as fact. It is never incremented locally.

The editable form sends the newest version back with `PATCH`; see [editing.md](editing.md) for that, and [review-model.md](review-model.md) for how a stale one is detected (a 422 naming `review_version`, not a 409). Confirm will do the same.

## Warnings

`getCaptureWarnings(capture)` normalises the array to plain strings, accepting either bare strings or `{ code, message }` objects. The section renders **only when there is something to show** — an empty `warnings: []` produces no empty panel.

Warnings are informational. Nothing turns one into a validation error or blocks an action, because the contract doesn't say they do.

## Confirmed transaction

`captureHasTransaction(capture)` and `getConfirmedTransactionId(capture)` gate this section, so it exists only for a `confirmed` capture — the one state where money exists. The id links to the existing transaction details route via `getTransactionDetailsPath(id)`; no new transaction feature was created.

If a confirmed capture arrives without the id, the section says so rather than linking nowhere.

When this page is the one that confirmed the capture, the transaction the backend returned fills in its type, status, amount and source beside the link — shown exactly as it arrived, never recomputed. A capture fetched later carries only the id, and the link alone is what appears.

## Status presentation

The page supports all seven statuses and never compares status strings on its own — it uses `isCaptureProcessing()` and the `AI_CAPTURE_STATUS` constants.

| Status | Note shown |
| --- | --- |
| `uploaded`, `queued`, `processing` | The AI hasn't finished; nothing has been recorded |
| `ready_for_review` | No note — the review information is the point |
| `failed` | The AI couldn't read the receipt; nothing has been recorded |
| `confirmed` | Confirmed, and the expense is in the ledger |
| `discarded` | Discarded; nothing was recorded |

Every note except `confirmed` states plainly that no money moved.

Which actions a status offers comes only from the shared helpers, so no impossible combination can appear:

| Status | Actions |
| --- | --- |
| `ready_for_review` | Save · Confirm · Discard |
| `failed` | Retry · Discard |
| `uploaded`, `queued` | Discard |
| `processing`, `confirmed`, `discarded` | none |

All four writes share **one** action lock on the page: whichever is in flight disables the others and locks the review form, so two can never race over the same capture.

While the backend is still working the note is a live region, and the page polls for the change — see [retry.md](retry.md), which also covers the per-status wording for `uploaded`, `queued` and `processing`.

## Route and navigation

| Constant | URL |
| --- | --- |
| `PATH.USER.AI_EXPENSE_CAPTURE_DETAILS` | `/dashboard/ai-expense-captures/:captureId` |

`getAiExpenseCapturePath(captureId)` is the single builder, next to the other `get*Path` helpers. No component concatenates the URL.

The list row's **View** action uses it and passes the list's query string in router state, so **Back** from the details page returns to the same filters and page — the same mechanism the ledger and transaction details already use. The browser's own Back works regardless.

`captureId` is not validated client-side: no details page in this project does, and the backend answers `404` for an id that doesn't resolve. `encodeURIComponent` in the path builder is what keeps a malformed value from breaking the request URL.

## Loading and errors

Results are keyed to the request that produced them (`captureId:reloadKey`), so another capture's details are never shown under this id while a fetch is in flight — the status poller writes through the same key, so a late check can never land on a different capture. The request runs under an `AbortController` aborted on unmount and on `captureId` change, and `AbortError` is ignored — a slow earlier response cannot replace a newer one.

| Code | Behaviour |
| --- | --- |
| `401` | Never reaches the page: `apiClient` clears the session and fires `smartspend:session-expired`, which `AuthProvider` acts on |
| `403` | "Access denied" with its own message. No retry button — it won't change |
| `404` | "Receipt not available", worded so it covers both "doesn't exist" and "isn't yours". No retry button |
| everything else | `getApiErrorMessage(error, t)` plus a retry button |

No redirect on error: the page shows the state in place with a back link, like the other details pages.

## Responsive, RTL and theme

Plain global CSS with BEM-style `capture-details__*`, `ai-suggestions__*` and `review-values__*` prefixes. Logical properties throughout (`padding-inline-start`, `border-block-end`, `margin-inline`), `[dir="rtl"]` flips for the back arrow and the row action arrow, `<bdi dir="ltr">` around ids, amounts, dates and version numbers inside Arabic text. Colours come from the existing tokens, so dark mode follows automatically. Definition rows collapse to a single column under 640px.
