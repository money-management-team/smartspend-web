# Debts — API

All requests go through `debtsApi` (`src/features/Dashboards/User/api/debtsApi.js`), which wraps the fetch-based `apiRequest`. Endpoints are relative: `VITE_API_BASE_URL` already ends in `/api`, so `/debts` becomes `…/api/debts` (never `/api/api/debts`). The bearer token, `Accept`, `Accept-Language` and `Content-Type` headers come from `apiRequest`. Responses use the `{ status: true, message, data }` envelope; failures throw `ApiError`.

## Endpoints

| Function | Method & path | Envelope |
| --- | --- | --- |
| `list(query)` | `GET /debts` | `data.debts` (Laravel paginator, rows in `.data`) |
| `summary(query)` | `GET /debts/summary` | `data.summary.by_currency` (one entry per currency) |
| `get(debtId)` | `GET /debts/{debt}` | `data.debt` |
| `create(payload)` | `POST /debts` | `data.debt` |
| `update(debtId, payload)` | `PATCH /debts/{debt}` | `data.debt` |
| `archive(debtId)` | `DELETE /debts/{debt}` | `data.debt` (archived) |
| `listPayments(debtId, query)` | `GET /debts/{debt}/payments` | `data.payments` (Laravel paginator, rows in `.data`) |
| `recordPayment(debtId, payload, key)` | `POST /debts/{debt}/payments` | `data.payment` + `data.debt` (201) |
| `reversePayment(paymentId, reason)` | `POST /debt-payments/{debtPayment}/reverse` | `data.payment` + `data.debt` |

`PUT /debts/{debt}` is also accepted by the backend; the frontend uses `PATCH` only, so a partial body never clears fields by omission.

### Path ids: debt vs payment

Every debt-level endpoint takes the **debt id**. Reversing takes the **payment id** on a different resource:

```
Debt id = 10, payment id = 25
✔ POST /debt-payments/25/reverse
✘ POST /debts/10/payments/25/reverse
```

`debtsApi.reversePayment` only accepts the payment id; the page passes `payment.id` from the history row.

## Debt object

```json
{
  "id": 1,
  "workspace_id": 1,
  "direction": "payable",
  "counterparty_name": "Ahmed",
  "original_amount": "1500.0000",
  "paid_amount": "0.0000",
  "remaining_amount": "1500.0000",
  "currency_code": "ILS",
  "issued_at": "2026-08-01",
  "due_date": "2026-10-01",
  "status": "active",
  "is_overdue": false,
  "effective_status": "active",
  "days_until_due": 47,
  "opening_transaction_id": null,
  "has_movement": false,
  "payments_count": 0,
  "owner": { "id": 1, "name": "Rania" },
  "notes": "Personal loan",
  "settled_at": null,
  "archived_at": null,
  "created_at": "…",
  "updated_at": "…"
}
```

Money values are 4-decimal strings. They are displayed with `formatMoney` and compared with the BigInt helpers (`subtractMoney`); they are never parsed into floats for anything that is stored.

## GET /debts/{debt}

The details page reads `response.data.debt`. A response without a debt entity is treated as `MALFORMED_RESPONSE`.

## PATCH /debts/{debt}

Editable fields (only the changed ones are sent):

| Field | Notes |
| --- | --- |
| `counterparty_name` | Required, max 150 |
| `original_amount` | 4-decimal string. **Only before the first payment**; the backend then recalculates `remaining_amount` |
| `issued_at` | `YYYY-MM-DD`; cleared → `null` |
| `due_date` | `YYYY-MM-DD`, not before `issued_at`; cleared → `null` |
| `notes` | Max 1000; cleared → `null` |
| `metadata` | Accepted by the API module, not exposed in the UI |

Never sent (the module drops them even if a caller passes them): `user_id`, `workspace_id`, `direction`, `currency_code`, `status`, `paid_amount`, `remaining_amount`, `opening_transaction_id`.

An archived debt can't be updated (409). `original_amount` after a payment is rejected (409/422).

## DELETE /debts/{debt} — archive

Archives; nothing is deleted. Response: `data.debt` with `status: "archived"`, `effective_status: "archived"` and `archived_at` set. Rejected with **409** when an open debt already has payments (it must be settled first) or when it is already archived.

## GET /debts/{debt}/payments

Query: `per_page` (the page uses 10), `page`. The paginator is `data.payments`; rows are `data.payments.data`, and `current_page`, `last_page`, `per_page`, `total` (and `from`/`to` when present) drive the pagination footer (`parsePage(response, "payments")`).

**Reversed payments stay in the list** with `status: "reversed"` and `is_reversed: true`.

```json
{
  "id": 1,
  "debt_id": 1,
  "amount": "500.0000",
  "currency_code": "ILS",
  "paid_at": "2026-08-15",
  "status": "posted",
  "is_reversed": false,
  "transaction_id": 3,
  "reversal_transaction_id": null,
  "account": { "id": 1, "name": "Cash", "type": "cash", "currency_code": "ILS" },
  "notes": null,
  "reversed_at": null,
  "created_at": "…"
}
```

## POST /debts/{debt}/payments

**Moves real money.** Required headers (besides the ones `apiRequest` adds): `Idempotency-Key` — 8 to 255 characters matching `[A-Za-z0-9._:-]+`. Keys are `debt-payment-<uuid>` from `createIdempotencyKey`. `recordPayment` throws before sending if no key is given.

| Field | Rules |
| --- | --- |
| `account_id` | Required |
| `amount` | Required, positive decimal string, not above `remaining_amount` |
| `paid_at` | Optional `YYYY-MM-DD`, defaults to now (the form omits it when it is today) |
| `notes` | Optional, max 1000 |
| `metadata` | Optional; accepted by the module, not exposed in the UI |

Response **201**: `data.payment` (the new payment) and `data.debt` (with the backend's new `paid_amount`, `remaining_amount`, `status`, `effective_status`, `payments_count`, and `settled_at` once fully paid).

## POST /debt-payments/{debtPayment}/reverse

Body: `{ "reason": "…" }` — required string, 3 to 500 characters. **No Idempotency-Key** is documented or sent: a payment can only be reversed once, so a repeated request is answered with 409 rather than reversing twice.

Response **200**: `data.payment` (`status: "reversed"`, `is_reversed: true`, `reversal_transaction_id`, `reversed_at`) and `data.debt` (amount restored to `remaining_amount`, status recalculated).

## Errors

| Code | HTTP | Debts meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Session expired: `apiClient` clears the session and fires `smartspend:session-expired`; forms show nothing extra |
| `FORBIDDEN` | 403 | Debt (or, for a payment, the account) outside the user's workspaces |
| `NOT_FOUND` | 404 | Debt, payment or account unavailable |
| `CONFLICT` | 409 | Edit/archive/payment on an archived debt; archive with payments before settlement; payment already reversed; Idempotency-Key reused with a different payload; request still processing |
| `VALIDATION_ERROR` | 422 | Field errors (`error.errors`) or a domain rejection: payment above the remaining amount, insufficient balance (payable), debt already paid or archived, missing Idempotency-Key, invalid amount/account/date, reversal that would make a balance negative, invalid reason |
| `RATE_LIMITED` | 429 | Shown with the retry delay |
| `NETWORK_ERROR` / `TIMEOUT` / `SERVER_ERROR` / `MALFORMED_RESPONSE` | — | Unknown outcome for writes (see [payments-and-reversal.md](payments-and-reversal.md)) |

The wording per context is in [implementation.md](implementation.md#error-wording).
