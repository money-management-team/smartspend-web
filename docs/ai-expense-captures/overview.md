# AI Expense Captures — Overview

A receipt is uploaded, the backend's AI reads it, and the user **reviews and confirms** what it found before anything is recorded. The feature is a review-and-confirm queue, not an upload tool.

## The rule the whole feature protects

> No Transaction and no ledger entry exists until the user explicitly confirms a reviewed capture.

Everything before `confirmed` is a draft, however complete it looks on screen. **Confirm is the only money-moving action in Sprint 7.** Discard never creates a transaction — and never deletes or reverses one either; it abandons a draft, and `confirmed` is not discardable at all. See [discard.md](discard.md).

Confirm is implemented in [confirm.md](confirm.md): it carries `review_version` alone, must carry an `Idempotency-Key`, saves any unsaved draft first, and computes no financial value locally — the backend's posting pipeline owns the transaction, the ledger entries, the balance and the budget.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Purpose, scope, statuses, lifecycle, routing plan (this file) |
| [review-model.md](review-model.md) | AI suggestions vs review values, `review_version`, money rules |
| [list.md](list.md) | `GET /ai/expense-captures` and the list page: filters, paginator, URL state, states |
| [details.md](details.md) | `GET /ai/expense-captures/{id}` and the review screen: suggestions, review values, warnings |
| [editing.md](editing.md) | `PATCH /ai/expense-captures/{id}`: the editable draft form, `review_version`, conflicts |
| [retry.md](retry.md) | `POST /ai/expense-captures/{id}/retry`: requeuing a failed capture, and the status polling that follows |
| [confirm.md](confirm.md) | `POST /ai/expense-captures/{id}/confirm`: the only money-moving action — idempotency, save-before-confirm, uncertain outcomes |
| [discard.md](discard.md) | `DELETE /ai/expense-captures/{id}`: abandoning a draft, and why it deletes no money |
| [upload.md](upload.md) | `POST /ai/expense-captures`: creating a capture from a receipt — **undocumented endpoint, assumptions flagged** |
| [source.md](source.md) | `GET /ai/expense-captures/{id}/source`: signed URL, MIME handling, preview, download |
| [foundation.md](foundation.md) | What Task 1 built, what it reuses, what is deliberately absent |

## Endpoint scope

Seven documented endpoints, **all integrated**:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/ai/expense-captures` | List — **implemented**, see [list.md](list.md) |
| `GET` | `/ai/expense-captures/{id}` | One capture — **implemented**, see [details.md](details.md) |
| `GET` | `/ai/expense-captures/{id}/source` | The original file — binary, not the JSON envelope. Infrastructure built; **blocked on a signed URL the contract never delivers**, see [source.md](source.md) |
| `PATCH` | `/ai/expense-captures/{id}` | Update the review draft — **implemented**, see [editing.md](editing.md) |
| `POST` | `/ai/expense-captures/{id}/retry` | Re-run AI processing after a failure — **implemented**, see [retry.md](retry.md) |
| `POST` | `/ai/expense-captures/{id}/confirm` | Create the expense transaction — **implemented**, see [confirm.md](confirm.md) |
| `DELETE` | `/ai/expense-captures/{id}` | Discard the draft — **implemented**, see [discard.md](discard.md) |

**There is still no _documented_ create/upload endpoint.** `POST /ai/expense-captures` is absent from the Sprint 7 contract. It was nevertheless wired in a later task, on the strength of the product flow diagram rather than a contract — see [upload.md](upload.md), where every assumed value is listed. Until the backend confirms the path, the field name and the response shape, that path is **wired but unverified**, and a missing route surfaces as "not connected yet" rather than as a file problem.

## Statuses

Seven documented values, centralised in `AI_CAPTURE_STATUS` / `AI_CAPTURE_STATUSES` (`captureConstants.js`).

| Status | Transaction exists? | Meaning |
| --- | --- | --- |
| `uploaded` | No | The capture exists but is not queued yet |
| `queued` | No | Waiting for AI processing |
| `processing` | No | AI processing is running |
| `ready_for_review` | No | AI finished; the user can review and edit |
| `failed` | No | AI processing failed; retry may be possible |
| `confirmed` | **Yes** | The backend created the expense transaction; read-only |
| `discarded` | No | The draft was intentionally abandoned; read-only |

`ready_for_review` is the **canonical** spelling. The Sprint 7 guide phrases it differently in one prose section; only this form is supported, and no second variant is accepted "just in case". An unknown status is displayed as it came rather than reinterpreted — the same rule `ImportStatusBadge` already follows.

The Imports feature (Sprint 6) also has a status named `ready_for_review`, for an unrelated lifecycle. The two vocabularies are separate on purpose: `IMPORT_STATUSES` and `AI_CAPTURE_STATUSES` never share constants, translation keys or badge components.

## Lifecycle

```
uploaded ──▶ queued ──▶ processing ──┬──▶ ready_for_review ──┬──▶ confirmed   (transaction created)
                                     │                       └──▶ discarded
                                     └──▶ failed ──▶ retry ──▶ queued
                                                  └──────────▶ discarded
```

The backend owns every transition. The frontend never advances a status itself; a helper returning `true` only means "offer this action", and the backend may still refuse it.

While a capture is `uploaded`, `queued` or `processing` the details page follows it by re-reading `GET /ai/expense-captures/{id}` on a growing delay, and stops as soon as the status settles. See [retry.md](retry.md).

## Action rules

Centralised in `captureHelpers.js` so no component compares status strings.

| Status | Edit | Confirm | Retry | Discard | Notes |
| --- | --- | --- | --- | --- | --- |
| `uploaded` | — | — | — | Yes | Pending state |
| `queued` | — | — | — | Yes | Pending state |
| `processing` | — | — | — | — | Pending state; the UI waits rather than racing the backend |
| `ready_for_review` | Yes | Yes | — | Yes | The only status that can confirm |
| `failed` | — | — | Yes | Yes | |
| `confirmed` | — | — | — | — | Read-only; offers "View transaction" |
| `discarded` | — | — | — | — | Read-only |

| Helper | Statuses |
| --- | --- |
| `isCaptureProcessing(status)` | `uploaded`, `queued`, `processing` — the backend still owes a result, so the UI shows a pending state and (from Task 2) polls. `uploaded` is included because nothing in the UI can advance it |
| `isCaptureFinal(status)` | `confirmed`, `discarded`. `failed` is deliberately **not** final: retry can revive it |
| `canReviewCapture(status)` | `ready_for_review` — the one status whose draft may be edited and saved |
| `canConfirmCapture(status)` | `ready_for_review` — the only status that can create an expense |
| `canRetryCapture(status)` | `failed` — the one status that may be requeued for another AI attempt |
| `canDiscardCapture(status)` | `uploaded`, `queued`, `ready_for_review`, `failed`. Never `processing` (the backend is mid-flight), and never `confirmed` — money exists there. Re-examined in Task 8 and kept |

`captureHasTransaction(capture)` states the core rule as one check, and `getConfirmedTransactionId(capture)` returns the id only once confirmed — so a "View transaction" link cannot appear on a draft.

## Routing

| Constant | URL | Page | Status |
| --- | --- | --- | --- |
| `PATH.USER.AI_EXPENSE_CAPTURES` | `/dashboard/ai-expense-captures` | `AiExpenseCaptures.jsx` | Added |
| `PATH.USER.AI_EXPENSE_CAPTURE_DETAILS` | `/dashboard/ai-expense-captures/:captureId` | `AiExpenseCaptureDetails.jsx` | Added |

Both routes are in the `user` group, behind `RequireAuth` + `DashboardLayout`, like every other dashboard page. The review route is nested under the list, which keeps the sidebar item highlighted on it. `getAiExpenseCapturePath(id)` is the single builder, beside the other `get*Path` helpers in `Path.js`. The names avoid `AI_ASSISTANT` (`/dashboard/ai-assistant`), which is a different feature.

## Sidebar

`dashboard.sidebar.aiCaptures` — **AI Receipts** / **الفواتير الذكية** — in the **Overview** group, after Import history, with `LuReceiptText`. It is the same kind of "bring money in from a document" work as the import wizard.

The Arabic follows terminology the product already uses: **فاتورة / فواتير** for a receipt (as in the financial operations scan panel) and **الذكية** for AI, matching **المساعد الذكي**. "إيصالات" appears nowhere else in the product and was not introduced.

The user-facing name is "AI receipts"; `ai_expense_captures` stays the internal and API name. The two are kept apart on purpose — the route, module and constants use the backend's wording, the UI uses the user's.

## Related existing UI

`FinancialOperations`' receipt tab (`components/ReceiptCapture/`) is now the entry point to this feature: it uploads the image and navigates to the new capture's details page, where the review and confirm flow takes over. See [upload.md](upload.md).
