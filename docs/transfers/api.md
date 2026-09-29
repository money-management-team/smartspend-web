# Transfers — API

All calls go through `transfersApi` (`src/features/Dashboards/User/api/transfersApi.js`) → `apiRequest`, which adds the Bearer token, `Accept-Language`, envelope handling, `ApiError` codes and the 401 session-expired flow.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api` (`/transfers` → `/api/transfers`, never `/api/api/…`). Ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/transfers?from_account_id&to_account_id&status&currency_code&date_from&date_to&per_page&page` | `list(query, { signal })` | `data.transfers` (paginator; rows in `.data`) |
| `GET` | `/transfers/{id}` | `get(id, { signal })` | `data.transfer` |
| `POST` | `/transfers` | `create(payload, idempotencyKey)` | `201`, `data.transfer` |
| `POST` | `/transfers/{id}/reverse` | `reverse(id, reason)` | `data.transfer`, `data.reversals` |

The backend exposes nothing else on transfers — verified against the staging API, which answers `allow: GET,HEAD,POST` for `/api/transfers`, `allow: GET,HEAD` for `/api/transfers/{id}` and `allow: POST` for `/api/transfers/{id}/reverse`. There is no `PUT`, `PATCH` or `DELETE`, so the module has no update and no delete.

## Create

```
POST /transfers
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token>      ← added by apiClient
Idempotency-Key: transfer-<uuid>   ← required; create() throws without one
```

```json
{
  "from_account_id": 2,
  "to_account_id": 1,
  "amount": "400.0000",
  "fee_amount": "5.0000",
  "fee_category_id": 4,
  "fee_description": "Wire fee",
  "description": "Move to cash",
  "reference_number": "TR-2026-001",
  "occurred_at": "2026-08-10 12:00:00"
}
```

| Field | Sent when | Notes |
| --- | --- | --- |
| `from_account_id`, `to_account_id` | always | Different active accounts of the same currency |
| `amount` | always | `toMoneyString` → 4-decimal string, positive |
| `fee_amount`, `fee_category_id` | only with a non-zero fee | Fee is a string too; the category must be an **expense** category |
| `fee_description` | only with a fee, when filled | max 500 |
| `description`, `reference_number` | when filled | max 500 / max 100 |
| `occurred_at` | always | The date input plus `12:00:00`, so the day never shifts |
| `currency_code`, `metadata`, `workspace_id` | never | The currency follows the accounts; the backend derives the workspace |

`create` **throws if no key is passed**, so a money-moving write can't go out without an `Idempotency-Key`.

### Idempotency

The key identifies **one logical operation**: the backend applies it once and replays the stored result for a repeat with the same key and body. The form uses the shared `createIdempotentAttempt("transfer")` helper from `FinancialOperations/transactionHelpers.js` — the same rules as transactions, documented in [../transactions/idempotency.md](../transactions/idempotency.md):

> Same operation → same key. New operation → new key. Never "retry" with a new key when the first outcome is unknown.

- The key changes only when the payload changes, so retrying the same transfer after a timeout, a 5xx, a 409 or a network error reuses it.
- After a definitive rejection (422, 403, 404, 401) the next submit gets a fresh key.
- A synchronous `pendingRef` guard plus disabled inputs stop a double click from sending a second request at all.

### Create response (201)

```json
{ "status": true, "message": "Transfer completed successfully.", "data": { "transfer": {
  "id": 1, "workspace_id": 1, "from_account_id": 2, "to_account_id": 1, "fee_category_id": null,
  "initiated_by": 1, "amount": "400.0000", "fee_amount": "0.0000", "currency_code": "ILS",
  "status": "posted", "occurred_at": "…", "posted_at": "…", "metadata": null,
  "from_account": {}, "to_account": {},
  "transactions": [ { "id": 6, "transfer_id": 1, "type": "transfer", "status": "posted", "amount": "400.0000",
    "ledger_entries": [ { "account_id": 2, "signed_amount": "-400.0000", "entry_role": "transfer_out" },
                        { "account_id": 1, "signed_amount": "400.0000",  "entry_role": "transfer_in" } ] } ] } } }
```

`transactions` can hold more than one entry (a fee adds a `fee` transaction, a reversal adds `reversal` ones), so the UI never assumes `transactions.length === 1`; it looks transactions up by `type`.

## List

```
GET /transfers?from_account_id=2&status=posted&currency_code=ILS&per_page=20&page=1
```

| Param | Rule | Sent by the list page |
| --- | --- | --- |
| `from_account_id`, `to_account_id` | optional integers | the From / To account selects |
| `status` | `pending` · `posted` · `reversed` · `failed` · `confirmed` | the Status select (never `confirmed`, see below) |
| `currency_code` | optional, 3 letters | the Currency select |
| `date_from` | optional date, lower bound of `occurred_at` | the From date |
| `date_to` | optional date, ≥ `date_from` | the To date |
| `per_page` | 1–100, default 20 | always `20` |
| `page` | Laravel paginator page | the pagination |

- `transfersApi.list` keeps **only these keys** (`pickQuery` in `apiClient.js`), so no undocumented filter can be sent. In particular there is **no `workspace_id`** filter on this endpoint, and none is invented.
- **`confirmed` is an input alias.** The backend maps it to `posted`, which is the stored, canonical status. The UI only offers and sends `posted`. An old link with `?status=confirmed` is read as `posted` (`readTransferFilters`), so no fake "confirmed" state ever appears. The badge shows the backend's `status` value with a translated label.
- The backend orders rows by `occurred_at` DESC, then `id`. The list keeps that order; there is no client-side sorting.
- An inverted date range is never sent: picking a start after the end clears the end (and the reverse), and a URL with `date_to < date_from` drops `date_to`.

### Response

```json
{ "status": true, "message": "Transfers retrieved successfully.", "data": { "transfers": {
  "current_page": 1, "last_page": 1, "per_page": 20, "total": 1, "from": 1, "to": 1,
  "data": [ { "id": 1, "from_account_id": 2, "to_account_id": 1, "fee_category_id": null,
    "amount": "400.0000", "fee_amount": "0.0000", "currency_code": "ILS", "status": "posted",
    "occurred_at": "…", "posted_at": "…",
    "from_account": {}, "to_account": {}, "fee_category": null, "initiator": {} } ] } } }
```

`parseTransferPage(response)` reads the paginator at `data.transfers` and the rows at `data.transfers.data`. It never treats `data.transfers` as the rows. Defensively, a plain array (one page) or a paginator sent as `data` itself is also accepted. Anything else is `MALFORMED_RESPONSE` instead of being guessed at.

Rows render the relations (`from_account.name → to_account.name`, falling back to `#id`). The fee and its category appear only when `fee_amount` is non-zero, and `fee_category: null` is handled. Money stays in the backend's strings and is formatted with `formatMoney`.

## Details

`GET /transfers/{id}` → `data.transfer`, with `from_account`, `to_account`, `fee_category`, `initiator` and `transactions[]` (each with `ledger_entries[]` and `reversal`). `description` / `reference_number` are read from the transfer when present, otherwise from its `transfer` transaction.

## Reverse

```json
POST /transfers/{id}/reverse
{ "reason": "Transferred to the wrong account." }
```

`reason` is required, 3–500 characters. **No `Idempotency-Key`** is documented for this endpoint, so none is sent. The response is parsed defensively:

```json
{ "status": true, "data": {
  "transfer": { "id": 2, "status": "reversed" },
  "reversals": [ { "id": 14, "type": "reversal", "subtype": "transfer" },
                 { "id": 15, "type": "reversal", "subtype": "fee" } ] } }
```

`data.transfer` is merged into the page when its id matches, the `data.reversals` ids are linked in the success notice, and the transfer is refetched so the new transactions and the final status come from the backend.

## Error codes

`getTransferErrorMessage(error, t, context)` / `getTransferErrorHint(error, t, context)` in `transferHelpers.js`; `context` is `"create"` or `"reverse"`.

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | apiClient clears the session; `RequireAuth` redirects |
| 403 | `FORBIDDEN` | `errors.forbidden` — the transfer or one of its accounts is outside the user's workspaces |
| 404 | `NOT_FOUND` | `errors.notFound`; the details page switches to "Transfer not available" |
| 422 on the list | `VALIDATION_ERROR` | The backend's message (an invalid filter), with Try again + Clear filters |
| 409 | `CONFLICT` | create: `errors.idempotencyConflict`; reverse: `errors.alreadyReversed`. Never retried with a new key |
| 422 | `VALIDATION_ERROR` | The **backend's own message** (same account, currency mismatch, insufficient balance, archived account, invalid fee category, reversal that would go negative, missing reason) plus field errors under `from_account_id`, `to_account_id`, `amount`, `fee_amount`, `fee_category_id`, `currency_code`, `description`, `reference_number`, `fee_description`, `occurred_at`, `reason`, `idempotency_key`. A balance rejection adds `errors.insufficientBalanceHint` (create) or `errors.reverseBalanceHint` (reverse) |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE` | `getApiErrorMessage`, plus `errors.unknownOutcome` (create: check the list, the same retry is safe) or `errors.unknownReverseOutcome` (reverse: reload before trying again) |
