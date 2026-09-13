# Savings Goals — Business rules

## The ledger is the source of truth

- A goal's saved amount is its savings account's ledger balance. The frontend never adds or subtracts amounts, never computes `remaining_amount`, `percentage_funded` or either status, and never persists progress.
- Every write returns the goal in its new state (`data.savings_goal`, progress recalculated). That object replaces what is shown (`mergeGoal`). When it is missing or has no progress, the goal/progress is fetched again instead of being patched by hand.
- The only local money comparison is a **display hint**: in the withdrawal form, an amount above the saved amount shows a warning (BigInt string comparison via `subtractMoney`). It never blocks the submit, because the backend decides.

## Auto-created savings account

- `POST /savings-goals` creates the goal **and** its dedicated account (`type: "savings"`, same currency). The frontend never creates or chooses it and never sends `account_id`.
- The details page shows the account with a link to its account page ("Created automatically for this goal").
- Money only reaches that account through the goal's own contribution/withdrawal flow.

## Lifecycle and actions

`getGoalActions(goal)` decides what the UI offers. The backend still validates everything, and each action handles its rejection.

| Lifecycle | Edit | Contribute | Withdraw | Pause | Resume | Archive |
| --- | --- | --- | --- | --- | --- | --- |
| `active` | ✓ | ✓ | when balance > 0 | ✓ | — | offered; confirm only at balance 0 |
| `paused` | ✓ | **—** | when balance > 0 | — | ✓ | offered; confirm only at balance 0 |
| `achieved` | ✓ | ✓ (overfunding allowed) | when balance > 0 | ✓ | — | offered; confirm only at balance 0 |
| `archived` | — | — | — | — | — | — (read-only) |

- A goal whose balance is unknown (no progress) keeps Withdraw available; the backend decides.
- An unknown lifecycle value is treated like `active`.
- Contributions are **not capped** at the target: overfunding is allowed, and the percentage can exceed 100 %.

## Target changes

Editing `target_amount` can change the lifecycle status: raising it can turn `achieved` into `active`, and lowering it can turn `active` into `achieved`. The form explains this, and the response's status is shown as is. The currency can't be edited: the goal's account already holds money in it.

A new goal's `target_date` can't be in the past (checked client-side against the local date, and by the backend). On edit, the date is validated by the backend only.

## Pause / resume

- **Pause** puts the goal on hold. The money stays in its account, **withdrawals remain allowed**, and **contributions are blocked**. It is rejected with 409 when the goal is already paused or archived.
- **Resume** accepts contributions again. The backend returns `active`, **or `achieved`** when the goal is already fully funded. The frontend never forces `active`. It is rejected with 409 when the goal isn't paused or is archived.
- Neither sends a body or an Idempotency-Key.

## Archive

- `DELETE /savings-goals/{id}` **archives**. It is not a permanent deletion: the goal, its savings account and all movements stay recorded, and the goal becomes read-only.
- **The balance must be zero first.** The required flow is: withdraw all money, then archive. The dialog:
  - explains this;
  - disables the confirm button while `saved_amount > 0`;
  - offers **Withdraw** (on the details page it opens the withdrawal form in place; on the list it links to the goal).
- Money is never withdrawn automatically.
- The backend's 409 (balance remaining / already archived) is still handled and explained.

## Money movements

- Contributions and withdrawals are real transfers. The response's `savings_goal` becomes the page state, and the activity is refetched.
- **Eligible accounts** (`getEligibleAccounts`), loaded fresh from `accountsApi.list({ id_workspace: goal.workspace_id })` every time the form opens:
  - active only;
  - in the goal's currency (other currencies are rejected by the backend);
  - never a savings-goal container (`account.savings_goal` / `savings_goal_id` set). This excludes the goal's own account, which would be a circular movement, and other goals' accounts, which only move through their own flow.
- Failure reasons the backend reports as 422 are shown with its message plus a hint:
  - insufficient source balance / insufficient goal balance;
  - currency mismatch;
  - paused or archived goal.
  In each case the hint says that nothing moved.
- Amounts are 4-decimal strings (`toMoneyString`); no float math is used.

## Idempotency

Both money-moving endpoints require an `Idempotency-Key`. The form uses `createIdempotentAttempt("goal-contribution" | "goal-withdrawal")` from `transactionHelpers.js`:

- One key per logical submission. `keyFor({ goalId, type, ...payload })` returns the **same key** while the details are unchanged, and a new key once they change.
- **Double clicks** are blocked synchronously (`pendingRef`), and the buttons are disabled while submitting.
- After a **network error, timeout, 5xx, malformed response, 409 or 429**, the outcome is unknown or still processing, so the key is **kept**. Retrying the same details replays the stored result instead of moving money twice, and the user is told to check the activity first.
- The key is renewed only after a **success** or a **definitive rejection** (422, 403, 404, 401).
- Nothing is retried automatically.
- A 409 is shown as "conflicts with a request that is still being processed".
