# Mobile — creating an expense or an income (Phase 2B)

**Add → Expense / Income → account, category, amount → review → confirm → the server's result.** The operations `transaction.expense` and `transaction.income` are **closed**: `APPROVED` in `src/mobile/data/writeGate.js` is empty. Opening them is a separate, approved commit made after the steps under "Before opening". Same shape as [TRANSFER-CREATE.md](TRANSFER-CREATE.md).

## API contract (read from the backend source, never from production)

Refs: `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72` (read with `git show`, never checked out).

**Request:** `POST /transactions/expense` and `POST /transactions/income`, under `auth:sanctum`, `active.user`, `throttle:write`.
- **Header** `Idempotency-Key`: required, `[A-Za-z0-9._:-]`, 8 to 255 characters, not `import-<n>-row-<n>` (`ReadsIdempotencyKey`).
- **Body** (`StoreExpenseRequest` / `StoreIncomeRequest`):

| Field | Rule | Mobile sends |
|---|---|---|
| `account_id` | required, integer, exists | yes |
| `category_id` | expense: required; income: optional; integer, exists | yes (income: only when chosen) |
| `amount` | required, positive decimal **string**, up to 4 decimals | `"150.5000"` |
| `description` | optional, up to 500 | if typed |
| `reference_number` | optional, up to 120 | if typed |
| `occurred_at` | optional date | the chosen day at a fixed `12:00:00` |
| `currency_code`, `metadata`, `source` | optional | not sent: the currency is the account's |
| `confirm_possible_duplicate` | optional boolean (6b696d72 only) | only after the duplicate question is confirmed |

**Business rules** (`PostExpenseAction` / `PostIncomeAction`, inside the posting transaction under a row lock on the account; each a 422 with the server's message unless noted):
- the user is an active member of the account's workspace (403 otherwise);
- the account is active and not a savings goal's (goals use contribution or withdrawal);
- the category is in the account's workspace (or global), **active**, and of the entry's type (an expense needs an expense category, an income an income one);
- the currency is the account's (`ensureCurrencyMatches`);
- **expense only:** the amount may not exceed the balance unless the account allows a negative one (`InsufficientBalanceException`, "Insufficient balance in account [..]. Required: .., available: ..");
- an income needs no balance.

**Answer:** 201 `{ status: true, message, data: { transaction } }`, `TransactionResource` with `ledger_entries[].account` and `category` loaded. It carries **no balance**. A replay answers with the first transaction, in the same shape.

**Idempotency:** reserved per `{workspace, user, "post_expense"|"post_income", key}` with a hash of the request. Same key + same request after completion: the first transaction (201). Same key + different request: **409** ("previously used with different request data"). Same key still processing: **409**. A failure releases the key.

**Duplicate guard (6b696d72 only, off by default):** `finance.manual_duplicate_guard.enabled` (`FINANCE_MANUAL_DUPLICATE_GUARD`). When on, a payment that looks recorded answers 409 `code: "possible_duplicate"` once, with `data.matched_transaction`; the client confirms by sending the same request and key again with `confirm_possible_duplicate: true`. Mobile already handles this (`data/possibleDuplicate.js`, `tests/mobilePossibleDuplicate.test.mjs`).

### The difference between the branches, and why the writes stay closed

| | develop @ `fd87531` | `6b696d72` |
|---|---|---|
| Posting and the key's completion | **two** transactions (`IdempotencyService::run` without `atomic`) | **one** (`atomic: true`) |
| A failure between them | money posted, key stuck "processing": the client is refused (409) and cannot learn the outcome | taken back together; the key is released as failed |
| A key older than 24 h | **recycled**, even for these operations: a completed entry re-sent with the same key a day later runs again | `post_income` / `post_expense` are in `FINANCIAL_OPERATIONS`: never recycled |

Mobile limits the first gap by never reusing a key past 24 h (`data/pendingWriteStorage.js`) and by never resending by itself, but it cannot remove the "processing forever" case on develop. That is why the classification stays **`key-fix-pending`** (unlike `transfer.create`, whose completion is already atomic on develop) and why both operations stay closed until the fix is deployed.

## What Mobile does

Already in place before this phase (verified, not rebuilt):
- the forms (`forms/workflows.js` `expense`, `income`): account (active, non-goal), category (active, of the entry's type; required for an expense, optional for an income), amount with the account's currency beside it, date, description, reference;
- the payload builders (`forms/writePayloads.js`), the sender (`data/writeApi.js` → `transactionsApi.createExpense` / `createIncome`, one key per submission);
- the send hook (`forms/useWorkflowSubmit.js`): one request per submission, a key persisted across reloads, nothing resent by itself, a certain refusal (403/404/422/429) releases the key, a timeout, network error, 5xx or any other 409 is an unknown outcome and keeps it, and the cached reads are dropped on anything that may have written, so Home, Accounts and Activity read again;
- the review step and the possible-duplicate question.

Added in this phase:
- `models/transactionResult.js` and `forms/TransactionResult.jsx`: the confirmed result. It is shown only when the answer is provably the entry sent (an id, the type, the account's ledger leg, the amount and, if sent, the category). It shows the server's amount, account, category, date, description, reference and status, then the **account balance read again** (`GET /accounts/{id}`, reusing the transfer result's `BalanceNow`), and links to the transaction (`/m/activity/{id}`). A 2xx that cannot be checked falls back to the generic "Recorded", with no figures. Hide-amounts masks both amounts.
- Strings `forms.entryResult.*`, English and Arabic (`i18n/sections/forms.js`). The card reuses the transfer result's styles.
- Evidence comments on both registry entries; the classification is unchanged.

## Tests

`tests/mobileTransactionCreate.test.mjs`, against a fake backend that follows the rules above (balances, an idempotency table, the 422s). It covers, for both writes:
- the registration, the closed sender (no request) and the missing key; the closed screen sending zero requests;
- the exact payload and key; the result and the balance read after the write; an income with no category;
- zero, negative, over-precise and malformed amounts; account and category validation (archived, goal, wrong type, inactive); currency beside the amount and in the result;
- insufficient balance (refused, nothing moved, key released) and an account that allows a negative balance;
- a double tap; a lost answer then a reload replaying the same key with the money moving once; a different entry after a reload getting its own key; the same key with different data (409, unknown); a 409 while processing; a timeout and a 504;
- a 2xx that is not provably this entry (generic acknowledgement); hide-amounts; Arabic.

## Before opening

1. **Backend:** deploy `fix/financial-idempotency-p0` (or its equivalent) so the key completes with the money, then change both classifications to `key-atomic` in a reviewed commit.
2. **Staging run:** one expense and one income; the same key and request again (the same transaction, the balance moved once); the same key with a different amount (409); insufficient balance (422); an archived account (422); a goal's account (422); an inactive category (422).
3. The 408 evidence, the shared release rule.
4. A recorded per-write approval, then a separate commit adding the two operations to `APPROVED`.
