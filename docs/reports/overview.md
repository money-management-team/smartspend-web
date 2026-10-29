# Reports — overview

The Reports page (`/dashboard/reports`, `PATH.USER.REPORTS`) shows the Sprint 6 read-only financial reports. Every figure is calculated by the backend; the frontend only displays it. The page sits under `RequireAuth` → `DashboardLayout` and the sidebar already links to it.

The old placeholder "Export PDF / Export Excel" buttons, which only logged to the console, were removed. The header now carries a real **Export report** button (CSV, Excel or PDF) and a link to the export history — see [../report-exports/overview.md](../report-exports/overview.md). PDF is built in the browser with the Smart Spend document design — see [pdf-export.md](pdf-export.md).

## Reports

One page with a switcher entry per report. Each report calls exactly one endpoint:

| Report | Endpoint | What it shows |
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

Redesigned 2026-09-29 so the numbers come first and nothing is shown twice.

1. **Header** (dark identity band, like the other finance pages): "Reports" eyebrow, the selected report's icon, name and description, the requested period, and the Export history / Export report actions.
2. **Report selector**: a grouped native dropdown on every screen, with all ten reports under Performance, Balances & movements, and Planning.
3. **Simple filters**: period and currency alongside the report dropdown. Select Custom period to edit dates; grouping and list page size are under More options. Presets apply immediately; other edits use Apply. Saved filters remain available under the expandable tools area.
4. **Context bar**: one quiet line with the period the backend used, the previous period, the time zone, the applied currency and grouping, then the report's financial rule.
5. **Key figures**: KPI tiles per currency (the definition's `highlights`), each with the backend's change vs the previous period when the comparison has it.
6. **Analytics**: trend chart per currency, previous-period comparison and the report-specific sections (two columns when the report column is at least 720px wide).
7. **All figures (expandable)**: every `summary_by_currency` field, one card per currency, groups tiled in a grid.
8. **Items table** and pagination, for every report except Overview.

## Related docs

- [api.md](api.md): endpoints, query, response envelope, per-report fields, pagination, errors.
- [business-rules.md](business-rules.md): financial semantics per report, multi-currency, money precision.
- [implementation.md](implementation.md): files, state and URL, parsing, rendering, i18n/RTL, verification.

Responsive tables (2026-10-05): comparison and item rows keep their existing cells, values and links, with explicit table/row/cell roles. Below 720px of report-content width the rows render as labelled cards; desktop retains the original table view.
