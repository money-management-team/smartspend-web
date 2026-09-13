# Debts — Implementation

## List page (`Debts.jsx`)

- **Fetching:** two independent effects, each with an `AbortController`, and results keyed by their request so a stale response never shows. `AbortError` is ignored.
  - `debtsApi.list(debtFiltersToQuery(filters))`, keyed `filters+page:reloadKey`; parsed with `parsePage(response, "debts")`.
  - `debtsApi.summary(summaryQuery())`, keyed `summaryReloadKey`; parsed with `parseSummary`. It has its own loading, error and retry states inside `DebtSummary`.
  - Both send the session `workspace_id` (`getStoredWorkspace()`), so the list and the summary describe the same debts.
- **Filters** (`DebtFilters`): direction, status (including the effective `overdue`), currency, counterparty (debounced 400 ms), and due-date range. They live in the URL; changing one resets to page 1.
- **Table** (`DebtList`): counterparty (a link to the details page, with "Money moved" / "Record only"), direction badge, original / paid / remaining amounts, due date, `effective_status` badge, and the `days_until_due` countdown. Overdue rows get a danger edge (mirrored in RTL).
- **States:** loading; error with retry; empty with "New debt"; filtered-empty with "Clear filters"; empty page past the first with "Go to the first page".
- **Pagination:** `per_page=20`, with a footer when `last_page > 1` (it reuses the transactions pagination copy).
- **Create** (`DebtForm`): `onSave` resolves `workspace_id` with `resolveWorkspaceId()` and calls `debtsApi.create`. On success, the list and summary are refetched and a notice appears with a "View debt" link. On an unknown outcome, both are refetched when the form closes.

## Details page (`DebtDetails.jsx`)

Route `PATH.USER.DEBT_DETAILS`. It reads `debtId` from `useParams` and calls `debtsApi.get`, keyed by `debtId:reloadKey`.

- **Header:** counterparty; direction, effective status and currency chips. Actions follow `getDebtActions`: Record payment / Record collection (primary), Edit, Archive. An archived debt has no actions.
- **Note** (one at a time): archived → read-only, history kept; paid → fully paid, a mistaken payment can still be reversed; overdue → past due, payments still accepted.
- **Amounts panel:** original, paid, remaining (highlighted), payments count, and the days-until-due countdown ("Due in 47 days", "Overdue by 3 days"; "—" once paid or archived).
- **Payment history:** `DebtPayments` (see [payments-and-reversal.md](payments-and-reversal.md)).
- **Details list:** counterparty, direction, currency, issued on, due date ("No due date"), status, lifecycle status (only when it differs from the effective status, e.g. overdue → Active), owner, opening movement (a link to the opening transaction, or "Record only"), settled on, archived on, notes, created, last updated.
- **Load errors:** 404 → "Debt not available" without retry; 401 → session flow; others → the message plus "Try again".

### State after each write (details)

| Action | Update |
| --- | --- |
| Edit | `data.debt` merged in (`mergeDebt`); "updated" notice |
| Record payment | `data.debt` merged in; history refetched from page 1; notice with the new status |
| Reverse payment | `data.debt` merged in; history refetched; notice with the new status |
| Archive | `data.debt` merged in (archived, read-only); "archived" notice |
| Response without a debt | Full refetch |
| 404 on edit/archive | The page switches to "Debt not available" |
| 409, 403, unknown outcome, or a failed payment/reversal | Message in the dialog; the debt is refetched when the dialog closes (`staleRef`) |

A refetch re-renders the whole page, which remounts the history on page 1. Other pages (list, summary, accounts, transactions, dashboard) load fresh data when opened, so they reflect the ledger without any local patching.

## Modals

All use the shared dashboard modal shell (`AccountForm.css`, plus the textarea and error styles from `ReverseTransactionDialog.css`). They close on Escape and backdrop click, except while a request is pending, and block double submits with a synchronous `pendingRef`.

| Component | Request | Notes |
| --- | --- | --- |
| `DebtForm` | `POST /debts` | Create; direction is chosen explicitly; optional opening movement |
| `DebtEditForm` | `PATCH /debts/{id}` | Only changed fields; direction/currency read-only; amount locked after the first payment; no request when nothing changed |
| `DebtPaymentForm` | `POST /debts/{id}/payments` | Idempotency-Key per intent; blocks amount > remaining |
| `ReverseDebtPaymentDialog` | `POST /debt-payments/{paymentId}/reverse` | Reason 3–500 |
| `ArchiveDebtDialog` | `DELETE /debts/{id}` | Archive wording; confirm disabled while an open debt has payments |

## Error wording

`getDebtErrorMessage(error, t, context)` in `debtHelpers.js`, where `context` is `load`, `create`, `save`, `archive`, `payment` or `reverse`:

| Code | Wording |
| --- | --- |
| 403 | `forbidden`; in the payment context, `forbiddenPayment` (debt or account) |
| 404 | `notFound`; create → `accountNotFound`; payment → `paymentTargetNotFound`; reverse → `paymentNotFound` |
| 409 save | Archived → `archivedLocked`; amount after a payment → `amountLocked`; otherwise the backend's message |
| 409 archive | `alreadyArchived`, or `hasPayments`; otherwise the backend's message |
| 409 payment | `paymentProcessing`, `debtArchived`, or `idempotencyConflict` |
| 409 reverse | `debtArchived` or `alreadyReversed` |
| 422 | The backend's message (the domain reason). Without one, the first field error, or `validation` |
| Other | `getApiErrorMessage` (network, timeout, rate limit, server, malformed) |

Backend messages arrive in the UI language (`Accept-Language`), so a 409 message the English patterns can't match is still shown as is. The extra lines come from `getPaymentErrorHint`, `getReverseErrorHint` and `getCreateErrorHint`.

## i18n and RTL

- All copy is under `dashboard.debts.*` (plus `dashboard.sidebar.debts`) in both `en.json` and `ar.json`, in exact key parity. The shared `common.*`, `dashboard.transactions.pagination.*` and `dashboard.transactions.validation.*` (amount and reason) keys are reused.
- Enum labels (`status`, `direction`, `paymentStatus`) go through `translateEnum`, so an unknown backend value shows raw instead of a missing key.
- Amounts, currencies, ids and dates are wrapped in `<bdi>` (amounts with `dir="ltr"`); counterparty and notes use `dir="auto"`.
- Direction icons, the back arrow, pagination chevrons and the reverse icon are mirrored under `[dir="rtl"]`; layouts use logical properties (`text-align: start/end`, `padding-inline-start`). The overdue row edge is mirrored.
- Colors come from the theme tokens (dark mode included); transitions are disabled under `prefers-reduced-motion`.

## Verification

- `npx eslint` on the Debts, DebtDetails, `debtsApi`, routing and sidebar files: clean.
- `npm run build`: succeeds. The existing chunk-size warning is unrelated.
- Manual flows against the backend:
  - **Details:** open a debt from the list; `GET /debts/{id}`.
  - **Edit:** PATCH with only the changed fields. The amount is locked once `payments_count > 0`.
  - **History:** paginated; reversed rows stay listed.
  - **Record payment:** a single POST with an `Idempotency-Key`. A double click sends one request, and a retry after a timeout reuses the key. The amounts and status come from the response.
  - **Reverse:** `POST /debt-payments/{paymentId}/reverse`. The row turns "Reversed" and the remaining amount is restored from the response.
  - **Archive:** the 409 is shown while payments are unsettled; on success the page becomes read-only.
