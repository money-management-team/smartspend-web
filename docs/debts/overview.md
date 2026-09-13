# Debts — Overview

A **debt** is money owed between the user and someone else (the *counterparty*). Its `direction` says which way:

| `direction` | Meaning | Paying it moves money… |
| --- | --- | --- |
| `payable` | **I owe** the counterparty | **out of** the chosen account |
| `receivable` | The counterparty **owes me** | **into** the chosen account (a *collection*) |

A debt has an `original_amount`, and the backend keeps `paid_amount`, `remaining_amount`, the lifecycle `status` and the `effective_status` (which is `overdue` once the due date has passed). **Payments** are real financial movements posted in the ledger on one of the user's accounts. The frontend never calculates amounts, statuses or balances: it shows what the backend returns after every write.

A debt is never deleted. `DELETE /debts/{id}` **archives** it: it becomes read-only and its payments and ledger history are kept.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Domain model, routes, flow, key files (this file) |
| [api.md](api.md) | Every endpoint, payload, response envelope, pagination key and error code |
| [business-rules.md](business-rules.md) | Statuses, action matrix, editable/immutable fields, the `original_amount` lock, archive, overdue |
| [payments-and-reversal.md](payments-and-reversal.md) | Recording a payment, money direction, eligible accounts, Idempotency-Key, reversing a payment, history |
| [implementation.md](implementation.md) | Pages, components, state after each write, error wording, i18n/RTL, verification |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.DEBTS` | `/dashboard/debts` | `src/features/Dashboards/User/Debts/Debts.jsx` (summary, filters, list, create) |
| `PATH.USER.DEBT_DETAILS` | `/dashboard/debts/:debtId` | `src/features/Dashboards/User/DebtDetails/DebtDetails.jsx` |

- Build links with `getDebtDetailsPath(id)`. The details route is nested under the list path, so the sidebar's "Debts" item (group "Manage", icon `LuHandCoins`) stays highlighted.
- Create, edit, record payment, reverse payment and archive are modals (the dashboard's convention), not routes.
- The list keeps its filters and page in the URL (`?direction=&status=&currency_code=&counterparty=&due_from=&due_to=&page=`).

## Flow

```
Debts (GET /debts/summary + GET /debts, filtered + paginated)
 ├─ New debt ── POST /debts ──▶ list + summary refetched, notice with "View debt"
 └─ click a counterparty ──▶ Debt details (GET /debts/{id})
                             ├─ Record payment / collection ── POST /debts/{id}/payments (Idempotency-Key)
                             │     ──▶ debt from the response, payment history refetched
                             ├─ Edit ── PATCH /debts/{id} ──▶ debt from the response
                             ├─ Archive ── DELETE /debts/{id} ──▶ stays on the page, read-only
                             └─ Payment history (GET /debts/{id}/payments, paginated)
                                   └─ Reverse ── POST /debt-payments/{paymentId}/reverse
                                         ──▶ debt from the response, history refetched (the payment stays, "Reversed")
```

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/debtsApi.js` | Every debt request (list, summary, get, create, update, archive, listPayments, recordPayment, reversePayment) |
| `src/features/Dashboards/User/Debts/debtHelpers.js` | Statuses, action matrix, URL filters, summary parsing, form validation and payloads, payment idempotency attempt, error wording |
| `…/Debts/Debts.jsx` | List page: summary, filters, table, pagination, create modal |
| `…/Debts/components/DebtsHeader/` | Page title and "New debt" |
| `…/Debts/components/DebtSummary/` | One card per currency (`GET /debts/summary`) |
| `…/Debts/components/DebtFilters/` | Direction / status / currency / counterparty / due-date filters |
| `…/Debts/components/DebtList/` | The debts table; the counterparty links to the details page |
| `…/Debts/components/DebtForm/` | Create modal (with the optional opening movement) |
| `…/Debts/components/DebtEditForm/` | Edit modal (PATCH, only changed fields) |
| `…/Debts/components/DebtPaymentForm/` | Record payment / collection modal (Idempotency-Key) |
| `…/Debts/components/DebtPayments/` | Paginated payment history with the Reverse action |
| `…/Debts/components/ReverseDebtPaymentDialog/` | Reverse confirmation with the required reason |
| `…/Debts/components/ArchiveDebtDialog/` | Archive confirmation |
| `…/Debts/components/DebtBadge/` | Direction, debt status and payment status badges |
| `src/features/Dashboards/User/DebtDetails/DebtDetails.jsx` | Details page |
| `src/locales/{en,ar}/*.json` → `dashboard.debts.*`, `dashboard.sidebar.debts` | All copy |

Accounts come from the existing `accountsApi`, the workspace from `resolveWorkspaceId()` / the session workspace, idempotency keys from `createIdempotentAttempt()`, money formatting from `utils/formatters.js`; none of these is duplicated. The legacy axios instance (`src/services/api.js`) is not used.
