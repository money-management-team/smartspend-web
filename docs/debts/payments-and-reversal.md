# Debts — Payments and reversal

## Money direction

A payment is a **real financial movement** on the chosen account, posted by the backend:

| Debt `direction` | Payment means | Account effect | UI wording |
| --- | --- | --- | --- |
| `payable` | The user pays the counterparty | Money **leaves** the account; it needs the balance | "Record payment", amount shown as `−` |
| `receivable` | The counterparty pays the user | Money **enters** the account | "Record collection", amount shown as `+` |

The frontend never adds to or subtracts from an account balance, and never recalculates the debt.

## Recording a payment (`DebtPaymentForm`)

Opened from "Record payment / Record collection" on the details page, only while `getDebtActions(debt).canRecordPayment`.

- **Remaining and paid amounts** are shown at the top, as the backend reported them, with "Pay the full remaining amount" (fills the amount with `remaining_amount`).
- **Accounts** are loaded fresh from the existing `accountsApi.list({ id_workspace: debt.workspace_id })` every time the form opens, and filtered with `getEligibleAccounts`: active, in the **debt's currency**, never a savings-goal container.
  - Payable: accounts that can't pay (`canAccountPay`: balance ≤ 0 and `allow_negative_balance` not true) are listed but disabled, labelled "no balance".
  - Receivable: every eligible account can receive.
  - With no eligible account, the select explains which case applies.
- **Fields:** account (required), amount (required), payment date (optional; defaults to today, and the picker stops at today — the backend validates the date), notes (optional, ≤ 1000).
- **Validation before sending:** account chosen; amount a positive decimal with ≤ 4 decimals; **amount not above `remaining_amount`** (string comparison, never floats); valid date; notes length.
- **Hints:** the effect line ("Cash will pay out −500.00"), and for a payable debt a warning when the amount is above the account's balance (not blocking: the account may allow negatives; the backend decides).
- **Payload:** `{ account_id, amount, paid_at?, notes? }`. `paid_at` is omitted when it is today, so the backend records "now"; another day is sent as `YYYY-MM-DD`.
- **Success:** `onCompleted(data)` → the page shows `data.debt` as the new state (paid/remaining/status/`payments_count`/`settled_at`), refetches the history from page 1, and shows "Payment recorded … Status: Partially paid". When the debt becomes `paid`, "Record payment" disappears and the paid note appears.

## Idempotency

`POST /debts/{id}/payments` requires an `Idempotency-Key`. The form uses `createPaymentAttempt(debt.id)` from `debtHelpers.js`, built on the shared `createIdempotentAttempt("debt-payment")`:

- **One key per payment intent**, meaning one opening of the form. The key does **not** change when the details are edited.
- **Double clicks** are blocked synchronously (`pendingRef`); the submit button is disabled while pending.
- After a **network error, timeout, 5xx, malformed response, 429 or 409**, the outcome is unknown or still processing, so the key is **kept**. The next submission reuses it, even with edited details. The backend then does one of three things:
  - it replays the first result;
  - it records the payment once, if the first request never arrived;
  - it rejects a different payload with **409**.
  It never records a second payment, which a fresh key could have done.
- The key is renewed only after a **success** or a **definitive rejection** (422, 403, 404, 401), when nothing was recorded.
- Nothing is retried automatically, and a new key is never generated for an ambiguous retry.
- After a 409 the key stays pinned, so to record a *different* payment the user closes the form and opens it again (a new intent and a new key). The message says so.

## Payment errors

The message comes from `getDebtErrorMessage(error, t, "payment")`, and an extra line from `getPaymentErrorHint`.

| Case | Message | Hint |
| --- | --- | --- |
| 403 | No access to this debt or the selected account | No payment was recorded |
| 404 | Debt or account unavailable | No payment was recorded |
| 409 still processing | "Still being processed. Check the payment history…" | "Nothing new was recorded. To record a different payment, close this form and open it again." |
| 409 other (key reused with a different payload…) | "Conflicts with an earlier request. Check the payment history…" | same |
| 422 above remaining | The backend's message | "The payment is more than the remaining amount…" |
| 422 debt already paid / archived | The backend's message | "Already fully paid" / "Archived debts don't accept payments" |
| 422 insufficient balance (payable) | The backend's message | "The account doesn't have enough money…" |
| 422 missing Idempotency-Key | The backend's message | "The request was missing its safety key…" |
| Network / timeout / 5xx | Generic network wording | "We couldn't confirm whether the payment was recorded… Retrying from this form is safe." |

The backend's 422 text is always kept because it carries the financial reason. After any failure except 401, the details page marks itself stale and refetches the debt when the form closes, so a payment recorded despite a timeout shows up. The account list is reloaded after a 404/422, because a balance may have changed.

## Payment history (`DebtPayments`)

- `GET /debts/{id}/payments?per_page=10&page=N`, with real pagination (footer when `last_page > 1`). `refreshKey` changes after a payment or a reversal, which refetches from page 1.
- Columns: paid on, amount (signed from the account's point of view), account (links to the account page), status (badge), transaction (links to `TransactionDetails` via `getTransactionDetailsPath`, plus the reversal transaction), notes, recorded at, action.
- **Reversed payments are never hidden or removed.** They stay in place, dimmed with the amount struck through, with a "Reversed" badge, "Reversed on …", the reversal transaction link and "Already reversed" in place of the action.
- States: loading, error with retry, "No payments yet.", and an empty page past the first with "Go to the first page".

## Reversing a payment (`ReverseDebtPaymentDialog`)

- Offered only for payments with `status: "posted"` that aren't reversed (`is_reversed` false), on a debt that isn't archived (`canReversePayment`). This includes payments of a `paid` debt.
- Sent to **`POST /debt-payments/{paymentId}/reverse`**: the payment's own id from the history row, never the debt id.
- The dialog summarizes the payment (date, account, amount) and explains:
  - the money effect (payable → the amount returns to the account; receivable → it is taken back out);
  - the payment stays in the history, marked reversed;
  - the amount is added back to the debt's remaining amount;
  - a payment can be reversed only once.
- **Reason:** required, trimmed length 3–500 (the same limits as transaction reversal), with a live counter. A backend `errors.reason` message is shown under the field.
- **No Idempotency-Key** is sent. After an unknown outcome, retrying is safe: a second reversal of the same payment is rejected with 409 ("already reversed").
- **Success:** the page shows `data.debt` (remaining restored, status recalculated by the backend, e.g. `paid` → `partially_paid`), refetches the history (the payment now shows "Reversed" with its reversal transaction), and shows "The payment was reversed. Status: …". The original payment is never deleted, and no amount or balance is restored by hand.
- **Errors** (`getDebtErrorMessage(error, t, "reverse")` + `getReverseErrorHint`):
  - 409 → "already reversed" (or "debt archived"), with the hint "Close this message to see the payment's current state";
  - 404 → payment unavailable;
  - 422 → the backend's message; a reversal that would make a balance negative adds "Reversing it would take the account below zero. Nothing was reversed.";
  - unknown outcome → check the history before trying again.
  Every failure refetches the debt (and its history) when the dialog closes.
