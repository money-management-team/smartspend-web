# Phase 6UI.5C3: Account and transaction details

Mobile only. Read-only: no write is opened (`APPROVED` in `src/mobile/data/writeGate.js` is still `Object.freeze([])`), Backend is untouched, and the flag-off build still contains no Mobile code (`tests/mobileBundle.test.mjs`).

## Audit: Desktop against Mobile

| Desktop | Backend | On Mobile |
|---|---|---|
| Account: name, type, status, default and hidden chips | `GET /accounts/{id}` | Shown in the hero: icon, name, type, status, Default. (Hidden is not in the Mobile account model and is not shown.) |
| Account: current and opening balance | same | The confirmed balance leads the hero; the opening balance is in "About this account". Both are the backend's strings; nothing is calculated here. |
| Account: movement history, with filters and paging | `GET /transactions?account_id=` | Movements for this account, paged ("Load more"), each with its direction and the amount of this account's own ledger lines. Filters: "All activity" opens Activity (which already filters by account) for this account. |
| Account: statement export (PDF/CSV built in the browser from list reads) | `GET /transactions` | Not built on Mobile (it needs the PDF/CSV code that only the full version loads). The Changes card says statements aren't available in Mobile and links to the full version. |
| Account: edit, archive | `PUT /accounts/{id}`, `POST /accounts/{id}/archive` | Draft forms (filled in and reviewed, not sent), offered only for an active, non-goal account. Unchanged. |
| Transaction: type, status, amount, date, accounts | `GET /transactions/{id}` | Hero: the amount, type and status chips, the date, and the accounts it touched. |
| Transaction: reversed, reversal, correction, transfer, not-posted notes | same | One card of notes (each note keeps its link to the original or the replacement). |
| Transaction: details table | same | Category, description, reference and date in view; when and why for a reversed one in view; the record's own metadata (posted time, source, creator, transfer, related ids) behind "More about this record". |
| Transaction: ledger entries | `ledger_entries` | The backend's own signed lines, each account a link. A transfer links to its Mobile page. |
| Transaction: Correct, Reverse | `PATCH /transactions/{id}`, reverse call | Draft forms only, for a posted transaction that is not a reversal or a transfer leg (Correct only for income and expense). Unchanged. |

## What changed

- Account hero with the account's icon and chips; the balance larger.
- "All activity" link in the Movements card (a link, not a request).
- Movements: a direction icon on each row, the same row as Activity.
- Transaction hero names the accounts it touched. Each name is its own isolate and the arrow sits in the page's direction, so it points from source to destination in English and Arabic.
- The transaction's situation is one card of notes instead of up to six cards.
- Record metadata is collapsed; facts that matter stay visible.
- The transfer id and each ledger line's account are links.
- Fixed: the account page logged a missing-translation warning for every plain expense or income movement (it asked for `movements.kind.expense`); only reversals and transfer legs have movement wording, and the rest use the type's own name.

## Unchanged protections

- Every page still refuses a response about another record, reports "not found" and "no access" in the same words, makes no request for an address that is not an id, and shows a status it does not know exactly as sent.
- Reads: `GET /accounts/{id}` and `GET /transactions?account_id=` on the account; `GET /transactions/{id}` on a transaction. Nothing new is requested.
- A balance is never calculated from movements, and no balance appears on a transaction's page.
- Hidden amounts hide every figure on both pages.
