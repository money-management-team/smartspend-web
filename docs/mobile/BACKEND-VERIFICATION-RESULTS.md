# Mobile — backend verification results

**Date:** 2026-11-01.

**Frontend:** local `integration/mobile`, from `ef6063b`.

**Backend:**
- Repository `money-management-team/smartspend-backend`, branch `develop` @ `fd87531` (`fd87531f34612be16e5dd56b1dcc9bc9fd2d73a5`).
- Read-only clone at `F:\Projects\smartspend-backend`.
- Verification tests are on a local branch, `verification/mobile-backend-2026-11-01`, which is not pushed.

**Verdict: BACKEND SOURCE AUDITED; ISOLATED LOCAL TESTS RUN.**
- **Reads:** Mobile's reads were verified against the real Laravel, run locally on fictional data.
- **Funding preview:** proven side-effect free.
- **Idempotency gap:** one gap was found and reproduced. It affects money writes that Mobile does not send.
- **Writes:** every Mobile write stays disabled.
- **Not done:** no staging environment and no production test.

| Kind of evidence | What was done |
|---|---|
| Source inspection | Routes, controllers, FormRequests, Actions/Services, `IdempotencyService`, reversal and locking code, migrations, the backend's own docs |
| Backend test suite, SQLite | Run on unmodified `develop` (§9) |
| Backend test suite, disposable MySQL 8.4.7 | Run (§9) |
| New verification tests (backend, local branch) | Funding-preview side-effect audit; idempotency completion window (§5–§7) |
| Real HTTP: Mobile build → local Laravel → SQLite with the backend's fictional demo data | Two full runs, English/USD and Arabic/ILS (§4) |
| Production | Unchanged from the earlier pass: four unauthenticated GETs. **Nothing else was sent to production.** |

## 1. GitHub access

- **Account:** `gh` is signed in as `abdullah-m-sh100`, an active member of the `money-management-team` org.
- **Backend repository:** private, default branch `main`. GitHub reports ADMIN permission; it was used **read-only**.
- **Frontend repository:** ADMIN as well.
- **Why the earlier pass failed:** the same command returned "Could not resolve" on 2026-11-01 before access was granted.
- **Branches:**
  - `main`: only "chore: initialize Laravel backend", so it is not the product branch.
  - `develop`: holds merged PRs #1–#5 (Sprint 1, Sprint 8–9 AI, WhatsApp #3, branded emails #4, Smart Savings #5).
  - 17 other feature/sprint branches.

## 2. Backend commit and production

- **Audited:** `develop` @ `fd87531` ("Merge pull request #5 … savings-reversal-integrity", 2026-10-24).
- **Production:** most likely the same commit. It is **not confirmed from the server**, which exposes no version.
  - `.github/workflows/deploy-hostinger.yml` deploys on every push to `develop` by running `/home/u316277277/deploy/smartspend/deploy.sh` on the Hostinger host. That script is outside the repository.
  - The most recent workflow run is a successful `develop` push at `fd87531` (2026-10-24T16:31Z), and five earlier runs also succeeded.
- **To confirm:** have the deployer report `git rev-parse HEAD` in the server's deploy directory, or add a version endpoint.
- **Engine:** the latest commit is "finalize MariaDB compatibility", and the backend's docs say production is MySQL-family. Which engine Hostinger actually runs is unconfirmed (§11).

## 3. Laravel architecture (from `CLAUDE.md` and source)

- **Stack:** Laravel 13, PHP ^8.3 (production reports PHP 8.3.36), Sanctum bearer tokens.
- **Layout:**
  - `app/Domain/{Finance,Planning,Debts,Recurring,Import,AiCapture,WhatsApp,…}/{Actions,Services,Support}`;
  - thin controllers, FormRequests and Resources.
- **Money:**
  - `DECIMAL(19,4)` columns.
  - Amounts are strings, handled with `bcmath`.
  - `MoneyAmount::normalize` accepts at most 15 integer digits and 4 decimals: no exponent, no `+`, no leading zeros.
  - Balances are derived from `ledger_entries` (`BalanceService`), never stored.
  - Corrections are reversing entries.
- **Authorization:** the `ScopesToWorkspace` concern. Another user's record gives **404**; a workspace you name but don't own gives **403**. Personal workspaces are owner-only for finance.
- **Envelope:** `{status, message, data}` / `{status:false, message, errors}`, on every status including 401, 403 and 404.
- **Rate limits:**
  - `throttle:auth`: 5 a minute per identifier, 20 per IP.
  - `throttle:write`: 30 a minute.
  - `api`: 120 a minute.
  - separate AI and WhatsApp limiters.
- **Idempotency:** every money movement requires `Idempotency-Key` (8–255 characters, `[A-Za-z0-9._:-]`), handled by `IdempotencyService`.

## 4. Contract inventory: what Mobile uses

### Reads: verified over real HTTP

Method: `shootreal.mjs` (scratchpad).
- It serves a Mobile build of the current tree (Mobile and Smart Savings on, development mode) and proxies `/api` to Laravel at `127.0.0.1:8010`.
- Laravel runs on a throwaway SQLite database, seeded with `DefaultCategorySeeder` and `ReleaseDemoSeeder`: fictional users `demo.en@smartspend.test` and `demo.ar@smartspend.test`, local-only password.
- Outbound HTTP from Laravel goes to a closed proxy, and Chrome resolves no host but `127.0.0.1`.
- It signs in through the real `/m/signin` form, then opens 41 Mobile screens (every report type and the add forms) and the first item of each list.
- The proxy refuses any non-GET except `POST /api/login`.

| Run | API calls | Distinct endpoints | Non-GET | Refused by proxy | Errors |
|---|---|---|---|---|---|
| English, USD | 52 | 45 | `POST /api/login` 200 | 0 | none; 1 expected 404 (below) |
| Arabic, ILS, RTL | 52 | 45 | `POST /api/login` 200 | 0 | none; 1 expected 404 |

Details:
- **No screen errors:** no JavaScript exception and no error card on any screen.
- **The only 4xx:** `GET /savings-goals/{id}/plan` → 404 for a goal without a plan. This is intended: `SavingsPlanController::planResponse` throws `ModelNotFoundException` when there is no active plan, and Mobile's `SmartPlanSection` treats `NOT_FOUND` as that normal state.
- **Endpoints exercised:**
  - auth and identity: `/user`, `/auth/email/status`;
  - finance: `/dashboard`, `/accounts{/id}`, `/transactions{/id}`, `/transfers{/id}`, `/categories{/id}`;
  - planning: `/budgets{/id}`, `/savings-goals{/id}{/plan}`, `/debts{/id}{/payments}`, `/recurring-transactions{/id}`, `/calendar`;
  - notifications and alerts: `/notifications`, `/notifications/unread-count`, `/notifications/preferences`, `/financial-alerts`;
  - the 10 `/reports/*`;
  - `/report-exports`, `/imports`;
  - AI: `/ai/settings`, `/ai/input-quotas`, `/ai/expense-captures`, `/ai/voice-expense-captures`;
  - WhatsApp: `/integrations/whatsapp`, `/integrations/whatsapp/expense-drafts`.
- **Read-contract script:** `scripts/mobileReadContract.mjs` was run against the same backend with the fictional token. 16 of 16 passed: debts, transfers, notifications, calendar, exports, imports and 10 reports, each parsed by the models the screens use.
- **Isolation over HTTP:** for accounts, transfers, debts, savings goals and budgets, the owner gets 200 and the other fictional user gets **404**. An invalid token gets **401**.
- **Not exercised by this run:**
  - `/ai/conversations`, `/ai/insights` and `/ai/forecast` (the Assistant tabs load them on demand);
  - plan options and the confirmation preview (no installment was due in the seed data);
  - WhatsApp drafts with content;
  - export downloads (no completed export in the seed).

  Their shapes are covered by the backend's own feature tests (§9), not by this run.
- **SQLite caveat:** these are shape and behaviour checks. Report SQL on MySQL/MariaDB is covered by the MySQL suite (§9), not by this run.

### Writes: from source

All of these are **disabled in Mobile**.

| Write | Route, middleware | Key | Duplicate protection (source) | Mobile |
|---|---|---|---|---|
| Category create | `POST /categories`, `throttle:write` | none | DB unique `(workspace_id, type, name_key)`. A duplicate or the losing side of a race gets **422** on `name`, "A category with this name and type already exists in this workspace." (`CreateCategoryAction`) | send code exists, gate closed; mismatch fixed (§8) |
| Category rename | `PUT/PATCH /categories/{id}` | none | same unique index (`UpdateCategoryAction`); system categories refused | send code exists, gate closed |
| Income / expense | `POST /transactions/income\|expense` | required | `IdempotencyService::run` (§6) | none |
| Correction | `PATCH /transactions/{id}` | required | `run` + reversal | none |
| Reversal | `POST /transactions/{id}/reverse` | — | row lock + status check + DB `unique(reversal_of_id)` (§7) | none |
| Transfer, transfer reversal | `POST /transfers`, `…/reverse` | required | reserve, then post and `complete()` in **one** transaction (§6) | none |
| Debt payment, reversal | `POST /debts/{id}/payments`, `POST /debt-payments/{id}/reverse` | required | reserve; `complete()` after the posting commits (§6); reversal row-locked, "already reversed" re-checked | none |
| Goal contribution, withdrawal | `POST /savings-goals/{id}/contributions\|withdrawals` | required | `IdempotencyService` | none |
| Recurring confirm-next | `POST /recurring-transactions/{id}/confirm-next` | derived from the occurrence (stored on the row) | rule and occurrence row-locked; reserve and complete inside one transaction | none |
| Smart Savings confirm, postpone, skip, plan create/revise/discontinue | `POST …/planned-contributions/{iid}/confirm` etc., `smart_savings` middleware | required | `run()`; confirm-accounts and reverse-legs wrap it in an outer transaction | none |
| Imports confirm and reverse | `POST /imports/{id}/confirm\|reverse` | required | `run()` | none |
| AI receipt and voice confirm | `POST /ai/…/confirm` | required | voice wraps `run()` in a transaction; receipt calls `run()` from the controller | none |
| WhatsApp draft confirm | `POST /integrations/whatsapp/expense-drafts/{id}/confirm` | required | draft row-locked, everything in one transaction (as recorded on 2026-10-11) | none |
| Report export create | `POST /report-exports` | — | queued job | none (form ends disabled) |

## 5. Financial safety findings

| Property | Finding | Evidence |
|---|---|---|
| Money only inside `DB::transaction` | Yes, in every posting action read | `PostExpenseAction::post`, `TransferMoneyAction`, `ReverseTransactionAction::reverse`, `PostOccurrenceAction` |
| Lock order | Accounts are locked in ascending `id` order | `TransferMoneyAction` (`orderBy('id')->lockForUpdate()`) |
| Precision | `DECIMAL(19,4)` with `bcmath`; the client's `toMoneyString` gives 4 decimals | the backend refuses `+`, leading zeros and exponents with **422**, before anything posts |
| Currency | A transfer or expense must match the account currency; no cross-currency sum | `validateExpenseData`, transfer checks, CLAUDE.md rule 3 |
| Ledger as the source of truth | Balance = opening + Σ `ledger_entries` | `BalanceService` |
| Workspace isolation | Another user's record → 404 | `ScopesToWorkspace`; real HTTP (§4) |
| Funding preview | No write of any kind (§7) | new test, SQLite and MySQL |
| Completion window | **Gap**: see §6 | new test, reproduced |

## 6. Idempotency findings

`IdempotencyService::reserve`:
- **Claim:** it claims a key by `INSERT`ing a row under the unique index `idempotency_scope_unique` (workspace, user, operation type, key).
- **Same key, different payload:** **409**, caught by comparing the SHA-256 of the normalised payload.
- **Same key while processing:** **409** "currently being processed".
- **Same key after completion:** replays the first result without touching the ledger.
- **Failed key:** re-opened so the person can correct and retry.
- **Retention:** keys expire after **24 hours**. After that the same key is treated as new, **even if it completed**.

The key claim is atomic, at the database level. For **simultaneous duplicates** (two copies of an HTTP/1.1 request arriving together), the second copy either waits on the unique index and then replays, or gets a 409 while the first is still processing. Neither path posts twice. The backend's own `ConcurrencyTest`, `TransactionIdempotencyTest` and MySQL concurrency tests cover this (§9).

**Gap: the completion window.** It is reproduced by `tests/Feature/Verification/IdempotencyCompletionWindowTest.php`.

`IdempotencyService::run()` calls the operation, which commits its own `DB::transaction`, and then `complete()` in a **separate** transaction, outside the `try`. If `complete()` fails after the posting has committed (a lost database connection, a deadlock, a killed PHP worker):
1. **The client is told it failed:** it gets a **500**, but the money **has** moved, and the key stays `processing`.
2. **Retry within 24 hours:** a same-key retry gets **409**. No second posting, but the client never learns that the first one succeeded.
3. **Retry after 24 hours:** the key has expired, and the same key **posts a second time**.

Observed on SQLite, forced with a trigger that refuses `status = completed`:
- first request 500, 1 transaction, key `processing`, balance 900;
- retry 409, still 1 transaction;
- after 25 hours, 201, **2 transactions, balance 800**.

MySQL gives the same outcome (§9). The retry within 24 hours there answered 500 rather than 409, which is likely caused by the in-process trigger harness and not relied on.

Which callers have the window:

| Pattern | Callers |
|---|---|
| **Affected:** `complete()` after the posting commits | `PostIncomeAction`, `PostExpenseAction`, `UpdateTransactionAction` (correction), `RecordDebtPaymentAction`, `ConfirmImportBatchAction`, `ReverseImportBatchAction`, `ConfirmSavingsInstallmentAction`, `PostponeSavingsInstallmentAction`, `SkipSavingsInstallmentAction`, `CreateSavingsPlanAction`, `CreateSavingsGoalWithPlanAction`, `ReviseSavingsPlanAction`, `DiscontinueSavingsPlanAction`, `AiExpenseCaptureController` (receipt confirm) |
| **Safe:** reserve, post and complete in one transaction | `TransferMoneyAction` (control test passes: a failed completion rolls the transfer back and a same-key retry posts once), `PostOccurrenceAction` (recurring), `ConfirmSavingsInstallmentFromAccountsAction`, `ReverseSavingsInstallmentLegsAction`, `AiVoiceCaptureAdmissionService`, `AiVoiceCaptureConfirmationService`, `WhatsAppExpenseDraftConfirmationService` |

**Severity:** low likelihood, high impact.
- **Likelihood:** it needs a failure in the few milliseconds between two commits, and then the *same key* resent more than 24 hours later.
- **Clients:** the frontends keep keys in memory only (`createIdempotentAttempt`) and never resend after a reload, so in practice the second posting needs a client that persists keys.
- **What does happen in the window:** the 500 and the stuck 409 do. The person is told the expense failed when it was recorded.

**Smallest correction (proposed, not applied):** run `operation()` and `complete()` inside one `DB::transaction` in `IdempotencyService::run()`, the way `TransferMoneyAction` already does. The operation's own transaction becomes a savepoint.

Why it was not applied: `ConfirmImportBatchAction` hands the posting to a job. With `QUEUE_CONNECTION=sync` that job would run inside the outer transaction, so a 5,000-row import would become one long transaction. That consequence needs the backend owner's decision and a full MySQL regression. Either:
- exempt the import callers; or
- dispatch their job `afterCommit`.

The failing test is the acceptance test for whichever fix is chosen.

## 7. Reversals and Smart Savings funding preview

**Reversals: one time only, enforced three ways.**
1. **Row lock:** `ReverseTransactionAction::reverse` row-locks the original (`lockForUpdate`).
2. **Status check:** it refuses `Reversed` with `TransactionAlreadyReversedException` (409).
3. **Database index:** the schema has `unique('reversal_of_id')` (`create_transactions_table`), so a second reversal row cannot exist even if both checks were bypassed.

Debt and Smart Savings legs must be reversed through their own domain (`DebtTransactionRequiresDomainReversalException`, `SavingsInstallmentLegRequiresDomainReversalException`), and both of those re-check "already reversed" under a row lock. Existing tests: `ReversalEntryPointRaceTest`, `ReversalSnapshotRaceTest`, `ReverseTransactionActionTest`, `DebtTransactionReversalGuardTest`, `PlannedSavingsContributionReversalApiTest`.

**Funding preview: proven a read.**

`POST /savings-goals/{id}/planned-contributions/{iid}/funding-preview` runs `SavingsPlanInstallmentController::fundingPreview` → `SavingsInstallmentFundingPreviewService`, using `SavingsInstallmentPreviewService`, `SavingsInstallmentFundingPlanner`, `FundSavingsInstallmentAction::ensureBreakdownFits` and `SavingsInstallmentFundingIntent`. The six evidence items from handoff §4:

| # | Evidence item | Result |
|---|---|---|
| 1 | Source shows no INSERT/UPDATE/DELETE, lock, quota, job or event | **Yes.** No `save/create/update/delete`, `lockForUpdate`, `dispatch`, `event`, `Cache` or `Log` in the controller or any collaborator; `ensureBreakdownFits` only validates |
| 2 | A run shows SELECT only | **Yes.** The query log over 11 calls (every mode, refusals, a 422 and another user's 404) contains only `select` statements |
| 3 | `confirmation_intent` stored? | **No.** It is a stateless HMAC-SHA256 of user, workspace, goal, plan, currency, installment, versions and legs, keyed from `APP_KEY`. Issuing one changes nothing; confirm recomputes and compares it, and re-checks every balance |
| 4 | Authorization | Another user → **404**, nothing written |
| 5 | Repeats | A hash of every row of every table is identical after each of the 12 calls |
| 6 | Rate limits | Only the general `api` limiter (120 a minute, shared with all reads). Not the `write` limiter that confirm uses |

The test is `FundingPreviewSideEffectAuditTest`, with `Queue::fake`, `Notification::fake` and `Event::fake`. No job, notification, application event or model write event was dispatched.

**Verdict:** source and isolated tests show funding preview has **no persistent or consequential side effect**. It is eligible for a narrowly scoped "read" classification **only if the product owner approves it** (Decision B). Nothing was enabled: Mobile still never calls it, and the write gate and guard test are unchanged.

## 8. Frontend/backend mismatches

| # | Mismatch | Evidence | Action |
|---|---|---|---|
| M1 | A category create refused as a duplicate (422 on `name`) may follow the person's own first copy, which **did** create it. Mobile kept its cached list and said "Nothing was saved" | `CreateCategoryAction` (a duplicate and the losing side of a race give the same 422) | **Fixed in Mobile:** after a create 422, the category cache is dropped, so the next view reads the server. The copy now says "This request saved nothing. If the name is already taken, the category may already be in your list." (en/ar). New test in `tests/mobileCategories.test.mjs`, which fails without the fix |
| M2 | `toMoneyString` lets a leading `+` and leading zeros through; the backend refuses them | `MoneyAmount::PATTERN` | No change: the refusal is a 422 before anything posts, and only Desktop sends money. Noted for the shared wrapper owner |
| M3 | `IdempotencyService` completion window (§6) | new failing test | Backend decision; frontends must never persist and resend a key after 24 hours (they don't) |
| — | Login field is `identifier`, not `email` | `LoginRequest` | Already matched (Mobile and Desktop send `identifier`) |
| — | 401/403/404 envelopes | `bootstrap/app.php`, real HTTP | Matched |
| — | `GET …/plan` 404 for "no plan" | `planResponse` | Matched (Mobile treats it as the normal state) |

No other field-name, pagination or envelope mismatch appeared in the real-HTTP runs or the contract script.

## 9. Backend tests actually executed

Full suite, SQLite (`phpunit.xml`), unmodified `develop` @ `fd87531`: **3,121 tests, 2,975 passed, 4 failed, 142 skipped.**

The 4 failures are all environmental:
- **3 × `MysqlTestRunnerSecurityTest`:** the runner identifies listeners with `Get-NetTCPConnection`. On this Windows 11 build that cmdlet (and `netstat`) does not report a listener that a TCP connect proves exists, even outside the sandbox, so the tests' assumptions about the host fail.
- **1 × `WhatsAppInteractiveSafetyTest::test_the_flag_defaults…`:** caused by the local `.env` copied from `.env.example`, which sets `WHATSAPP_UX_VERSION=v1`; dotenv wins over the test's `putenv`. With that line unset locally it **passes**.

Full suite, disposable MySQL 8.4.7 (`phpunit.mysql.xml`), `develop` plus the new verification tests, known-gap group excluded: **3,126 tests, 3,097 passed, 4 failed, 25 skipped** (44 minutes). Every product test passed. The failures were the same 3 runner-host tests, plus my own transfer control test, which was invalid on MySQL (see below) and now skips there.
- **Runner:** a local copy of `tests/Support/mysql-test.ps1` (scratchpad `mysql-test-local.ps1`). Only two functions changed, because of the listener problem above:
  - "is something listening" is a TCP connect;
  - "is it ours" uses the pid file the server writes in its own protected folder, then the original's process-name and `--datadir` check.

  Everything else is the original: a private data folder with a marker, a random expired root password, a restricted account and port 3310.
- **PHP guard:** `tests/bootstrap.php` checks `@@datadir`, `@@port` and grants against the server itself, and it accepted the server.
- **Memory:** PHP's memory limit was raised to 2 GB for the run (the first attempt stopped at the 128 MB default).

New verification tests (`tests/Feature/Verification`, local branch):

| Test | SQLite | MySQL |
|---|---|---|
| `FundingPreviewSideEffectAuditTest` | pass (43 assertions) | **pass** |
| `IdempotencyCompletionWindowTest::…transfer…` (control) | pass | skipped: `CREATE TRIGGER` is DDL, MySQL commits `RefreshDatabase`'s transaction, and the action's transaction becomes a savepoint that cannot roll back in-process. The backend's own trigger tests skip on MySQL for the same reason and prove rollback with separate-process race tests |
| `IdempotencyCompletionWindowTest::…expense…never_posts_twice` (group `verification-known-gap`, expected to fail) | **fails as expected**: 2 transactions | **fails as expected**: first 500 with 1 transaction and the key `processing`; retry within 24 hours 500; after 25 hours 201, **2 transactions, balance 800** |

Frontend: `npm test` **1,592 / 1,592** pass (one new test); `npm run lint` clean.

## 10. Remaining blockers

1. **Production commit** not confirmed from the server (§2).
2. **Completion window (§6):** a backend decision and fix, then a MySQL regression.
3. **No staging:** no hosted environment with fictional data exists for the end-to-end write tests in §12.
4. **Production database engine** (MySQL vs MariaDB) unconfirmed. The MySQL suite ran on MySQL 8.4.7, not MariaDB.
5. **Real Google OAuth:** unverified (needs a staging origin and a client ID that allows it).
6. **Decision B (funding preview):** the evidence is now in (§7); the decision is the product owner's.
7. **Enabling writes:** every Mobile write needs a separate staging-enablement approval.

## 11. Staging environment requirements

- **Code:** a host separate from production, deploying `develop` @ the production commit. Never the production directory or database.
- **Database:** the **same engine and version as production**. Confirm MySQL vs MariaDB first, then create a fresh database and user with no access to any other schema.
- **Configuration:** a new `APP_KEY` (funding intents are keyed from it) and a new `WHATSAPP_IDENTITY_HASH_KEY`.
  - `APP_ENV=staging`, `MAIL_MAILER=log` (or a sink), `QUEUE_CONNECTION=database` with one worker, scheduler on.
  - `OPENAI_API_KEY` empty or a test key with a spending cap; `WHATSAPP_ENABLED=false`; `SMART_SAVINGS_ENABLED` per test.
- **Data:** `php artisan db:seed --class="Database\Seeders\ReleaseDemoSeeder"` with `SMARTSPEND_DEMO_PASSWORD` set. It refuses anything but `local`/`testing`, so either run it with `APP_ENV=local` on the staging host or add a staging-safe seeder. Never a production dump.
- **Frontend:** a staging build with `VITE_API_BASE_URL` set to the staging API, its own origin (for CORS, Sanctum and Google), `VITE_MOBILE_ENABLED=true`, and the write gate still closed.
- **Access:** restricted (basic auth or IP allowlist); a named approver who confirms isolation before any write test.
- **Rollback:** snapshot the database before each write-test session.

## 12. Operations eligible for future staging tests

Eligible means it may be **tested on staging**. Nothing here is enabled in Mobile.

| Operation | Contract verified | Duplicate protection verified | Frontend payload aligned | Error handling verified | Isolated integration passed | Eligible for staging review |
|---|---|---|---|---|---|---|
| All Mobile reads (§4) | yes (source + real HTTP) | n/a | yes | yes (404 plan, 401, cross-user 404) | yes (local) | yes |
| Category create | yes | yes (unique index → 422) | yes (`{workspace_id, name, type}`) | yes, after M1 | backend tests only | **yes** |
| Category rename | yes | yes | yes (`{name}`) | yes | backend tests only | **yes** |
| Funding preview (read-like) | yes | n/a (no write) | wrapper exists, Mobile doesn't call it | yes | yes (new test) | **yes, if Decision B approves** |
| Transfer | yes | yes (single transaction) | Desktop wrapper only | not in Mobile | backend tests | yes, after Mobile UI work |
| Recurring confirm-next | yes | yes (derived key, locked) | Desktop wrapper only | not in Mobile | backend tests | yes, after Mobile UI work |
| Income, expense, correction, debt payment, imports, single-account Smart Savings confirm | yes | **partly**: completion window (§6) | Desktop wrapper only | not in Mobile | backend tests + gap test | **after the §6 fix** |
| Reversals (transaction, transfer, debt) | yes | yes (lock + unique) | Desktop wrapper only | not in Mobile | backend tests | yes, after Mobile UI work |

## 13. Next actions

1. **Backend owner:**
   - Confirm the production commit.
   - Decide the §6 fix (all `run()` callers in one transaction, with the import job dispatched `afterCommit`).
   - Run the full MySQL suite and `IdempotencyCompletionWindowTest`, which should then pass.
2. **Product owner:** decide Decision B with §7 as the evidence.
3. **Ops:** stand up staging per §11, on the production engine.
4. **On staging:** re-run `shootreal.mjs` and `mobileReadContract.mjs` against the staging API, then the category create/rename write tests with the gate opened **only in a staging build**.
5. **Mobile:** keep `APPROVED = []` in the production-bound source until staging-enablement approval is given.
