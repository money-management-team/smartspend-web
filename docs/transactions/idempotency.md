# Transactions — Idempotency

`POST /transactions/income`, `POST /transactions/expense` and `PATCH /transactions/{id}` must carry an `Idempotency-Key` header (so must `POST /transfers`, see [../transfers/api.md](../transfers/api.md)). The key identifies **one logical operation**: the backend applies it once, and a repeat with the same key and body returns the stored result instead of moving money again.

## The rule

> Same operation → same key. New operation → new key. Never "retry" with a new key when the first outcome is unknown.

## `createIdempotentAttempt(prefix)`

In `FinancialOperations/transactionHelpers.js`. Each form keeps one instance (`useState(() => createIdempotentAttempt(...))`). For income and expense the instance lives on `FinancialOperations.jsx`, not in the review dialog, so closing and reopening the review can't hand a retry a fresh key.

| Method | Behavior |
| --- | --- |
| `keyFor(payload)` | Returns the current key while the payload fingerprint (`JSON.stringify`) is unchanged; a changed payload starts a new key (`createIdempotencyKey(prefix)` → `prefix-<uuid>`) |
| `settle(error)` | Ends the operation after success (`settle(null)`) or a **definitive rejection** (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHENTICATED`, `REQUEST_FAILED`) — the next submit gets a fresh key |
| `reset()` | Forgets the current key |

After `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE`, `CONFLICT` (409) or `RATE_LIMITED`, the outcome is unknown or the request is still being processed, so the key is **kept**: submitting the same details again reuses it and the backend replays the original result. The forms say so (`errors.unknownOutcome`) and the list is refreshed so a saved operation shows up.

| Form | Prefix | Fingerprint |
| --- | --- | --- |
| New operation (income / expense), confirmed in the review dialog | `operation` | `{ type, ...payload }` |
| New transfer | `transfer` | the transfer payload |
| Correct transaction | `correction` | `{ id, reason, ...changes }` |

## Duplicate-click protection

- Each form (and the review dialog) has a synchronous `pendingRef` guard: a double click fires the handler twice before React re-renders, and the second call returns immediately.
- Buttons and inputs are disabled while a request runs (`isSubmitting` / `isSaving`), and the manual-entry button is also disabled while accounts/categories reload.
- Even without the guards, a repeated identical payload would reuse the same key.

## Verified behavior (local mock that enforces the rules)

- Three `requestSubmit()` calls in a row → one `POST`.
- The server commits, then answers 502 → the form explains the unknown outcome; clicking Save again sends the **same** key → the stored result is replayed, one transaction in total.
- Chrome may silently resend a POST whose connection dropped; because the header is part of the request, that resend carries the same key and is deduplicated too.
- After a 422 (e.g. insufficient balance), the corrected submission uses a new key.
- `POST /transactions/{id}/reverse` sends no key (not documented for it).
