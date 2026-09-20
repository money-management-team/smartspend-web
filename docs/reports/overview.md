# Reports — overview

The Reports page (`/dashboard/reports`, `PATH.USER.REPORTS`) shows the Sprint 6 read-only financial reports. Every figure is calculated by the backend; the frontend only displays it. The page sits under `RequireAuth` → `DashboardLayout` and the sidebar already links to it.

The old placeholder "Export PDF / Export Excel" buttons, which only logged to the console, were removed. The header now carries a real **Export CSV** button and a link to the export history — see [../report-exports/overview.md](../report-exports/overview.md). Statement imports are a separate feature: [../imports/overview.md](../imports/overview.md).

## Reports

One page with a tab per report. Each tab calls exactly one endpoint:

| Tab | Endpoint | What it shows |
|---|---|---|
| Overview | `GET /reports/overview` | Dashboard-ready totals (income, cash flow, transfers, balances, budgets, savings, debts, recurring forecast) plus top categories and transactions. No item list. |
| Income & Expense | `GET /reports/income-expense` | Income, expense, and net, compared with the previous period, with trend, top categories, top transactions, and average expense. |
| Cash Flow | `GET /reports/cash-flow` | Inflow and outflow split into operating, transfer, savings, and debt buckets. |
| Accounts | `GET /reports/accounts` | Per-account inflow, outflow, net change, and current balance. |
| Categories | `GET /reports/categories` | Ledger totals per category. |
| Transfers | `GET /reports/transfers` | Transfers, with principal kept separate from fees. |
| Budgets | `GET /reports/budgets` | Budget usage, status distribution, and utilization. |
| Savings Goals | `GET /reports/savings-goals` | Goal funding and the period's contributions and withdrawals. |
| Debts | `GET /reports/debts` | Payable and receivable, kept separate, with current outstanding. |
| Recurring | `GET /reports/recurring` | Templates as a forecast next to the posted, skipped, and failed occurrences. |

## Page layout

1. Header and report tabs.
2. Filter bar: quick periods, date from and to, currency (or all currencies), group by (day, week, or month), and per page (list reports only). See [implementation.md](implementation.md#filters).
3. Period bar: the period the backend used, the previous period, the time zone, the applied currency and grouping, and the report's financial rule.
4. Summary: one card per currency from `summary_by_currency`.
5. Analytics: a trend chart per currency, the previous-period comparison, and the report-specific sections.
6. Items table and pagination, for every report except Overview.

## Related docs

- [api.md](api.md): endpoints, query, response envelope, per-report fields, pagination, errors.
- [business-rules.md](business-rules.md): financial semantics per report, multi-currency, money precision.
- [implementation.md](implementation.md): files, state and URL, parsing, rendering, i18n/RTL, verification.
