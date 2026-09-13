# Savings Goals — API

All calls go through `savingsGoalsApi` (`src/features/Dashboards/User/api/savingsGoalsApi.js`) → `apiRequest`, which adds the Bearer token, `Accept-Language`, the `{ status, data, message, errors }` envelope handling, `ApiError` codes and the 401 session-expired flow. No component calls `apiRequest` for savings goals directly.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api`, so `/savings-goals` resolves to `/api/savings-goals` (never `/api/api/…`). Goal ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/savings-goals` | `list(query, { signal })` | `data.savings_goals` (paginator) |
| `POST` | `/savings-goals` | `create(payload)` | `data.savings_goal` (201) |
| `GET` | `/savings-goals/{id}` | `get(id, { signal })` | `data.savings_goal` |
| `PATCH` | `/savings-goals/{id}` | `update(id, payload)` | `data.savings_goal` |
| `DELETE` | `/savings-goals/{id}` | `archive(id)` | `data.savings_goal` (`status: "archived"`) |
| `GET` | `/savings-goals/{id}/progress` | `getProgress(id, { signal })` | `data.progress` |
| `GET` | `/savings-goals/{id}/contributions` | `listContributions(id, query, { signal })` | `data.contributions` (paginator) |
| `GET` | `/savings-goals/{id}/activity` | `listActivity(id, query, { signal })` | `data.activity` (paginator) |
| `POST` | `/savings-goals/{id}/contributions` | `contribute(id, payload, idempotencyKey)` | `data.contribution` + `data.savings_goal` (201) |
| `POST` | `/savings-goals/{id}/withdrawals` | `withdraw(id, payload, idempotencyKey)` | `data.withdrawal` + `data.savings_goal` (201) |
| `POST` | `/savings-goals/{id}/pause` | `pause(id)` | `data.savings_goal` |
| `POST` | `/savings-goals/{id}/resume` | `resume(id)` | `data.savings_goal` |

There is intentionally no `delete` wrapper: `DELETE` archives, and `archive` says so. `PUT` is supported by the backend but the client uses `PATCH`.

## Goal object

```json
{
  "id": 1, "workspace_id": 1, "name": "New Laptop",
  "target_amount": "3000.0000", "currency_code": "ILS", "target_date": "2026-12-31",
  "status": "active", "achieved_at": null, "archived_at": null, "notes": null,
  "account": { "id": 5, "name": "New Laptop", "type": "savings", "currency_code": "ILS" },
  "progress": {
    "goal_id": 1, "account_id": 5, "target_amount": "3000.0000",
    "saved_amount": "1200.0000", "remaining_amount": "1800.0000", "percentage_funded": "40.0000",
    "status": "in_progress", "contributions_count": 1, "days_remaining": 138,
    "is_achieved": false, "deadline_passed": false, "is_archived": false
  }
}
```

`GET …/progress` returns the same progress fields plus `name`, `currency_code` and `target_date`. `withFreshProgress` merges it into the displayed goal.

## Pagination keys

Every list is a Laravel paginator; the rows are in its `.data`. The key differs per endpoint, and `parsePage(response, key)` reads exactly the one it is given (a wrong key is a malformed response, never a guess):

| Endpoint | Rows |
| --- | --- |
| `GET /savings-goals` | `response.data.savings_goals.data` |
| `GET …/contributions` | `response.data.contributions.data` |
| `GET …/activity` | `response.data.activity.data` (**not** `contributions`) |

`current_page`, `last_page`, `per_page`, `total` (and `from`/`to` when sent) drive the pagination footer.

## List query

| Param | Sent by the UI |
| --- | --- |
| `workspace_id` | The session workspace (`getStoredWorkspace()?.id`), like the Accounts page; omitted when unknown |
| `status` | Lifecycle filter |
| `progress_status` | Progress filter |
| `currency_code` | Currency filter |
| `per_page` / `page` | `12` / the URL page |
| `before_due` | Supported by the backend, **not exposed**: its value format isn't documented, and a misread filter would silently show wrong results |

## Create

```json
{ "workspace_id": 1, "name": "New Laptop", "target_amount": "3000.0000", "currency_code": "ILS", "target_date": "2026-12-31", "notes": "Saving for a laptop" }
```

- `workspace_id` comes from `resolveWorkspaceId()`.
- `target_date` and `notes` are sent only when filled. `metadata` is allowed by the wrapper but not edited by the UI.
- **Never sent:** `user_id`, `account_id`, `status`. The wrapper whitelists fields, so they can't leak in.

## Update

`PATCH` with **only the changed** editable fields: `name`, `target_amount`, `target_date`, `notes` (and `metadata`). Clearing the date or the notes sends `null`. `workspace_id`, `account_id`, `currency_code`, `status` and `user_id` are never sent (whitelist). The response's goal, including a possibly changed lifecycle status, is shown as is.

## Contribution / withdrawal

```http
POST /savings-goals/1/contributions
Idempotency-Key: goal-contribution-<uuid>

{ "from_account_id": 1, "amount": "1200.0000", "description": "Monthly savings", "occurred_at": "2026-08-15 12:00:00" }
```

```http
POST /savings-goals/1/withdrawals
Idempotency-Key: goal-withdrawal-<uuid>

{ "to_account_id": 2, "amount": "200.0000" }
```

- The wrappers throw if no key is passed; the key is managed by the form (see [business-rules.md](business-rules.md#idempotency)).
- `amount` is a 4-decimal string from `toMoneyString`; `description` is only sent when filled.
- `occurred_at` is omitted when the chosen date is today (the backend records "now"); another day is sent as `YYYY-MM-DD 12:00:00` so no time zone can shift it.

## Pause / resume

`POST` with **no body and no Idempotency-Key**. Resume may return `status: "active"` or `"achieved"`.

## Movement rows (contributions / activity)

```json
{ "id": 1, "savings_goal_id": 1, "type": "contribution", "amount": "1200.0000", "currency_code": "ILS",
  "transfer_id": 1, "transfer_status": "posted", "is_reversed": false,
  "from_account": { … }, "to_account": { … }, "occurred_at": "…", "created_at": "…" }
```

`type` is `contribution` or `withdrawal`. A reversed movement (`is_reversed: true` / `transfer_status: "reversed"`) stays in the history.

## Error codes

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Nothing in the form; apiClient clears the session and `RequireAuth` redirects |
| 403 | `FORBIDDEN` | `errors.forbidden`; for movements `errors.forbiddenMovement` (goal or account outside the workspace) |
| 404 | `NOT_FOUND` | `errors.notFound` (page → "not available" state); for movements `errors.movementNotFound` |
| 409 | `CONFLICT` | By context: movement → `idempotencyConflict`; pause → `pauseConflict`; resume → `resumeConflict`; edit → `archivedLocked`; archive → `hasBalance` or `alreadyArchived` (see below) |
| 422 | `VALIDATION_ERROR` | Field errors under the inputs + the **backend's own message** (insufficient balance, currency mismatch, paused/archived goal, invalid date, missing key…), plus a hint on what it means for the money |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE` | `getApiErrorMessage`; for movements also `errors.unknownOutcome` |

**Archive 409.** The backend message is matched: balance/empty/withdraw… → `hasBalance`; already/archived → `alreadyArchived`. A message that matches neither (e.g. in Arabic) is shown as the backend sent it, since it is still the specific reason.

**Backend field errors mapped to inputs:** `name`, `target_amount`, `currency_code`, `target_date`, `notes`, `from_account_id`, `to_account_id`, `amount`, `description`, and `occurred_at` (shown under the date field). `workspace_id` and `metadata` errors appear in the error block.
