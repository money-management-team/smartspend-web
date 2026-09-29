# AI Expense Captures — Confirming the reviewed expense

`POST /ai/expense-captures/{id}/confirm` and the confirmation dialog on `/dashboard/ai-expense-captures/:captureId`.

> ## This is the only money-moving action in Sprint 7
>
> Everything before it is a draft, however complete it looks. After it the backend has run its normal posting pipeline: a **Transaction**, its **Ledger Entries**, the capture linked to that transaction, the account balance moved and any covering budget affected.
>
> **None of that is computed in the frontend.** The page sends one request and renders the answer. It never subtracts an amount from a balance, never adjusts budget progress, and never invents a transaction record.

## Endpoint

`aiExpenseCapturesApi.confirm(captureId, payload, { idempotencyKey, signal })` → `apiRequest("/ai/expense-captures/{id}/confirm", { method: "POST", body })`. Fetch-based, no axios, same API module as the rest of Sprint 7. `VITE_API_BASE_URL` already ends in `/api`, so the module's path carries no `/api` prefix of its own.

No component calls `apiRequest` directly. The page owns the request and hands the dialog an `onConfirm()` that throws on failure — the same shape Save and Retry already use.

## Request body

```json
{ "review_version": 3 }
```

**`review_version` and nothing else.** `buildCaptureConfirmPayload(capture)` is the only thing that builds it, and it can produce no other key.

Not sent, ever: `account_id`, `category_id`, `merchant_name`, `amount`, `currency_code`, `transaction_date`, `transaction_time`, `reference_number`, `tax_amount`, `fee_amount`, `description`, `ai_suggested_values`, `review_values`, `status`, `confirmed_transaction_id`, `user_id`, `workspace_id`.

The backend reads every financial field from the draft it already saved. Restating any of them here would create a second source of truth for money, and the two could disagree.

A capture with no usable `review_version` produces no payload at all — the version is never guessed, never defaulted to `0`, never incremented locally.

## Save before confirm

The backend confirms **the draft it holds**, so unsaved edits have to reach it first, and the version Confirm carries must be the one that save returned.

The page orchestrates this, in this order and never the other way round:

1. If the draft is dirty, save it through the **existing PATCH flow** (`handleSave`) — PATCH logic is not duplicated in the confirm path.
2. Take the `review_version` from what that save returned.
3. `POST /confirm` with that version.

`handleSave` **returns** the merged capture rather than only storing it, because Confirm runs in the same tick and cannot see a state update yet. A save that fails throws, and Confirm is never reached — no idempotency key is minted and no POST is sent.

The dialog says so before it acts: when the draft is dirty it shows "Your unsaved changes will be saved first, then confirmed."

### Why the draft lives in the page

`ReviewValues` is a **controlled** form: the page owns the draft values and passes them down. A draft held inside the form would be invisible to a sibling Confirm, and Confirm would have no safe way to know whether what it was about to spend had been saved. Everything else about the form — validation, touched fields, saving, conflicts — stays local to it.

The values are derived by fetch key, so a reload reseeds them from the server's copy while a save, which shares the key, leaves what the user typed alone.

## Eligibility

Confirm renders only when `canConfirmCapture(status)` — `ready_for_review`. The check lives in `CaptureConfirm`, which returns `null` otherwise, so the rule is stated once. `uploaded`, `queued`, `processing`, `failed`, `confirmed` and `discarded` get no Confirm action at all.

### What the draft must contain

`CAPTURE_CONFIRM_REQUIRED_FIELDS` — `account_id`, `category_id`, `amount`, `currency_code`, `transaction_date` — plus anything the form's own `validateCaptureForm` rejects. The missing fields are **named** in the UI rather than described as "invalid".

Saving a draft and confirming an expense are different bars: PATCH documents every field as optional and the draft form requires none, while an expense cannot exist without these. They are not new rules — every expense-creating path in this app already requires exactly them (`NewOperation`, `ReviewOperationDialog`).

> `category_id` is the one the Sprint 7 contract does not state explicitly; it comes from the project's own expense rule ("Choose a category. Expenses need one."). See [Contract ambiguity](#contract-ambiguity).

The backend remains authoritative and may still refuse what passes here.

## Idempotency — mandatory

This is the request that must never post twice, so a missing key is refused by the API module before anything is sent.

The key comes from the shared `createIdempotentAttempt(CONFIRM_ATTEMPT_PREFIX)`. **No second idempotency system exists**, and no component generates a UUID, a `Math.random` or a `Date.now` of its own.

One key per logical confirmation, fingerprinted on the capture:

| Outcome | Key |
| --- | --- |
| Success | **Retired.** A later confirmation is a genuinely new operation |
| 422, 403, 404 | **Retired.** Nothing was created and the user must change something first |
| Timeout, network failure, 5xx, unreadable body | **Kept.** The outcome is unknown |
| 429 | **Kept.** The same intent is still unresolved |

That is exactly the rule this needs: a technical retry must never become a second financial attempt. Pressing Confirm again after a timeout replays the original request; the backend answers with the original result instead of creating a second expense.

### Replay of the same key

If the backend replays a successful response for the same key, the frontend treats it as **success** — not a duplicate error. The transaction id that comes back is the same one, and no second local record is created.

## Double submission

Two guards, not one: the button is disabled while the request is in flight, **and** a synchronous `pendingRef` blocks a second call that fires before React re-renders. Three rapid clicks send one POST.

While a confirmation is in flight the review form is locked (`isLocked`): its inputs and its Save are disabled, so a PATCH can never race the POST that is about to spend the draft.

## The confirmation step

Confirm never posts on the first click. It opens a dialog (`role="alertdialog"`, the project's existing modal shell) that states plainly what will happen:

- a real expense transaction is created in the ledger;
- the balance of the selected account changes;
- it counts towards any budget covering the category;
- **the reviewed values are used, not the AI's suggestions**.

Then a summary of what will be recorded: account, category, merchant, amount, currency, transaction date and description, from `CAPTURE_CONFIRM_SUMMARY_FIELDS`.

The summary is the **reviewed draft**. No `ai_suggested_values` appear in it at any confidence — those stay in their own section, as historical extraction context. Where the draft has unsaved edits, the summary shows what will actually be confirmed, which is what the save in step 1 is about to store.

## Success

Documented as **201**. `apiRequest` decides success with `response.ok`, which is true for every 2xx, so 201 is accepted exactly like 200 and **nothing special-cases either** — verified against `apiClient.js` rather than assumed.

```json
{ "status": true, "data": {
  "capture": { "id": 15, "status": "confirmed", "confirmed_transaction_id": 91 },
  "transaction": { "id": 91, "type": "expense", "status": "posted",
                   "amount": "25.0000", "currency_code": "ILS", "source": "receipt_ocr" } } }
```

`parseConfirmResponse` reads `data.capture` and `data.transaction`; neither is assumed to be at `data` itself, and the transaction is optional.

The capture response **may be partial**, so it is merged with `mergeCaptureUpdate`: `ai_suggested_values`, `warnings`, `source_type` and every other GET-only field survive. A response whose capture isn't the one just confirmed is a malformed answer rather than something to merge.

Afterwards, because the status is now `confirmed`:

| Section | State |
| --- | --- |
| Review values | Read-only — `canReviewCapture("confirmed")` is false. No Save, no editing |
| Confirm | Gone — `canConfirmCapture("confirmed")` is false |
| Retry | Gone — `canRetryCapture("confirmed")` is false |
| AI suggestions | Still shown, as a record of what the AI read |
| Original receipt | Unchanged |
| Recorded transaction | Shown |

No section is hidden by a status compared inline; each uses its own shared helper.

## The transaction

The details page's existing "Recorded transaction" section is reused — **no second transaction page was created**. The id links to the existing route through `getTransactionDetailsPath(id)`.

When this page is the one that created the transaction, the returned object fills in type, status, amount and source beside the link, shown exactly as the backend sent them. A capture fetched later carries only `confirmed_transaction_id`, and the link alone is then what appears — nothing is invented to fill the gap.

## An unknown outcome

A timeout, a dropped connection, an ambiguous 5xx or an unreadable body means **the expense may or may not exist**. This is handled as its own state, not as a failure:

- the message is "We don't know whether this was recorded", never "confirmation failed, try again";
- it is drawn in the warning tone, not the failure tone;
- the key is kept, so a retry replays rather than re-posts;
- **one** automatic `GET /ai/expense-captures/{id}` runs to find out what the backend holds — a read, never a second POST, and never a loop;
- if that read is inconclusive, **Check status** is offered manually.

### Check status

`GET /ai/expense-captures/{id}` and nothing else. It cannot create an expense.

| Result | What happens |
| --- | --- |
| `confirmed` | The confirmation landed. The capture is replaced with the server's copy, `confirmed_transaction_id` is used, the page goes read-only, and the attempt is retired. **No second POST** |
| still `ready_for_review` | It did not land. The **same** key remains available, so retrying is the same request, not a new one |

A full GET replaces the capture rather than merging it: it is the whole record, and a capture the backend has since confirmed arrives complete.

## Errors

| Code | Behaviour |
| --- | --- |
| `401` | Never surfaces here: `apiClient` ends the session and `AuthProvider` signs the user out. Not duplicated |
| `403` | The page's existing access-denied wording, and no retry offered |
| `404` | The page's existing not-available wording, and no retry offered |
| `429` | The shared rate-limit message with its retry-after seconds. Nothing retries by itself; the attempt is preserved |
| `5xx` | Treated as an unknown outcome, above. **The key is never regenerated** |

### The four kinds of 422

A 422 arrives for very different reasons, and `getConfirmErrorKind(error)` separates them because each needs its own answer:

| Kind | Detected by | Answer |
| --- | --- | --- |
| `version` | `isCaptureVersionConflict` — the error actually names `review_version` | The concurrency UX. **No auto-retry, no local increment, no resend.** The user presses **Reload latest** |
| `balance` | `isInsufficientBalanceError` (shared with transactions) | "This account doesn't have enough available balance", plus "Nothing was recorded and no balance changed" |
| `fields` | The error names a field the review form renders | The messages go **onto those fields** in `ReviewValues`, through its existing error pathway. No second field-error renderer |
| `lifecycle` | A 422 naming nothing we render | The capture is most likely no longer `ready_for_review`: **one** GET to show where it really is. Never another POST |

**Not every 422 is a version conflict.** Ordinary validation stays inline on the fields.

### A stale review_version

On a version conflict the attempt is retired (nothing was created, and the next confirmation will be a genuinely different one), the concurrency message appears, and the only way forward is **Reload latest** → `GET /ai/expense-captures/{id}`, which replaces `review_values`, `review_version` and `status` with the server's copy.

**Nothing confirms automatically after that reload.** The draft may have changed underneath the user, so they look again and decide. The reload discards local unsaved changes, and the dialog says so.

### Insufficient balance

The contract documents this as a 422, and it means **no Transaction and no Ledger Entry were created**. So nothing local changes: no balance is adjusted, no capture state is touched, and the capture stays `ready_for_review` and editable so the user can pick another account or correct the amount.

## No local financial state

Nothing in this feature computes `oldBalance - amount`, adjusts budget spent or remaining, or edits dashboard, report or transaction totals. There is no global cache to invalidate and **none was invented for this task** — the normal endpoints return updated values when those pages are next loaded.

Returning to the AI receipts list refetches it, so the confirmed status appears through its ordinary fetch, with the list's filters preserved by the existing back-link state.

## Accessibility

The dialog is a real `role="alertdialog"` with `aria-modal`, a labelled title and description, Escape to close, and an overlay click that is ignored while a request is in flight. Every control is a real `<button>`. The submitting and checking states are announced through a `role="status"` line and `aria-busy`, not conveyed by a disabled attribute alone. Errors use `role="alert"` and are text, never colour alone — the unknown-outcome state is distinguished by its wording, not only by its tone.

## Responsive, RTL and theme

The existing modal shell and design tokens, so dark mode follows automatically. Logical properties throughout, `<bdi>` around ids and amounts, and full-width actions below 640px. No new modal or design library.

## Contract ambiguity

1. **Whether `category_id` is required to confirm.** The Sprint 7 contract does not say. It is required here because every expense in this app requires one; if the backend is laxer, removing it from `CAPTURE_CONFIRM_REQUIRED_FIELDS` is a one-line change.
2. **How a 422 announces an invalid lifecycle.** No documented field or code, so a 422 naming nothing the form renders is read as one and answered with a single read. A documented marker would make this exact instead of inferred.
3. **Whether the backend replays the transaction for a repeated key.** Assumed, and handled as success either way. If it instead answers 409, that is treated as an unknown outcome and the key is kept — still safe.

## Not in this task

Nothing: all seven documented Sprint 7 endpoints are integrated. The source preview remains blocked on a signed URL the contract never delivers.

`DELETE /ai/expense-captures/{id}` arrived in Task 8 — see [discard.md](discard.md). It is the opposite intent to this one and creates nothing, and a `confirmed` capture is never discardable, so the two can never meet on the same capture.
