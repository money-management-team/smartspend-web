# AI Expense Captures — Discarding a capture

`DELETE /ai/expense-captures/{id}` and the Discard action on `/dashboard/ai-expense-captures/:captureId`.

> ## What discard is, and what it is not
>
> **It is:** the user saying they no longer want this AI draft. The capture moves to `discarded`.
>
> **It is not:** deleting a confirmed Transaction, reversing one, removing Ledger Entries, adjusting an account balance or a budget, or undoing Confirm. There is nothing financial to undo, because a capture creates none of that until it is confirmed.
>
> A confirmed expense can never be removed through this endpoint, and the UI never offers it a route to try.

## Endpoint

`aiExpenseCapturesApi.discard(captureId, { idempotencyKey, signal })` → `apiRequest("/ai/expense-captures/{id}", { method: "DELETE" })`. Fetch-based, no axios, same API module. `VITE_API_BASE_URL` already ends in `/api`, so the module's path carries no `/api` prefix of its own. No component calls `apiRequest` directly.

## Request

**No body.** The contract documents none, so `body` is left undefined — which also keeps `Content-Type` off the request. Not sent: `reason`, `review_version`, `review_values`, `amount`, `account_id`, `category_id`, `user_id`, `workspace_id`. The capture is identified by the path alone.

### Idempotency

Optional, exactly as for Retry: Sprint 7 recommends a key for writes without requiring one here, and discard creates nothing. The key is sent when available and the call does not depend on it — a backend that ignores the header behaves identically.

It reuses the shared `createIdempotentAttempt(DISCARD_ATTEMPT_PREFIX)`. **No second idempotency system**, and no `Math.random`, `Date.now` or UUID generated in a component. One key per logical discard: a timeout, a 5xx or a rate limit keeps it, so pressing Discard again is the same request rather than a second destructive one; success or a definitive refusal retires it.

## When Discard is offered

`canDiscardCapture(status)` — `DISCARDABLE_STATUSES`, unchanged since Task 1:

| Status | Discard | Why |
| --- | --- | --- |
| `uploaded` | Yes | A draft that created nothing |
| `queued` | Yes | Same |
| `processing` | **No** | The backend is mid-flight; the UI waits rather than racing it |
| `ready_for_review` | Yes | A draft the user can abandon |
| `failed` | Yes | Same |
| `confirmed` | **No** | Money exists. Discard must never reach it |
| `discarded` | **No** | Already final |

The check lives in `CaptureDiscard`, which returns `null` otherwise, so the rule is stated once and no status string is compared in the page.

### processing, re-reviewed

The Sprint 7 guide lists `uploaded`, `queued`, `ready_for_review` and `failed` and says nothing clear about `processing`. Task 1 excluded it; that decision was re-examined for this task and **kept** — there is no backend evidence for the transition, and "DELETE exists" is not evidence. Loosening it would be inventing a lifecycle move.

### Confirmed safety

`confirmed` is not in the list, so the button cannot render. If UI state were stale and a DELETE went out anyway, the backend refuses it — and **a refusal is never read as permission to remove anything locally**. `confirmed_transaction_id` is never cleared, the transaction card is never hidden, and nothing is deleted from state. Verified: after a refused discard on a confirmed capture, both the status and the transaction id are still there.

## The confirmation dialog

Discard never fires on the first click. An `alertdialog` (the project's existing modal shell, the same one Confirm uses) states plainly:

- the reviewed draft is abandoned and can no longer be edited;
- **no expense is created from this receipt**;
- **no existing transaction is deleted, reversed or changed** — defensive clarity, since the button cannot appear on a confirmed capture, but "discard" must not be read as "delete my expense";
- the receipt stays in the list as discarded, so it remains auditable.

Actions are **Cancel** and **Discard capture**. The wording is never "delete expense", "remove expense" or "reverse"; the Arabic is تجاهل المسودة / تجاهل هذه الفاتورة, never حذف المصروف.

## Unsaved review edits

They are **not** saved first, and the dialog says so: "Your unsaved changes won't be saved — they won't matter once this is discarded."

Confirm and Discard have opposite intent. Confirm saves the latest reviewed values because money is about to move against them; Discard is the user saying no expense should exist, so PATCHing their draft first would be the wrong reading of the click. **No PATCH is sent before the DELETE** — verified: a dirty draft still produces exactly one request.

## One action lock

The details page can render Save, Retry, Confirm and Discard depending on status. All four report into a **single** `isActionBusy` lock on the page: whichever is in flight holds it, the others are disabled, and the review form is locked. One mechanism, not a flag per action, and no second coordination system.

On top of that, each action keeps its own synchronous `pendingRef`, so a double click cannot send two requests before React re-renders. Three rapid clicks send one DELETE.

Which combinations can appear:

| Status | Actions |
| --- | --- |
| `ready_for_review` | Save · Confirm · Discard |
| `failed` | Retry · Discard |
| `uploaded`, `queued` | Discard |
| `processing` | none |
| `confirmed`, `discarded` | none |

Each is verified against the shared helpers, so no impossible combination can be rendered.

## Success

```json
{ "status": true, "message": "AI expense capture discarded successfully.",
  "data": { "capture": { "id": 15, "status": "discarded" } } }
```

The response is **partial**, so it is merged with `mergeCaptureUpdate`, never swapped in. `review_values`, `ai_suggested_values`, `review_version`, `warnings` and `source_type` all survive — each verified individually.

Afterwards the status is `discarded`, so `canReviewCapture`, `canRetryCapture`, `canConfirmCapture` and `canDiscardCapture` are all false: the form is read-only and every action disappears together. The page stays where it is and shows the final state; **it does not navigate away**.

## Nothing is deleted locally

`discarded` is a valid final lifecycle state, not a disappearance. The record is **not** removed from React state, not treated as a 404, not dropped from any list cache, and none of its history is erased — suggestions, review values, warnings and receipt metadata all stay readable.

The list endpoint accepts `status=discarded`, so the record remains part of the system and auditable. Returning to the list refetches it and the new status appears through that ordinary fetch. **No global cache machinery was added**, and nothing removes the row by hand.

## Errors

| Code | Behaviour |
| --- | --- |
| `401` | Never surfaces here: `apiClient` ends the session and `AuthProvider` signs the user out. Not duplicated |
| `403` | The page's existing access-denied wording, and no retry offered |
| `404` | The page's existing not-available wording, and no retry offered. A 404 is **not** read as a successful discard |
| `422` | The capture is no longer discardable: **one** GET, never another DELETE |
| `429` | The shared rate-limit message with its retry-after seconds. Nothing retries by itself; the attempt is preserved |
| `5xx`, timeout, network | An unknown outcome, below |

### The 422 lifecycle case

DELETE sends no body, so a 422 cannot be about a field — the only thing left to validate is the capture's own state. `isLifecycleRejection(error)` (shared with Retry, which asks the same question for the same reason) treats it as "the lifecycle moved", and the page refetches once.

The important case: the UI thought `ready_for_review`, the backend has it `confirmed`. DELETE answers 422, one GET follows, and the page renders the confirmed read-only state with its transaction card intact. **Never a second DELETE**, and nothing is removed locally on the way.

A 409 is deliberately excluded: with an idempotency key in play it means "the same request is still being processed", which a refetch would not explain.

### An unknown outcome

A timeout, a dropped connection, a 5xx or an unreadable body means the discard may or may not have landed. Nothing claims success:

- the message is "We don't know whether this was discarded", in the warning tone, not the failure tone;
- the key is kept, so a retry is the same request;
- **one** automatic `GET /ai/expense-captures/{id}` runs to find out — a read, never another DELETE, and never a loop;
- if that read is inconclusive, **Check status** is offered manually.

### Check status

`GET /ai/expense-captures/{id}` and nothing else — the same `handleCheckStatus` that Confirm uses, shared rather than written twice. It cannot discard anything.

| Result | What happens |
| --- | --- |
| `discarded` | The discard landed. The capture is replaced with the server's copy and the attempt retires |
| still discardable | It did not land. The **same** key remains available, so the user can explicitly retry the same logical action |

## No financial side effect

Discard creates no transaction, reverses none, deletes none, touches no ledger entry, and changes no balance, budget or report total. Nothing is refetched or invalidated merely because a draft was abandoned — there is nothing financial to refresh. Audited: no `transactionsApi`, no `/reverse`, no balance or budget arithmetic anywhere in the discard path.

## No review_version

The documented request has none and none is added. Discard is not coupled to the draft's dirty/version model at all — the dirty flag is used only to decide whether the dialog mentions unsaved changes.

## Accessibility

A real `alertdialog` with `aria-modal`, a labelled title and description, Escape to close, and an overlay click ignored while a request is in flight — the same behaviour as `CaptureConfirm`. Every control is a real `<button>`. The discarding and checking states are announced through a `role="status"` line and `aria-busy`; errors use `role="alert"`. The destructive meaning is carried by the label and the dialog, never by colour alone.

## Responsive, RTL and theme

The existing modal shell and design tokens, so dark mode follows automatically. Logical properties throughout and full-width actions below 640px. No new modal or design library.

## Contract ambiguity

1. **Whether `processing` is discardable.** The guide does not say. Excluded, as Task 1 decided — the backend is mid-flight and no transition is documented. Adding it later is one entry in `DISCARDABLE_STATUSES`.
2. **How a 422 announces "not discardable".** No documented field or code, so any 422 on this bodyless request is read as one and answered with a single read.
3. **Whether the backend honours `Idempotency-Key` here.** Recommended for writes generally, unstated for discard. The implementation is correct either way.
