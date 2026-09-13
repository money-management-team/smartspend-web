# Transfers — Implementation

## List page (`Transfers.jsx`)

- **Filters and page live in the URL** (`from_account_id`, `to_account_id`, `status`, `currency_code`, `date_from`, `date_to`, `page`). This mirrors the transactions ledger:
  - `readTransferFilters` sanitizes the URL: ids must be digits, the currency three capital letters, and dates `YYYY-MM-DD`; the `confirmed` alias becomes `posted`, and an inverted range drops its end.
  - `transferFiltersToSearchParams` writes the URL back, and `transferFiltersToQuery` builds the request with `per_page: 20`.
  - Any filter change resets to page 1 (`replace: true`). Updates read the live `window.location.search`, so two quick changes can't overwrite each other.
- **Filter bar (`TransferFilters`)**:
  - From account, To account, Status, Currency, From date, To date, and a Clear filters button shown while any filter is set.
  - It reuses the `transaction-filters` classes from `TransactionFilters.css` (no new filter styles).
  - Account options come from one `accountsApi.list({ id_workspace })` call on the page, the same call the form makes. A failure just leaves "All accounts". A filtered id that isn't listed (e.g. an archived account) stays selectable as `#id`.
  - Currencies are `ACCOUNT_CURRENCIES` plus the accounts' own codes.
  - The date inputs get `min`/`max` from each other.
- **Fetch** keyed by `JSON.stringify(query)#reloadKey`. The result is stored with its key, so "loading" is derived (no synchronous `setState` in the effect), and the request is aborted on change/unmount.
- **Pagination**: the footer shows the paginator's own "Showing from–to of total" and page counter (arrows mirrored in RTL). Moving pages keeps the filters.
- **Rows**:
  - transfer icon, `From → To`, `#id · date · fee`, the amount **without a sign**, and the status badge with transfer-specific labels;
  - rows stay in the backend's order;
  - the title is a `Link` stretched over the row (the row keeps a focus outline). It carries the list's query in router state, so the details page's back link restores the filters.
- **States**:
  - `Loading`;
  - error + Try again (+ Clear filters when filtered);
  - empty: "No transfers yet" + New transfer;
  - empty while filtered: "No transfers match these filters." + Clear filters;
  - an empty non-first page: go to the first page.
- **After a create**: a success notice with a "View transfer" link, and the list is refetched (`reloadKey`); nothing is patched locally.
- `?new=1` opens the form once and the flag is then dropped from the URL, so a reload doesn't reopen it.

## Create form (`TransferForm`)

- Loads **accounts** (`accountsApi.list({ id_workspace })`) and **expense categories** (`categoriesApi.list({ workspace_id, type: "expense" })`) in one effect with its own loading / error+retry state. No account or category fetching is duplicated.
- Fields: from account (label shows the balance), to account, amount, date, fee, fee category + fee description (only once a non-zero fee is typed), description, reference number.
- Client validation: both accounts chosen and different, amount required/valid/positive/≤ 4 decimals, fee valid when filled, fee category required with a fee. Amount and fee messages reuse `dashboard.transactions.validation.amount*`.
- Submitting: synchronous `pendingRef` guard, disabled inputs while the request runs, one `Idempotency-Key` per payload (see [api.md](api.md)).
- Errors: 422 field errors under the inputs (`occurred_at` maps to the date field), the backend message and a hint (`insufficientBalanceHint` / `unknownOutcome`) in the shared error block.
- Success closes the modal and hands the created transfer to the page.

## Details page (`TransferDetails.jsx`)

- Keyed fetch (`transferId:reloadKey`). A **refetch of the same transfer keeps the current data on screen** instead of flashing a spinner; data of another id is never shown while it loads. 404 → "Transfer not available" (no retry); other errors → message + retry.
- Header: icon, `From → To`, type chip, status badge, "With fee" chip, and **Reverse transfer** only when `canReverseTransfer`.
- Amount card (struck through when reversed) and a note when the transfer is reversed (with a fee-included variant) or not posted.
- **Money movement** panel: `Left` −amount (source), `Arrived` +amount (destination), `Fee` −fee (source). Accounts link to their details pages; signs come from the known direction, never from arithmetic.
- **Transfer details** list: number, status, both accounts, amount, currency, fee, fee category (links to the category), description, reference number, transfer date, posted, made by, reversed on, reversal reason.
- **Ledger transactions** table: number (links to Transaction details), type, status, amount — built from `transactions[]`, so a fee or reversal row simply appears.
- Reversal: `ReverseTransferDialog` → `transfersApi.reverse` → notice with the reversal ids, the returned transfer merged, then a refetch. A 409 marks the page stale and it refreshes when the dialog closes.

## Reverse dialog (`ReverseTransferDialog`)

Reuses the transaction reverse dialog's shell and styles. It states that reversing is not deleting, that compensating entries are posted, that the fee is reversed with the movement (only when there is a fee), that the transfer stays in history and that it can only be reversed once. The reason is required (3–500, with a live counter) and validated before any request; duplicate submits are blocked by a `pendingRef`.

## Integration with the rest of the dashboard

- **Sidebar**: "Transfers" (`LuArrowRightLeft`) in the Overview group, after Financial operations.
- **Dashboard hero**: the Transfer action now opens `getNewTransferPath()`.
- **New operation form**: its Transfer chip was removed — a transfer is neither income nor expense and its rules live here. The form now shows a one-line pointer linking to the transfers form, and `/dashboard/financial-operations?new=transfer` redirects to `/dashboard/transfers?new=1`, so old links still work.
- **Transaction details**: a transaction with a `transfer_id` shows a "Transfer" row and a link to the transfer in its note; it stays read-only there.

## Reused, not rebuilt

`Loading`, the `account-form-modal` shell (`AccountForm.css`), the reverse dialog's body/textarea/error styles, `TransactionStatusBadge`, `formatMoney` / `formatDateTime`, `createIdempotentAttempt`, `getAmountError`, `toOccurredAt`, `REASON_MIN`/`REASON_MAX`, `isInsufficientBalanceError`, `isAlreadyReversedError`, and the pagination strings under `dashboard.transactions.pagination.*`.

## i18n and RTL

- `dashboard.transfers.*`: `title`, `subtitle`, `listTitle`, `add`, `chips`, `fields`, `form`, `validation`, `states` (incl. `emptyFiltered`), `statuses` (`pending`, `posted`, `reversed`, `failed`), `filters.allCurrencies`, `messages`, `actions`, `reverseDialog`, `details` (+ `movements`), `errors`. The filter bar reuses `dashboard.transactions.filters.*` (`label`, `allAccounts`, `allStatuses`, `dateFrom`, `dateTo`, `clear`). Plus `dashboard.sidebar.transfers`, `dashboard.transactions.details.transfer` / `viewTransfer`, and `dashboard.financialOperations.newOperation.transferHint`.
- Removed as unused: `dashboard.financialOperations.newOperation.transfer`, `form.destinationAccount`, `form.selectDestinationAccount`, `form.submit.transfer`, `messages.transferCreated`; the page subtitle no longer mentions transfers.
- English and Arabic stay in exact key parity.
- Logical CSS properties, `text-align: start/end`, `<bdi>` around names and numbers, `dir="ltr"` on amounts and reference numbers, mirrored pagination/back arrows under `[dir="rtl"]`, and `color: inherit` on paragraphs inside coloured notices (because `index.css` gives every `p` a colour).

## Verification

Driven end to end in headless Edge against a local mock that enforces the documented contract (required `Idempotency-Key` with replay, 409 on key reuse with a different body, 422 for balance/category/currency rules, reversal of the whole transfer, Laravel pagination): **70/70 checks**, repeated three times.

**List filters (second pass).** Headless Chrome against a mock of the documented `GET /transfers` contract:

- the initial request is `?per_page=20&page=1`, and rows come from `data.transfers.data` in the backend's order;
- relations, the fee with and without a `fee_category`, and unsigned amounts render;
- page 2 works;
- each filter is sent and resets to page 1, and Clear filters resets everything;
- `?status=confirmed` is sent as `posted`;
- an inverted range drops `date_to`;
- the filtered-empty and error states show Try again / Clear filters, and Retry refetches;
- the details back link keeps the filters;
- no request ever carried `workspace_id` or went to `/api/api/`;
- labels are translated in Arabic RTL, with no raw keys and no console errors.

Covered in the first pass: sidebar → list → empty state; accounts/categories loading; archived accounts and the other-currency account excluded; destination disabled until a source is chosen; double click → one `POST`; 4-decimal amount, midday `occurred_at`, no invented `workspace_id`/`currency_code`; fee requires a category and produces a second transaction; insufficient balance shows the backend message + hint and creates nothing; details (accounts, fee, category, status, dates, initiator, movement rows, transactions table); reversal (reason validation, no `Idempotency-Key`, status → Reversed, both reversal entries linked, fee reversed, balances restored by the backend); a reversal refused by the negative-balance guard; a second reversal reported as already reversed with a refresh on close; unknown outcome → same key on retry → the money moves once; `?new=transfer` redirect, hero action, the new-operation pointer, the link from a transfer's transaction; pagination; Arabic RTL on list, details and form; no `/api/api/…`, every request authenticated, no console errors or missing translation keys.
