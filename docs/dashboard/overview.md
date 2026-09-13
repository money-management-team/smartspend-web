# Dashboard — Overview

The dashboard (`/dashboard`) is the authenticated user's home page. It is **read-only**: every figure comes from `GET /dashboard`, computed by the backend for the selected period, and the frontend never sums, converts or recalculates balances, income, expense, net, savings rate or progress.

The page also has a compact **Financial Alerts** section, fetched separately from `GET /financial-alerts` (see [financial-alerts.md](financial-alerts.md)).

## Sections

| Section | Source | Notes |
| --- | --- | --- |
| Period filter | URL (`?period=`, `?date_from=&date_to=`) | Today, week, month (default), quarter, year, all time, custom range; shows the range the backend used |
| Hero | `period`, `totals.current_balance`, `totals.currency_code` | Period label + dates; "Total balance in {currency}" when multi-currency |
| Summary by currency | `summary_by_currency` | Shown only when `scope.is_multi_currency` (or more than one currency row). One row per currency, never added together |
| Income / Expenses / Net cards | `totals.income`, `totals.expense`, `totals.net` | Backend strings, formatted only |
| Where your money is | `accounts` | Accounts grouped by type + currency; each account's own balance; the group shows a count, not a sum |
| General statistics | `totals.savings_rate`, `totals.active_accounts_count` / `accounts_count`, `transfers`, `totals.adjustments` | Transfers are their own figure, with a note that they are not income or expense |
| Cash flow | `totals.income`, `totals.expense`, `totals.net` | Bar chart of the two totals for the period (the response has no time series) |
| Expense categories | `breakdown.by_category` (expense rows) | Chart only rows in the primary currency; rows in other currencies are listed with their own currency |
| Budget progress | `planning.budgets` | Links to budget details |
| Savings goals | `planning.savings_goals` | Links to goal details |
| Recurring commitments | `commitments.recurring` | Counts + upcoming rules, linked to the recurring details page |
| Recent transactions | `recent_transactions` | Links to transaction details; transfers are neutral (no sign) |
| Financial alerts (compact) | `GET /financial-alerts` | First 3 alerts, budget status counts, "View all" → Notifications page, Financial alerts tab |

`commitments.debts` is not rendered: the frontend has no debts feature yet.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Sections and sources (this file) |
| [api.md](api.md) | `GET /dashboard` query and response as used by the page |
| [financial-alerts.md](financial-alerts.md) | `GET /financial-alerts`, alerts vs notifications, compact / full views |
| [implementation.md](implementation.md) | Files, loading/period state, multi-currency and transfer rules, i18n/RTL, verification |

## Routes

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.DASHBOARD` | `/dashboard` | `src/features/Dashboards/User/Dashboard/Dashboard.jsx` |
| `PATH.USER.NOTIFICATIONS` | `/dashboard/notifications` | `src/features/Dashboards/User/Notifications/Notifications.jsx` (Notifications inbox tab + Financial alerts tab; see [../notifications/overview.md](../notifications/overview.md)) |

Both are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.
