# Debts — Business rules

## The backend is the source of truth

- `paid_amount`, `remaining_amount`, `status`, `effective_status`, `days_until_due`, `payments_count` and `settled_at` are the backend's. The frontend never computes or patches them.
- Every write returns the debt in its new state (`data.debt`). That object replaces what is shown (`mergeDebt`); when it is missing, the debt is fetched again instead of being patched.
- Account balances are never changed by the frontend. Payments and reversals are posted in the ledger by the backend; the Accounts, Transactions and Dashboard pages read the new balances when they are opened.
- The only local money comparisons are **guards and hints** on the decimal strings (BigInt via `subtractMoney`): a payment above `remaining_amount` is blocked, and a payable payment above the account's balance shows a warning. The backend still decides.

## Two statuses

| Field | Values | Used for |
| --- | --- | --- |
| `status` (lifecycle) | `active`, `partially_paid`, `paid`, `archived` | What the debt allows (`getDebtLifecycle`) |
| `effective_status` | the lifecycle value, or `overdue` | What the user sees (`getDebtStatus`, badges) |

`overdue` is an **effective** status, not a lifecycle one: an overdue debt is still `active` or `partially_paid` and **accepts payments like any open debt**. When a response lacks `effective_status`, `is_overdue` keeps the fallback from hiding an overdue debt.

The backend moves the lifecycle on its own: a payment turns `active` into `partially_paid`, or into `paid` (with `settled_at`) when `remaining_amount` reaches zero; a reversal can turn `paid` back into `partially_paid` or `active`. The frontend shows the returned status and never infers it.

## Action matrix

`getDebtActions(debt)` decides what the UI offers. Every action still handles its rejection.

| Lifecycle | Edit | Record payment | Reverse a payment | Archive |
| --- | --- | --- | --- | --- |
| `active` (incl. overdue) | ✓ | ✓ | ✓ (posted, not reversed) | ✓ (no payments yet) |
| `partially_paid` (incl. overdue) | ✓ (amount locked) | ✓ | ✓ | offered; confirm disabled until settled |
| `paid` | ✓ (amount locked) | — (nothing remains) | ✓ | ✓ |
| `archived` | — | — | — | — (read-only) |

- An unknown lifecycle value is treated as open; an unknown `remaining_amount` keeps "Record payment" available (the backend decides).
- "Record payment" is labelled **Record collection** for a receivable debt.

## Editable and immutable fields

Editable: `counterparty_name`, `original_amount` (see below), `issued_at`, `due_date`, `notes` (and `metadata` through the API module). The edit form shows the direction and currency read-only and never sends them. Never sent on update: `user_id`, `workspace_id`, `direction`, `currency_code`, `status`, `paid_amount`, `remaining_amount`, `opening_transaction_id`.

Validation (client-side, mirrored by the backend): counterparty required and ≤ 150 characters; amount a positive decimal with ≤ 4 decimals; dates `YYYY-MM-DD` with the due date not before the issue date; notes ≤ 1000 characters.

## `original_amount` only before the first payment

- `amountLocked` is true when `payments_count > 0`. Without `payments_count`, a positive `paid_amount` locks it too.
- While locked, the edit form has no amount input: it shows the amount read-only and explains why ("The original amount can't be changed because this debt already has payments."), and the PATCH never includes `original_amount`.
- When the amount can change, the hint says the backend will recalculate the remaining amount. The frontend does not compute it.
- A backend 409 about the amount is still explained ("The original amount can't be changed after the first payment.").

## Archive

- `DELETE /debts/{id}` **archives**. It is never worded as a deletion ("Archive debt", "The debt and its details are kept"). The debt, its payments and its ledger movements stay recorded.
- **An open debt that already has payments can't be archived before it is settled.** When the lifecycle isn't `paid` and `paid_amount > 0` (`mustSettleFirst`), the dialog explains this with the remaining amount and disables its confirm button. The frontend never settles or reverses anything automatically to make archiving possible.
- The backend's 409 (payments before settlement / already archived) is shown in the dialog, and the debt is refetched when it closes.
- After archiving, the page shows the returned archived debt: every mutation action disappears, including Reverse on payments, and an "archived, read-only" note is shown. The list and summary are refetched the next time the list is opened.

## Opening movement (create)

A debt can be created as a record only, or with an opening movement on an account (`account_id`): payable → the borrowed money comes into the account; receivable → the lent money leaves it. The backend posts it (`opening_transaction_id`, `has_movement`); the details page links to that transaction. `POST /debts` has no Idempotency-Key, so after an unknown outcome the create form tells the user to check the list before retrying.
