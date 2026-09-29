# Reports — API

Source: the Sprint 6 Frontend API documentation. All calls go through `apiRequest` in `src/features/Dashboards/User/api/apiClient.js`, wrapped by `src/features/Dashboards/User/api/reportsApi.js`. `VITE_API_BASE_URL` already ends in `/api`, so endpoints are written as `/reports/...`. Every request is authenticated with the Bearer token and sends `Accept-Language`.

## Endpoints

| Report (`data.report`) | Endpoint | `reportsApi` function |
|---|---|---|
| `overview` | `GET /reports/overview` | `getOverviewReport` |
| `income-expense` | `GET /reports/income-expense` | `getIncomeExpenseReport` |
| `cash-flow` | `GET /reports/cash-flow` | `getCashFlowReport` |
| `accounts` | `GET /reports/accounts` | `getAccountsReport` |
| `categories` | `GET /reports/categories` | `getCategoriesReport` |
| `transfers` | `GET /reports/transfers` | `getTransfersReport` |
| `budgets` | `GET /reports/budgets` | `getBudgetsReport` |
| `savings-goals` | `GET /reports/savings-goals` | `getSavingsGoalsReport` |
| `debts` | `GET /reports/debts` | `getDebtsReport` |
| `recurring` | `GET /reports/recurring` | `getRecurringReport` |

Each function is `(query, { signal })`. The shared `getReport(reportName, query, options)` does the call; it throws for an unknown report name.

## Query

Only these keys are sent (`REPORT_QUERY_KEYS`, enforced with `pickQuery`):

| Key | Value | Notes |
|---|---|---|
| `from` | `YYYY-MM-DD` | Required by the UI; never sent after `to`. |
| `to` | `YYYY-MM-DD` | |
| `currency` | ISO code | Omitted for "All currencies". Each currency still comes back as its own row. |
| `group_by` | `day` \| `week` \| `month` | Bucket size of `trend_by_currency`. Default `month`. |
| `per_page` | `10` \| `20` \| `50` | List reports only. Default `10`. Not sent for Overview. |
| `page` | integer > 1 | Page of `items` (`data.pagination.current_page`). Not sent for page 1 or for Overview. |

Example: `GET /reports/income-expense?from=2026-08-01&to=2026-08-31&currency=USD&group_by=month&per_page=10`

Not sent, on purpose:
- Filters that only appear in the echoed `data.filters` (`account_id`, `category_id`, `type`, `status`, …). They are not confirmed as request filters.
- `workspace_id`. The backend scopes reports by the token.

`page` is not in the documented examples. It is the standard parameter behind the documented `pagination.current_page`, and without it pagination can't work. If the backend rejects it, remove it from `REPORT_QUERY_KEYS`.

## Response envelope

```json
{
  "status": true,
  "message": "...",
  "data": {
    "report": "income-expense",
    "period": { "preset": "custom", "timezone": "Asia/Gaza", "date_from": "2026-08-01", "date_to": "2026-08-31", "starts_at": "...", "ends_at": "..." },
    "filters": { "currency": "USD", "group_by": "month" },
    "summary_by_currency": [ { "currency_code": "USD", "...": "..." } ],
    "analytics": { "...": "..." },
    "items": [],
    "pagination": { "current_page": 1, "per_page": 10, "total": 2, "last_page": 1, "from": 1, "to": 2, "has_more_pages": false }
  }
}
```

`parseReport` keeps this shape: `{ report, period, filters, summary, analytics, items, pagination }`. `summary` is `summary_by_currency` as rows (an object keyed by currency code is also accepted). `pagination` is normalized, or `null` when the backend didn't send a pagination object.

## Per-report fields

Money is always a decimal string (`"620.0000"`, `"-1620.0000"`); counts are integers.

### Overview
- `summary_by_currency`: `total_income`, `total_expense`, `net_income`, `total_inflow`, `total_outflow`, `net_cash_flow`, `transfer_in`, `transfer_out`, `net_internal_transfer_effect`, `current_account_balance`, `budgets_total`, `budgets_spent`, `savings_target`, `savings_saved`, `payable_outstanding`, `receivable_outstanding`, `recurring_expected_income`, `recurring_expected_expense`.
- `analytics`: `previous_period`, `previous_summary_by_currency`, `comparison_by_currency`, `trend_by_currency`, `top_expense_categories`, `top_income_categories`, `top_transactions`, `recent_high_value_transactions`, `budget_status_distribution`, `savings_progress_summary`, `debt_summary`, `recurring_forecast`.
- `items: []` and `pagination: []`. There is no item pagination.

### Income & Expense
- `analytics`: `previous_period`, `previous_summary_by_currency`, `comparison_by_currency`, `trend_by_currency`, `categories_by_currency`, `top_transactions`, `average_expense_by_currency`.

### Cash Flow, Categories, Transfers
- `analytics`: `previous_period`, `previous_summary_by_currency`, `comparison_by_currency`, `trend_by_currency`.

### Accounts
- Summary: `currency_code`, `total_opening_balance`, `total_inflow`, `total_outflow`, `total_net_change`, `total_current_balance`, `accounts_count`.
- Items: `account_id`, `name`, `type`, `currency_code`, `opening_balance`, `inflow`, `outflow`, `net_change`, `current_balance`, `transaction_count`, `latest_transaction_at`, `status`, `is_archived`.

### Budgets
- Summary: `currency_code`, `budgets_count`, `total_budget`, `total_spent`, `total_remaining`.
- Analytics: `status_distribution` (e.g. `safe`, `warning`), `utilization_by_currency`, `previous_period`, `previous_summary_by_currency`, `comparison_by_currency`.
- Items: `budget_id`, `name`, `currency_code`, `category`, `scope`, `amount_limit`, `spent`, `remaining`, `progress_percentage`, `progress_status`, `expense_count`, `period_start`, `period_end`, `status`, `is_archived`.

### Savings Goals
- Summary: `currency_code`, `goals_count`, `total_target`, `total_saved`, `total_remaining`, `period_contributions`, `period_withdrawals`, `period_net_movement`.
- Analytics: `status_distribution`, `previous_period`, `comparison_by_currency`.
- Items: `savings_goal_id`, `name`, `currency_code`, `target_amount`, `saved_amount`, `current_amount`, `remaining_amount`, `progress_percentage`, `progress_status`, `status`, `target_date`, `account`, `period_contributions`, `period_withdrawals`, `period_net_movement`, `latest_movement_at`, `is_archived`.

### Debts
- Summary: `currency_code`, `payable_original`, `payable_outstanding`, `receivable_original`, `receivable_outstanding`, `debt_received`, `debt_given`, `payments`, `collections`, `debts_count`.
- Analytics: `current_outstanding_by_currency` (`payable`, `receivable`, `active_debts_count`, `overdue_debts_count`, `net_position`), `direction_distribution`, `previous_period`, `comparison_by_currency`.
- Items: `debt_id`, `direction`, `counterparty_name`, `currency_code`, `original_principal`, `outstanding_amount`, `amount_paid_or_collected`, `status`, `effective_status`, `opened_at`, `due_date`, `latest_payment_at`, `payment_count`, `period_movement_count`, `period_movement_total`, `opening_transaction_id`, `is_archived`.

### Recurring
- Summary: `currency_code`, `active_templates`, `paused_templates`, `completed_templates`, `archived_templates`, `expected_income`, `expected_expense`, `posted_occurrences`, `skipped_occurrences`, `failed_occurrences`, `upcoming_occurrences`.
- Analytics: `forecast_by_currency`, `actual_source` (`"posted_occurrences"`), `templates_are_forecast_only` (`true`).
- Items: `recurring_transaction_id`, `name`, `description`, `type`, `amount`, `currency_code`, `status`, `frequency`, `interval`, `next_run_at`, `last_run_at`, `expected_next_occurrence`, `occurrence_counts` (`posted`, `skipped`, `failed`, `scheduled`, `due`, `cancelled`), `account`, `category`.

The contract doesn't fix the inner shape of some analytics (trend points, comparison entries, category and transaction lists) or of the items for income-expense, cash-flow, categories, and transfers. The readers in `reportHelpers.js` accept the plausible shapes listed in [implementation.md](implementation.md#tolerant-parsing), and anything else is still rendered generically.

## Pagination

List reports return `data.pagination` with `current_page`, `per_page`, `total`, `last_page`, `from`, `to`, and `has_more_pages`. There is no Laravel `links` array. `parsePagination` maps it to `{ page, perPage, total, lastPage, from, to, hasMore }`. The next-page button uses `has_more_pages` when it is sent.

Overview returns `pagination: []`. `parsePagination` returns `null` for it, and the page never renders the items table or the pagination footer for Overview.

## Errors

Errors are `ApiError`s from `apiRequest`; `getReportErrorMessage(error, t)` maps them to messages:

| Status / code | Shown |
|---|---|
| 401 `UNAUTHENTICATED` | `apiRequest` clears the session and fires `smartspend:session-expired`; `AuthProvider` logs the user out. |
| 403 `FORBIDDEN` | `dashboard.reports.errors.forbidden` (no access to the report or workspace). |
| 404 `NOT_FOUND` | `dashboard.reports.errors.notFound` (report not available). |
| 422 `VALIDATION_ERROR` | The backend's localized message plus each field message, with a "Reset filters" button. |
| 429 `RATE_LIMITED`, network, timeout, 5xx, malformed | `getApiErrorMessage`. |

Every error state has a Retry button.
