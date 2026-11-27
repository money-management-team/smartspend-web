# Mobile — correcting and reversing a transaction (Phase 2C)

**Transaction → Correct / Reverse → review (original beside proposed) → confirm → the server's result.** The operations `transaction.correct` and `transaction.reverse` are **closed**: `APPROVED` in `src/mobile/data/writeGate.js` is empty. Opening them is a separate, approved commit after the steps under "Before opening". Same shape as [TRANSFER-CREATE.md](TRANSFER-CREATE.md) and [TRANSACTION-CREATE.md](TRANSACTION-CREATE.md).

## API contracts (read from the backend source, never from production)

Refs: `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72` (read with `git show`).

### Correction: `PATCH /transactions/{id}`

`UpdateTransactionAction`. **A correction is not an edit.** It reverses the original and posts a replacement, in **one** `DB::transaction` under row locks on both accounts (ascending id), on both refs.
- **Request:** `Idempotency-Key` required (`UpdateTransactionRequest`). Body: `reason` required (3–500); optional and only what changed: `account_id`, `category_id` (nullable), `amount` (positive decimal string, up to 4 decimals), `description`, `reference_number` (nullable), `occurred_at`; `confirm_possible_duplicate` (6b696d72, only after the duplicate question).
- **Rules (422/409 with the server's message):**
  - only a **posted income or expense** with exactly one ledger entry and no transfer;
  - an already reversed original is a 409 (`TransactionAlreadyReversedException`);
  - the replacement's account must be in the same workspace and **in the same currency**;
  - an expense needs a category, of the entry's type and active;
  - the replacement obeys the expense balance rule (after the original was taken back); a failure rolls the whole correction back.
- **Answer: 200** `{ data: { transaction } }`, the **replacement**: a new id, the same type, `related_transaction_id` = the original's id. The original becomes `reversed` (with `reversed_at`, `reversal_reason`) and a `reversal` transaction is posted.
- **Idempotency:** reserved per `{workspace, user, "update_transaction", key}`. Same key + same request replays the replacement; a different request is a 409; processing is a 409.
- **Imports:** a transaction an import posted has an `import_rows` link. On **6b696d72** the replacement keeps `source = statement_import` and the import keys in `metadata`, and the row follows the replacement. On **develop** it does not: the replacement is a manual transaction, the import row still points at the reversed original, and reversing the import afterwards skips what is already reversed (`ReverseImportBatchAction`), so **the corrected money stays behind**.

### Reversal: `POST /transactions/{id}/reverse`

`ReverseTransactionAction`, **identical on both refs**. Body: `reason` required (3–500). **No Idempotency-Key.**
- One `DB::transaction`; the accounts are locked first, the original is re-read under lock.
- **Refused:** a reversal transaction (422), a transaction already reversed (409), anything not posted (422), no ledger entries (422), **debt money** (409 `debt_transaction_requires_domain_reversal`, with the debt payment's own endpoint), a multi-leg savings installment's transfer (409), and a reversal that would leave an account negative where that is forbidden (422).
- A transfer's transaction is reversed **as a whole transfer**; Mobile uses `transfer.reverse` for those, so its transaction page doesn't offer Reverse.
- **Answer: 200** `{ data: { original_transaction, reversals } }`: the original (now `reversed`) and the reversal transaction(s) (`type: reversal`, `reversal_of_id`, ledger entries with their accounts). **No balance.** (The full version reads `data.transaction_original`, which the backend never sends; it falls back to reloading. Mobile reads the backend's `original_transaction`.)
- **Dedup:** none needed for the money: the row lock plus the "already reversed" check make a second request a 409. After a **lost answer** that 409 can't tell "my request did it" from "it was already reversed", so Mobile reports an unknown outcome and sends nothing more.

### Why the classifications stand

| Write | Classification | Evidence |
|---|---|---|
| `transaction.reverse` | `once-only` | One transaction, row lock, status check, identical on both refs. Never double-reverses. |
| `transaction.correct` | `key-fix-pending` | The money is atomic on both refs, but on develop `IdempotencyService::run` completes the key in a **second** transaction (money corrected, key stuck "processing"), recycles it after 24 h, and **hashes the request without `occurred_at`, `description` and `reference_number`**: the same key with another date replays the first correction instead of being refused. 6b696d72 fixes all three. |

Mobile never reuses a key for a different request (its stored key is bound to a hash of the whole request) and never past 24 h, so the hash gap is not reachable from Mobile, but the server can't be relied on to refuse it.

## What Mobile does

Already in place (verified, not rebuilt): the forms (`workflows.js` `transaction-correct`, `transaction-reverse`), routes `/m/activity/{id}/correct|reverse`, payload builders (the reason plus only the changed fields; an emptied optional text is `null`), the senders, the send hook (one request per submission, a persisted key bound to the request, nothing resent by itself, certain refusals release the key, timeouts/5xx/409 are unknown), the possible-duplicate step.

Added in this phase:
- **Eligibility** (`eligibleToCorrect` / `eligibleToReverse` in `forms/workflows.js`, shared by the form and the transaction page): correct only a posted income/expense that is not a reversal, a transfer leg or **imported** (`importedCorrection`: "correct it in the full version", because of the develop gap above); reverse only a posted entry that is not a reversal, a transfer leg or **debt money** (`debtMoney`).
- **Review with the original beside the proposal** (`showsOriginal`): each changed detail shows "Was: …", and a cleared detail is listed as "Not set".
- **Reversal review:** the transaction's amount, date and the account it was recorded on, and what reversing means ("its effect on the balance is cancelled; nothing is deleted").
- **Server-confirmed results:** `buildCorrectionResult` (a NEW transaction, the same type, `related_transaction_id` = this one, the amount, account and category asked for) and `buildReversalResult` (this original, `reversed`, a reversal of it, its amount) in `models/transactionResult.js`, shown by `TransactionResult.jsx` and `ReversalResult.jsx`. Anything not provable falls back to the generic "Recorded". Both read **again from the server** the original's status (`TransactionNow.jsx`) and every affected account's balance (`BalanceNow`); nothing is computed. Hide-amounts masks the figures.
- **A fix the tests found** (`forms/MobileWorkflow.jsx`): after a confirmed write every cached read is dropped, so the record page went back to "Loading" and took the form, with its result, away (and would then have said "not eligible", the record having just changed). Once shown, the form now stays with the record it was shown for.
- Strings `forms.entryResult.*`, `forms.was`, `forms.ineligible.*`, English and Arabic.

## Tests

`tests/mobileTransactionChange.test.mjs`, against a fake backend that follows the rules above (balances, ledger legs, an idempotency table, the 409s and 422s): the registration; the closed sender and closed screens sending zero requests; who is offered what (reversed, reversal, transfer leg, imported, debt money, invalid ids, the transaction page's links); the correction (prefill, same-currency accounts, original vs proposed, exact payload and key, replacement result, original status and balances read again, another account, a cleared income category, validation, insufficient balance, double tap, lost answer after and before the server applied it, a different correction after a reload, same key replayed and with different data, 409/timeout/504, unverifiable 2xx, hide-amounts, Arabic); the reversal (explanation, exact payload with no key, result and balances read again, overdraw refused, short reason, double tap, lost answers, 409 never read as success, unverifiable 2xx, hide-amounts, Arabic); and the two result builders.

## Before opening

1. **Backend:** deploy `fix/financial-idempotency-p0` (atomic key completion, no recycling, the full request hash, import provenance), then change `transaction.correct` to `key-atomic` and lift the imported restriction, in a reviewed commit.
2. **Staging run:** a correction (the replacement, the original reversed, balances); the same key and request again (the same replacement); the same key with another date (409 once the hash is fixed); an imported one; a reversal; a second reversal (409); a reversal that would overdraw (422); a debt payment's transaction (409).
3. The 408 evidence, the shared release rule, then a recorded per-write approval and a separate commit adding the operations to `APPROVED`.
