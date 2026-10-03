# AI Expense Captures — Retrying failed AI processing

`POST /ai/expense-captures/{id}/retry`, the Retry action on `/dashboard/ai-expense-captures/:captureId`, and the status polling that follows it.

> **This requeues AI processing. It moves no money.** No transaction, no ledger entry, no balance change, no budget change — and it does not touch the reviewed draft either. The expense is created only by Confirm — see [confirm.md](confirm.md).

## Endpoint

`aiExpenseCapturesApi.retry(captureId, { idempotencyKey, signal })` → `apiRequest("/ai/expense-captures/{id}/retry", { method: "POST" })`. Fetch-based, no axios, same API module as the rest of Sprint 7. `VITE_API_BASE_URL` already ends in `/api`, so the module's path carries no `/api` prefix of its own.

**No request body.** The contract documents none, so none is invented: `body` is left `undefined`, which also keeps `Content-Type` off the request. The capture is identified by the path alone. No `user_id` and no `workspace_id` — authorization is the backend's, from the bearer token.

### 202 is a success

`apiRequest` decides success with `response.ok`, which is true for **every** 2xx. So a 202 is accepted exactly like a 200 and **nothing special-cases either** — this was verified against `apiClient.js` rather than assumed, and no status list was introduced.

### Idempotency

Sprint 7 calls a key *recommended for write requests* but does **not** require one here, and retry creates nothing. So the key is sent when available and the call does not depend on it — a backend that ignores the header behaves identically.

It reuses the project's existing `createIdempotentAttempt` with `RETRY_ATTEMPT_PREFIX` (`"ai-capture-retry"`), beside `ai-capture-confirm` and `import-confirm`. **No second idempotency system was built.** What it buys is the ambiguous case: after a timeout or a dropped connection the attempt keeps its key, so pressing Retry again replays the original request instead of queuing the capture twice. A success or a definitive rejection retires it, so a genuinely new retry later is a new operation.

## When Retry is offered

Only when `canRetryCapture(status)` — that is, **`failed`**. The check lives in `CaptureRetry` itself, which renders `null` otherwise, so the rule is stated once and the page cannot get it wrong.

`uploaded`, `queued`, `processing`, `ready_for_review`, `confirmed` and `discarded` get no Retry button at all. Nothing offers an action the backend would refuse.

## Response

```json
{ "status": true, "data": { "capture": { "id": 15, "status": "queued" } } }
```

The capture is at `data.capture`, parsed with `parseCaptureResponse`, and a record whose id isn't the one just retried is treated as a malformed answer rather than merged.

**The response may be partial** — `id` and `status` alone. It is therefore **merged** with `mergeCaptureUpdate`, not swapped in: `review_values`, `ai_suggested_values`, `review_version`, `warnings`, `source_type` and every other GET-only field survive. Absence is not deletion.

The status is applied **exactly as it came**. The frontend never jumps ahead to `processing` or `ready_for_review`; `failed → queued` is the backend's transition, and the UI reflects it immediately.

## Status polling

After the status changes the capture keeps moving on its own, so the details page re-reads `GET /ai/expense-captures/{id}` until it settles. This is the same shape as Sprint 6's `useImportStatus`, kept as a small effect in the page rather than a new polling framework — the page already owns the capture state for the details fetch and the draft PATCH, and a hook would only have to hand it back.

### What is polled

`isCaptureInFlight(capture)` — the `PROCESSING_STATUSES` set: `uploaded`, `queued`, `processing`. That is precisely the complement of the documented stopping set (`ready_for_review`, `failed`, `confirmed`, `discarded`). `uploaded` is included for the same reason it counts as processing everywhere else in this feature: nothing in the UI can advance it, so leaving it unpolled would strand the page on a state only the backend can change.

### Intervals

| Check | Delay |
| --- | --- |
| 1–5 | 2.5s, 3s, 4s, 5s, 8s |
| 6 onwards | 10s |

The first check is deliberately seconds away, never milliseconds: AI processing will not finish in 300ms, and hammering the endpoint would cost the user a rate limit. No WebSocket — the project has no realtime contract.

### One timer, one request

The next check is scheduled **only** when the effect re-runs with a higher count, so two checks can never overlap and two timers can never exist. Each check runs under its own `AbortController`.

### Stopping

Polling stops on **all** of:

- the status leaving the in-flight set;
- a fatal error — `NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED` (`CAPTURE_FATAL_POLL_CODES`);
- `MAX_CAPTURE_POLLS` (30) checks, roughly four and a half minutes;
- unmount, and a change of `captureId` — the effect cleanup clears the timer and aborts the request in flight.

A transient error (a dropped connection, a 5xx) does **not** stop the checks, but it does count towards the limit, so a failing poll walks towards the cap instead of retrying forever at the same delay.

Polling never runs forever. When it stops while the capture is still in flight, the page says it is taking longer than expected and offers **Refresh status**, which refetches once.

**Stopping says nothing about the capture.** Nothing is marked failed because the frontend gave up; the backend's status remains the only truth.

### A fresh GET replaces, it does not merge

A poll returns the whole record, so it **replaces** the capture. Reprocessing can produce different `ai_suggested_values`, different `warnings` and a different `review_version`, and keeping the previous ones would show a result the backend has already discarded. Only the partial PATCH and Retry responses are merged.

That is also why nothing clears `review_values` locally on retry: whether reprocessing preserves or replaces the draft is the backend's answer to give, and the next GET gives it.

## Processing presentation

Each in-flight status now says what it actually means, instead of sharing one generic line:

| Status | Note |
| --- | --- |
| `uploaded` | Waiting to be queued for AI processing. Nothing has been recorded |
| `queued` | Waiting for AI processing. Nothing has been recorded |
| `processing` | AI processing is in progress. Nothing has been recorded |
| `failed` | The AI couldn't read this receipt. Nothing has been recorded |

While the backend is working the note is a **live region** (`role="status"`), so a screen reader hears the transition rather than only a sighted user seeing it. A settled status stays a plain `role="note"`.

Review editing is not offered in any of these states: the draft form is gated on `canReviewCapture(status)`, which is `ready_for_review` only. That was already true and is unchanged.

## Errors

| Code | Behaviour |
| --- | --- |
| `401` | Never surfaces here: `apiClient` ends the session and `AuthProvider` signs the user out. Not duplicated |
| `403` | The page's existing access-denied wording, and **no Retry button afterwards** — it will not change |
| `422` | The capture is no longer `failed`: **one** `GET /ai/expense-captures/{id}`, never another POST |
| `429` | The shared rate-limit message with its retry-after seconds. Nothing retries by itself |
| `5xx`, timeout, network | The message plus a note that the outcome is unknown, and **Refresh status** |

### The 422 lifecycle case

Retry sends no body, so a 422 cannot be about a field — the only thing left to validate is the capture's own state. `isRetryLifecycleError(error)` therefore treats any 422 as "the lifecycle moved", and the page refetches once so the user sees where it actually is instead of a stale screen.

A **409 is deliberately excluded**: with an Idempotency-Key in play it means "the same request is still being processed", which a refetch would not explain.

### Uncertainty

A timeout, a dead connection, a 5xx or an unreadable body leave the outcome genuinely unknown (`isUncertainRetryOutcome`). **Nothing claims the retry succeeded**, the capture's state is left as it was, and the offered action is **Refresh status** — a GET that can answer the question — rather than a second POST that might queue the capture twice.

No financial uncertainty wording is used, because retry creates nothing financial to be uncertain about.

### Failing again

If a poll later returns `failed`, polling stops and the failed state is shown again, with Retry available because `canRetryCapture("failed")` is true. A second click is a new user intent, with a new idempotency key — never an automatic loop.

## Accessibility

A real `<button>`, disabled while the request is in flight, with a `role="status"` line announcing the retrying state so it is not conveyed by a disabled attribute alone. Errors use `role="alert"` and are text, never colour alone. The processing note is a live region while the backend is working.

## Responsive, RTL and theme

No redesign: the same panel shape, BEM-prefixed `capture-retry__*` classes, logical properties (`margin-block-start`, `padding-inline`), existing tokens so dark mode follows, and a full-width action below 640px.

## The list page

Returning to the list refetches it, so the latest backend status appears through its normal fetch. **No global cache was built** for this, and the list's existing behaviour is untouched.

## Not in this task

Nothing: all seven documented Sprint 7 endpoints are integrated. The source preview remains blocked on a signed URL the contract never delivers — retry invents none.

`DELETE /ai/expense-captures/{id}` arrived in Task 8 — see [discard.md](discard.md). It shares this task's `isLifecycleRejection` helper, renamed from `isRetryLifecycleError` because a discard's 422 asks the same question for the same reason: neither request sends a body, so the only thing left to validate is the capture's state.

`POST /ai/expense-captures/{id}/confirm` arrived in Task 7 — see [confirm.md](confirm.md). It shares this task's `isUncertainOutcome` helper, which was renamed from `isUncertainRetryOutcome` when Confirm turned out to need exactly the same question answered, far more urgently.
