# Transactions — API

All calls go through `transactionsApi` (`src/features/Dashboards/User/api/transactionsApi.js`) → `apiRequest`, which adds the Bearer token, `Accept-Language`, envelope handling, `ApiError` codes and the 401 session-expired flow.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api` (`/transactions` → `/api/transactions`, never `/api/api/…`). Ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/transactions?…filters` | `list(query, { signal })` | `data.transactions` = Laravel paginator; rows in `data.transactions.data` |
| `GET` | `/transactions/{id}` | `get(id, { signal })` | `data.transaction` |
| `POST` | `/transactions/income` | `createIncome(payload, idempotencyKey)` | `201`, `data.transaction` |
| `POST` | `/transactions/expense` | `createExpense(payload, idempotencyKey)` | `201`, `data.transaction` |
| `PATCH` | `/transactions/{id}` | `correct(id, payload, idempotencyKey)` | `data.transaction` — the **new** replacement |
| `POST` | `/transactions/{id}/reverse` | `reverse(id, reason)` | `data.transaction_original`, `data.reversals` |

- `createIncome`, `createExpense` and `correct` **throw if no key is passed**, so a money-moving write can't go out without an `Idempotency-Key` header.
- `amount` is converted with `toMoneyString` (4-decimal string) only when present, so a partial correction never sends an empty amount.
- There is no `delete` and no `PUT` (PUT is accepted by the backend; the client uses PATCH).
- Before this section was completed, `createIncome`/`createExpense`/`update` sent no `Idempotency-Key`, `update` used PUT and always sent `amount`. `update` was replaced by `correct`.

## List, pagination and filters

```json
{ "status": true, "data": { "transactions": { "current_page": 1, "data": [ { "id": 1, "type": "income", "status": "posted", "amount": "4000.0000", "currency_code": "ILS", "ledger_entries": [], "category": {}, "creator": {} } ], "last_page": 1, "per_page": 20, "total": 1, "from": 1, "to": 1 } } }
```

`parseTransactionPage(response)` reads `data.transactions.data` plus `current_page`, `last_page`, `per_page`, `total`, `from`, `to`. It also accepts a plain array (treated as one page); anything else is `MALFORMED_RESPONSE`.

| Query | Source | Notes |
| --- | --- | --- |
| `type` | type chips | `income`, `expense`, `transfer`; omitted for "All" |
| `account_id` | account select | options from `accountsApi.list` (active) |
| `category_id` | category select | options from `categoriesApi.list`, grouped by type; limited to the selected type |
| `status` | status select | `posted`, `pending_review`, `draft`, `reversed`, `failed`; omitted = all statuses (reversed included) |
| `date_from`, `date_to` | date inputs | `YYYY-MM-DD`; each input constrains the other |
| `sort_by`, `sort_dir` | sort select | `occurred_at`/`amount`/`created_at` + `asc`/`desc`; default `occurred_at desc` |
| `per_page`, `page` | pagination | `per_page` is 20; any filter change resets to page 1 |

`workspace_id` is **never** sent: the backend scopes transactions to the workspaces the user manages. Unknown or malformed values in the URL are dropped by `readFilters` before a request is made.

## Create income / expense

Headers: `Accept`, `Content-Type`, `Authorization` (apiClient) + `Idempotency-Key`.

```json
{ "account_id": 2, "category_id": 1, "amount": "4000.0000", "description": "Monthly salary", "reference_number": "SAL-2026-08", "occurred_at": "2026-08-15 12:00:00" }
```

| Field | Income | Expense |
| --- | --- | --- |
| `account_id` | required | required |
| `category_id` | optional (omitted for "No category") | **required** |
| `amount` | required, positive, ≤ 4 decimals, string | same |
| `description`, `reference_number` | optional (omitted when empty) | same |
| `occurred_at` | date input + `12:00:00` | same |
| `currency_code`, `source`, `metadata` | not sent (account currency / backend default) | same |

A 422 for insufficient balance (account without `allow_negative_balance`) is shown with the backend message; nothing is changed locally.

## Details

`GET /transactions/{id}` → `data.transaction`, with `ledger_entries[]` (`account_id`, `signed_amount`, `entry_role`, `account`), `category` and `creator`.

## Correct (PATCH)

Headers: `Idempotency-Key`. Body: `reason` (required, 3–500) + **only the changed fields** among `account_id`, `category_id`, `amount`, `description`, `reference_number`, `occurred_at`. Cleared optional values are sent as `null`.

```json
{ "reason": "Corrected the payslip", "amount": "4200.0000" }
```

The response's `data.transaction` is a **new** transaction (new `id`, `related_transaction_id` = original id). See [correction-and-reversal.md](correction-and-reversal.md).

## Reverse

`POST /transactions/{id}/reverse` with `{ "reason": "Duplicated entry" }`. No `Idempotency-Key` (not documented for this endpoint). The response is parsed defensively: `data.transaction_original` (merged into the page when its id matches, otherwise the page refetches) and `data.reversals` (array; ids are linked in the success notice).

## Error codes

`getTransactionErrorMessage(error, t, context)` in `transactionHelpers.js`:

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | apiClient clears the session; `RequireAuth` redirects |
| 403 | `FORBIDDEN` | `errors.forbidden` (account/workspace/category access) |
| 404 | `NOT_FOUND` | `errors.notFound`; the details page switches to "not available" |
| 409 | `CONFLICT` | create: `errors.idempotencyConflict`; correct/reverse: `errors.alreadyReversed` when the message mentions reversal (always for reverse), otherwise the idempotency message. Never retried with a new key |
| 422 | `VALIDATION_ERROR` | field errors under inputs (`account_id`, `category_id`, `amount`, `currency_code`, `description`, `reference_number`, `occurred_at`, `reason`, `idempotency_key`) + the backend message; insufficient/negative balance adds `errors.insufficientBalanceHint` |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE` | `getApiErrorMessage`; on writes, `errors.unknownOutcome` explains the result is unknown and a same-details retry is safe |
