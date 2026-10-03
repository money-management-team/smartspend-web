# Dashboard — API

`VITE_API_BASE_URL` already ends with `/api`, so endpoints are relative (`/dashboard`, never `/api/dashboard`). Requests go through `apiRequest()` in `src/features/Dashboards/User/api/apiClient.js` (Bearer token, `Accept-Language`, envelope checks, `ApiError`).

## `GET /dashboard` — `dashboardApi.get(query, { signal })`

Read-only. Nothing here moves money.

### Query

| Param | Values | Sent when |
| --- | --- | --- |
| `period` | `today`, `week`, `month`, `quarter`, `year`, `all`, `custom` | Always (default `month`) |
| `date_from`, `date_to` | `YYYY-MM-DD` | Only with `period=custom`; both required, `date_to` ≥ `date_from` (checked before sending) |
| `workspace_id` | session workspace id | When a workspace is stored; otherwise the backend aggregates every workspace the user can access |

Built by `dashboardFiltersToQuery()` in `Dashboard/dashboardHelpers.js`.

### Response (`data`) and how it is used

| Key | Used for |
| --- | --- |
| `period` (`preset`, `date_from`, `date_to`, `timezone`) | Period label and range; `timezone` is stored with the workspace |
| `scope` (`workspace_id` / `workspace_ids`, `is_multi_currency`, `primary_currency_code`) | Remember the workspace when the scope names exactly one; multi-currency switch; primary currency |
| `totals` (`currency_code`, `accounts_count`, `active_accounts_count`, `opening_balance`, `current_balance`, `income`, `expense`, `net`, `adjustments`, `savings_rate`) | Hero, summary cards, cash flow, statistics — shown as sent |
| `summary_by_currency[]` (`currency_code`, `accounts_count`, `current_balance`, `income`, `expense`, `net`) | Per-currency table when multi-currency |
| `accounts[]` | "Where your money is" |
| `breakdown.by_category[]` (`category_id`, `name`, `type`, `total`, `currency_code?`, `color?`) | Expense categories (`by_type` is not rendered: income/expense already come from `totals`) |
| `transfers` (`count` / `transfers_count` / `total_count`, `total_amount` / `amount` / `total`, `currency_code`) | Transfers statistic — read defensively by `getTransfersSummary()` |
| `planning.budgets` / `planning.savings_goals` (`items[]` or an array) | Budget and goal widgets |
| `commitments.recurring` (counts such as `active_count`, `due_count`, `overdue_count`, `upcoming_count`, `paused_count`; rows in `items[]` / `upcoming[]` / an array) | Recurring commitments widget |
| `commitments.debts` | Not used |
| `recent_transactions[]` | Recent transactions |

Blocks are read defensively (`getBlockItems`, `getBlockCounts`): a missing or differently shaped block renders its empty state instead of breaking the page. Missing amounts show "—", never 0.

### Errors

Handled by `getApiErrorMessage` with a "Try again" button: network, timeout, 403, 404, 422, 429 (retry-after seconds) and 5xx. 401 goes through the session-expired flow. An envelope without `data` is treated as `MALFORMED_RESPONSE`.

## `GET /financial-alerts`

See [financial-alerts.md](financial-alerts.md). Note the workspace param is **`id_workspace`**, not `workspace_id`.
