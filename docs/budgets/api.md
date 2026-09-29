# Budgets — API

All calls go through `budgetsApi` (`src/features/Dashboards/User/api/budgetsApi.js`) → `apiRequest`, which adds `Accept`, `Content-Type`, the Bearer token, `Accept-Language`, envelope handling, `ApiError` codes and the 401 session-expired flow. No token handling is done here.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api` (`/budgets` → `/api/budgets`, never `/api/api/…`). Ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/budgets` | `list(query, { signal })` | `data.budgets` — Laravel paginator, rows in `.data` (see below) |
| `GET` | `/budgets/{id}` | `get(id, { signal })` | `data.budget` with `progress` |
| `GET` | `/budgets/{id}/progress` | `getProgress(id, { signal })` | `data.progress` only |
| `POST` | `/budgets` | `create(payload)` | `201`, `data.budget` with `progress` |
| `PATCH` | `/budgets/{id}` | `update(id, payload)` | `data.budget` with recalculated `progress` |
| `DELETE` | `/budgets/{id}` | `archive(id)` | `data.budget` with `status: "archived"`, `archived_at` (no `progress`) |

- There is no `delete` wrapper: DELETE archives, and `archive` says so. PUT is accepted by the backend; the client uses PATCH.
- No `Idempotency-Key`: budget writes don't move money.
- Each wrapper sends **only its allowed fields** (see the payloads below), so `user_id`, `status` or a scope-defining field can never be sent by mistake. `amount_limit` is converted with `toMoneyString` (4-decimal string), and a missing/`null` `category_id` is dropped.

## Create

```json
{ "workspace_id": 1, "name": "Food budget", "category_id": 2, "amount_limit": "800.0000", "currency_code": "ILS", "period_start": "2026-08-01", "period_end": "2026-08-31", "notes": "Monthly food budget" }
```

| Field | Rule | Frontend |
| --- | --- | --- |
| `workspace_id` | required | added by the page from `resolveWorkspaceId()` |
| `name` | required, max 150 | trimmed |
| `category_id` | optional/nullable | only for a category budget (an active **expense** category) |
| `amount_limit` | required, positive | string, ≤ 4 decimals, → `"800.0000"` |
| `currency_code` | required, 3 letters | select; defaults to the workspace base currency |
| `period_start`, `period_end` | required, end ≥ start | date inputs (`YYYY-MM-DD`) |
| `notes` | optional, max 1000 | omitted when empty |
| `metadata` | optional | allowed by the wrapper; the form doesn't send it |

`user_id` is never sent: the backend takes the owner from the token.

## Update (PATCH)

Body: **only the changed fields** among `name`, `amount_limit`, `period_start`, `period_end`, `notes` (`null` when cleared), `metadata`. Nothing changed → no request.

`workspace_id`, `category_id`, `currency_code`, `user_id` and `status` are never sent (the wrapper filters them out even if a caller passes them). To track another category or currency, the user creates a new budget.

## Budget and progress shapes

`budget.category` is an **object or `null`** (`{ id, name, type, is_active }`), never a bare id; `budget.scope` is `"general"` or `"category"` (`getBudgetScope` falls back to the category when `scope` is missing).

`budget.progress` / `data.progress`:

| Field | Type | Notes |
| --- | --- | --- |
| `budget_id`, `name`, `scope`, `category_id`, `currency_code` | | |
| `amount_limit` | money string | may be absent from the progress-only endpoint → the budget's `amount_limit` is used |
| `spent`, `remaining` | money string | `remaining` can be negative |
| `percentage_used` | decimal string | can exceed 100 |
| `status` | `safe` · `warning` · `near_limit` · `exceeded` | unknown values are shown as-is |
| `expenses_count`, `days_remaining` | integers | |
| `period_start`, `period_end` | dates | |
| `has_started`, `has_ended`, `is_archived` | booleans | accepted as `true`/`1`/`"1"`/`"true"` |

Progress is parsed defensively (`getBudgetProgress`, `withFreshProgress`): a missing field never crashes the page, and a field the progress-only response omits keeps its previous value.

### Canonical progress fields

The backend may also send compatibility aliases. The frontend uses **one** field set everywhere (cards, details, summary) and never reads the aliases:

| Used (canonical) | Ignored alias |
| --- | --- |
| `amount_limit` | `limit_amount` |
| `spent` | `amount_spent` |
| `remaining` | `remaining_amount` |
| `percentage_used` | `percentage` |
| `expenses_count` | `expense_count` |
| `currency_code` | `currency` |
| `status` | — |

## List

```
GET /budgets?workspace_id=1&status=active&progress_status=warning&per_page=20&page=1
```

| Param | Rule | Sent by the list page |
| --- | --- | --- |
| `workspace_id` | optional integer | always the session workspace (`getStoredWorkspace().id`), omitted when unknown; never hard-coded |
| `category_id` | optional integer | the Category select (dropped with scope `general`) |
| `scope` | `general` · `category` | the Scope select |
| `owner` | only `mine` | "Only my budgets" (More filters) |
| `currency_code` | optional, 3 letters | the Currency select |
| `status` | `active` · `archived` (lifecycle) | the Status select |
| `progress_status` | `safe` · `warning` · `near_limit` · `exceeded` | the Progress select |
| `date_from`, `date_to` | nullable dates, **required together**, `date_to ≥ date_from`; period **intersection** | Period from / to (More filters) |
| `active_on` | optional date; budgets whose period contains it | Active on (More filters) |
| `per_page` | 1–100, default 20 | always `20` |
| `page` | Laravel paginator page | the pagination |

`budgetsApi.list` keeps only these keys (`pickQuery`) and enforces the two rules the backend would reject with a 422:

- `owner` is dropped unless it is `"mine"`, so filtering by an arbitrary user id is impossible;
- `date_from` / `date_to` are dropped unless **both** are present.

On the page, `budgetFiltersToQuery` sends the range only when complete. `progress_status` is applied by the backend and never filtered on the client.

`parseBudgetPage` reads the paginator at `data.budgets` and the rows at `data.budgets.data`, with `current_page`, `last_page`, `per_page`, `total`, `from` and `to`. A plain array is accepted defensively as one page. Anything else is `MALFORMED_RESPONSE`.

## Error codes

`getBudgetErrorMessage(error, t, context)` in `budgetHelpers.js`:

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | nothing in the form; apiClient clears the session and `RequireAuth` redirects |
| 403 | `FORBIDDEN` | `errors.forbidden` — the workspace isn't owned/managed by the user |
| 404 | `NOT_FOUND` | `errors.notFound`; the details page switches to "Budget not available" |
| 409 | `CONFLICT` | `save` → `errors.archivedLocked`; `archive` → `errors.alreadyArchived`. The page then refetches |
| 422 | `VALIDATION_ERROR` | the backend message + field errors under `name`, `category_id`, `amount_limit`, `currency_code`, `period_start`, `period_end`, `notes`; `workspace_id` / `metadata` errors in the error block. On the list (an invalid filter): the message with Try again + Clear filters |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE`, `WORKSPACE_UNAVAILABLE` | `getApiErrorMessage` |
