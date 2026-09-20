# Reports — implementation

## Files

```
src/features/Dashboards/User/
├── api/reportsApi.js                 # endpoints, allowed query keys, getReport + domain functions
└── Reports/
    ├── Reports.jsx / .css            # page: URL state, fetching, states, layout
    ├── reportHelpers.js              # filters/URL, dates, tolerant readers, formatting, errors
    ├── reportDefinitions.js          # per-report summary groups, notes, analytics sections, columns
    └── components/
        ├── ReportsHeader/            # title + subtitle
        ├── ReportTabs/               # one button per report
        ├── ReportFilters/            # filter bar (draft → apply)
        ├── ReportPeriod/             # backend period, previous period, filters echo, rule note
        ├── ReportSummary/            # summary_by_currency cards
        ├── ReportAnalytics/          # orchestrates analytics sections
        ├── ReportTrendChart/         # trend_by_currency (recharts), one chart per currency
        ├── ReportComparison/         # current vs previous per currency
        ├── ReportDistribution/       # status / direction counts
        ├── ReportRankedList/         # category rankings
        ├── ReportTransactions/       # top / high-value transactions
        ├── ReportMetrics/            # generic shape-aware renderer (cards / distribution / table)
        ├── ReportItemsTable/         # items with report-specific columns
        ├── ReportPagination/         # data.pagination footer
        ├── ReportSection/            # card shell
        ├── ReportBadge/              # status/type/direction badge
        └── ReportValue/              # typed value formatting (money, count, percent, dates)
```

The previous Reports page built its numbers from 9 parallel `GET /dashboard` calls. It converted money to floats, hard-coded `ILS`, and was limited to "last 8 months". It was replaced; `ReportsSummary`, `MonthlyReportChart`, and `ExpenseCategoriesTable` were removed.

## State and URL

All filters live in the query string: `?report=…&from=…&to=…&currency=…&group_by=…&per_page=…&page=…`.

- `readReportFilters` validates each value and falls back to a default when a value is invalid: `overview`, the current month in the workspace time zone, all currencies, `month`, `10`, page 1. An incomplete or reversed range from the URL is never sent.
- Switching tabs keeps the dates, currency, and grouping, and resets to page 1. Report links are shareable.
- The time zone comes from the stored workspace (`getStoredWorkspace().timezone`, cached by `resolveWorkspaceId`); without it, the browser's zone is used. It only affects the default and preset ranges.

## Fetching

This follows the dashboard pattern with a request key, like `Debts.jsx`:

- `requestKey = filters-string + reload counter`. The effect aborts the previous request, calls `getReport(report, reportFiltersToQuery(filters), { signal })`, and stores `{ key, data, error }`.
- While `result.key !== requestKey`, the page shows `Loading`, and the previous report's numbers are hidden. A slow response for an old tab or old filters can't replace the new one, because it is aborted and its key no longer matches.
- `parseReport` returning `null` becomes a `MALFORMED_RESPONSE` error.
- Retry bumps the reload counter.

## Filters

`ReportFilters` keeps a draft (dates, currency, group by, per page). Apply validates it with `validateDateRange` (`fromRequired`, `toRequired`, `invalidDate`, `fromAfterTo`) and writes the URL. Quick periods apply at once: this month, last month, last 3 months, this year. The component is remounted with `key={filterKey}`, so the draft always reflects the applied URL (no state syncing in effects). Currency options are the account currencies, the workspace base currency, the selected currency, and any currency present in the loaded summary. "Per page" is hidden for Overview.

## Rendering

`reportDefinitions.js` describes each report on top of the shared components:

- `summary`: ordered field groups (e.g. Debts: Payable / Receivable / Period movements; Recurring: Templates / Expected (forecast) / Occurrences; Overview: eight domain groups). Fields the backend sends that aren't listed are still shown under "Other figures", and nested objects (such as cash-flow buckets) become their own group.
- `notes`: the financial rule shown under the period bar.
- `analytics`: report-specific sections by `analytics` key and kind: `ranked`, `transactions`, `distribution`, `metrics`, or `generic`. Trend, comparison, and the recurring flags are handled for every report. Any other non-empty analytics key is still rendered with `ReportMetrics`, titled by its field label.
- `columns`: the items table. Each column lists candidate keys (dot paths) and a type: `money`, `count`, `percent`, `date`, `datetime`, `status`, `enum`, `currency`, `progress`, `range`, `occurrences`, or `frequency`. A column shows only when a row has a value. The primary column links to the row's details page (`getBudgetDetailsPath`, `getDebtDetailsPath`, …) and shows an "Archived" badge for `is_archived`. If no documented column matches, the rows' own scalar fields are shown instead of an empty table.

Money cells use each row's own `currency_code` (then `account.currency_code`, then the filter's currency). They never fall back to an assumed currency.

## Tolerant parsing

The contract fixes the top-level shape; some inner shapes are not documented. The readers in `reportHelpers.js` reshape without calculating:

- `toCurrencyRows`: an array of rows, a single row, or an object keyed by currency code.
- `parseTrend`: rows with a point list (`points`, `series`, `data`, …), flat points that each carry `currency_code`, or an object keyed by currency. The label key is `label`, `period`, `bucket`, `date`, and so on. Series are the money fields; one nesting level is flattened (`operating.inflow`). At most 6 series are drawn per chart.
- `parseComparison`: per-metric objects (`current`, `previous`, `change`, `change_percentage`, …), flat `*_change` / `*_change_percentage` keys, or only `previous_summary_by_currency`.
- `parseRankedGroups` / `toRankedRow`: lists under each currency row (`categories`, `expense`, `income`, …), flat rows grouped by currency, or objects keyed by currency.
- `parseTransactions` / `toTransactionRow`: arrays, `{ transactions: [] }`, or lists per currency.
- `parseDistribution`: `{ safe: 1, warning: 1 }`, `[{ status, count }]` (optionally per currency), or per-currency maps. Objects of money are never mistaken for a distribution.

Unknown fields get a readable label from their key (`getFieldLabel` checks `i18n.exists` first, so no missing-key warning is logged). Unknown enum values get the same fallback through `getValueLabel`.

## States

| State | Where |
|---|---|
| Loading | `Loading` with "Loading report..." while the request key doesn't match. |
| Error | "Failed to load report", the mapped message, 422 field messages, Retry, and "Reset filters" on 422. |
| No data | The period bar, then "No report data" when the summary, items, and analytics are all empty. |
| Empty summary | "No totals for this period." inside the summary section. |
| Empty analytics | "No analytics for this period." |
| Empty items | "No rows for this period."; on a page past the end, "This page is empty" with a first-page button. |

## i18n and RTL

- All strings are under `dashboard.reports.*` in `en.json` and `ar.json`, in exact key parity. Groups: `names`, `descriptions`, `itemsTitle`, `notes`, `filters`, `period`, `sections`, `summaryGroups`, `comparison`, `flags`, `states`, `errors`, `fields` (backend field labels), and `values` (statuses, types, directions, scopes, frequencies, buckets).
- Numbers and amounts are isolated with `<bdi dir="ltr">`. Dates and user text use a plain `<bdi>`.
- Charts render in a `dir="ltr"` box, as on the dashboard. Pagination chevrons are mirrored in RTL. Layout uses logical properties (`inline-size`, `padding-inline`, `text-align: start`).
- The tab bar scrolls horizontally on narrow screens. Transitions honor `prefers-reduced-motion`.

## Verification

Done while implementing (no test framework is configured, so the harnesses were throwaway scripts):

- Contract harness: the real `apiRequest`, `reportsApi`, and `reportHelpers` against a mocked `fetch`, 46 checks. It covered:
  - the URL and query for all 10 endpoints (`/api/reports/<name>`, never `/api/api`), the Bearer header, no `workspace_id`, no undocumented filters, and no `per_page`/`page` for Overview;
  - date validation and presets;
  - pagination parsing, and `pagination: []` → `null`;
  - multi-currency rows and money strings;
  - every analytics reader;
  - 401, 403, 404, 422, 429, and 500 mapping, and 401 clearing the session.
- Render harness (Vite SSR): every report rendered in English and Arabic with documented payloads. It checked that no `[object Object]`, `NaN`, or raw key is printed, that no missing-translation warning fires, that detail links are present, that Overview has no pagination, that two currencies give two cards, and that the empty states render.

At the time of writing, the backend at `VITE_API_BASE_URL` answered `404` for every `/reports/*` path (while e.g. `/dashboard` answered `401`), so the Sprint 6 routes were not deployed there yet. The page shows "This report isn't available" for that 404. Check the live responses against the tolerant readers once the routes are deployed.
