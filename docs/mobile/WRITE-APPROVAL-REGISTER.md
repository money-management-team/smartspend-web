# Mobile — per-write approval register and template

**Status (2026-11-16): no write is approved. `APPROVED` in `src/mobile/data/writeGate.js` is `Object.freeze([])`, and every one of the 50 registered writes is "Not approved" below.** This file is the single place that records, per write, what must be true before it may be opened, and the form an approval takes. It is checked against the registry by `tests/mobileApprovalRegister.test.mjs`, which fails if a write is added to the registry without a row here, or if a row says anything other than "Not approved" while `APPROVED` is empty. **That test keeps the document honest. It is not evidence that any write is safe.**

Read with [STAGING-READINESS.md](STAGING-READINESS.md), [HTTP-408-EVIDENCE.md](HTTP-408-EVIDENCE.md), [AI-STAGING-TEST-PLAN.md](AI-STAGING-TEST-PLAN.md), [NOTIFICATION-PILOT.md](NOTIFICATION-PILOT.md) and [SECURITY-AND-FINANCIAL-GATES.md](SECURITY-AND-FINANCIAL-GATES.md).

## 1. The rules

1. **One write, one approval.** No batches, no "everything in this tier".
2. An approval is **evidence plus a named decision**. Passing automated tests, a clean pilot or a clean 408 run is an input, never the decision.
3. The 408 requirement is recorded either as **satisfied with evidence** (the allowed sentence of HTTP-408-EVIDENCE.md section 6) or as an **owners' written decision to proceed without it, for a stated reason**. It is never recorded as satisfied without evidence.
4. The evidence is for **one backend commit and one database engine**. An approval is void if the commit or engine production runs differs from the one in the record, or if the write's classification changes.
5. Opening a write in production-bound source is a **separate, reviewed commit** adding the name to `APPROVED` and updating the tests that pin it, citing this record. There is no runtime switch, so closing it again means a new build.
6. Exposing Mobile to users also needs the Mobile release approval (`SMARTSPEND_MOBILE_RELEASE_APPROVED`), a different decision that does not imply any write approval.
7. Never mark a write approved on a branch because its tests pass.

## 2. The approval template

Copy this block into `docs/mobile/approvals/<operation>.md` (create the folder when the first approval is written), one file per write. A write with an empty or partly filled file is "Not approved".

```
# Approval: <operation>            (registry: <endpoint>, moves <true|false>, key <...>, dedup <...>)

## Identity
- Operation / endpoint / classification (from writeGate.js at commit <hash>):
- Backend commit evidence was gathered on (and database engine/version):
- Backend commit production runs (confirmed by <name> on <date>):  [must equal the line above]
- Frontend commit tested (pilot branch):
- Tier (register) and its baseline requirements met:  yes / no

## Backend evidence (source)
- Files and lines read (routes, request, action/service, resource), on both refs where they differ:
- What a duplicate request does (replay / refused / second effect):
- What an unknown outcome leaves behind and how it is recovered:
- Errors the endpoint can return and which are certain refusals:

## Staging evidence
- Staging isolation verified (STAGING-READINESS.md 3.1), record id:
- Cases run (ids from the plan), with pass / fail / not run + reason, evidence folder:
- Same request repeated: result.   Same key + different data: result.   Ownership: result.   Authorisation / consent: result.
- Unknown outcome (response lost, timeout) on a real browser: result and server state.
- Server's figures used by the screen (not computed locally): confirmed how.
- Money isolation (if applicable): ledger/balance counts before and after.
- Provider cost (if applicable): usage log and provider dashboard.

## HTTP 408
- Evidence record id and the allowed sentence:   OR   owners' written decision to proceed without it and why:

## Mobile behaviour
- Closed gate sends zero requests (build without the operation): evidence.
- One tap sends one request: evidence.   Double tap: evidence.
- Key lifecycle (same key after unknown outcome / new key after certain refusal / nothing stored but key and hash): evidence.
- Both languages and directions; light and dark; devices and browsers tested (versions, protocol used):

## Risk statement (plain language)
- What can still go wrong if this write is opened, who is affected, how we would notice, and how we would stop (rebuild and redeploy; time rehearsed):

## Decision
- [ ] Approved   [ ] Approved with conditions (list)   [ ] Rejected
- Approver (name, role, date):            Reviewer, not the tester (name, date):
- Tester (name):
- The exact change that will open it (commit message / diff summary):
- Re-review required when: the backend commit changes; the classification changes; the browser or hosting changes; the write's payload changes; <others>.
- What this approval does NOT cover:
```

## 3. The register

### Tier 1: not money, harmless to repeat (`same-result`)

**Baseline before approval:** Per-write staging evidence, the 408 evidence (or the owners' recorded decision), a pilot run of the same shape as NOTIFICATION-PILOT.md, a signed approval.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `ai.messageFeedback` | `POST /ai/messages/{id}/feedback` | false | none | `same-result` | **Not approved** |  |
| `ai.insightFeedback` | `POST /ai/insights/{id}/feedback` | false | none | `same-result` | **Not approved** |  |
| `ai.insightDismiss` | `POST /ai/insights/{id}/dismiss` | false | none | `same-result` | **Not approved** |  |
| `ai.settings` | `PUT /ai/settings` | false | none | `same-result` | **Not approved** |  |
| `account.update` | `PATCH /accounts/{id}` | false | none | `same-result` | **Not approved** |  |
| `budget.update` | `PATCH /budgets/{id}` | false | none | `same-result` | **Not approved** |  |
| `goal.update` | `PATCH /savings-goals/{id}` | false | none | `same-result` | **Not approved** |  |
| `recurring.update` | `PATCH /recurring-transactions/{id}` | false | none | `same-result` | **Not approved** |  |
| `debt.update` | `PATCH /debts/{id}` | false | none | `same-result` | **Not approved** |  |
| `profile.update` | `PUT /profile` | false | none | `same-result` | **Not approved** | Email change needs the verification flow checked on staging |
| `notifications.markRead` | `PATCH /notifications/{id}/read` | false | none | `same-result` | **Not approved** | First pilot: NOTIFICATION-PILOT.md section 3 |
| `notifications.markAllRead` | `POST /notifications/read-all` | false | none | `same-result` | **Not approved** | Second pilot, only after markRead is signed: NOTIFICATION-PILOT.md section 4 |
| `notifications.preferences` | `PATCH /notifications/preferences` | false | none | `same-result` | **Not approved** | Explicit true/false, never a toggle; one preference only |

### Tier 2: not money, but a repeat has an effect or the write is destructive

**Baseline before approval:** Everything in tier 1, plus an explicit, written decision by the owners about what a duplicate or a lost answer costs, because the server cannot replay it.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `category.create` | `POST /categories` | false | none | `unique-index` | **Not approved** | No replay: a lost answer can only be recovered by reading the list; owners must accept that risk |
| `category.update` | `PATCH /categories/{id}` | false | none | `unique-index` | **Not approved** | Registry keeps unique-index although a copy sets the same values; changing it is a reviewed change |
| `category.archive` | `POST /categories/{id}/archive` | false | none | `once-only` | **Not approved** | No restore exists; the name stays taken |
| `ai.conversationCreate` | `POST /ai/conversations` | false | none | `duplicates` | **Not approved** | No dedup: a copy is another empty conversation |
| `ai.conversationDelete` | `DELETE /ai/conversations/{id}` | false | none | `once-only` | **Not approved** | A copy is a 404 |
| `ai.dataDelete` | `DELETE /ai/data` | false | none | `same-result` | **Not approved** | Destructive; restore the snapshot afterwards; explicit acknowledgement in the UI |
| `account.create` | `POST /accounts` | false | none | `unique-index` | **Not approved** | No replay (unique name only) |
| `account.archive` | `POST /accounts/{id}/archive` | false | none | `once-only` | **Not approved** | No restore exists; refused for a savings plan's funding account |
| `budget.create` | `POST /budgets` | false | none | `unique-index` | **Not approved** | No replay (unique active key) |
| `goal.plannedContribution` | `POST /savings-goals/{id}/planned-contributions` | false | none | `duplicates` | **Not approved** | A copy creates a second planned contribution |
| `installment.postpone` | `POST /savings-goals/{id}/planned-contributions/{iid}/postpone` | false | client | `once-only` | **Not approved** | Smart Savings (flag-gated; sent from `data/writePlanApi.js` only). Names the plan and lock versions it was reviewed against, checked under row locks; an applied postpone bumps `lock_version`, so a copy is a coded 409 version conflict. On develop a 500 or an uncoded 409 can answer a postpone that happened: an unknown outcome, never resent. Needs the owners' decision on that lost-answer case, plus staging evidence |
| `profile.password` | `PATCH /profile/password` | false | none | `unverified` | **Not approved** | Classification unverified: a copy after success fails on the current password |
| `export.create` | `POST /report-exports` | false | none | `duplicates` | **Not approved** | A copy queues another export |
| `auth.forgotPassword` | `POST /auth/forgot-password` | false | none | `same-result` | **Not approved** | Public. A copy sends no second email inside the broker's 60 s throttle and later replaces the earlier link. AUTH-RECOVERY.md |
| `auth.resetPassword` | `POST /auth/reset-password` | false | none | `once-only` | **Not approved** | Public. Single-use token: a copy after success is 422, so a lost answer cannot be told from a bad link. A success ends every session. AUTH-RECOVERY.md |
| `email.resend` | `POST /auth/email/verification-notification` | false | none | `same-result` | **Not approved** | Signed in, 6/min per user. A copy sends one more email. AUTH-RECOVERY.md |

### Tier 3: spends provider quota or uploads for AI

**Baseline before approval:** Everything in tier 1, plus the provider strategy of AI-STAGING-TEST-PLAN.md section 2, a spend cap, and the lowered limits; cost recorded.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `receipt.upload` | `POST /ai/expense-captures` | false | client | `key-atomic` | **Not approved** | Uploads a file for AI reading; provider cost |
| `voice.upload` | `POST /ai/voice-expense-captures` | false | client | `key-atomic` | **Not approved** | Uploads audio for AI reading; provider cost; microphone behaviour needs real devices |
| `ai.message` | `POST /ai/conversations/{id}/messages` | false | client | `same-result` | **Not approved** | Spends provider quota; needs the failure and slow cases of AI-STAGING-TEST-PLAN.md (option B); open last in AI |
| `ai.insightsRefresh` | `POST /ai/insights/refresh` | false | none | `same-result` | **Not approved** | Spends provider quota through the job; shares the generation throttle with messages |

### Tier 4: money, completed atomically with its key on `develop`, and one-time reversals

**Baseline before approval:** Everything in tier 1, plus the staging run of the money cases (replay of the same key and request, the same key with other data, insufficient balance, ownership), balances compared with the ledger, on the commit production runs, and the financial gates of SECURITY-AND-FINANCIAL-GATES.md.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `transaction.reverse` | `POST /transactions/{id}/reverse` | true | none | `once-only` | **Not approved** | Money. A lost answer cannot be told from 'already reversed' |
| `transfer.create` | `POST /transfers` | true | client | `key-atomic` | **Not approved** | Money. Atomic on develop; the expiry gap is fixed only on the unmerged branch |
| `transfer.reverse` | `POST /transfers/{id}/reverse` | true | none | `once-only` | **Not approved** | Money. As above |
| `goal.contribution` | `POST /savings-goals/{id}/contributions` | true | client | `key-atomic` | **Not approved** | Money. Through the transfer action |
| `goal.withdrawal` | `POST /savings-goals/{id}/withdrawals` | true | client | `key-atomic` | **Not approved** | Money. Through the transfer action |
| `debt.paymentReverse` | `POST /debt-payments/{id}/reverse` | true | none | `once-only` | **Not approved** | Money. As above |
| `receipt.confirm` | `POST /ai/expense-captures/{id}/confirm` | true | client | `key-atomic` | **Not approved** | Money. Posts an expense from a reviewed receipt |
| `voice.confirm` | `POST /ai/voice-expense-captures/{id}/confirm` | true | client | `key-atomic` | **Not approved** | Money. Posts an expense from a reviewed recording |
| `whatsapp.confirm` | `POST /integrations/whatsapp/expense-drafts/{id}/confirm` | true | client | `key-atomic` | **Not approved** | Money. Needs the WhatsApp consent wording and Meta sandbox |

### Tier 5: money or keyed creates, blocked on the unmerged backend fix

**Baseline before approval:** Everything in tier 4, plus the backend fix (`fix/financial-idempotency-p0` or equivalent) merged, **deployed**, and confirmed on the commit production runs, then re-verified on staging on that commit.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `transaction.expense` | `POST /transactions/expense` | true | client | `key-fix-pending` | **Not approved** | Money. Blocked until the P0 fix is merged, deployed and confirmed |
| `transaction.income` | `POST /transactions/income` | true | client | `key-fix-pending` | **Not approved** | Money. As above |
| `transaction.correct` | `PATCH /transactions/{id}` | true | client | `key-fix-pending` | **Not approved** | Money. As above, plus the request hash omits date, description and reference on develop |
| `debt.payment` | `POST /debts/{id}/payments` | true | client | `key-fix-pending` | **Not approved** | Money. As above |
| `goal.create` | `POST /savings-goals` | false | client | `key-fix-pending` | **Not approved** | Key required only on the fix branch |
| `recurring.create` | `POST /recurring-transactions` | false | client | `key-fix-pending` | **Not approved** | Key required only on the fix branch |
| `debt.create` | `POST /debts` | false | client | `key-fix-pending` | **Not approved** | Key required only on the fix branch |

### Tier 6: never approvable as classified

**Baseline before approval:** None. The classification must first change in a reviewed commit, after the backend takes the occurrence in the request.

| Operation | Request | Moves money | Key | Server dedup | Status | Notes |
|---|---|---|---|---|---|---|
| `recurring.confirmNext` | `POST /recurring-transactions/{id}/confirm-next` | true | derived | `next-open` | **Not approved** | NEVER APPROVABLE as classified: a copy posts the following occurrence. The recurring safety work is out of scope here |
| `recurring.skipNext` | `POST /recurring-transactions/{id}/skip-next` | false | none | `next-open` | **Not approved** | NEVER APPROVABLE as classified: a copy skips the following occurrence |

## 4. Recommended order (what to evidence next)

1. Build staging and verify isolation. 2. Mobile reads against staging. 3. The 408 evidence. 4. `notifications.markRead`, then `notifications.markAllRead` (NOTIFICATION-PILOT.md). 5. The rest of tier 1, one at a time. 6. Tier 2 after the owners decide each risk. 7. Tier 3 (AI) in the order of AI-STAGING-TEST-PLAN.md section 7, `ai.message` last. 8. Tier 4 and then tier 5 only after the backend fix is merged, deployed and confirmed. 9. Tier 6 never, until the backend and the classification change.

The order is a recommendation for gathering evidence. It does not approve anything and may be changed by the owners, in writing.

## 5. Keeping the register in step

- A new registered write needs a row here in the same commit (the test enforces it).
- A change to a write's classification in `writeGate.js` needs the row, its tier and its notes updated in the same commit, and voids any approval for it.
- When the first write is approved, the "Not approved" cell of that row changes to "Approved, see approvals/<operation>.md" **in the same commit that adds it to `APPROVED`**, and the guard test is updated in that commit by a person who has read this file's rules.
