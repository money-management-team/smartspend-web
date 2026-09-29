# Transactions — Correction, reversal, statuses, transfers

## Correction by reversal (the new id)

"Correct" is the user-facing name; internally it is **correction by reversal**. `PATCH /transactions/{id}` does not change the transaction in place. The backend:

1. marks the original `status = "reversed"` (with `reversed_at`, `reversal_reason` = the reason),
2. posts a reversal transaction (`reversal_of_id` = original id) that cancels its ledger effect,
3. posts a **replacement** with a **new id** (`related_transaction_id` = original id, `status = "posted"`).

The frontend (`TransactionDetails.handleCorrect`):

- sends only the changed fields plus the required `reason`, with an `Idempotency-Key`;
- takes `data.transaction` as the replacement. If its id differs from the current one, it closes the form and `navigate(getTransactionDetailsPath(newId), { replace: true })`. The page fetches the replacement; the old id is never treated as the edited transaction again;
- shows "Correction saved. This is the new replacement transaction. The original was reversed: #old" with a link;
- if the response has no replacement, it refetches the current id (which now shows as reversed).

The correction form (`CorrectTransactionForm`):

- is offered only when `canChangeTransaction(tx)`;
- explains up front that saving reverses the transaction and posts a replacement with a new number;
- is prefilled (account from the ledger entry, category, amount without trailing zeros, description, reference, date in the user's time zone);
- loads accounts and categories of the transaction's workspace (`id_workspace` / `workspace_id`) and type. An archived current account/category stays selectable, labelled "no longer active";
- requires a reason (3–500) and at least one changed field; income category can be cleared, expense category can't.

## Reverse

`POST /transactions/{id}/reverse` with a required reason (3–500). Offered from the list (row action) and the details page, only for eligible transactions.

- `ReverseTransactionDialog` explains: reversing is not deleting; compensating ledger entries are posted; the original stays in history as reversed; it can only be reversed once.
- On success the list is refetched (list) or the original from `data.transaction_original` is shown as reversed (details), and `data.reversals` ids are linked in the notice.
- 409 → "already reversed"; the list/page refreshes once the dialog closes so the error stays readable.
- 422 → the backend's reason (missing reason, or the reversal would make a no-negative-balance account negative) plus the balance hint. The operation is never forced client-side.

## Eligibility

`canChangeTransaction(tx)`: `status === "posted"`, `type` is `income` or `expense`, not part of a transfer (`transfer_id == null`, type not `transfer`/`fee`), and not a reversal entry (`reversal_of_id == null`, type not `reversal`).

## Statuses

| Status | Badge | Correct / reverse |
| --- | --- | --- |
| `posted` | green (shown on details; rows show badges only for non-posted) | yes, if eligible |
| `reversed` | amber; amount struck through in rows and details | no — note explains it was reversed |
| `pending_review` | blue | no |
| `draft` | neutral | no |
| `failed` | red | no |

Reversed transactions and reversal entries stay listed; they're only hidden when the user filters by another status. Rows also carry chips: "Reversal entry" (`reversal_of_id`), "Correction" (`related_transaction_id` on a non-reversal), "Transfer" (transfer-linked non-transfer types such as fees).

## Transfers

- Transfers are created and managed in their own section: [../transfers/overview.md](../transfers/overview.md). That logic is not duplicated in `transactionsApi` or in the New operation form.
- Transfer transactions appear in the list with a neutral amount (no +/−) and the transfer icon, and the details page shows every account involved (from the ledger entries).
- A single leg of a transfer is never corrected or reversed from here: the backend reverses a transfer as a whole (movement + fee) through `POST /transfers/{id}/reverse`. Transfer-linked transactions are therefore **read-only**, with a note linking to the transfer. Previously the list offered a reverse button on transfer legs.
