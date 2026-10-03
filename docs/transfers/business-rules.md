# Transfers — Business rules

## Accounts

| Rule | Where it is enforced |
| --- | --- |
| Both accounts must exist and belong to a workspace the user manages | Backend (403/422); the selectors only list accounts returned by `GET /accounts` |
| Only active accounts can be used | `GET /accounts` returns active accounts; the form also drops anything with `status: "archived"` |
| The destination must differ from the source | The destination list excludes the chosen source, and the form refuses a match before sending (`validation.sameAccount`) |
| Both accounts must use the same currency | The destination list only offers accounts whose `currency_code` matches the source; the amount field states the currency |

Frontend prevention is for UX only — the backend validates everything, and its 422 message is shown as-is when it does.

Changing the source clears the destination, because the previous choice may now be the same account or a different currency.

## Currency

Transfers between accounts of different currencies are **not supported**. Nothing converts amounts in the frontend, and `currency_code` is never sent: it follows the accounts.

## Fee

- The fee is optional. Empty or zero means "no fee": `fee_amount` and `fee_category_id` are then not sent at all.
- A non-zero fee **requires** a fee category, and only **active expense** categories are offered (`GET /categories?type=expense`, filtered again client-side). Income categories can never be chosen; system expense categories are valid even though they are read-only elsewhere.
- The fee is not part of the transferred amount: the source account pays `amount + fee`, the destination receives `amount`.
- The backend records the fee as its **own** `fee` transaction on the source account, alongside the `transfer` transaction. The details page shows both.

## Money

Backend monetary values are strings (`"400.0000"`, `"5.0000"`). They stay strings end to end: inputs are validated with a regex (positive, at most 4 decimals), `toMoneyString` produces the 4-decimal payload, and display uses the shared `formatMoney`. No balance is ever derived from frontend state — the source and destination balances shown in the account selector come from `GET /accounts` and are refetched after a transfer.

## Financial semantics in the list

A transfer between the user's own accounts is **not income and not expense**: its two ledger entries (`transfer_out` / `transfer_in`) cancel each other out. The list therefore:

- shows the amount without a sign;
- never adds transfer amounts up or feeds them into any income/expense figure;
- computes no balance.

Only the fee is a real expense, and it is shown as such ("Transfer fee").

## Statuses

`dashboard.transfers.statuses.*` gives each value a translated label. The badge reuses `TransactionStatusBadge` with `labelsKey="dashboard.transfers.statuses"`.

| Status | Badge | Reverse |
| --- | --- | --- |
| `posted` | green, "Posted" | yes, once |
| `reversed` | amber, "Reversed"; the amount is struck through | no — the action is hidden and a note explains why |
| `pending` | blue, "Pending" | no — a note says only posted transfers can be reversed |
| `failed` | red, "Failed" | no |

`posted` is the canonical stored status. The filter input also accepts `confirmed`, which the backend maps to `posted`. The frontend never shows or stores "confirmed" as a separate state (see [api.md](api.md#list)).

Reversed transfers are never hidden by default: this is financial history. The Status filter can narrow the list to one status on the backend.

## Reversal

`POST /transfers/{id}/reverse` with a reason (3–500).

- Reversing is **not deleting**. The backend posts compensating ledger entries and the transfer stays in history as `reversed`.
- It reverses the **whole** transfer: the movement *and* the fee. The frontend never reverses one side, and the dialog says so when the transfer has a fee.
- It can only happen once. A second attempt returns 409 and is shown as "already reversed"; the page refreshes when the dialog closes, so the message stays readable first.
- The backend is atomic: either all reversal entries are written or none are.

### The financial guard (422)

A reversal can be refused when it would leave an account with a balance it isn't allowed to have — for example: A transfers 100 to B, B spends the 100, and taking it back would push B negative.

The dialog then shows the backend's own message plus `errors.reverseBalanceHint` ("… so nothing was reversed"). The operation is never forced, simulated or partially applied client-side, and the transfer stays `posted`.

## Transactions created by a transfer

| Transaction | `type` | Ledger entries |
| --- | --- | --- |
| The movement | `transfer` | `transfer_out` on the source (negative), `transfer_in` on the destination (positive) |
| The fee (optional) | `fee` | one negative entry on the source |
| Reversals (after a reversal) | `reversal` (`subtype`: `transfer` / `fee`) | the opposite of each original entry |

In the Transactions section those rows are visible but **read-only**: `canChangeTransaction` excludes anything with a `transfer_id` or a `transfer`/`fee` type, the row shows a "Transfer" chip, and the details page links to the transfer, where the whole thing can be reversed. Transfer logic is not duplicated there.
