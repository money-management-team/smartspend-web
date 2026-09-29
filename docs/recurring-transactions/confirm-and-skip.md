# Recurring Transactions — Confirm Next and Skip Next

## Confirm next — `POST /recurring-transactions/{id}/confirm-next`

**This moves real money.** The backend posts the rule's **oldest open occurrence** as a real transaction; the account balance changes. It is not a plain state action and is treated differently from pause/resume/archive:

- The dialog says it moves money (first point, emphasised), shows the next occurrence (due date, overdue badge, amount, account, status) and asks to confirm only if the payment really happened.
- No body: the occurrence is chosen by the backend, never by the client.
- **Double submission is prevented**: a synchronous ref guard in the dialog plus a disabled, `aria-busy` button while the request runs.
- On success (201) the response's `data.recurring_transaction` replaces the rule on screen, the rule is read again for the recalculated schedule, the occurrence history is refetched, and the notice links to the created transaction (`data.occurrence.transaction_id`). Other pages (transactions, accounts, dashboard) read fresh data when opened; nothing is patched locally.

### Idempotency decision

The documentation is inconsistent: one example shows an `Idempotency-Key` header, while the integration notes say the backend generates the key itself as `recurring:{ruleId}:{dueDate}`.

The backend source isn't available to this project (searched locally; no recurring-transaction implementation found), so the decision rests on the documented response. `data.occurrence.idempotency_key` comes back from the server in that exact form, `recurring:1:2026-08-15`: it is derived from the occurrence, so the same occurrence can't be posted twice whatever the client sends.

**Therefore the client sends no `Idempotency-Key`** for confirm-next (nor for any other recurring request). If the backend ever starts requiring the header, it will answer with a validation error that is shown to the user. The fix would then be to send one key per logical attempt with `createIdempotentAttempt()`, as the transaction writes do.

### Unknown outcome

After a network error, timeout or 5xx the dialog cannot know whether the occurrence was posted. Retrying blindly could post the **next** occurrence (a second, real payment). So:

- the message says the outcome is unknown and asks to check the history;
- the confirm button is disabled (only Close remains);
- closing the dialog refreshes the rule and the history before anything else can be done.

### The special 422

Confirm-next can answer 422 **without field errors**, carrying the occurrence instead:

```json
{
  "status": false,
  "message": "Insufficient balance.",
  "data": {
    "occurrence": { "status": "failed", "failure_reason": "…", "attempts": 1, "due_date": "…" }
  }
}
```

`apiClient` keeps the whole body on `error.payload`, and `getFailedOccurrence(error)` reads `error.payload.data.occurrence`. When present:

- the message shown is `failure_reason` (falling back to the backend message);
- the dialog lists the occurrence's due date, status (`failed`) and attempts;
- a hint explains that nothing was posted and no money moved, and that the occurrence **stays open**: fix the problem (for example, add funds), then confirm again;
- the button becomes "Try again". A retry targets the same open occurrence, because the backend chooses it; the client never creates occurrences;
- the page is refreshed when the dialog closes, so the failed occurrence (with its attempts and reason) appears in the history.

Other 422s are handled too: "no open occurrence" (hint: nothing to act on), insufficient balance without an occurrence payload (hint: add funds), and any other domain message (hint: nothing was posted).

## Skip next — `POST /recurring-transactions/{id}/skip-next`

- **Moves no money** and creates no transaction; the dialog says so.
- The backend closes the oldest open occurrence as `skipped`; it stays in the history with the reason.
- Optional body `{ "reason": "Paid in cash this month" }` — sent only when a reason is typed (≤ 500 characters; a backend `reason` error is shown under the field).
- On success, `data.recurring_transaction` is shown (the backend's new `next_due_date` — never computed here), then the rule and history are refetched.
- Offered only for active rules with an open occurrence (or an unknown schedule).
