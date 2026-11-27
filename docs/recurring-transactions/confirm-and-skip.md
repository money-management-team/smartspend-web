# Recurring Transactions — Confirm Next and Skip Next

Both requests **name the occurrence they act on**: `occurrence_id`, the rule's `schedule.next_occurrence.id`, which is the date the person is shown.

**Why the occurrence is named.** Posting or skipping an occurrence makes the backend materialise the next one at once. When the request carried no body, the backend acted on "the oldest open occurrence when the request arrives". A repeated request (a browser resend, a double tap, a retry after a lost answer) therefore posted or skipped the **following** period. That following occurrence has its own derived key, so nothing stopped it.

**Backend contract.** The change is in `smartspend-backend`, as uncommitted work on `fix/financial-idempotency-p0` (on top of `6b696d72`); it is not yet deployed.
- `occurrence_id` is required.
- Under the rule lock, the named occurrence must still be the rule's earliest open occurrence.
- A repeat of a request that already settled it returns that result.
- Anything else is a 409 with a machine-readable `code` that changes nothing:
  - `recurring_occurrence_not_next`: an earlier date is still open;
  - `recurring_occurrence_not_open`: the date was settled some other way.
- A missing id, a non-integer id, or one that belongs to another rule gets 422 on `occurrence_id`.
- A rule the caller can't see is still 404, before the body is read.
- Today's deployed backend ignores the field, so a frontend that sends it works before and after the backend change.
- **A request that waits for the lock:** "earliest open" is judged once the rule lock is held, not when the request arrives.
  - Suppose a request names the following occurrence (B) while another request is posting the earlier one (A) and holds the lock. It waits; once A commits, B is the earliest open occurrence and is posted.
  - This is intended: that request named B explicitly, and B is the earliest open date when it runs.
  - A repeated request can't do this, because a repeat names A and gets A's result.
  - A client normally only gets B's id by reading the rule after A was settled.
  - No dedicated concurrency test covers this case.

## Confirm next — `POST /recurring-transactions/{id}/confirm-next`

**This moves real money.** The backend posts the named occurrence as a real transaction, and the account balance changes. It is not a plain state action and is treated differently from pause/resume/archive:

- **The dialog** says it moves money (first point, emphasised), shows the next occurrence (due date, overdue badge, amount, account, status) and asks to confirm only if the payment really happened.
- **Body:** `{ "occurrence_id": <schedule.next_occurrence.id> }`, sent by `recurringTransactionsApi.confirmNext(ruleId, occurrenceId)`. The wrapper refuses to send without a valid id.
- **When it is offered:** only when the rule's schedule names an open occurrence (`getNextOccurrenceId`, `getRuleActions`). A rule whose schedule is missing offers no confirm, because there is nothing to name.
- **Double submission is prevented**: a synchronous ref guard in the dialog, plus a disabled, `aria-busy` button while the request runs. A repeat that reaches the server anyway gets the same answer.
- **On success (201):**
  - the response's `data.recurring_transaction` replaces the rule on screen;
  - the rule is read again for the recalculated schedule, and the occurrence history is refetched;
  - the notice links to the created transaction (`data.occurrence.transaction_id`);
  - other pages (transactions, accounts, dashboard) read fresh data when opened; nothing is patched locally.

### Idempotency

The client sends no `Idempotency-Key`. The backend derives the key from the occurrence: `recurring:{ruleId}:{dueDate}`, returned as `occurrence.idempotency_key`. Because the request names the occurrence, the same occurrence can't be posted twice, and a repeat can't reach a different one.

### Unknown outcome

After a network error, timeout or 5xx, the dialog cannot know whether the occurrence was posted. Retrying the same occurrence would be safe on the new backend, but the deployed backend still picks "the next" occurrence. So, as before:

- the message says the outcome is unknown and asks to check the history;
- the confirm button is disabled (only Close remains);
- closing the dialog refreshes the rule and the history before anything else can be done.

### Stale occurrence (409)

`recurring_occurrence_not_next` and `recurring_occurrence_not_open` are shown in both languages (`dashboard.recurring.errors.occurrenceNotNext` / `occurrenceNotOpen`; the codes are read from `error.serverCode`).
- The confirm button is disabled, because the same request would get the same answer.
- Closing the dialog refreshes the page.

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
- a hint explains what actually happened:
  - nothing was posted and no money moved;
  - the backend recorded this date as **failed** and moved the schedule on to the next date (`PostOccurrenceAction::recordFailure` → `advance`). A failed occurrence is settled; it is not posted again;
  - fix the problem (for example, add funds) before confirming the next date;
- the confirm button is disabled. Before this change, "Try again" sent a request with no body, and the backend then posted the **next** date: the same bug. Sending the named date again returns the same failure;
- the page is refreshed when the dialog closes, so the failed occurrence (with its attempts and reason) appears in the history, and the next date is offered.

Other 422s are handled too:
- "no open occurrence" (hint: nothing to act on);
- insufficient balance without an occurrence payload (hint: add funds);
- any other domain message (hint: nothing was posted).

## Skip next — `POST /recurring-transactions/{id}/skip-next`

- **Moves no money** and creates no transaction; the dialog says so.
- **Body:** `{ "occurrence_id": <schedule.next_occurrence.id>, "reason"?: "Paid in cash this month" }`, sent by `recurringTransactionsApi.skipNext(ruleId, occurrenceId, reason?)`. The reason is sent only when one is typed (≤ 500 characters; a backend `reason` error is shown under the field).
- **The backend** closes the named occurrence as `skipped`; it stays in the history with the reason. A repeat returns the same skipped occurrence (the first reason is kept) and never skips the following date.
- **On success,** `data.recurring_transaction` is shown (the backend's new `next_due_date`, never computed here), then the rule and history are refetched.
- **Offered only** for active rules whose schedule names an open occurrence.

## Mobile

Mobile's confirm and skip forms (`/m/planning/recurring/:id/confirm|skip`) send the same `occurrence_id`:
- `forms/workflows.js` `pickRule` reads `nextOccurrenceId`, and `forms/writePayloads.js` sends it;
- a rule with no open occurrence is ineligible (`noOpenOccurrence`).

Both writes stay closed in `src/mobile/data/writeGate.js`: they are classified `next-open`, which can never be approved, until this backend change is deployed. See `docs/mobile/WRITE-INTEGRATION.md`.

## Tests

`tests/recurringOccurrence.test.mjs` covers:
- the wrapper's bodies, and its refusal without an id;
- which occurrence a rule offers;
- the 409 messages;
- the list and details pages sending the shown occurrence;
- no resend after a 409 or a failed occurrence;
- Mobile's payloads and eligibility, with both writes still closed.

## Mobile: stale occurrence

On Mobile a 409 `recurring_occurrence_not_next` or `recurring_occurrence_not_open` is classified as a certain rejection (`CERTAIN_409` in `src/mobile/forms/useWorkflowSubmit.js`): the backend raises it before anything is posted or skipped. The form shows `forms.outcome.recurringStale`, every cached read is dropped so the rule is read again, and nothing is resent. Any other 409 stays an unknown outcome. Both writes are still closed (`APPROVED = []`). Tests: `tests/recurringOccurrence.test.mjs`.
