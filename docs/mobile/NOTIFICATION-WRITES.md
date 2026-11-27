# Mobile — notification writes (Phase 1 of the write integration)

Marking notifications read is the first Mobile write integrated end to end:
- registry and sender;
- screen and outcome handling;
- tests.

It was chosen because it moves no money, the backend makes a copy harmless, and it needs no backend change (see the functional completeness audit of 2026-11-15). **Both writes are still closed:** `APPROVED` in `src/mobile/data/writeGate.js` is empty. Opening them is a separate, approved commit made after the staging check below.

Notification preferences followed as Phase 1B (below).

## The two writes

| Operation | Request | Registry |
|---|---|---|
| `notifications.markRead` | `PATCH /notifications/{id}/read`, no body | `moves: false`, `key: "none"`, `serverDedup: "same-result"` |
| `notifications.markAllRead` | `POST /notifications/read-all`, no body | `moves: false`, `key: "none"`, `serverDedup: "same-result"` |

## Backend evidence

`NotificationController`, `NotificationService` and `FinancialNotificationResource` are identical on `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72`. The uncommitted work in the P0 worktree does not touch them.

- **Routes:** `Route::match(['post', 'patch'], '/notifications/{notification}/read')` and `POST /notifications/read-all`. Both sit under `auth:sanctum` and `active.user`, inside the `throttle:write` group.
- **Idempotency:**
  - `markRead` sets `read_at` only while it is null and otherwise returns the row unchanged, so the first read time is kept (backend test `test_reading_twice_does_not_move_the_timestamp`).
  - `markAllRead` updates only the caller's unread rows, so a repeat marks 0.
  - Neither takes an `Idempotency-Key`; none is needed.
- **Ownership:**
  - Notifications are scoped by `user_id`, not by workspace, so no `workspace_id` is sent.
  - Another person's notification is answered **404**, never 403 (`authorizeOwnership` throws `ModelNotFoundException`, so ids cannot be walked; test `test_the_inbox_never_shows_another_persons_notifications`).
  - Mark-all stops at the caller's own inbox (test `test_marking_all_read_stops_at_the_callers_own_inbox`).
- **Answers:**
  - Mark read: `{ status: true, data: { notification, unread_count } }`. The notification row includes `id`, `is_read` and `read_at`.
  - Mark all: `{ status: true, data: { marked_count, unread_count: 0 } }`.
  - The unread count is the server's in both.
- **Errors (the API envelope):**
  - 401: no or expired token.
  - 403: inactive account (`EnsureUserIsActive`, "Your account is inactive.").
  - 404: missing or not yours.
  - 429: write throttle.

## Frontend

- **Gate:** `data/writeGate.js` registers both operations. They are closed unless listed in `APPROVED`, and the test switch works only in the test runner.
- **Senders:** `data/writeApi.js` has `sendNotificationRead(id)` and `sendNotificationsReadAll()`.
  - Each calls `assertWriteOpen` first.
  - The id must be a positive whole number, or nothing is sent (`INVALID_ID`).
  - They use the app's own `notificationsApi`.
- **Hook:** `notifications/useNotificationWrite.js` owns one write at a time for the whole screen.
  - A busy flag is set before anything is awaited, so a second tap on any row or on Mark all does nothing.
  - The identity guard is checked before sending and again on the answer.
  - Nothing is resent automatically.
- **Outcome logic:** `models/notificationWrites.js` (pure).
  - **Confirmed** needs proof in the answer: for one notification, the row named is read and `unread_count` is a whole number; for all, `marked_count` and `unread_count`.
  - Failures use the same classification as every Mobile write (`classifyWriteOutcome`):
    - 403, 404 and 429 are **refused**;
    - 401 means the session is gone;
    - a timeout, a network error, a 5xx or a malformed answer is **unknown**.
- **Unread count:**
  - After a confirmed write, the server's `unread_count` from the answer goes into the same store entry the screen reads (`resourceStore.accept`). It is never decremented locally.
  - After an unknown outcome or a 404, the count is read again with a GET. After a 403, a 429 or a closed gate, nothing is re-read.
- **Rows:** read again after a confirmed write, an unknown outcome or a 404, so the read state shown is the server's.
- **Screen:** `notifications/MobileNotifications.jsx`.
  - **Gate closed (the product today):** exactly as before. Mark as read opens an explanation with a disabled button, and Mark all is disabled with a note.
  - **Gate open:** each is one button, disabled and marked busy while any notification write is on its way.
  - An outcome line follows: a status after success, an alert after a refusal or an unknown outcome.
  - After an unknown outcome, trying again by hand is safe and allowed.
- **Strings:** `notifications.write.*` in `i18n/sections/debtsTransfers.js`, in English and Arabic.

## Tests

`tests/mobileNotificationWrites.test.mjs` covers:
- the registration;
- the closed senders, with zero requests;
- an invalid id never being sent;
- proofs and classification, including a timeout;
- with the gate closed, the screen sending zero writes.

With the gate opened by the test switch:
- one request for mark-read and one for mark-all;
- the server's count shown (not a local subtraction);
- a second tap sending nothing;
- repeats returning the same answer;
- 404, 403, a network failure (unknown, not retried) and a 200 without a count (unknown);
- one write opened alone;
- Arabic.

The registry inventory and facade guards were updated for the two operations: `tests/mobileWriteGate.test.mjs`, `tests/mobileReadOnly.test.mjs`, and the two request rules in `tests/helpers/mobileApi.mjs`.

## Before opening (not done here)

1. A staging environment running the backend commit that production will run, with that commit confirmed.
2. On staging:
   - one mark-read;
   - a repeat of it (same answer, `read_at` unchanged);
   - another user's id (404);
   - mark-all twice (second `marked_count: 0`);
   - an inactive account (403).
3. Evidence that the proxy and app server don't answer 408 after accepting the body. This matters less here because both writes are harmless to repeat, but it is the shared release rule.
4. A recorded per-write approval, then a commit that adds both names to `APPROVED`.

## Phase 1B: the savings reminder preference

The backend has **one** notification preference, `savings_installment_reminders` (boolean, on by default). There are no others: no channel choice (`channels` is always `["in_app"]`) and no per-type switches. Mobile adds none.

| Operation | Request | Registry |
|---|---|---|
| `notifications.preferences` | `PATCH /notifications/preferences` with `{ "savings_installment_reminders": true | false }` | `moves: false`, `key: "none"`, `serverDedup: "same-result"` |

### Backend evidence

`NotificationController::preferences / updatePreferences`, `UpdateNotificationPreferencesRequest` and `NotificationPreferenceService` are identical on `develop` @ `fd87531` and `6b696d72`.

- **Validation:** `savings_installment_reminders` is `required|boolean`. An empty body or `"maybe"` is a 422 (backend test `test_the_owner_comes_from_the_token_and_the_field_is_validated`).
- **Owner:** comes from the token; a `user_id` in the body is removed before validation.
- **Semantics:** an explicit value, never a toggle.
  - In one transaction, `update` inserts the user's row if missing (`insertOrIgnore` on a unique `user_id`, so two first changes keep one row), locks it, and sets the value.
  - A copy leaves the same state.
  - Switching on when already on keeps the resume point (`test_switching_on_when_already_on_does_not_reset_the_resume_point`). Turning back on releases no backlog.
- **Answer:** the same envelope as the read: `data.preferences.savings_installment_reminders`, `data.channels` and `data.savings_installment_reminders_available` (the global switch; while it is false nothing is sent whatever the preference).
- **Route:** in the `throttle:write` group, under `auth:sanctum` and `active.user`.
- **Errors:** 401, 403 (inactive account), 422, 429.

### Frontend

- **Sender:** `data/writeApi.js` `sendNotificationPreferences(values)` checks the gate. It then refuses anything but a real `true`/`false` (`INVALID_VALUE`, nothing sent), and calls the app's `notificationsApi.updatePreferences`.
- **Outcome logic:** `models/preferenceWrites.js` (pure).
  - **Confirmed** needs the preferences envelope saying the value asked for.
  - An envelope naming the other value is stored (it is the server's) but reported as unknown (`DIFFERENT_VALUE`).
  - Failures: 422, 403 and 429 are refused; 401 means the session is gone; a timeout, a network error, a 5xx or a malformed answer is unknown.
- **Hook:** `settings/usePreferenceWrite.js`.
  - One save at a time, with the busy flag set before anything is awaited.
  - The identity guard is checked before and after; nothing is resent automatically.
  - On an answer, it stores the server's envelope in the same entry the screen reads (`resourceStore.accept`). After an unknown outcome it reads the preference again (a GET).
- **Screen:** `settings/MobileProfile.jsx` `NotificationPreferences`.
  - **Gate closed (the product):** unchanged. The draft shows the closed note and a disabled Save.
  - **Gate open:** the draft shows "This change isn't saved yet" with Save and Undo. While saving, Save, Undo and the switch are disabled and Save is marked busy.
  - Only a confirmed answer ends the draft. A refusal leaves the saved value (`data-sm-saved`) as the server's and keeps the draft so it can be saved again by hand.
  - An outcome line follows: a status after success, an alert otherwise.
- **Strings:** `profile.prefsWrite.*` in `i18n/sections/assist.js`, English and Arabic.
- **Style:** a small scoped style for the draft panel at the end of `styles/mobile.css`.

### Tests

`tests/mobileNotificationPreferences.test.mjs` covers:
- the registration;
- the closed sender, with zero requests;
- only a real boolean being sent;
- the same request twice leaving the same setting;
- proofs and classification, including a timeout;
- with the gate closed, the screen sending zero writes.

With the gate open:
- one PATCH with the exact body and no key;
- the server's answer shown as saved, including its global switch;
- a second tap sending nothing;
- a 422 and a 403 leaving the saved value unchanged and the draft in place;
- a network failure: unknown, not retried, the saved value read again;
- a different value in the answer;
- Undo;
- Arabic.

The registry and facade guards list the third operation.

### Before opening

The same as for the two writes above:
1. Staging on the production backend commit.
2. A staging run: off, off again (same answer), on, an empty body (422), and an inactive account (403).
3. The 408 evidence.
4. A recorded approval and a separate commit to `APPROVED`.
