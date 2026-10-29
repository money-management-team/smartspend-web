# WhatsApp draft review: edit, confirm, discard

The details page (`/dashboard/whatsapp/drafts/:draftId`) is the review screen. Backend reference: `feature/whatsapp-availability-contract` @ `b7ca549` (not on `develop` yet; the live API may not have these contracts). Built on the TASK 04 adapter; the inbox is in `draft-inbox.md`.

## Files (`src/features/Dashboards/User/WhatsAppDrafts/`)

| File | Role |
| --- | --- |
| `WhatsAppDraftDetails.jsx` | Page. Mounts `DraftReview` under `key = user id + draft id`, so a different user or draft starts from nothing. |
| `useWhatsAppDraftReview.js` | State and the three writes (save, confirm, discard), the confirmation attempt, reconciliation. |
| `draftReview.js` | Pure logic: form ↔ draft, diff, client checks, reducer, error text. |
| `useDraftChoices.js` | Accounts and expense categories of the draft's own workspace (existing APIs). |
| `components/DraftReview/DraftEditForm.jsx` | The edit form. |
| `components/DraftReview/DraftActionsPanel.jsx` | Confirm, uncertain, success, discard and terminal states, plus both dialogs. |
| `components/DraftDetailsView/DraftDetailsView.jsx` | `FinancialCard`, `ReadinessCard`, `AboutCard` (read-only pieces). |
| `WhatsAppDraftLink.jsx` | Entry for the backend review link. |

Shared change: `ConfirmDialog` accepts `children` and `busy`, and a `primary` tone.

## Backend calls

| Action | Request | Notes |
| --- | --- | --- |
| Save | `PATCH /integrations/whatsapp/expense-drafts/{id}` | `{ review_version, ...changed fields }`. Editable: `account_id`, `category_id`, `amount` (decimal string), `description`, `transaction_date` (cannot be null), `transaction_time` (null clears). Response: the draft with the new `review_version`. |
| Confirm | `POST .../{id}/confirm` | Header `Idempotency-Key`, body exactly `{ "review_version": n }`. 201 `{ draft, transaction }`. No other field is ever sent. |
| Discard | `DELETE .../{id}` | 200 with the discarded draft. |
| Read | `GET .../{id}` | Used for load, refresh and every reconciliation. |

Errors (from the backend source): stale `review_version` and a key used for another operation are both 409; a draft that is not open, a missing date, an invalid account/category, insufficient balance are 422 and record nothing. There is no code to tell the 409s apart, so the screen reads the draft and decides from facts.

## States and what is allowed

Editing needs `status === ready_for_review && can_edit`; Confirm needs `can_confirm`, `confirmation.ready`, no unsaved changes, no conflict banner, no write in flight; Discard needs `can_discard`. The `enabled` flag of WhatsApp is not consulted: reviewing works while WhatsApp is off. `confirmed`, `discarded`, `expired` and `collecting` show their own state with no edit, confirm or discard. A terminal draft is never changed by the front end; it only mirrors what the backend returns.

## Save

Only changed fields are sent (decimals are compared as strings, so `25.250` equals `25.25`). Nothing is sent when nothing changed. A date cannot be cleared; the time can. Currency is not editable: it is shown from the selected account and the backend sets it on save. The amount is a text input (no number input, no float). Client checks cover amount format, date, time and description length; server field errors keep what was typed and mark the field. One write at a time, so a double click sends one request. An older server answer never overwrites a newer `review_version`.

A stale `review_version` (409) loads the latest draft, keeps the user's edits aside in a banner ("Reapply my edits" or "Drop my edits") and disables Confirm until the user answers it, so a new review is required. Nothing is overwritten and nothing is confirmed automatically.

If a save's answer is lost, the draft is read again: if it already holds the user's values it is treated as saved, otherwise the edits stay in the form.

Unsaved edits trigger the router's leave prompt and the browser's `beforeunload`.

## Confirmation: how duplicate posting is prevented

Facts from the backend: confirmation runs in one database transaction under a row lock; the draft's status change and the posting commit together; a repeated confirmation of a confirmed draft with the **same** key returns the original transaction (201); with a **different** key it is refused (409). So a retry with the same key cannot post twice, and a new key on an already confirmed draft is refused.

Front end rules:

1. Confirming is two steps: the Confirm button opens a dialog stating that a real expense is recorded and showing the saved amount, account, category and date; only "Record expense" sends anything. Nothing confirms on load, refresh, save or opening the dialog.
2. The first explicit confirmation creates one attempt `{ draftId, reviewVersion, idempotencyKey }` (`createWhatsAppConfirmAttempt`), held in a ref. It is reused for every retry of that same confirmation and never regenerated.
3. One write at a time (a ref set synchronously), and the adapter also shares an identical in-flight confirmation, so a double click or a second code path sends one request.
4. Success is shown only from a 201 with a `transaction`. The transaction reference comes from the backend; "View transaction" links to the existing transaction page.
5. Outcome unknown (network failure, timeout, 5xx, unreadable answer): the attempt is kept, the draft is read (a GET). `confirmed` → success with the real transaction and a note that it was checked with the server. Still open on the same version → "uncertain" panel with **Check status** (read only) and **Try again** (checks first, then repeats the same request with the same key). A fresh Confirm is not offered while the outcome is unknown. Retries are explicit user actions; there is no automatic retry.
6. Definitive refusal (422, 403, 429): nothing was recorded; the message is translated and the draft is re-read for fresh readiness. A new explicit confirmation is a new attempt with a new key.
7. 409: the draft is read. Confirmed → shown as recorded (no duplicate). Version changed → conflict banner, attempt dropped, new review required. Otherwise the 409 is reported.

### Reload during an unknown outcome

(Evidence from the backend source and its MySQL concurrency test, and the tested scenario, are in `production-readiness.md` section 2.)

The key lives only in memory, so a reload loses it; nothing private or financial is written to storage. After a reload the draft is read first: a confirmed draft is shown as recorded (with its transaction) and nothing is sent; a still-open draft means the earlier request did not commit (status and posting commit together), and confirming again is a new explicit action with a new key. If the first request were still running on the server, the second waits on the row lock and is then refused with 409 for the different key (the screen then shows the recorded expense), so it cannot double post.

Proposal if durable recovery is ever wanted: store only an opaque `{ userId, draftId, reviewVersion, key }` in `sessionStorage` (tab scoped, no amounts, cleared on logout and on any terminal read). It is not implemented because the backend already makes the reload case safe without persisting anything.

## Discard

Dialog first (it states that recorded expenses are not affected), then one `DELETE`. After a network failure or 5xx the draft is read before anything else: discarded → done; still open → "not discarded, try again". A confirmed draft is never turned into a discarded one. No reversal or transaction endpoint is called. After a confirmation or discard (also one found by reconciliation) the review screen calls `refresh()` on the shared pending count, so the sidebar, Attention Center, inbox and Settings update at once.

## Deep link

The backend writes `{WHATSAPP_FRONTEND_URL}/whatsapp/drafts/{id}` (`config/whatsapp.php` `review_path`). `PATH.USER.WHATSAPP_REVIEW_LINK` (`/whatsapp/drafts/:draftId`) is registered inside the `RequireAuth` + `DashboardLayout` route group and `WhatsAppDraftLink` forwards to `getWhatsAppDraftPath(id)`.

- Signed out: `RequireAuth` redirects to sign-in with `state.from = /whatsapp/drafts/7`; `getPostAuthPath` accepts it (same-origin path), so sign-in returns there, then it forwards to the review page. Nothing draft-related is requested or rendered before sign-in.
- The target is the fixed dashboard path plus the id as one encoded path segment: no value from the link can pick another destination, and a malformed id ends on "not found" without a request. The backend decides ownership (404 otherwise).
- Hosting: it is one more application path and needs the same SPA fallback that `/dashboard/*` already needs. No hosting file is in this repository and the live host was not touched or tested.

## Privacy

No draft data, key or amount in `localStorage`, `sessionStorage`, URLs or console (tested). Writes are never aborted by navigation (the request that was sent finishes on the server), but answers arriving after the page or user changed are dropped. Accounts and categories are requested for the draft's own `workspace_id` only.
