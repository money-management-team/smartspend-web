# Transactions — Overview

Transactions are **ledger records**, not ordinary CRUD rows. The section lets a signed-in user browse their transaction history (filtered and paginated by the backend), record income and expenses, open a transaction, correct it, and reverse it. Transfers have their own section ([../transfers/overview.md](../transfers/overview.md)); their transactions are listed here but stay read-only.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, key files, domain rules (this file) |
| [api.md](api.md) | Endpoints, payloads, pagination, filters, response parsing, error codes |
| [idempotency.md](idempotency.md) | How `Idempotency-Key` values are created, reused and retired |
| [correction-and-reversal.md](correction-and-reversal.md) | Correction by reversal (new id), reverse, statuses, transfers |
| [implementation.md](implementation.md) | Pages, components, state after mutations, money, errors, i18n/RTL |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.FINANCIAL_OPERATIONS` | `/dashboard/financial-operations` | `src/features/Dashboards/User/FinancialOperations/FinancialOperations.jsx` (new operation form + transactions list) |
| `PATH.USER.TRANSACTION_DETAILS` | `/dashboard/financial-operations/:transactionId` | `src/features/Dashboards/User/TransactionDetails/TransactionDetails.jsx` |

- Build detail links with `getTransactionDetailsPath(id)`. The details route is nested under the list path, so the sidebar's "Financial operations" item stays highlighted.
- `getNewOperationPath(type)` (`?new=income|expense`) opens the page with the form on that type; the Dashboard hero's Income / Expense buttons use it. `?new=transfer` redirects to the transfers form, so older links still work.
- List filters, sort and page live in the URL query (`type`, `account_id`, `category_id`, `status`, `date_from`, `date_to`, `sort`, `page`), so the details page's back link and the browser's back button return to the same view.

## Flow

```
Financial operations
 ├─ New operation: Expense | Income ── POST (Idempotency-Key) ──▶ list + balances refetched
 └─ Transactions list (GET /transactions, paginated, filtered)
     ├─ Reverse (row action, reason) ── POST …/reverse ──▶ list refetched
     └─ click a row ──▶ Transaction details (GET /transactions/{id})
                         ├─ Correct (reason) ── PATCH (Idempotency-Key) ──▶ navigate to the NEW id
                         └─ Reverse (reason) ── POST …/reverse ──▶ shown as reversed
```

## Domain rules the UI respects

- **The backend ledger is the source of truth.** Balances are never calculated or adjusted on the client; after any money movement, the list and the accounts (for the balances in the form) are refetched.
- **A posted transaction is never edited in place.** "Correct" calls `PATCH`, which reverses the original and posts a replacement with a **new id**. The UI moves to the replacement. See [correction-and-reversal.md](correction-and-reversal.md).
- **There is no delete.** Cancelling is a reversal, with a required reason. Nothing is described as deletion.
- **Reversed transactions stay in the history.** The list never hides them unless the user filters by another status.
- **Only posted income/expense transactions** that are not reversal entries and not part of a transfer can be corrected or reversed.
- **Income category is optional, expense category is required**, and each form only offers categories of the matching type (active ones, system categories included).
- **Every money-moving write carries an `Idempotency-Key`**, reused for retries of the same payload. See [idempotency.md](idempotency.md).

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/transactionsApi.js` | `list`, `get`, `createIncome`, `createExpense`, `correct` (PATCH), `reverse` |
| `src/features/Dashboards/User/FinancialOperations/transactionHelpers.js` | Eligibility rules, pagination parsing, URL filters, amount validation, idempotent attempts, error wording |
| `…/FinancialOperations/components/NewOperation/` | Add income / expense / transfer form |
| `…/FinancialOperations/components/Ledger/` | Paginated list with rows, badges, pagination |
| `…/FinancialOperations/components/TransactionFilters/` | Account, category, status, date range, sort |
| `…/FinancialOperations/components/TransactionStatusBadge/` | Status badge (list + details) |
| `…/FinancialOperations/components/CorrectTransactionForm/` | Correction modal |
| `…/FinancialOperations/components/ReverseTransactionDialog/` | Reverse confirmation |
| `src/locales/{en,ar}/*.json` → `dashboard.transactions.*`, `dashboard.financialOperations.*` | All copy |

Accounts and categories come from the existing `accountsApi` and `categoriesApi`; `transactionsApi` never duplicates them.
