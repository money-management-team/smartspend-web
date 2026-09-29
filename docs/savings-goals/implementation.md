# Savings Goals — Implementation

## List page (`SavingsGoals.jsx`)

- **Fetching:** one effect calls `savingsGoalsApi.list(goalFiltersToQuery(filters))` with an `AbortController`. The result is stored with its request key (`filters+page:reloadKey`); the page is "loading" until the matching result arrives. `AbortError` is ignored.
- **Filters** (`SavingsGoalFilters`): lifecycle status, progress status and currency, kept in the URL. Changing one resets to page 1; "Clear filters" drops them all.
- **States:**
  - `Loading`;
  - error → `getGoalErrorMessage` + "Try again";
  - empty → create button;
  - filtered empty → "Clear filters";
  - empty page past the first → "Go to the first page".
- **Cards (`SavingsGoalCard`):**
  - the radial `GoalProgress`: the ring is clamped to 0–100 %, the text is the real percentage;
  - the name, as a link stretched over the card to the details page;
  - the lifecycle badge, the progress badge (when it differs), and "Deadline passed";
  - saved / target, remaining and the target date;
  - Add contribution, Edit and Archive, per the action matrix. Archived cards are dimmed and have no buttons.
- **Pagination:** `per_page=12`; the footer (reusing the transactions pagination copy) appears when `last_page > 1`.
- **`?new=1`** opens the create form once, then is removed from the URL.

### State after each write (list)

| Action | Update |
| --- | --- |
| Create | Refetch (the backend decides order and page), plus a "created" notice with a "View goal" link |
| Edit | Card replaced with the returned goal. If filters are active, or the response has no progress, the list is refetched instead, since the new status may move the goal across filters |
| Contribution | Refetch, "contribution added" notice |
| Archive | Refetch, "archived" notice |
| Edit / archive 404 or 409 | Message in the modal, and the list is refetched |
| Failed contribution | Message in the form; the list is refetched when the form closes |

## Details page (`SavingsGoalDetails.jsx`)

Route `PATH.USER.SAVINGS_GOAL_DETAILS`. It reads `savingsGoalId` from `useParams` and calls `savingsGoalsApi.get`, keyed by `savingsGoalId:reloadKey`.

- **Header:** name; lifecycle, progress and "Deadline passed" badges; currency. The actions follow the matrix: Add contribution (primary), Withdraw, Pause/Resume, Edit, Archive.
- **Note** (one at a time):
  - archived → read-only, history kept;
  - paused → contributions blocked, withdrawals allowed;
  - achieved → can still add or withdraw, and the status is recalculated;
  - deadline passed.
- **Progress panel:**
  - the progress badge with a one-line hint;
  - the real percentage (large), which can exceed 100 %;
  - `GoalProgressBar`, whose width is clamped while `aria-valuetext` carries the real value;
  - stats: saved, remaining, target, contributions count, and days remaining ("Deadline passed" when it has).
  - **Refresh progress** calls `GET …/progress` (abortable, one at a time) and merges the result with `withFreshProgress`. Errors show inline; a 404 turns the page into "not available".
- **Activity (`GoalActivity`):**
  - tabs map to endpoints: All → `GET …/activity`, Contributions → `GET …/contributions`, Withdrawals → `GET …/activity?type=withdrawal`;
  - `per_page=10`, with pagination;
  - each row shows the type icon, from → to accounts, date, description, and the amount signed from the goal's point of view (+ contribution, − withdrawal), plus the transfer status badge;
  - rows link to the transfer details;
  - reversed movements stay listed, struck through, with a "Reversed" badge;
  - `refreshKey` changes after every movement, which refetches from page 1.
- **Details list:** name, target amount, currency, target date ("No target date"), goal status, progress, savings account (link + hint), achieved on, archived on, notes, created, last updated.
- **Errors:** 404 → "Savings goal not available" without retry; 401 → session flow; others → the message + "Try again".

### State after each write (details)

| Action | Update |
| --- | --- |
| Contribution / withdrawal | The returned `savings_goal` is merged in; the activity is refetched; notice |
| Pause / resume | The returned goal is merged in (resume shows whatever status came back); the notice names the new status |
| Edit | The returned goal is merged in (the status may have flipped); notice |
| Archive | The returned archived goal is merged in; the page stays, now read-only; notice |
| No usable goal in the response | Full refetch; a missing `progress` triggers a progress refresh |
| 404 on edit / pause / resume / archive | Page switches to "not available" |
| 409, 403 or unknown outcome | Message in the modal; the goal is refetched when it closes |
| Any failed contribution/withdrawal | Message + hint in the form; the goal is refetched when it closes (a 404 there may concern the account, so the page isn't marked unavailable) |

## Modals

All reuse the dashboard modal shell (`AccountForm.css`) and the textarea/error-block styles from `ReverseTransactionDialog.css`. Escape and a backdrop click close them, except while a request runs.

- **`SavingsGoalForm`:**
  - create fields: name, target amount, currency (defaulting to the workspace base currency), target date (`min` = today), notes, with a note that the savings account is created automatically;
  - edit fields: the same minus currency, which is shown read-only with the explanation, plus the "target change may flip the status" note;
  - client validation: name required and ≤ 150; amount positive with ≤ 4 decimals; currency; date not in the past on create; notes ≤ 1000;
  - edit sends only the changed fields and closes without a request when nothing changed.
- **`GoalMovementForm`** (`type="contribution" | "withdrawal"`):
  - explains that real money moves through the ledger;
  - shows the goal's current saved amount, plus the overfunding note (achieved goal, contribution) or the "may drop below target" note (achieved goal, withdrawal);
  - fields: eligible account (with balances), amount, date (≤ today), description;
  - handles idempotency, the double-click guard, field errors, the backend message and a hint.
- **`GoalActionDialog`** (`action="pause" | "resume" | "archive"`):
  - `role="alertdialog"` with Cancel focused;
  - explains the consequences;
  - for archive: blocked with the saved amount and a Withdraw shortcut/link while the balance is above zero.

## Error wording (`getGoalErrorMessage`, `getMovementErrorHint`)

`context` is `load`, `save`, `archive`, `contribution`, `withdrawal`, `pause` or `resume`; see [api.md](api.md#error-codes). A 422 always keeps the backend's own message, since it is the financial/domain reason. The hint adds what happened to the money:

- nothing moved;
- insufficient source or goal balance;
- currency, paused or archived;
- or, after a network error/timeout/5xx, "we couldn't confirm; retrying the same details is safe".

## Dashboard integration

- **Hero:** "New goal" → `getNewSavingsGoalPath()`.
- **"Savings goals" widget:** goal names link to `getSavingsGoalDetailsPath(goal_id)`. It still reads the `/dashboard` payload.

## Removed

- `SavingPlans`: fake "AI saving plans" with hard-coded `$US` amounts, rendered only when a goal carried a `plans` field the backend never sends.
- `ContributionForm`: replaced by `GoalMovementForm`.
- The static translation keys that went with them (`goals.*`, `plans.*`, `addFunds`, `delete`, `confirmArchive`, and `dashboard.user.savingsGoals.items`).
- The `window.confirm` archive: replaced by `GoalActionDialog`.

## i18n and RTL

All copy is in `dashboard.savingsGoals.*` in both locales, with exact key parity (1235 keys each). No plural keys are used, so the parity holds for Arabic too. Amount validation and pagination copy are reused from `dashboard.transactions.*`.

| Key | Content |
| --- | --- |
| `title`, `subtitle`, `newGoal`, `deadlinePassed` | Header |
| `status.*`, `progressStatus.*`, `progressHints.*` | The two statuses |
| `fields.*`, `actions.*`, `filters.*`, `states.*`, `notices.*` | Labels, buttons, list, notices |
| `form.*`, `validation.*`, `movementForm.*`, `actionDialog.*` | Modals |
| `activity.*`, `details.*`, `errors.*` | Details page and errors |

- Layout uses logical properties (`inline-size`, `padding-inline-start`, `margin-inline`, `text-align: start/end`); progress bars fill from the inline start. Back and pagination arrows are mirrored under `[dir="rtl"]`.
- Amounts, currency codes, dates and percentages are wrapped in `<bdi>` (`dir="ltr"` for amounts); names, notes and descriptions use `dir="auto"`.
- Colors come from tokens (`--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--primary-soft`, `--surface-soft`, `--success-soft`, `--warning-soft`). Dark overrides use `:root[data-theme="dark"]`. Transitions and the refresh spinner honor `prefers-reduced-motion`.

## Verification

- `npx eslint` on every changed file: clean. `npm run build`: passes.
- **End-to-end smoke test.** The real pages, API module and helpers ran in React under happy-dom, loaded through Vite, against a stateful fake backend that enforces the documented rules (balances, pause, zero-balance archive, 409s, and idempotency replay). It covered:
  - flows A–H: create → details → contribute → withdraw → pause → resume → archive → history;
  - a lost response retried with the same key (money moved once);
  - a double click sending one request;
  - payload whitelists and exact bodies;
  - eligible accounts;
  - status taken from responses (resume → `achieved`, target raise → `active`);
  - filters and pagination.

  93/93 checks passed in English and in Arabic, with no missing translation keys and no React errors.
- **Staging backend.** Without a token, all eleven endpoints return `401 {"status":false,"message":"Unauthenticated."}`, while an unknown sub-route returns 404, confirming the routes and envelope. The authenticated flows still need a manual pass with a real account.
