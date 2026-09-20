# Reports — business rules

The backend owns every report calculation (Ledger, BalanceService, BudgetProgressService, SavingsGoalProgressService, and the recurring occurrences). The frontend displays those figures as sent. It never rebuilds a total, derives a change, or reinterprets a movement type.

## Multi-currency

- Amounts stay separated by currency. `summary_by_currency`, `*_by_currency` analytics, trend charts, comparisons, and rankings are rendered once per `currency_code`.
- ILS, USD, EUR, and other currencies are never added together, and no exchange rate is applied.
- "All currencies" means no `currency` query param. The backend still returns one row per currency, and the page shows one card or chart per currency.
- Readers only group rows by their own `currency_code`. Grouping never sums anything.
- Money without a known currency is shown as a plain number, never with an assumed `ILS`.

## Money precision

- The backend sends money as decimal strings (`"620.0000"`, `"-1620.0000"`). They are kept as strings in state and passed to `formatMoney` for display.
- Signs (the red and green tone) are read from the string, not from a float.
- `Number()` is used only for rendering: chart coordinates and bar widths. Those numbers are never stored, summed, or shown as figures; tooltips show the formatted backend string.

## Per-report rules

| Report | Rule shown in the UI and followed in code |
|---|---|
| Income & Expense | Transfers, savings movements, and debt principal are excluded from income and expense. The page never adds them in. |
| Cash Flow | Movements are split into operating, transfer, savings, and debt buckets. Internal transfers net to zero overall, and a reversal cancels the original effect in its period. Cash flow is not reinterpreted as income or expense. |
| Accounts | The opening balance is account metadata and is not counted as period inflow. `current_balance` comes from BalanceService and is never calculated. |
| Categories | Totals are ledger-backed: refunds reduce expense and reversals cancel the original impact. That logic is not reproduced in the frontend. |
| Transfers | Transfer principal is kept separate from fees and is never income or expense. Internal legs net to zero; a reversal cancels the original ledger impact. |
| Budgets | Only posted expenses consume a budget; transfers and reversed expenses don't. `progress_percentage`, `progress_status`, `spent`, and `remaining` are shown exactly as sent; a progress bar only clamps its width (130% still reads "130%"). |
| Savings Goals | Contributions and withdrawals are savings movements, not income or expense. Funding comes from SavingsGoalProgressService. |
| Debts | Payable and receivable are kept in separate groups. Principal and settlements are debt movements, not income or expense. |
| Recurring | Templates are forecasts only ("Forecast" badge on expected amounts). Actual figures come from occurrences, and only posted occurrences are real ledger transactions. The `actual_source` and `templates_are_forecast_only` flags are shown when sent. |
| Overview | Uses `GET /reports/overview` directly. It is never assembled from other report calls, and it has no fake pagination. |

## Comparison and trends

- The comparison shows the backend's `comparison_by_currency` values: current, previous, change, and change %.
- When only `previous_summary_by_currency` is present, the current and previous values are shown side by side and no change is computed.
- A change is shown with neutral styling, because whether a rise is good depends on the metric.
- Trend series are the money fields of each `trend_by_currency` bucket, as sent. Count and percentage fields are not plotted on the money axis.

## Periods

- `data.period` is the source of truth. The period bar shows `date_from` and `date_to`, `timezone`, and the previous period, even if they differ from the requested range.
- The UI never sends a range where `from` is after `to`, or an invalid or incomplete date.
