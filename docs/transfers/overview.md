# Transfers — Overview

A **transfer** moves money between two of the user's own accounts. It is neither income nor expense, so it is never counted as either: it has its own section, its own list and its own details page. If the transfer costs a fee, the fee **is** a real expense, booked on the source account through an expense category.

A posted transfer is never edited or deleted. Cancelling one is a **reversal**, which reverses the whole transfer — the movement and the fee together — by posting compensating ledger entries.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, key files, domain rules (this file) |
| [api.md](api.md) | Endpoints, payloads, responses, list parsing, `Idempotency-Key`, error codes |
| [business-rules.md](business-rules.md) | Account and currency rules, fee behaviour, reversal and its financial guard |
| [implementation.md](implementation.md) | Pages, components, state after a write, accounts/categories integration, i18n/RTL, verification |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.TRANSFERS` | `/dashboard/transfers` | `src/features/Dashboards/User/Transfers/Transfers.jsx` (list + New transfer) |
| `PATH.USER.TRANSFER_DETAILS` | `/dashboard/transfers/:transferId` | `src/features/Dashboards/User/TransferDetails/TransferDetails.jsx` |

- Build detail links with `getTransferDetailsPath(id)`; the details route is nested under the list path, so the sidebar's "Transfers" item stays highlighted.
- `getNewTransferPath()` (`/dashboard/transfers?new=1`) opens the list with the form. The dashboard hero's **Transfer** action and the "record a transfer" link under the new-operation form use it.
- The list page keeps its filters and `page` in the URL, so the details page's back link (and the browser's) returns to the same filtered page.

## Flow

```
Transfers
 ├─ New transfer ── POST /transfers (Idempotency-Key) ──▶ list + balances refetched
 └─ Transfers list (GET /transfers: from/to account, status, currency, date range; paginated)
     └─ click a row ──▶ Transfer details (GET /transfers/{id})
                         ├─ movement: −amount (source), +amount (destination), −fee (source)
                         ├─ the transactions the ledger posted (links to Transaction details)
                         └─ Reverse (reason) ── POST /transfers/{id}/reverse ──▶ reversed, fee included
```

## Domain rules the UI respects

- **A transfer is not income and not expense.** Its amount is shown without a `+`/`−` sign, and the section never treats it as a transaction of either type.
- **A fee is an expense.** It is entered with the transfer, requires an **expense** category, and the backend books it as its own `fee` transaction on the source account.
- **The backend ledger is the source of truth.** No balance is ever computed or adjusted in the frontend; after a write the affected data is refetched.
- **Both accounts must be active and share a currency**, and the source can't also be the destination. The form prevents those choices; the backend still validates them.
- **Every transfer creation carries an `Idempotency-Key`**, reused while the details are unchanged, so a double click or a retry after an unknown outcome can't move the money twice.
- **There is no edit and no delete.** Reversal is the only correction, it needs a reason (3–500 characters), it reverses the whole transfer, and it can only happen once.
- **Reversed transfers stay in the list** as history, with the amount struck through.

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/transfersApi.js` | `list`, `get`, `create` (Idempotency-Key required), `reverse` |
| `src/features/Dashboards/User/Transfers/transferHelpers.js` | Pagination parsing, URL filters (`readTransferFilters`, `transferFiltersToQuery`, …), movement rows, fee/reversal eligibility, fee validation, error wording |
| `src/features/Dashboards/User/Transfers/Transfers.jsx` | List, filters, pagination, success notices, opens the form |
| `…/Transfers/components/TransferFilters/` | Filter bar (reuses the transactions filter styles) |
| `…/Transfers/components/TransferForm/` | Create modal (accounts, fee, fee category, description, reference, date) |
| `…/Transfers/components/ReverseTransferDialog/` | Reverse confirmation with the required reason |
| `src/features/Dashboards/User/TransferDetails/TransferDetails.jsx` | Details, money movement, ledger transactions, reverse action |
| `src/locales/{en,ar}/*.json` → `dashboard.transfers.*` | All copy |

Accounts and categories come from the existing `accountsApi` and `categoriesApi`; `transfersApi` never duplicates them. The status badge, modal shell, loading, empty and error states are the dashboard's existing components.
