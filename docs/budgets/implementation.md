# Budgets — Implementation

## Budgets list (`Budgets.jsx`)

- **Filters and page live in the URL** (`scope`, `category_id`, `owner`, `currency_code`, `status`, `progress_status`, `date_from`, `date_to`, `active_on`, `page`):
  - `readBudgetFilters` sanitizes them: unknown values are dropped, `category_id` is dropped with scope `general`, and an inverted range drops its end.
  - `budgetFiltersToQuery(filters, workspaceId)` builds the request: the session workspace, the period only when both dates are set, and `per_page: 20`.
  - Any change resets to page 1 and reads the live URL, as on the transactions and transfers pages.
- **Filter bar (`BudgetFilters`, rendered in the `BudgetList` panel under its header)**:
  - The main row has Scope, Category, Status (active/archived), Progress (safe/warning/near limit/exceeded) and Currency.
  - **More filters** reveals Period from / Period to, Active on, and Owner (all / only mine). It opens by itself while one of those is set, and the toggle is hidden then.
  - A hint appears while only one period date is chosen, and nothing extra is requested until the range is complete.
  - The Category select is disabled for scope General.
  - Clear filters appears while anything is set.
  - It reuses `TransactionFilters.css`; `BudgetFilters.css` only adds the action group and the hint.
- **Filter options**: expense categories come from one `categoriesApi.list({ workspace_id, type: "expense" })` call on the page, the same call as the form; a failure leaves "All categories". Currencies come from `getCurrencyOptions` (the usual list + the workspace base currency).
- **Workspace**: the session workspace id is sent as `workspace_id`. It is never hard-coded, and it is omitted when unknown.
- **Fetching:** one effect calls `budgetsApi.list(query)` with an `AbortController`.
  - The query is memoized by its serialized value (`queryKey`), so a URL change that doesn't change what is sent (the first date of a range) doesn't refetch.
  - The result is stored with its request key (`queryKey#reloadKey`), so there is no synchronous `setState` in the effect. The page is "loading" until the matching result arrives.
- **States** (in `BudgetList`):
  - `Loading` with `states.loading`;
  - error → `getBudgetErrorMessage` + "Try again" (+ "Clear filters" when filtered);
  - empty → `states.empty` + "New budget";
  - empty while filtered → `states.emptyFiltered` + "Clear filters";
  - an empty page past the first → `states.emptyPage` + "Go to the first page".
- **Back link**: the card's link passes the list's query in router state, and Budget details' back link returns to `/dashboard/budgets?<same filters>`.
- **Cards (`BudgetCard`):** name (a `Link` stretched over the card to the details page), scope and category name, badges (archived, progress status, period state when not current), `spent / limit`, the real percentage, the progress bar, remaining (danger color when negative) and the period. Edit and Archive icon buttons sit above the link and exist only for active budgets. Archived cards are dimmed.
- **Pagination:** shown when `lastPage > 1`; reuses the transactions pagination copy.

### Summary

`BudgetSummary` shows **counts** of the listed, non-archived budgets by backend status: active, on track (`safe`), need attention (`warning` + `near_limit`), exceeded. It does not total money: a general budget already includes the expenses of category budgets in the same period, and budgets can use different currencies. When the list has several pages, a hint says the counts cover the current page.

### State after each write

| Action | List update |
| --- | --- |
| Create | Refetch (the backend decides order/page); "created" notice with a "View budget" link |
| Edit | The card is replaced with the returned budget (its progress recalculated); refetch if the response has no budget/progress; "saved" notice |
| Edit 404 / 409 | Message in the form; the list is refetched |
| Archive | Refetch (whether archived budgets stay listed is the backend's choice); "archived" notice |
| Archive 404 / 409 (already archived) | Message in the dialog; the list is refetched |

## Budget details (`BudgetDetails.jsx`)

Route `PATH.USER.BUDGET_DETAILS`; it reads `budgetId` from `useParams` and calls `budgetsApi.get`, keyed by `budgetId:reloadKey`.

- **Header:** name, chips for scope, active/archived, and period state. Edit and Archive only while active.
- **Archived note:** "This budget is archived. Its history is kept, but it can't be edited or archived again."
- **Progress panel:** status badge + a one-line explanation of the status, the real percentage (large), the progress bar, and stats: spent, remaining, spending limit, expenses count, days remaining. **Refresh progress** calls `GET /budgets/{id}/progress` (abortable, one at a time, spinner honoring reduced motion) and merges the result with `withFreshProgress`; errors show inline, a 404 turns the page into "not available".
- **Details list:** name, scope, category (link to the category details; "Archived" when the category is inactive), spending limit, currency, period, status, archived on, notes (line breaks kept), created, last updated. Rows without a value are skipped.
- **Errors:** 404 → "Budget not available" without retry; 401 → session flow; 403 / 429 / network / timeout / server → the message and "Try again".
- **Edit:** the returned budget is merged in with `mergeBudget` (progress recalculated) and a "saved" notice appears.
- **Archive:** the page **stays** on the budget: the DELETE response is merged in, so it immediately shows as archived, the actions disappear and the notice says its history is kept. The last calculated progress stays visible (flagged `is_archived`).
- **409 while editing/archiving:** the message stays in the modal; closing it refetches the budget, so the page shows the archived state.

## Create / edit form (`BudgetForm`)

- One modal for create and edit, reusing the dashboard modal shell (`AccountForm.css`) and the textarea/error styles from `ReverseTransactionDialog.css`; `BudgetForm.css` only adds the scope cards, the read-only box, two-column rows and the note.
- **Create fields:** name, scope (radio cards General / Category, each with a one-line explanation), category select (only for Category), spending limit, currency, start/end date (defaults: the current month), notes.
- **Edit fields:** name, spending limit, start/end date, notes, pre-filled from the budget (`"800.0000"` → `800`). Scope, category and currency are shown read-only with the explanation that a new budget is needed to change them.
- **Client validation** (`validateBudgetForm`): name required/≤ 150, category required for a category budget, currency 3 letters, amount positive with ≤ 4 decimals, both dates, end ≥ start, notes ≤ 1000. Date inputs also get `min`/`max` from each other.
- **Payload:** create sends the full payload (the page adds `workspace_id`); edit sends only changed fields and closes without a request when nothing changed.
- **Limit below spent (edit):** an informational note with the spent amount; saving stays allowed.
- **Duplicates:** a `pendingRef` guard blocks a second submit synchronously, the parent keeps a single in-flight save promise, and inputs/buttons are disabled while saving. Escape or a backdrop click closes the form, except while saving.
- **Errors:** 422 → field errors under the inputs + the backend message; 403 / 404 / 409 → budget wording; others → `getApiErrorMessage`; 401 → nothing (session flow).

## Archive dialog (`ArchiveBudgetDialog`)

`role="alertdialog"`, Cancel focused first. Copy: "Archiving is not permanent deletion…" + kept history, unchanged transactions, no further edits. Confirm runs once (`pendingRef`, "Archiving...", buttons disabled, Escape/backdrop blocked while it runs); errors stay in the dialog (409 → "already archived").

## Categories and workspace integration

- **Categories:** the form calls `categoriesApi.list({ workspace_id, type: "expense" })` only once "Category" is selected, then keeps only active expense categories. Loading and error (with retry) are shown in place of the select. `budgetsApi` never calls `/categories`.
- **Workspace:** create uses `resolveWorkspaceId()` (the `/dashboard` scope + the session workspace), like accounts and categories. The category list and the default currency use the cached session workspace (`getStoredWorkspace()`: `id`, `base_currency_code`). No budget-specific workspace state exists.

## i18n and RTL

All copy is in `dashboard.budgets.*` in both locales, with exact key parity (the old static keys such as `categories.dining` or `delete` were removed). The amount validation messages and pagination copy are reused from `dashboard.transactions.*`.

| Key | Content |
| --- | --- |
| `title`, `subtitle`, `create`, `edit(Named)`, `archive(Named)`, `viewBudget` | Header and actions |
| `createSuccess`, `updateSuccess`, `archiveSuccess` | Notices |
| `scopes.*`, `scopeHints.*`, `status.*`, `progressStatus.*`, `statusHints.*`, `periodState.*` | Labels |
| `fields.*` | Field and stat labels (form, cards, details) |
| `summary.*`, `list.*`, `states.*` (incl. `emptyFiltered`), `card.*` | List page |
| `filters.*` (`allScopes`, `progress`, `allProgress`, `allCurrencies`, `periodFrom`, `periodTo`, `activeOn`, `owner`, `ownerAll`, `ownerMine`, `moreFilters`, `lessFilters`, `rangeHint`) | Filter bar; it also reuses `dashboard.transactions.filters.label` / `allCategories` / `allStatuses` / `clear` |
| `form.*`, `validation.*`, `errors.*` | Form and errors |
| `archiveDialog.*`, `details.*` | Dialog and details page |

- Layout uses logical properties (`inline-size`, `padding-inline-start`, `text-align: start/end`); the progress bar fills from the inline start, so it grows right-to-left in Arabic. The back and pagination arrows are mirrored under `[dir="rtl"]`.
- Amounts, currency codes and percentages are wrapped in `<bdi>` (`dir="ltr"` for amounts); user-entered names and notes use `dir="auto"`.
- Colors come from tokens: `--color-success` (safe), `--color-warning` (warning), a warning/danger mix (near limit), `--color-danger` (exceeded), `--primary-soft`, `--surface-soft`, `--warning-soft`, `--success-soft`. Dark theme overrides use `:root[data-theme="dark"]`. Transitions and the refresh spinner honor `prefers-reduced-motion`.

## Verification

- `npx eslint` on every changed file: clean. `npm run build`: passes.
- A Vite SSR smoke script exercised the real modules: request method/URL/body of every `budgetsApi` call (no `/api/api`, PATCH body filtered, `amount_limit` as `"…0000"`), list parsing, percentage formatting beyond 100 %, bar clamping, archive/progress merging, validation and error wording; and rendered the card (exceeded, archived, without progress), list states, summary, both form modes and the dialog in English and Arabic with no missing translation keys.
- **List filters:** headless Chrome against a mock of the documented `GET /budgets` contract. The mock sends alias fields with deliberately wrong values, to prove they are never read. Checked:
  - the initial request is `?workspace_id=1&per_page=20&page=1`, and cards come from `data.budgets.data`;
  - spent/limit/percentage come from the backend progress;
  - `-₪100.00` remaining is shown in the danger color, and USD budgets are shown in `$`;
  - the summary has counts only;
  - page 2 works;
  - scope, category, status, progress status, currency, `active_on` and `owner=mine` are each sent and reset to page 1;
  - scope General drops the category;
  - one period date shows the hint and sends nothing, and two dates are sent together;
  - the filtered-empty state works, and error + Retry recovers;
  - the details back link keeps the filters;
  - Arabic RTL has no raw keys.
- Against the staging backend, unauthenticated `GET /budgets`, `/budgets/{id}` and `/budgets/{id}/progress` return `401 {"status":false,"message":"Unauthenticated."}`, confirming the routes and envelope. The authenticated flows (create → details → refresh → edit → archive) still need a manual pass with a real account.
