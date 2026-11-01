# Mobile — backend verification handoff

**For:** an engineer with access to the Laravel backend source and an isolated backend loaded with fictional data.
**State (updated 2026-11-01):**
- The backend source (`develop` @ `fd87531`) has been audited and tested locally. Results, with file references, are in BACKEND-VERIFICATION-RESULTS.md, and they replace the "unverified" notes below where they overlap:
  - every read Mobile uses works against the real Laravel (local, fictional data);
  - funding preview is proven side-effect free (§4 below: items 1–6 answered);
  - `IdempotencyService::run()` has a completion window that can post twice after 24 hours (results §6), which affects income, expense, correction, debt payment, imports and single-account Smart Savings confirm.
- Still needed: staging, the production commit confirmed from the server, the §6 fix, and staging-enablement approval.
- Every value in the "Frontend sends" column comes from the web app's own wrappers (`src/features/Dashboards/User/api/*`) and their docs (`docs/<feature>/`). They are what the frontend sends, not what the backend guarantees.
- Every Mobile write is closed (`src/mobile/data/writeGate.js` and SECURITY-AND-FINANCIAL-GATES.md). Mobile has send code for exactly two of them, category create and rename, and both are closed.

Do not change backend contracts to make Mobile fit; report what the backend does.

## 1. Why this matters: a write can arrive twice

A local test with Chrome 156 over HTTP/1.1 (SECURITY-AND-FINANCIAL-GATES.md §2) showed the browser itself resending a POST or PATCH. It happened after a 408, and after a reused connection dropped once the server had read the body. The server received 2–3 copies; in one case the page saw a single 201. Over HTTP/2 it did not happen.

Every write below therefore needs one of these server-side protections:
- an idempotency key the server stores and replays;
- a uniqueness rule that makes the repeat harmless;
- proof that this path can never be resent.

## 2. Evidence needed for every write (the common checklist)

For each operation in §3, record answers to every item. Each needs a source reference (file and line) **and** a run against the isolated backend.

| # | Question | Evidence that settles it |
|---|---|---|
| C1 | Route, method, controller, form request | Route file and controller method |
| C2 | Payload accepted and rejected (validation rules) | The FormRequest rules; a 422 run for each rule |
| C3 | Response shape on success | A recorded response |
| C4 | Authorization: owner and workspace checks | Policy or gate code; a run with another user's id gives 403/404 and no data |
| C5 | Financial side effects (ledger rows, balances, statuses) | The service code; database rows before and after |
| C6 | Idempotency key: required? read from which header? | Middleware or controller code |
| C7 | Key storage, scope (user / route / body hash) and retention | Table or cache, and expiry |
| C8 | Same key, same body | The stored status and body are replayed; there is no second effect (count rows) |
| C9 | Same key, different body | Rejected (409/422) with no effect |
| C10 | Same key while the first request is still running | Waits, or 409; never two effects (slow the handler in a test) |
| C11 | No key at all | Rejected, or what happens on a repeat |
| C12 | Duplicate HTTP/1.1 arrival (two identical requests, same key, a few ms apart) | One effect; both answers consistent |
| C13 | 408 and timeouts: can any layer (app server, proxy, Hostinger front end, Laravel Cloud) answer 408 after reading the body? Is HTTP/1.1 used anywhere on the path? | Server and proxy configuration; a trace of the protocol from browser to origin |
| C14 | A write that completes after the client gave up (client timeout 20 s; uploads 60 s) | What the next read shows; that a resend with the same key replays |
| C15 | Concurrency: two different requests on the same record at once | The locking used (row lock, version check); the outcome |
| C16 | Database transaction: ledger rows and balance update together | `DB::transaction` around all writes; a forced failure leaves no partial state |
| C17 | One-time reversal (for reversals) | A database-level guard (unique reversal row, or a status check under a lock); two parallel reversals give exactly one |
| C18 | Reconciliation: a GET that shows whether this write happened, by id or by key | The read, and the field to compare (not "a similar row exists") |
| C19 | Existing backend tests | Test files and what they cover |
| C20 | Missing isolated-backend tests | The C8–C17 runs above, written as repeatable tests |

**To open a write in Mobile** (one reviewed commit per write):
1. C1–C18 answered with evidence.
2. Then a Mobile send path built on the full version's key lifecycle: one key per logical operation, reused for an unknown outcome, renewed only after a definite rejection, never stored.
3. Then the operation added to `APPROVED` in `writeGate.js`, citing the evidence.

## 3. Pending writes

"Key" in the tables below means whether the full version sends `Idempotency-Key` today.

### 3.1 Money movements

| Operation | Frontend sends | Effect (frontend docs) | Key | Specific questions beyond §2 |
|---|---|---|---|---|
| Expense / income | `POST /transactions/expense\|income` `{account_id, category_id (expense: required), amount "0.0000", occurred_at "YYYY-MM-DD 12:00:00", description?, reference_number?}` → 201 `data.transaction` | Ledger entry on the account; balance changes; insufficient balance gives 422 | yes | Is the key stored per user and route? What is returned on a replay after the transaction was later corrected? |
| Correct | `PATCH /transactions/{id}` `{reason (3–500), changed fields only}` → a **new** `data.transaction` | Reverses the original and posts a replacement | yes | A repeat must not create two replacements; what does a correction of an already-corrected transaction return? |
| Reverse transaction | `POST /transactions/{id}/reverse` `{reason}` → `data.transaction_original`, `data.reversals` | Reversal entries; original becomes `reversed` | **no** | C17. Does a 409 on a repeat leave nothing behind? |
| Transfer | `POST /transfers` `{from_account_id, to_account_id, amount, fee_amount?, fee_category_id?, fee_description?, description?, reference_number?, occurred_at}` → 201 `data.transfer` | Two ledger legs and an optional fee | yes | Same currency enforced server-side; fee and legs in one transaction (C16) |
| Reverse transfer | `POST /transfers/{id}/reverse` `{reason}` | Reverses both legs and the fee | **no** | C17; the docs say a repeat gives 409, and that is unverified |
| Debt payment / collection | `POST /debts/{id}/payments` `{account_id, amount, paid_at?, notes?}` | Movement on the account; debt paid and remaining update | yes | Amount above remaining rejected server-side? Concurrent payments on one debt (C15) |
| Reverse debt payment | `POST /debt-payments/{id}/reverse` `{reason}` | Reverses the movement; remaining goes back up | **no** | C17 |
| Goal contribution / withdrawal | `POST /savings-goals/{id}/contributions\|withdrawals` `{from_/to_account_id, amount, description?, occurred_at, planned_contribution_id?}` | Transfer to or from the goal's own account | yes | Withdrawal above saved rejected? |
| Recurring confirm-next | `POST /recurring-transactions/{id}/confirm-next` (no body) | Posts the next occurrence | key **derived by the server** (docs) | Two parallel confirms give one transaction (C10, C17) |
| Installment confirm | `POST /savings-goals/{id}/planned-contributions/{iid}/confirm` `{expected_plan_version, expected_lock_version, from_account_id, amount}` | One transfer into the goal | yes | The version and lock checks are under a lock? A stale version gives 409 with no effect? |
| Installment confirm-accounts | `POST …/confirm-accounts` `{expected_plan_version, expected_lock_version, amount, legs[], confirmation_intent}` | Several transfers (legs) | yes | All legs in one transaction (C16) |
| Funding-leg reversal | `POST …/reverse-legs` `{expected_lock_version, reason, leg_ids \| all}` | Reverses legs | yes | C17 per leg |
| Import confirm | `POST /imports/{id}/confirm` (key) → 202; then the queue posts the rows | Many transactions | yes | Confirm idempotent under its key; queue-worker failure behaviour; partial posting |
| Import reverse | `POST /imports/{id}/reverse` `{reason}` (key) | Opposing transactions | yes | C17 for the whole batch |
| Receipt confirm | `POST /ai/expense-captures/{id}/confirm` (review values) | Creates the expense | per wrapper | Review version checked? Repeat gives one expense? |
| Voice confirm | `POST /ai/voice-expense-captures/{id}/confirm` `{review_version}` (key) | Creates the expense | yes | Same |
| WhatsApp draft confirm | `POST /integrations/whatsapp/expense-drafts/{id}/confirm` `{review_version}` (key) | Creates the expense | yes | Stale review version gives 409 with no effect? |

### 3.2 Records without a money movement

| Operation | Frontend sends | Key | Specific questions |
|---|---|---|---|
| **Category create** (Mobile has send code; closed) | `POST /categories {workspace_id, name, type}` → `data.category` | **none** | C11: is name uniqueness per workspace and type enforced by a database constraint or only in application code? What does a duplicate create return (409, 422, or a second category)? |
| **Category rename** (Mobile has send code; closed) | `PATCH /categories/{id} {name}` | none | Repeat is harmless? Rename of a system category gives 403? Any effect on existing transactions? |
| Account create / edit / archive | `POST /accounts`, `PATCH /accounts/{id}` (changed fields; `opening_balance` 409 after activity), `POST /accounts/{id}/archive` | none | Duplicate create? Archive repeat gives 422 with no effect? |
| Budget, goal, recurring rule, debt: create / edit / archive / pause / resume | per wrappers (`budgetsApi`, `savingsGoalsApi`, `recurringTransactionsApi`, `debtsApi`) | none | Duplicate creates; a debt created with `account_id` posts an opening movement (treat it as §3.1) |
| Planned contribution create / edit / cancel | `POST/PATCH/DELETE …/planned-contributions` | none | Duplicate create |
| Installment postpone / skip | `POST …/postpone {expected_plan_version, expected_lock_version, new_date, reason?}`, `POST …/skip {…, reason?}` | yes | Stale versions give 409 with no effect |
| Recurring skip-next | `POST /recurring-transactions/{id}/skip-next {reason?}` | none | Two skips never skip two occurrences |
| Export create / cancel | `POST /report-exports {report, format: csv\|xlsx\|pdf, filters}`, `DELETE /report-exports/{id}` | none | Duplicate jobs? Cancel after completion? |
| Import upload / mapping / validate / row edit / ignore / cancel | `importsApi` | none (confirm has one) | Cancel after confirm |
| Notification mark-read / mark-all | `PATCH /notifications/{id}/read`, `POST /notifications/read-all` | none | Documented as idempotent; confirm it |
| Notification preference | `PATCH /notifications/preferences {savings_installment_reminders}` | none | — |
| Profile / password | `PUT /profile {name, email, phone?, locale?, timezone?}`, `PATCH /profile/password {current_password, password, password_confirmation}` | none | Email change starts re-verification? Password change revokes other tokens (docs) |
| AI: message, feedback, delete, settings, delete data, refresh, dismiss | `aiCopilotApi` | message: `client_request_id` | Message replay by `client_request_id`? What does delete keep (retention)? |
| Receipt / voice upload, retry, discard, review update | `aiExpenseCapturesApi`, `aiVoiceExpenseCapturesApi` | upload and voice: key | Quota counted once per key? |
| WhatsApp link challenge, confirm link, unlink, preferences, draft update, discard | `whatsappApi` | — | Consent and legal wording is the product owner's decision |

## 4. Smart Savings funding preview (Decision B: blocked)

**2026-11-01:** all six items below are answered in BACKEND-VERIFICATION-RESULTS.md §7. The source shows no write; the query log shows SELECT only; the intent is a stateless HMAC; another user gets 404; every table's row hash is unchanged; only the general `api` limiter applies. It is still blocked: approving it as a read is the product owner's Decision B.

The request: `POST /savings-goals/{id}/planned-contributions/{iid}/funding-preview`, with no body or `{amount, legs[]}`. It returns `data.funding_preview`: the preview fields, plus `funding {amount, legs[], shortfall_amount, problem}` and `confirmation_intent`.

The wrapper's comment says it is "read only, owner only … moves nothing". **That is not evidence.** Mobile never sends it (`tests/mobileReadOnly.test.mjs`), and every POST stays a write.

Evidence needed to approve it as a read:
1. **Source:** the controller and service code shows no `INSERT`, `UPDATE` or `DELETE` on any table: no audit or row that changes later behaviour, no lock or quota consumed, no queued job, no event with side effects.
2. **Run:** with query logging on, a run on the isolated backend shows SELECT statements only.
3. **`confirmation_intent`:** whether it is stored server-side, and whether issuing one changes what a later confirm accepts. If it is stored, the preview is a write.
4. **Authorization:** another user's goal or installment gives 403/404 with no data.
5. **Repeats:** calling it twice in a row returns the same result and leaves the database unchanged (compare checksums of the affected tables).
6. **Rate limits:** whether it counts against any limit that would block a later confirm.

## 5. PDF export (Decision A: backend PDFs only)

- **Mobile does:** downloads only through `GET /report-exports/{id}/download`, only when the export says `download_available: true`. It never builds a PDF on the device and never creates an export.
- **To verify:**
  - `format: "pdf"` is accepted by `POST /report-exports`, and the queue builds it;
  - the download response sets `Content-Type: application/pdf` and a `Content-Disposition` file name (Mobile sanitises it: no folder part, no reserved characters, at most 120 characters, with the full version's built name as fallback);
  - another user's export gives 403/404 with no file;
  - an expired export gives 404 or 410 (Mobile shows "no longer available");
  - downloading twice is harmless;
  - creation duplicates (§3.2 export create).

## 6. Authentication and Google OAuth

Mobile sign-in, registration and Google sign-in call the one AuthProvider (`login`, `register`, `loginWithGoogle`). They are the existing auth contract (`POST /login`, `POST /register`, `POST /auth/google`), not financial writes. They are therefore outside the write gate and are not added to it.

To verify before a Mobile release:
- `POST /login` rate limiting and lockout;
- the 401/422 shapes Mobile shows (wrong credentials give a generic message);
- `POST /register` validation fields, matching Mobile's field mapping;
- the email verification link flow works when the account was created from `/m/register`;
- the Google client ID allows the staging and production origins (Google Identity Services, popup mode);
- `google_consent_required` 422 and the consent resend;
- that the backend verifies the Google ID token (audience, issuer, expiry);
- Google sign-in in an installed PWA (standalone) on iOS and Android. Popups may be blocked there; Mobile tells the person and keeps password sign-in available.

**Not verified anywhere:** real Google OAuth. Mobile's tests use a fake Google and a fake provider; one test uses the real provider with a fake server.

## 7. Reads Mobile relies on

The full list is in BACKEND-CONTRACT-GAPS.md ("Read contracts Mobile relies on").

`scripts/mobileReadContract.mjs` checks them with GET only. Run it against the isolated backend:

```
SMARTSPEND_CONTRACT_BASE=… SMARTSPEND_CONTRACT_TOKEN=… SMARTSPEND_CONTRACT_OK=isolated-fictional-data node scripts/mobileReadContract.mjs
```

It refuses to run without that opt-in, and refuses any target that is neither HTTPS nor local.
