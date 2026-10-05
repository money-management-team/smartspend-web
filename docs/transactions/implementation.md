# Transactions — Implementation

## Page (`FinancialOperations.jsx`)

- **Filters in the URL.** `readFilters(searchParams)` sanitizes the query; `filtersToQuery` builds the request (`per_page` 20). `updateFilters(changes)` reads the **live** `window.location.search` (not the last render), so two quick changes can't overwrite each other, and resets `page` to 1 unless a page is given. Changing the type clears a category of the other type.
- **List fetch.** One effect keyed by the query + a reload counter; the result is stored with its key, so "loading" is derived (no synchronous `setState` in the effect). Aborted on change/unmount.
- **Options fetch.** Accounts (`accountsApi.list`) and categories (`categoriesApi.list`) load in a separate effect; the previous options stay visible while they reload. Errors show in the form with a retry.
- **After a mutation** (create, reverse): both the list and the options are refetched; balances in the account selector come from the backend.
- **Reverse from the list** opens `ReverseTransactionDialog`; a success notice appears under the intro.
- **Recording lives on the page, not in a form.** `recordOperation(operation)` builds the payload, owns the `Idempotency-Key` attempt and calls `createIncome` / `createExpense`; the review dialog only awaits it and shows the error if it throws. Keeping the attempt at page level means closing and reopening the review can't hand a retry a fresh key.

## Compact daily-entry layout (2026-10-05)

The page keeps the original API flows in a quieter, responsive layout:

| Section | Component | What it does |
| --- | --- | --- |
| Blue identity card | `OperationsIntro` | Page title, short explanation and the original per-currency total of today's expenses |
| New transaction | `CaptureStep` | One row of native dropdowns: transaction type, active account, input method |
| Account control | `AccountStep` | Active accounts by name and currency; the selected account's backend balance uses `PrivateMoney`. A single active account remains automatically selected |
| Entry panel | `NewOperation`, `VoiceCaptureWorkflow`, `ReceiptCapture` | Only the selected method is mounted. Manual entry is the default; saved `voice_capture` links still reopen voice review |
| Recent transactions | `Ledger` | Five rows initially. Show more opens the original 20-per-page list, filters, saved views and pagination |

- The type dropdown controls manual expense/income entry. Voice and receipt workflows remain **expense-only**; their type control shows Expense and is disabled.
- AI allowances appear only for voice/receipt, using the selected channel's quota. Quota fetching, reset, retry and enforcement rules are unchanged.
- `AiInputAllowance` has an opt-in `compact` presentation. Without it, the existing receipt-retry page keeps its original markup and styling.
- Quick templates use `ManualTemplateTools compact`: dropdown, explicit Apply, optional Save template and management link. The original eligibility, storage, limit, application and review rules are retained. Other consumers keep the default layout.

- **Today's total** is a separate `GET /transactions` for today (`type=expense`, `status=posted`, `per_page` 100 — the backend's documented maximum; anything higher is rejected with a 422). It follows the paginator for up to 5 pages, so a busy day is totalled in full instead of stopping at the first page. Amounts of different currencies are **never** added together: each currency is totalled with `sumMoney` on its own, the largest group is shown and the rest are counted.
- **Every method needs an account first.** `requireAccount()` is passed down; without a selection it shows a toast and scrolls to and focuses the account dropdown.

## Input methods

| Method | Component | Existing behavior preserved |
| --- | --- | --- |
| Manual | `NewOperation` | Collects values and opens `ReviewOperationDialog`; only explicit confirmation posts money |
| Voice | `VoiceCaptureWorkflow` | Existing secure recorder, upload, status polling, draft editing, confirmation and history |
| Receipt | `ReceiptCapture` | Existing image validation/upload and review route; no direct transaction post from this panel |

## Manual entry (`NewOperation`)

- Type dropdown in `CaptureStep`: Expense / Income; the initial type still comes from `?new=`. Changing type retains the entered form values. Transfers retain their own page and the link under the form.
- Fields: amount (text, `inputMode="decimal"`, validated as a string, currency label from the chosen account), note → `description`, category (income: "No category" default; expense: explicit "Select a category"), date → `occurred_at` at `12:00:00`, reference number. The account comes from the dropdown above the form. Note and reference number are available under More details; hiding it does not remove an entered value from the review payload.
- Client validation before the review opens: amount required / valid / > 0 / ≤ 4 decimals, expense category required. The account is enforced by `requireAccount()`.
- On submit it calls `onReview(operation)` with an `onRecorded` callback that clears the form once the operation is actually recorded.

## Review dialog (`ReviewOperationDialog`)

- The last step of **every** method: a receipt showing total, description, category, account, input method, date and reference, then current balance → balance after (exact `sumMoney` / `subtractMoney` on the backend's decimal strings, never floats).
- "Edit details" turns the amount, description, category and date into inputs in place, so a wrong value is fixed without going back.
- A warning appears when an expense would take the account below zero; the ledger still decides.
- Confirm: synchronous `pendingRef` guard, `aria-busy` while saving, then the page closes the dialog, shows the message with a "View transaction" link and refetches. Idempotency and duplicate protection: see [idempotency.md](idempotency.md).
- Errors stay in the dialog: backend message, insufficient-balance hint, unknown-outcome guidance (and a refresh) for network/timeout/5xx, plus any 422 field messages.

## Transactions list (`Ledger` + `TransactionFilters`)

- Header: Recent transactions + total. The collapsed view renders the first five rows from the existing server response. The expanded view retains the type filter as a select. Deep links with active filters, another sort or page > 1 open the full history immediately.
- Filters and saved views open on demand in the full history: account, category (grouped by type), status, from/to dates, sort and Clear filters. All request/URL behavior is retained.
- Rows: type icon, title (description → category → type), compact meta (account · date), amount with +/− from the **type** (never computed), status badge for non-posted, chips (reversal entry / correction / transfer). The title is a `Link` stretched over the row (keyboard focus outlines it) and carries the list's query in router state for the back link. The reverse button (only when `canChangeTransaction`) sits above the link.
- States: loading, error (+ retry, + clear filters when filtered), empty (no transactions / no match + clear / empty page + first page).
- Show more reveals the loaded page; server pagination then supplies all further pages. Show less returns a later page to page 1 and displays five rows. The original pagination summary and previous/next controls are preserved.

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

Daily manual entry shows only amount, category and date. Optional note and reference remain available under More details and still use the original review payload. The three primary fields sit in one row on desktop and two rows on phones.
