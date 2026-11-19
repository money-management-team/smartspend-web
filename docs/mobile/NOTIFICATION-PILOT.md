# Mobile — the first write pilot: `notifications.markRead`, then `notifications.markAllRead`

**Status (2026-11-16): not started. Both writes are closed (`APPROVED = Object.freeze([])`), and this document does not open them.** It is the acceptance checklist the pilot must satisfy, and the rules for running it. The registry names are `notifications.markRead` and `notifications.markAllRead` (plural). Background and the backend evidence are in [NOTIFICATION-WRITES.md](NOTIFICATION-WRITES.md); the environment is in [STAGING-READINESS.md](STAGING-READINESS.md); the approval record is in [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md).

## 1. Why these two go first

- They move no money and have no cost: no provider, no ledger, no balance.
- The backend makes a repeat harmless (**same-result**, read from the source, identical on `develop` @ `fd87531` and `6b696d72`): `markRead` sets `read_at` only while it is null and otherwise returns the row unchanged; `markAllRead` updates only the caller's unread rows, so a repeat marks 0. Neither takes a key, and none is needed.
- Ownership is enforced as a 404 (never a 403) for another person's notification, and mark-all stops at the caller's own inbox.
- Both answer with the **server's** `unread_count`, which Mobile shows instead of computing one.

That makes them the safest way to learn how a Mobile write behaves on a real host, **including the 408 question**: a duplicate arrival here has no extra effect, so any unexpected duplicate is visible without harm. It also means a clean pilot proves little about writes with weaker protection. It is a rehearsal of the process, not a licence.

## 2. Preconditions (all recorded; none exists today)

1. A staging stack built and isolated per STAGING-READINESS.md §3, on a pinned backend commit (the commit production runs, once confirmed).
2. **The HTTP 408 evidence** ([HTTP-408-EVIDENCE.md](HTTP-408-EVIDENCE.md)) either collected, or the owners' signed decision to run this harmless pilot **before** it, in order to gather the evidence with it. That decision must be written down. Either way the pilot may not be described as satisfying the 408 rule.
3. Synthetic notifications. Notifications are created by backend events, so the staging team creates them directly in the staging database (a staging-only seed): at least **12 unread** and 3 read for `owner-a`, **5 unread** for `owner-b` (the counter-party), 0 for a user with an empty inbox, with ids recorded.
4. A snapshot of the seeded database to restore between runs.
5. A pilot build: branch `staging/mobile-pilot-notifications-markread` from `integration/mobile` whose only difference is `"notifications.markRead"` in `APPROVED` (and the tests that pin `APPROVED` updated in the same commit). Built `--mode staging`, deployed with the staging workflow only. **Never merged, never built from `development`.** The mark-all pilot is a **separate** build with only `"notifications.markAllRead"`.
6. Devices: desktop Chrome (headless, driven over CDP), a real Android phone and a real iPhone, on the staging URL. Record the browser versions and the protocol each used (`nextHopProtocol`).

## 3. Acceptance criteria: `notifications.markRead`

Every criterion needs recorded evidence (request log, server log or rows, screenshot). "Passed" means every line, on every device in the matrix.

| # | Criterion | How it is checked | Evidence |
|---|---|---|---|
| **R1** | **The closed gate sends zero requests.** On a build **without** the operation in `APPROVED` (the same commit minus the pilot line), a scripted session opens the inbox, opens "Mark as read" on several rows, and taps Mark all: affordances are disabled or explanatory and **no non-GET request leaves the browser** | CDP network log filtered to non-GET; the staging access log for the session | Network log: zero non-GET; access log: zero PATCH/POST to `/notifications` |
| **R2** | **One tap sends one request.** In the pilot build, one tap on one unread row sends exactly `PATCH /notifications/{id}/read` with that row's id, **no body, no `Idempotency-Key` header**, and no other non-GET request | Network log | One request; the access log shows one PATCH |
| **R3** | **Rapid taps send one request.** Ten taps within one second on the same row, and on different rows while the first is in flight, send **one** request (the busy flag is set before anything is awaited) | Network log and access log; the count of PATCH lines equals the number of **intended** actions | Equal counts |
| **R4** | **The server's `unread_count` is used.** The count shown after the tap equals `data.unread_count` in the response. To prove it is not a local subtraction: with the inbox open (count shown N), the staging team inserts a **new unread notification** for `owner-a` on the server, then the tester taps one row; the count shown must be the server's (N, not N−1) | The response body and the screen | Screenshot beside the response |
| **R5** | **Repeated requests create no additional effect.** The same PATCH sent again (from a script) leaves `read_at` unchanged (compare the stored timestamp before and after), returns the same row and the same `unread_count`, and creates no row | Database rows; the response | Rows before and after |
| **R6** | **Ownership.** `owner-a`'s session patching one of `owner-b`'s notification ids (from a script) answers **404**, and `owner-b`'s row is unchanged. Mobile never sends an id it did not list, and the sender refuses a non-numeric id without a request | Response; rows | 404; unchanged row |
| **R7** | **Authorisation and refusals.** An inactive account answers 403 and Mobile says so; an expired token answers 401 and the session ends; the write throttle answers 429 and Mobile says so without re-reading. None of them changes a row | Responses; Mobile screens | Per case |
| **R8** | **A lost answer is an unknown outcome.** With the request delivered and the answer lost (the browser goes offline at the moment of the response, via CDP; a real phone's airplane mode as the second method), Mobile shows an unknown outcome, **does not resend**, reads the unread count again with a GET, and the server shows the row read **once**. A deliberate second tap then gives the same answer and an unchanged `read_at` | Network log; rows | Request count 1 then 1 more by hand |
| **R9** | **A timeout is unknown too.** Throttle the connection past Mobile's 20 s timeout (CDP) and confirm the same handling as R8 | Network log | As R8 |
| **R10** | **A 5xx and a malformed answer.** These cannot be induced safely on staging; they are covered only by the automated tests and are recorded as **not run on staging** | | "not run" with the reason |
| **R11** | **Row state is the server's.** After a tap, an unknown outcome or a 404, the row's read state and the count are read again from the server, and the screen shows what the server returned | Network log (the GETs) | GET after write |
| **R12** | **No other write.** The whole session's non-GET requests are only the pilot's | Network log of the entire run | Only `PATCH /notifications/{id}/read` |
| **R13** | **Server-side arrivals equal taps.** For the whole run, the number of PATCH lines in the access log equals the number of intended taps (R3). **Any extra arrival is a stop condition** (section 6) | Access log (or, if the host cannot expose it, the row-level evidence of R5 and the probe in HTTP-408-EVIDENCE.md) | Equal counts |
| **R14** | **Both languages, both directions, light and dark**; hide-amounts is irrelevant here | Screenshots | Four screenshots |
| **R15** | **Rollback rehearsed.** Redeploying `integration/mobile` to staging restores disabled affordances; the time from the decision to the result is recorded | Deploy log; repeat R1 | Time taken |

## 4. Acceptance criteria: `notifications.markAllRead`

Run only after the mark-read pilot's record is signed (section 5). A **separate pilot build** with only `"notifications.markAllRead"` in `APPROVED`. R1 to R4 and R6 to R15 apply with the changes below; R5 is replaced by A5.

| # | Criterion | How it is checked |
|---|---|---|
| **A1** | **Closed gate:** zero requests (as R1, with the mark-all control) | Network log |
| **A2** | **One tap, one request:** exactly `POST /notifications/read-all`, no body, no key; rapid taps and a tap on a row's mark-read while it runs send **one** request (the whole screen shares one busy flag) | Network log, access log |
| **A3** | **The server's count is used:** the response is `{ marked_count, unread_count: 0 }`; the screen shows the server's count and, if a new notification arrived since the page loaded, the list read again shows it **still unread** (mark-all marked what was unread when the request arrived) | Response; screen; rows |
| **A4** | **Scope is honest:** the control and its confirmation say it marks **all** of the person's unread notifications (the backend acts on the whole inbox, not only the rows on screen) | Screenshots of the wording in both languages |
| **A5** | **Repeats create no additional effect:** a second mark-all returns `marked_count: 0`, `unread_count: 0`, and leaves every `read_at` unchanged; with an **empty inbox** the first call is also `marked_count: 0` | Responses; rows |
| **A6** | **Isolation:** `owner-b`'s 5 unread notifications are still unread after `owner-a`'s mark-all | Rows before and after |
| **A7** | **Unknown outcome:** as R8 (the whole inbox is read once; the count is read again; nothing resent) | Network log; rows |

## 5. Exit, sign-off, and what "done" does not mean

- The pilot is **complete** when every criterion has a recorded **pass** or a **justified "not run"** (R10 only), on the full device matrix, with the evidence folder and the record of [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md) filled in and signed by the tester and a separate reviewer.
- **A complete pilot does not open the write.** It is one input of the per-write approval, alongside the 408 evidence (or the owners' recorded decision about it) and the named approver's decision. Opening it in production-bound source is a **separate, reviewed commit** (`APPROVED = Object.freeze(["notifications.markRead"])` and the tests that pin it), and exposing Mobile to users additionally needs the Mobile release approval, which is a different decision.
- Automated tests passing, the pilot passing, or the 408 plan passing are **never** an approval on their own.

## 6. Stop conditions (end the pilot, restore the snapshot, report)

- Any server arrival that is not matched by an intended tap (a duplicate).
- Any non-GET request other than the operation under test.
- A write sent while the gate should have been closed.
- A change to another person's notification.
- A response the pilot build mishandles: an unknown outcome shown as success, a count that is not the server's, or a resend without a person's action.
- The staging stack found not to be isolated (a production hostname, credential or database reachable from it).

A stop is recorded as a finding with the evidence; the write stays closed, and the pilot restarts only after the cause is fixed and the plan is re-signed.

## 7. After this pilot

The register's tier 1 writes follow one at a time in the order of STAGING-READINESS.md §5, each with its own criteria written the same way (closed gate sends zero requests; one tap, one request; the server's figures are used; repeats have no extra effect; unknown outcomes are handled), its own evidence, and its own approval. Nothing is batched.
