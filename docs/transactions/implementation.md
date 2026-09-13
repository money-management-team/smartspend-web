# Transactions — Implementation

## Page (`FinancialOperations.jsx`)

- **Filters in the URL.** `readFilters(searchParams)` sanitizes the query; `filtersToQuery` builds the request (`per_page` 20). `updateFilters(changes)` reads the **live** `window.location.search` (not the last render), so two quick changes can't overwrite each other, and resets `page` to 1 unless a page is given. Changing the type clears a category of the other type.
- **List fetch.** One effect keyed by the query + a reload counter; the result is stored with its key, so "loading" is derived (no synchronous `setState` in the effect). Aborted on change/unmount.
- **Options fetch.** Accounts (`accountsApi.list`) and categories (`categoriesApi.list`) load in a separate effect; the previous options stay visible while they reload. Errors show in the form with a retry.
- **After a mutation** (create, reverse): both the list and the options are refetched; balances in the account selector come from the backend.
- **Reverse from the list** opens `ReverseTransactionDialog`; a success notice appears above the layout.
- `SmartCapture` is unchanged (placeholder actions, no transaction data).

## New operation form (`NewOperation`)

- Type chips: Expense / Income; the initial type comes from `?new=`. Transfers are recorded in their own section, with a link under the form.
- Fields: amount (text, `inputMode="decimal"`, validated as a string), category (income: "No category" default; expense: explicit "Select a category"), account (label shows the backend balance via `formatMoney`), note → `description`, reference number, date → `occurred_at` at `12:00:00`.
- Client validation: amount required / valid / > 0 / ≤ 4 decimals, account required, expense category required.
- Idempotency and duplicate protection: see [idempotency.md](idempotency.md).
- Success: message per type, a "View transaction" link, amount/note/reference cleared, `onCreated` refreshes the page data.
- Errors: 422 field errors under the inputs; backend message + insufficient-balance hint; unknown-outcome guidance (and a refresh) for network/timeout/5xx.

## Transactions list (`Ledger` + `TransactionFilters`)

- Header: "Transactions" + total from the paginator, type chips.
- Filters row: account, category (grouped by type), status, from/to dates, sort, "Clear filters".
- Rows: type icon, title (description → category → type), meta (type · category · account · date), amount with +/− from the **type** (never computed), status badge for non-posted, chips (reversal entry / correction / transfer). The title is a `Link` stretched over the row (keyboard focus outlines it) and carries the list's query in router state for the back link. The reverse button (only when `canChangeTransaction`) sits above the link.
- States: loading, error (+ retry, + clear filters when filtered), empty (no transactions / no match + clear / empty page + first page).
- Pagination footer: "Showing from–to of total", previous/next (arrows mirrored in RTL), "Page x of y".

## Transaction details (`TransactionDetails.jsx`)

- Keyed fetch (`transactionId:reloadKey`); 404 → "Transaction not available" (no retry); other errors → message + retry.
- Header: icon, title, type chip, status badge, reversal/correction chips; Correct / Reverse only when eligible.
- Amount card (struck through when reversed), notes: reversed, reversal entry (links the original), transfer (read-only), not-posted.
- Details: type, status, amount, currency, account(s) (links to account details), category (link), description, reference number, transaction date, posted, source, recorded by, reversed on, reversal reason, reverses / replaces (links). Raw ids other than transaction numbers aren't shown.
- Ledger entries table: account (link), role, signed amount (red when negative).
- Correction / reversal handling: see [correction-and-reversal.md](correction-and-reversal.md). A 409 in a dialog triggers a refetch when the dialog closes. Notices are keyed by transaction id; the route element stays mounted across id changes, so the correction notice survives the navigation to the replacement.

## Money

- Amounts stay the backend's decimal strings in state and payloads; inputs are validated with a regex, never parsed into floats. `toMoneyString` produces the 4-decimal string sent to the API.
- Display uses the shared `formatMoney(value, currency, locale)` (display-only rounding) with `dir="ltr"`; signs come from the type, ledger-entry signs from `signed_amount` (`isNegativeMoney`).
- The old list formatted amounts with `Number(...).toLocaleString` and ignored the currency format; that is gone.

## Shared helpers added

- `formatters.js`: `parseDateValue` (accepts ISO, `YYYY-MM-DD`, and the backend's `YYYY-MM-DD HH:mm:ss`), `formatDateTime`; `formatDate` now uses the same parser and returns the raw value instead of throwing on an unparseable date. Output for valid inputs is unchanged.
- `Path.js`: `TRANSACTION_DETAILS`, `getTransactionDetailsPath`, `getNewOperationPath`.

## i18n and RTL

- `dashboard.transactions.*`: title, `types`, `statuses`, `sources`, `entryRoles`, `fields`, `form`, `filters` (+ `sortOptions`), `chips`, `actions`, `states`, `pagination`, `reverseDialog`, `correctForm`, `validation`, `errors`, success messages, `details`.
- `dashboard.financialOperations.*`: page, smart capture, `newOperation` chips and the transfers pointer, form-only labels, per-type submit labels and messages.
- Removed as unused: the fake `categories`/`accounts`/`transactions` blocks, `ledger.*`, `states.*`, `filters.*`, `types.*`, `messages.created`, and the form labels now under `transactions.fields`.
- Backend enum values without a translation (unknown source, entry role, type) are shown raw via `translateEnum`, which checks `i18n.exists` first so dev builds don't log missing keys.
- Logical CSS properties, `text-align: start/end`, `<bdi>` around names/numbers, `dir="ltr"` on amounts and reference numbers, mirrored back/pagination arrows under `[dir="rtl"]`.
- Paragraphs inside colored notices/errors set `color: inherit`, because `index.css` gives every `p` a text color.
