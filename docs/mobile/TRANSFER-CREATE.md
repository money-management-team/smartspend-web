# Mobile — creating a transfer (Phase 2A)

The first financial write integrated end to end on Mobile: **Add → Transfer → accounts and amount → review → confirm → the server's result**. The operation `transfer.create` is **closed**; `APPROVED` in `src/mobile/data/writeGate.js` is empty. Opening it is a separate, approved commit made after the steps under "Before opening".

## API contract (verified on `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72`)

`TransferController::store`, `StoreTransferRequest`, `TransferMoneyAction`, `TransferResource` and `BalanceService` are **identical on both branches**. `IdempotencyService::reserve` differs only in expiry (see below).

**Request:** `POST /transfers`, under `auth:sanctum`, `active.user` and `throttle:write`.
- **Header** `Idempotency-Key`: required, `[A-Za-z0-9._:-]`, 8 to 255 characters.
- **Body fields:**

| Field | Rule | Mobile sends |
|---|---|---|
| `from_account_id` | required, integer, exists | yes |
| `to_account_id` | required, integer, different from `from_account_id`, exists | yes |
| `amount` | required, positive decimal **string**, up to 4 decimals | yes, as `"150.0000"` |
| `fee_amount` | optional, non-negative decimal string | only with a fee |
| `fee_category_id` | optional (an expense category in the workspace) | only with a fee |
| `fee_description` | optional, up to 500 characters | only with a fee |
| `description` | optional, up to 500 characters | if typed |
| `reference_number` | optional, up to 100 characters | if typed |
| `occurred_at` | optional date | the chosen day at a fixed `12:00:00` (stable, so a re-entered transfer hashes the same) |
| `currency_code`, `metadata` | optional | not sent: the currency is the source account's |

**Business rules** (in `TransferMoneyAction` under row locks, each a 422 with the server's message):
- the accounts are different and in the same workspace;
- both accounts are active;
- **the same currency:** cross-currency transfers are not supported, and there are no exchange rates;
- neither account is a savings goal's (goals use contribution or withdrawal);
- amount plus fee must not exceed the source account's balance (`InsufficientBalanceException`, "Insufficient balance … available: …").

**Authorization:**
- An inactive user, or a user who isn't the workspace owner or a member, is refused with 403 (`WorkspaceAccessService::ensureCanManageFinances`).
- A missing account is a 422 from `exists`.

**Atomicity:** the following run in **one** `DB::transaction`:
- locking both accounts (ascending id);
- the transfer row;
- the transfer transaction and its two ledger legs (out and in);
- the optional fee transaction and its leg;
- the status `posted`;
- the savings-goal status sync;
- `IdempotencyService::complete`.

The key therefore completes with the money or not at all. A failure marks the key `failed` after the rollback, and a failed key may run again because nothing was committed.

**Idempotency:** the key is reserved per `{workspace, user, "internal_transfer", key}` with a hash of the request.
- Same key and same request after completion: the **first transfer is returned** (201, same body).
- Same key with a different request: **409** ("previously used with different request data").
- Same key while the first request is processing: **409** ("currently being processed").
- **Expiry (the one branch difference):**
  - On `develop`, a key older than 24 hours is recycled even for this financial operation, so a completed transfer re-sent with the same key a day later would run again.
  - On `6b696d72`, `FINANCIAL_OPERATIONS` (which includes `internal_transfer`) stops that.
  - Mobile keeps a pending key for 24 hours from **before** it is sent (`data/pendingWriteStorage.js`), so it never reuses one past the server's window, assuming the device clock is right.

**Answer:** 201 `{ status: true, message, data: { transfer } }`. `transfer` is `TransferResource` with:
- `id`, `from_account_id`, `to_account_id`, `amount`, `fee_amount`, `currency_code`, `status`, `occurred_at`, `posted_at`;
- `from_account` / `to_account` in their summary form, **without balances**;
- `fee_category`, `initiator`, `transactions`.

**Errors:** 401, 403, 409 (key conflict or processing), 422 (validation or a domain rule above), 429.

## What Mobile does

The form and its send path existed before this phase. This phase verified them and added the confirmed result.
- **Form** (`forms/workflows.js` `transfer`, unchanged):
  - The source is an active, non-goal account.
  - The destination is offered only in the source's currency and never the same account.
  - The amount is validated (above zero, at most 4 decimals, no thousands separator).
  - A fee asks for an expense category.
  - The review shows both accounts with their currency.
- **Send** (`forms/useWorkflowSubmit.js`, unchanged):
  - One request per submission, with a busy flag set before anything is awaited.
  - One Idempotency-Key per submission intent, kept in `localStorage` as the key plus a hash of the request, never the input. It is reused only for the identical request.
  - Nothing is resent automatically, and after an unknown outcome this form sends nothing more.
  - A 2xx is confirmed. 403, 404, 422 and 429 are refused, showing the server's message, and the key is released. A timeout, a network error, a 5xx or a 409 is unknown, and the key is kept.
- **Result** (new): `forms/TransferResult.jsx` with `models/transferResult.js`.
  - Shown only when the answer is provably the transfer that was sent: an id, the two accounts sent, and the amount sent.
  - It shows the server's amount and currency, the from and to accounts, the fee, the status and the posted time.
  - Then both balances, **read again from the server** (`GET /accounts/{id}`) because the answer carries none; nothing is computed locally.
  - It links to the transfer (`/m/transfers/{id}`) and back.
  - A 2xx that can't be checked falls back to the generic "Recorded", with no figures.
- **Strings:** `transfers.result.*` in `i18n/sections/debtsTransfers.js`, English and Arabic.
- **Style:** a small section at the end of `styles/mobile.css`.
- **Registry:** `transfer.create` stays `moves: true`, `key: "client"`, `serverDedup: "key-atomic"`, now with the evidence above as a comment.

## Tests

`tests/mobileTransferCreate.test.mjs` uses a fake backend that follows the rules above. It covers:
- the registration;
- the closed sender (no request) and the missing key;
- with the gate closed, the screen sending zero writes.

With the gate open:
- the exact payload and key;
- the fee fields only with a fee;
- invalid amounts never reaching review;
- the same account, another currency or a goal account never being offered;
- the server's 422s for the same account and another currency;
- insufficient balance (refused, nothing moved, key released);
- a double tap sending once;
- **an unknown outcome**: the key kept, then the same transfer after a reload sending the same key, which the server replays, so the money moves once;
- **the same key with different data**: a 409, treated as unknown;
- a different transfer after a reload getting its own key;
- a 409 while processing;
- a timeout;
- a 2xx that can't be checked;
- the server's balances read after the write;
- Arabic.

## Before opening

1. **Backend:**
   - Confirm the production backend commit.
   - The expiry fix exists only on `6b696d72` (unmerged and undeployed). Until it is deployed, the residual risk on `develop` is a same-key resend more than 24 hours later, which Mobile does not make.
   - The atomic completion that matters for transfers is already on `develop`.
2. **Staging run:**
   - one transfer;
   - the same key and request again (same transfer, balances moved once);
   - the same key with a different amount (409);
   - insufficient balance (422);
   - another currency (422);
   - an inactive account (403).
3. The 408 evidence, the shared release rule.
4. A recorded per-write approval, then a separate commit adding `transfer.create` to `APPROVED`.
