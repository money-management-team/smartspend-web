# Dashboard — Implementation

## Files

| Path | Role |
| --- | --- |
| `Dashboard/Dashboard.jsx` | Page: period in the URL, one keyed `GET /dashboard`, sections |
| `Dashboard/dashboardHelpers.js` | Periods, custom-range validation, URL ↔ filters ↔ query, scope workspace, multi-currency helpers, transfers summary, defensive block readers, `formatOptionalMoney`, `getPeriodLabel` |
| `Dashboard/components/DashboardPeriodFilter/` | Period chips + custom range form |
| `Dashboard/components/DashboardHero/` | Period, welcome, total balance, quick actions |
| `Dashboard/components/CurrencySummary/` | Per-currency table (multi-currency only) |
| `Dashboard/components/SummaryCards/` | Income / Expenses / Net |
| `Dashboard/components/MoneyDistribution/` | Accounts by type + currency |
| `Dashboard/components/GeneralStats/` | Savings rate, active accounts, transfers, adjustments |
| `Dashboard/components/CashFlowChart/` | Income vs expense bars + exact figures |
| `Dashboard/components/ExpenseCategories/` | Expense pie (primary currency) + legend |
| `Dashboard/components/BudgetProgress/`, `SavingsGoals/` | Planning widgets |
| `Dashboard/components/RecurringCommitments/` | `commitments.recurring` |
| `Dashboard/components/RecentTransactions/` | Latest transactions |
| `Dashboard/components/FinancialAlerts/` | See [financial-alerts.md](financial-alerts.md) |
| `api/dashboardApi.js`, `api/financialAlertsApi.js` | Requests |

## Loading and the period

- `readDashboardFilters(searchParams)` → `{ period, date_from, date_to }`. An unknown period, or `custom` without a valid range, falls back to `month`, so a bad URL never reaches the backend.
- The request key is the filters' search string plus a retry counter. A result stores the key that produced it; the page is loading while the keys differ. This follows the dashboard pattern (AbortController, `AbortError` ignored) without setting state synchronously inside the effect.
- **One request per change.** Presets apply on click; choosing a preset that is already active does nothing. "Custom period" only opens the date form — nothing is sent until **Apply**, and only if the range is valid (`getCustomRangeError`: both dates, `date_to` ≥ `date_from`) and different from the current one.
- **While another period loads**, the previous figures stay on screen, dimmed and non-interactive, with an "Updating…" pill (`aria-busy`). The first load shows `Loading`. An error replaces the content with the message and "Try again".
- The filter component is keyed by the filter string, so it resets its draft when the URL changes (back/forward).

## Workspace

When the response's scope names exactly one workspace (`scope.workspace_id`, or a single `workspace_ids` entry), it is stored via `updateWorkspace` together with `primary_currency_code` and `period.timezone`. With several workspaces the stored one is left untouched. The request sends `workspace_id` only when one is stored.

## Rules enforced by the UI

- **No recalculation.** Amounts are the backend's decimal strings passed to `formatMoney`; the only numeric conversions are for chart geometry (bar heights, pie slices, relative account bars), never for a displayed figure. The old per-type account sums (`sumMoney`) and the float "average daily spend" were removed.
- **Transfers are not income or expense.** They only appear in `GeneralStats` (count + amount from `data.transfers`) with an explicit note; recent transfers are shown without a sign.
- **Multi-currency.** `isMultiCurrency(data)` is true when `scope.is_multi_currency` is set or `summary_by_currency` has several rows. Then the hero says which currency the total is in, the per-currency table is shown, and the expense pie only includes rows in the primary currency (`scope.primary_currency_code`); other rows are listed with their own currency and a note.
- **Missing data** renders "—" or the section's empty state.

## Removed fake data

- Static translation values: `hero.month` ("August 2026"), `hero.title`, `hero.balance`, `summary.*.amount/change`, the `money.*` sample accounts and amounts, `stats.*.value`, `cashFlow.subtitle` ("Last 8 months"), `expenseCategories.values`, `categories`, `budgetProgress.values`, `upcomingBills`, `recentTransactions.items`, `aiInsights`, `months`.
- Frontend-computed figures: per-type balance totals, group totals, average daily spend, the top category and a transaction count taken from the recent list.

## i18n and RTL

Copy lives in `dashboard.user.*` (period, hero, summary, currencies, money, stats, cashFlow, expenseCategories, commitments, recentTransactions, states) and `dashboard.financialAlerts.*`, with exact EN/AR key parity. Plurals use `_one` / `_other` in both files, like the rest of the project.

Amounts and dates are wrapped in `<bdi>`, backend texts use `dir="auto"`, charts render `dir="ltr"`, and new CSS uses logical properties (`border-inline-start`, `margin-inline-start`, `text-align: start`).

## Verification

- ESLint on the changed files: clean. `npm run build`: passes.
- The E2E smoke test (happy-dom, real pages through Vite, stateful fake backend) covered one request per period change, custom range validation, no alert refetch on period change, backend totals, the per-currency table, transfers kept separate, links, error + retry, and the Notifications page (no read state, refresh refetches). It passed in English and Arabic, together with the recurring flows.
- On staging, `GET /dashboard` and `GET /financial-alerts` return `401` without a token, which confirms the routes; authenticated data still needs a manual pass with a real account.
