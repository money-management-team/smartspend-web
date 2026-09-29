# Recurring Transactions — API

All requests go through `apiRequest()` with relative paths (`VITE_API_BASE_URL` already ends with `/api`). The module is `src/features/Dashboards/User/api/recurringTransactionsApi.js`.

| Function | Request | Body | Response `data` |
| --- | --- | --- | --- |
| `list(query)` | `GET /recurring-transactions` | — | `recurring_transactions` (Laravel paginator, rows in `.data`) |
| `get(id)` | `GET /recurring-transactions/{id}` | — | `recurring_transaction` (with `account`, `category`, `owner`, `schedule`) |
| `create(payload)` | `POST /recurring-transactions` | create fields | `recurring_transaction` (201) |
| `update(id, payload)` | `PATCH /recurring-transactions/{id}` | changed editable fields | `recurring_transaction` |
| `archive(id)` | `DELETE /recurring-transactions/{id}` | — | `recurring_transaction` (archived) |
| `pause(id)` | `POST …/{id}/pause` | none | `recurring_transaction` |
| `resume(id)` | `POST …/{id}/resume` | none | `recurring_transaction` |
| `confirmNext(id)` | `POST …/{id}/confirm-next` | none | `occurrence` + `recurring_transaction` (201) — **moves money** |
| `skipNext(id, reason?)` | `POST …/{id}/skip-next` | `{ reason }` only when given | `occurrence` + `recurring_transaction` (201) |
| `listOccurrences(id, query)` | `GET …/{id}/occurrences` | — | `occurrences` (paginator, rows in `.data`) |

No request sends an `Idempotency-Key` (see [confirm-and-skip.md](confirm-and-skip.md) for confirm-next). There is no `delete` function: `DELETE` archives.

## List query

| Param | Values | UI |
| --- | --- | --- |
| `workspace_id` | session workspace | always, when known |
| `type` | `income`, `expense` | filter |
| `status` | `active`, `paused`, `completed`, `archived` | filter |
| `frequency` | `weekly`, `monthly`, `yearly` | filter |
| `processing_mode` | `manual`, `automatic` | filter |
| `account_id` | account id | filter (accounts from `accountsApi`) |
| `due_from`, `due_to` | `YYYY-MM-DD` | filter (`due_to` ≥ `due_from`) |
| `category_id`, `owner` (`mine` / `all`) | — | supported by the API, not exposed in the UI |
| `per_page`, `page` | 15, page | pagination |

Rows are read from `response.data.recurring_transactions.data`; `current_page`, `last_page`, `total`, `from`, `to` drive the pagination footer. A list row may have `schedule: null`.

## Create payload

| Field | Rule |
| --- | --- |
| `account_id` | required; active account that is not a savings-goal container |
| `category_id` | **required for income and expense**; category of the same type |
| `name` | required, ≤ 150 |
| `type` | `income` or `expense` |
| `amount` | positive, sent as a 4-decimal string (`toMoneyString`) |
| `frequency` | `weekly`, `monthly`, `yearly` |
| `interval` | integer 1–60 (default 1) |
| `start_date` | required |
| `end_date` | optional, ≥ `start_date` |
| `max_occurrences` | optional, 1–1000 |
| `processing_mode` | `manual` (default) or `automatic` |
| `description`, `notes` | optional |
| `currency_code`, `metadata` | accepted by the API; the UI omits them (the backend takes the account's currency) |

Never sent: `user_id`, `status`, `next_due_date`, `last_processed_at`, `anchor_day`. The 201 response's rule (with the backend's `anchor_day`, `next_due_date`, `status`) is what the UI shows next.

## Update payload

Only `name`, `amount`, `interval`, `end_date`, `max_occurrences`, `processing_mode`, `description`, `notes`, `metadata` — and only those that changed (a cleared optional field is sent as `null`). `pickPayload` in the API module drops anything else, so structural fields can't be sent even by mistake.

## Rule entity (details)

`id`, `name`, `type`, `amount`, `currency_code`, `account_id`/`account`, `category_id`/`category`, `frequency`, `interval`, `anchor_day`, `start_date`, `end_date`, `max_occurrences`, `processing_mode`, `status`, `next_due_date`, `last_processed_at`, `description`, `notes`, `owner`, `archived_at`, `created_at`, `updated_at`, and `schedule { next_occurrence, open_occurrences_count }` (either may be null).

## Occurrences

Query: `occurrence_status` (`scheduled`, `due`, `posted`, `skipped`, `failed`, `cancelled`), `due_from`, `due_to`, `per_page` (10), `page`. Rows from `response.data.occurrences.data`, each with `id`, `recurring_transaction_id`, `due_date`, `status`, `is_open`, `is_overdue`, `amount`, `currency_code`, `transaction_id`, `idempotency_key`, `failure_reason`, `attempts`, `processed_at`, `created_at`.

## Error codes

| Code | Meaning here | UI |
| --- | --- | --- |
| 401 | Session expired | apiClient clears the session and logs out |
| 403 | Not allowed | "You don't have permission…" |
| 404 | Rule gone / not yours | Details page: "not found" state; dialogs: message, page refreshed on close |
| 409 | Archive of an archived rule; update of an archived rule; other state conflicts | Specific wording, page refreshed on close |
| 422 | Validation (field errors under the inputs) or a domain rejection (not active, nothing open, insufficient balance). **Confirm-next may carry `data.occurrence`** | Backend message; for confirm-next `failure_reason` — see [confirm-and-skip.md](confirm-and-skip.md) |
| 429 | Rate limited | "Try again after N seconds" |
| network / timeout / 5xx | Unknown outcome for writes | Message; confirm-next blocks an immediate retry |

On staging, all twelve routes (with `GET /dashboard` and `GET /financial-alerts`) answer `401 {"status":false,"message":"Unauthenticated."}` without a token, and an unknown sub-route answers 404, confirming the routes and the envelope.
