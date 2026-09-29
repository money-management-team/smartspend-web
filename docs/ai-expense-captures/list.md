# AI Expense Captures — List

`GET /ai/expense-captures` and the page that consumes it: `/dashboard/ai-expense-captures`.

## Endpoint

Called through `aiExpenseCapturesApi.list(query, { signal })` (`api/aiExpenseCapturesApi.js`), which wraps the project's fetch-based `apiRequest`. No axios, no second HTTP client, and `apiRequest` is never called from the page component.

`VITE_API_BASE_URL` already ends in `/api`, so the module's path is `/ai/expense-captures` — never `/api/ai/expense-captures`, and never `/api/api/…`.

## Query parameters

Only the four documented parameters. `pickQuery` allow-lists them in the API module, so a caller that adds a stray key cannot send it.

| Parameter | Values | Default |
| --- | --- | --- |
| `status` | one of the seven documented statuses; **omitted entirely** for All | omitted |
| `per_page` | 10, 20 or 50 in the UI (backend accepts 1–100) | 20 |
| `sort_dir` | `asc`, `desc` | `desc` |
| `page` | Laravel page number; omitted on page 1 | omitted |

Not sent, because the contract does not document them: `workspace_id`, `account_id`, `category_id`, `date_from`, `date_to`, `search`.

**`user_id` is never sent.** The backend scopes captures to the signed-in user from the bearer token; ownership is not a frontend concern, and passing an owner from the client would be both useless and a way to ask for someone else's receipts.

`sort_dir` is the only documented sort parameter — there is no sort *field*, so none is invented.

## Paginator

The envelope is `data.captures`, and it is **a Laravel paginator, not an array**. Rows are in `data.captures.data`.

```json
{ "status": true, "data": { "captures": {
  "current_page": 1, "data": [ { "id": 15, "status": "ready_for_review", "review_version": 2 } ],
  "per_page": 20, "total": 1 } } }
```

`parseCapturesPage(response)` in `captureHelpers.js` is a thin wrapper over the shared `parsePage(response, key)` that Imports, Savings goals and the other paginated lists already use. It reads the standard fields defensively (`current_page`, `last_page`, `per_page`, `total`, `from`, `to`), falls back sensibly when one is missing, accepts a plain array as a single page, and returns `null` for anything else — which the page turns into a `MALFORMED_RESPONSE` error rather than guessing.

Records are passed through exactly as the backend sent them. Nothing is mutated and no field is filled in.

## What a row shows

The list contract guarantees `id`, `status` and `review_version`. Those are what `CaptureRow` renders, plus `created_at` **only when the response carries it**.

Merchant, amount, currency, category, account, the receipt image and any confidence score are **not** shown. They belong to the details endpoint, and the list contract does not promise them — rendering them here from the Show contract would be inventing data.

## Status badge

`CaptureStatusBadge` is Sprint 7's own component. It is deliberately **not** the imports badge: the two features share the word `ready_for_review` and nothing else, and merging them would tie two unrelated lifecycles and two sets of translations together.

| Status | Tone |
| --- | --- |
| `ready_for_review` | brand — the one status that needs the user |
| `confirmed` | success — the only status where a transaction exists |
| `failed` | danger |
| `processing` | info |
| `uploaded`, `queued` | neutral |
| `discarded` | muted |

An undocumented status is displayed as the backend sent it, in the neutral tone. It never crashes the row and is never reinterpreted.

## Filters

The status select is built from `AI_CAPTURE_STATUSES` (Task 1), never from a list redefined in the component. Its **All** option has the value `""` and sends no `status` parameter at all.

`hasActiveCaptureFilters(filters)` treats only `status` as a real filter: sort direction and page size change how the same captures are shown, not which ones. That is what makes "no captures match this status" the right empty message only when a status is chosen.

## URL state

Filters live in the query string, like the other dashboard lists:

```
/dashboard/ai-expense-captures?status=failed&sort_dir=asc&per_page=50&page=2
```

So a reload keeps them, back / forward work, and a filtered list can be shared.

- `readCaptureFilters(searchParams)` sanitises everything on the way in. An unknown status, a `sort_dir` that is not `asc`/`desc`, a `per_page` outside the offered sizes, or a `page` below 1 all fall back to the default — a hand-edited link cannot send a value the backend would reject with a 422.
- `captureFiltersToSearchParams(filters)` leaves defaults out, so the URL stays short.
- Changing `status`, `sort_dir` or `per_page` resets `page` to 1: page 4 of one filter is meaningless under another.

## Pagination

Real backend pagination. The page number goes to the API and the backend returns that page; the frontend never fetches everything and slices locally. The footer reuses the existing `dashboard.transactions.pagination.*` keys (summary, page, previous, next, first) instead of duplicating them.

## Loading, empty and error states

**Loading** uses the shared `components/Loading/Loading`. The page keys each result to the request that produced it (`filterKey:reloadKey`) and derives `isLoading` from that key, so rows from the previous filters are never shown as though they belonged to the new ones.

**Cancellation**: every request runs under an `AbortController` that the effect aborts on cleanup, and an `AbortError` is ignored. Changing filters quickly cannot let a slow earlier response overwrite a newer one.

**Empty** has three cases:

| Case | Message |
| --- | --- |
| Page beyond the results | "There are no receipts on this page." + go to first page |
| A status filter matches nothing | "No receipts match this status." + clear filters |
| Nothing at all | "No AI receipts yet." |

There is **no upload call to action** in the empty state: Sprint 7 documents no endpoint that creates a capture, so offering one would promise something that does not exist.

**Errors** go through the shared `getApiErrorMessage(error, t)`, with a retry button. The documented failures are 401 (handled globally — `apiClient` clears the session and fires `smartspend:session-expired`, which `AuthProvider` acts on) and 422 for an invalid filter value, which the URL sanitising already prevents from being sent. No special 403/404 handling is added, because the list is not documented to return them.

## Row action

**View**, added together with the review screen it opens. It uses `getAiExpenseCapturePath(capture.id)` and carries the list's query string in router state, so Back from the details page returns to the same filters and page. See [details.md](details.md).

Confirm, retry and discard are deliberately not row actions: they belong on the review screen, where the user can see what they are acting on.
