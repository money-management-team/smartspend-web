# Recurring Transactions — Implementation

## List page (`Recurring.jsx`)

- **Fetching:** `recurringTransactionsApi.list(recurringFiltersToQuery(filters))` in an effect with an `AbortController`, stored with its request key (`filters:reloadKey`). The page is loading until the matching result arrives.
- **Filters (`RecurringFilters`):** type, status, frequency, processing mode, account and next-due range, all kept in the URL (`readRecurringFilters` validates every value, so a bad URL is ignored). Changing a filter resets to page 1; "Clear filters" removes them. The account list comes from `accountsApi`; if it fails, only the account filter is hidden.
- **Rows (`RecurringOperationRow`):**
  - type icon; the name links to the details page;
  - category · account · "Every N months";
  - badges: status, processing mode, next occurrence status and overdue, when the row has a schedule;
  - "Next due {date}" from `next_occurrence.due_date` or `next_due_date`;
  - the signed amount in the rule's currency;
  - Confirm and Edit / Pause / Resume / Archive, following the action matrix. Archived and completed rows are dimmed.
- **States:**
  - `Loading`;
  - error → message + "Try again";
  - empty → "Add recurring expense";
  - filtered empty → "Clear filters";
  - empty page past the first → "Go to the first page".
- **Pagination:** `per_page=15`, footer when `last_page > 1` (reuses the transactions pagination copy).
- **After every write** the list is refetched, since the backend decides the new status, next due date and position. A notice names the rule; after confirm-next it links to the created transaction, and it always links to the rule.
- **Dialog failures:** 404 / 409 / 422 or an unknown outcome mark the list stale, and it is refetched when the dialog closes.

## Details page (`RecurringDetails.jsx`)

Route `PATH.USER.RECURRING_DETAILS`; `recurringTransactionId` from `useParams`; `recurringTransactionsApi.get`, keyed by `id:reloadKey`.

- **Header:** name, type chip, status and mode badges, signed amount. Actions per the matrix: Edit, Pause/Resume, Archive.
- **Note** (one at a time):
  - archived → read-only, history kept;
  - paused → nothing posted, resume recalculates, no retroactive posting;
  - completed → read-only;
  - active automatic → the server posts on the due date;
  - active manual → nothing is posted until confirmed.
- **Next occurrence panel:**
  - due date + overdue badge, status, amount, and attempts / failure reason when present;
  - "N open occurrences";
  - **Confirm** (primary) and **Skip next**, with the hint "Confirming posts real money; skipping doesn't";
  - handles `schedule: null` ("schedule isn't available") and `next_occurrence: null` ("no open occurrence").
- **Details list:** name, type, amount, currency, account (link), category (link), frequency + interval, anchor day, start and end dates, max occurrences, processing mode, status, next due date, last processed, owner, description, notes, archived, created, updated.
- **Occurrence history (`RecurringOccurrences`):**
  - paginated (`per_page=10`), with a status filter kept in the URL (`occurrence_status`, `occurrences_page`) next to the page's other params;
  - table columns: due date + overdue, status, amount, transaction link (when `transaction_id` is set), attempts, failure reason, processed at;
  - all statuses stay listed;
  - a `refreshKey` changes after every action on the rule, which rereads the history.
- **Errors:** 404 → "Recurring transaction not found" without retry; 401 → session flow; others → the message + "Try again".

### State after each write (details)

| Action | Update |
| --- | --- |
| Edit, pause, resume, archive, confirm, skip | The returned `recurring_transaction` is merged in (relations the response lacks are kept), then the rule is reread silently for the fresh `schedule`, and the history is refetched |
| No usable rule in the response | Full reload |
| Failure (404 / 409 / 422 / unknown outcome) | Message in the dialog; the page reloads when it closes |

## Modals

All reuse the dashboard modal shell (`AccountForm.css`) and the textarea/error-block styles (`ReverseTransactionDialog.css`). Escape or a backdrop click closes them, except while a request runs. A synchronous ref guard blocks double submission.

- **`RecurringForm`:**
  - a note that a rule moves no money by itself;
  - **create:** type cards (income/expense); account (eligible accounts, with currency); category (refetched per type, cleared when the type changes, empty-state hints); name; amount (in the account's currency); frequency; interval (with an "Every N …" preview); start date (today); end date; max occurrences; processing mode radios with explanations; description; notes;
  - **edit:** fixed fields shown read-only with the new-rule hint, the amount-change note, and only editable inputs;
  - client validation (see [business-rules.md](business-rules.md)); backend field errors mapped to inputs; edit closes without a request when nothing changed.
- **`RecurringActionDialog`** (`pause`, `resume`, `archive`, `confirm`, `skip`):
  - `role="alertdialog"`, with Cancel focused;
  - explains the consequences;
  - for confirm/skip: the next occurrence, plus the skip reason field;
  - the special-422 details and unknown-outcome blocking — see [confirm-and-skip.md](confirm-and-skip.md).

## Error wording (`getRecurringErrorMessage`, `getConfirmErrorHint`)

`context` is `load`, `save`, `archive`, `pause`, `resume`, `confirm` or `skip`.

- 403 and 404 have their own wording.
- 409: "already archived" (archive), "archived and can't be changed" (save), otherwise the backend message or "changed meanwhile".
- 422:
  - `data.occurrence.failure_reason` first;
  - then the backend message;
  - then the first field error.
- Everything else falls back to `getApiErrorMessage` (network, timeout, 429, 5xx).

## Removed fake data

- The hard-coded rule arrays in `Recurring.jsx`, the `console.log` stubs in `Recurring.jsx` and `RecurringHeader.jsx`, and the fake "Due now / income / expenses" sections.
- The row's "Delete" button (which did nothing), replaced by Archive.
- The fake translation keys: `dashboard.recurring.items`, `categories`, `accounts`, `frequency`, `inDays`, `previousAmount`, `actions.schedule`, `actions.delete`, `sections.dueNow/dueSubtitle/income/expenses`, `confirmDeduction`, `confirmDeposit`, `next`.

## i18n and RTL

All copy is in `dashboard.recurring.*` in both locales, with exact key parity:

| Keys | Content |
| --- | --- |
| `title`, `subtitle`, `actions.*`, `sections.*`, `filters.*`, `states.*`, `notices.*` | Page |
| `types.*`, `statuses.*`, `frequencies.*`, `every.*`, `processingModes.*`, `occurrenceStatuses.*`, `overdue`, `nextDue`, `fields.*` | Labels |
| `form.*`, `validation.*`, `actionDialog.*` | Modals |
| `errors.*` | Errors, including `insufficientBalance`, `failedOccurrenceHint`, `noOpenOccurrenceHint`, `unknownOutcome` |
| `nextOccurrence.*`, `occurrences.*`, `details.*` | Details page |

Plurals use `_one` / `_other` in both files, like the rest of the project. Amounts and dates are wrapped in `<bdi>` (`dir="ltr"` for amounts and currency codes), and names, notes, reasons and backend messages use `dir="auto"`. The CSS uses logical properties, and the pagination arrows and back link are mirrored under `[dir="rtl"]`.

## Verification

- ESLint on every changed file: clean. `npm run build`: passes.
- **End-to-end smoke test.** The real pages ran in React under happy-dom, loaded through Vite, against a stateful fake backend that enforces the documented rules. Among them:
  - whitelisted fields on create/update;
  - no body on pause/resume/confirm;
  - no `Idempotency-Key` anywhere;
  - `id_workspace` for alerts;
  - the special 422 on insufficient balance;
  - occurrences advancing and being cancelled on archive.

  The test covered create (category required, categories following the type, goal accounts excluded, exact payload, one POST on double click, no money moved), details, editing only the amount (PATCH `{ amount }`), pause → resume, confirm-next with the special 422 (failure_reason and attempts shown, no money moved, failed occurrence in the history), retry after a top-up (money moved once, transaction linked), skip with a reason (no money moved, kept in the history), the status filter, an unknown outcome blocking the retry, archive (read-only, history kept), pagination and filters.

  **99/99 checks passed in English and in Arabic**, with no missing translation keys, no React errors and no backend-rule violations. The test script lives outside the repo; there is no test framework in the project.
- **Staging:** every endpoint answers 401 without a token (the routes exist). The authenticated flows still need a manual pass with a real account.
