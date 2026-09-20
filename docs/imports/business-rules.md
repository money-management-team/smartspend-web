# Statement imports — financial rules

## Nothing moves until Confirm

Upload, mapping, validation, preview, row corrections and row ignores create no transaction and change no balance. The UI says so on the upload screen and on the summary card (`dashboard.importPage.noMoneyMoved`).

## Confirm posts real transactions

`POST /imports/{id}/confirm` posts the **valid rows only** through the same financial actions as a transaction added by hand. Invalid, duplicate and ignored rows are skipped and stay in the import for the record.

`ImportConfirm` therefore:

- states plainly that this creates real transactions and changes balances;
- shows how many rows will be imported (`counts.valid`) and how many will be skipped, by reason;
- requires an explicit acknowledgement checkbox before the button enables;
- disables the button while a confirmation is in flight and when nothing is importable.

Confirm is offered only when `canConfirmImport(record)` is true: status `ready_for_review` or `partially_valid`, nothing posted yet, and at least one valid row. `partially_valid` counts — the invalid rows are simply left out.

## Confirmation may be asynchronous

The endpoint may answer **`202 Accepted`** with the import still `confirmed` or `processing`, and finish in the background. A synchronous development queue may instead return `completed` straight away. Both are valid and both are handled.

The frontend never treats a confirmation response as "done". `ImportConfirm` hands the returned import to `ImportOutcome`, which polls `GET /imports/{id}` until the status is final (`completed`, `failed`, `cancelled`, `reversed`).

## Reverse, not delete

`POST /imports/{id}/reverse` undoes a confirmed import by posting the **opposing** transactions. The originals stay in the ledger and remain auditable, and the import becomes `reversed`.

The UI presents this as **Reverse import** and never as "Delete import" or "Delete transactions". `ImportReverse` spells out both halves of the contract before the user commits: the imported transactions stay, and an opposing entry is created for each. A `reason` is required and travels with the reversal so it stays auditable.

Reverse is offered only when `canReverseImport(record)` is true — that is, only for a `completed` import.

## Cancel before confirmation, Reverse after

The two are never offered together:

| Situation | Action | Why |
|---|---|---|
| Nothing posted yet | **Cancel import** | The file is dropped, the import becomes `cancelled`. No transaction existed, so there is nothing to undo. |
| Import completed | **Reverse import** | Transactions exist. They can only be undone by opposing entries. |
| Confirmed / processing | Neither | The backend is mid-flight; the outcome screen polls until it settles. |

`canCancelImport` returns false as soon as the import is posted (`confirmed`, `processing`, `completed`, `reversed`) or final, so cancel can never be used on a confirmed financial import.

## The frontend is not the financial source of truth

After Confirm or Reverse the frontend **never** adjusts account balances, budget spent amounts, dashboard totals or transaction lists itself. It shows what the backend returns and re-reads the import. Other pages pick up the new financial state through their own loaders on their next fetch, the same way they do after a manual transaction.

## Multi-currency and money values

Counts are integers and are displayed exactly as the backend sends them, never recomputed from a page of rows. Row amounts are formatted with the row's own currency and wrapped in `<bdi dir="ltr">` so they stay readable inside Arabic RTL text. Amounts sent back in a row correction go through `toMoneyString` (4-decimal strings), as everywhere else in the app.

## Status vocabulary

`IMPORT_STATUSES` in `importHelpers.js` holds all eleven documented statuses in lifecycle order: `uploaded`, `mapping_required`, `validating`, `ready_for_review`, `partially_valid`, `confirmed`, `processing`, `completed`, `failed`, `cancelled`, `reversed`. Three groups drive every decision:

- **posted** — `confirmed`, `processing`, `completed`, `reversed` (money may have moved);
- **in flight** — `validating`, `confirmed`, `processing` (polled);
- **final** — `completed`, `failed`, `cancelled`, `reversed` (nothing changes on its own).

An unknown status is shown as the backend sent it and never reinterpreted.
