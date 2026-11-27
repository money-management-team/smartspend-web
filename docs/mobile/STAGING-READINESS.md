# Mobile — staging and write-safety readiness (Phase 2G)

**Verdict (2026-11-16): not ready to open any write.** `APPROVED` in `src/mobile/data/writeGate.js` is `Object.freeze([])`, 50 writes are registered and all are closed, and **no staging environment exists**. Nothing in Mobile has ever been run against a deployed backend; every result so far is local (jsdom and headless Chrome against fake or local servers on fictional data). Passing tests is not evidence that a write is safe to open. This document says what exists, what is missing, and the order in which evidence has to be collected.

Companion documents: [HTTP-408-EVIDENCE.md](HTTP-408-EVIDENCE.md) (the one release rule nobody has proven), [AI-STAGING-TEST-PLAN.md](AI-STAGING-TEST-PLAN.md), [NOTIFICATION-PILOT.md](NOTIFICATION-PILOT.md) (the first write to open) and [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md) (per-write status and the approval template).

**Update (Phase 2G.1, 2026-11-16):** the workflows, server scripts, isolation guards and their tests for staging now exist in both repositories (sections 3.1, 3.3, 3.9 below describe what they must satisfy). **Staging itself is still not provisioned.** What was built, how it isolates, and the exact remaining steps are in [STAGING-INFRASTRUCTURE.md](STAGING-INFRASTRUCTURE.md); read that before treating any checklist item below as done.

Labels used below: **Verified** (read in source or run locally in this repository), **Unverified** (stated in a document or assumed, not observed), **Missing** (does not exist).

## 1. What exists

### Frontend (this repository)

| Item | State | Evidence |
|---|---|---|
| The write gate | **Verified.** One registry (`MOBILE_WRITES`, 50 entries) and `APPROVED = Object.freeze([])`. Opening a write is a source change, not a setting: there is no environment variable, storage key, URL parameter or console switch. A write is also unreachable through `writeApi.js` (`sendWorkflowWrite` asserts the gate first). | `writeGate.js`, `writeApi.js`, `tests/mobileWriteGate.test.mjs`, `tests/mobileReadOnly.test.mjs` |
| The test switch | **Verified.** `setWriteApprovalsForTests` works only when `import.meta.env.MODE === "test"` and throws otherwise. Neither the flag-on nor the flag-off build contains it (checked on the Phase 2F builds). | `tests/mobileBundle.test.mjs` |
| No runtime kill switch | **Verified (and important).** Because `APPROVED` is compile-time, a write that was opened can only be closed by **building and deploying again** without it. There is no way to switch one off in a running build. The pilots below must therefore be small, staging-only deployments that can be replaced in minutes. | `writeGate.js` header |
| Key handling | **Verified locally.** One `Idempotency-Key` (or `client_request_id`) per submission, kept 24 h per user, workspace and operation, bound to a hash of the request, released only after a confirmed or certain outcome. Nothing is resent by itself. | `forms/useWorkflowSubmit.js`, `data/pendingWriteStorage.js` |
| Client timeout | **Verified.** 20 s for every request (`REQUEST_TIMEOUT_MS`); 90 s for the AI message and forecast. A timeout is an unknown outcome. | `apiClient.js` |
| Build flags | **Verified.** Mobile is off unless `VITE_MOBILE_ENABLED` is exactly `"true"`. A *production-mode* build with it on needs `SMARTSPEND_MOBILE_RELEASE_APPROVED=true` in the shell; any other mode (for example `--mode staging`) does not, and may carry the PWA. The deploy workflow pins it off. | `scripts/mobileBuildFlag.mjs`, `deploy-hostinger.yml` |
| CI | **Verified.** `ci.yml` runs lint and `npm test` on pull requests and `integration/**` pushes: no secrets, no deployment. `RELEASE-AND-ROLLBACK.md` records that it had not yet run on GitHub's Linux runner; whether it has since is **Unverified**. | `.github/workflows/ci.yml` |
| Deployment | **Verified.** One workflow, `deploy-hostinger.yml`: it deploys `development` to production, pins Mobile off and validates the production API URL. **There is no staging workflow.** `vercel.json` is a leftover from a previous host. Vercel preview builds on pushes exist (SSO-protected, recorded earlier); whether they can serve as a staging front end, and against which API, is **Unverified**. | workflow, `vercel.json` |
| Local isolation | **Verified.** The dev server forwards `/api` to `127.0.0.1:8000` only; a remote origin needs `SMARTSPEND_ALLOW_REMOTE_API=true`. `.env.local` is git-ignored. | `scripts/devApiTarget.mjs`, `docs/dev-environment/local-api-target.md` |

### Backend (read only; `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72`)

| Item | State | Evidence |
|---|---|---|
| Production deployment | **Verified.** `develop` deploys through GitHub Actions and SSH to one Hostinger shared host (`deploy.sh` on the server), serialised in one concurrency group, behind a CI gate (SQLite, MySQL 8.4, MariaDB 11.8). The gate's GitHub-side settings (branch protection, environment-scoped secrets) are **Unverified**: they cannot be committed. | backend `docs/operations/CI_DEPLOY_GATE.md` |
| The P0 idempotency fix | **Verified as unmerged and undeployed.** On `fd87531` the key is completed in a second transaction, keys are recycled after 24 h, and the correction hash omits date, description and reference; `6b696d72` fixes them. The commit and database engine production actually runs are **Unconfirmed**. | `docs/mobile/TRANSACTION-CREATE.md`, `TRANSACTION-CHANGE.md`, `RELEASE-AND-ROLLBACK.md` |
| A staging plan | **Verified as a plan only.** `docs/operations/WHATSAPP_STAGING_PLAN.md` (option A: separate subdomains, application directory, database and `.env` on the same Hostinger plan; with its handover checklist) was written for WhatsApp. **Nothing in it was created.** It is the right starting point and this document reuses it. | backend repo |
| Runbooks | **Verified.** Queue and scheduler (workers per queue, cron, monitoring), backup and recovery (daily encrypted backup, 30-day retention, restore ordering), AI operations (services, env, deploy order, smoke checks, incident handling), AI release readiness and test matrix (including "manual staging scenarios"). | backend `docs/` |
| Request correlation | **Missing.** The backend has no request-id middleware and logs no request id. A request can be correlated only by what it carries (the `Idempotency-Key` header or the body's `client_request_id`) and by timestamps. See the 408 plan. | `git grep` on `6b696d72` |
| AI provider for tests | **Missing at runtime.** The fake provider (`tests/Fakes/AI/FakeStructuredAIProvider.php`) exists only inside PHPUnit. `AppServiceProvider` binds the real adapter (`LaravelAiStructuredProvider`) and nothing selects a fake by environment. See the AI plan. | `AppServiceProvider.php`, `tests/Fakes` |
| Proxy and server timeouts | **Missing (not in either repository).** `public/.htaccess` is the stock rewrite file with no timeout directive. The web server in front of PHP (Apache, LiteSpeed or other), its request-body and keep-alive timeouts, its maximum execution time, PHP's `max_execution_time`, and the protocol (HTTP/1.1 or HTTP/2) between the edge and PHP are all **Unknown**. The claim "production serves over HTTP/2" in `docs/performance/mobile-code-splitting.md` is about the front-end host and is not evidence about the API host. | whole repo search |
| Provider timing | **Verified.** A chat message makes up to two sequential provider calls (intent, then answer), each with `AI_COPILOT_TIMEOUT_SECONDS` (default 45), inside one synchronous request. The client waits 90 s. The server's own limit and the edge's limit are **Unknown**. | `config/ai_copilot.php`, `AiChatService` |

## 2. What is missing (infrastructure and decisions)

| # | Missing | Why it blocks | Who decides or provides |
|---|---|---|---|
| 1 | A staging **backend** (own subdomain, application directory, database, `.env`) | Nothing can be run against a deployed backend | Owner: option A or B of the staging plan; who holds the credentials |
| 2 | A staging **front end** and a **separate staging deploy workflow** | Mobile can't be served to a device against staging | Owner/devops |
| 3 | Confirmation of the production commit, database engine and version, PHP version and extensions | Staging must match what production runs, or its evidence says nothing about production | Backend owner |
| 4 | The web server, its timeouts and the protocol on the API path | The 408 question can't even be framed | Hosting provider or backend owner |
| 5 | Access to raw web-server access logs (or an equivalent request counter) on staging | Arrivals can't be counted | Hosting access |
| 6 | An AI provider strategy for staging (budget-capped key, or a provider stub; see the AI plan) | Nine writes can't be tested without provider cost or risk | Owner |
| 7 | Synthetic data and test accounts | A tester needs known users, an ownership counter-party, an inactive user | Backend owner |
| 8 | A real-device pass (iOS, Android, an installed PWA, a screen reader) | Not a write gate, but needed before users see Mobile | QA |
| 9 | Per-write approval authority: who may approve, and where it is recorded | A write can't be opened without a named approver | Owner |
| 10 | GitHub-side protections for the staging and production workflows (environment-scoped secrets, protected branches) | A new workflow could otherwise reuse deploy credentials | Repository admin |

## 3. Staging requirements checklist

Each line must be true, and recorded with who checked it and when, before the first pilot. None of it exists today.

### 3.1 Isolation from production

- [ ] Separate hostnames and TLS certificates for the staging API and the staging web origin, neither equal to a production hostname.
- [ ] Separate application directories: no shared `vendor`, `storage`, `bootstrap/cache`, `.env` or document root, and no symlink into production.
- [ ] A separate database server or at least a separate database **and database user** that has **no grant** on any production schema. The staging `.env` cannot name a production database.
- [ ] Separate queue tables, cache store, session store, file disks and mail configuration (mail set to `log`, never a real transport).
- [ ] Separate deploy credentials: a staging SSH key and known-hosts entry in a **GitHub environment** that only the staging workflow may use; the production deploy script is not reachable from it, and the staging workflow cannot run on `development` or `develop`.
- [ ] The staging front end is built with the staging API URL, and the staging workflow **fails** if that URL equals the production API URL (the mirror image of the check in `deploy-hostinger.yml`).
- [ ] Verification, not assertion: print the staging `.env` hostnames and database name, run the database grant query for the staging user, and confirm from the staging host that the production database host is unreachable. Record the output.

### 3.2 Data

- [ ] **Never copy production financial data into staging**, not as a dump, a sample, an anonymised export or a "just for debugging" fixture. Production data stays in production.
- [ ] A seed script that creates only synthetic data: `DefaultCategorySeeder`, then the personas in 3.5, with their accounts, categories, a few transactions, a budget, a goal and a debt, in at least two currencies.
- [ ] A **known-good snapshot** of the seeded staging database, so a run can be reset to a known state and each evidence run states which snapshot it started from.
- [ ] Any defect found from production behaviour is reproduced with synthetic data. If it cannot be, it is not reproduced in staging.

### 3.3 Environment and secrets

Names only; values live only on the server or in a GitHub environment, never in the repository, a document, a ticket or a chat.

- [ ] Backend: `APP_ENV=staging` (never `production`), `APP_DEBUG=false`, its own `APP_KEY`, `APP_URL`, `FRONTEND_URLS` (exactly the staging web origin, for CORS), `DB_*`, `QUEUE_CONNECTION=database`, a shared cache, `MAIL_MAILER=log`, `LOG_*`, the trusted-proxy configuration set to the host's real proxy addresses (not `*`; the setting is not an environment variable in this codebase, so it needs a deployment-side check), `FINANCE_MANUAL_DUPLICATE_GUARD` stated explicitly (off by default), the AI variables of the AI plan, and `WHATSAPP_ENABLED=false`.
- [ ] No production secret is present on the staging host: no production `APP_KEY`, database password, provider key, WhatsApp secret or SSH key.
- [ ] Frontend (build shell only): `VITE_API_BASE_URL` (staging), `VITE_MOBILE_ENABLED=true`, a **non-production mode** such as `--mode staging`, and `VITE_GOOGLE_CLIENT_ID` only if Google sign-in is to be tested (its client must allow the staging origin; otherwise use email and password). `SMARTSPEND_MOBILE_RELEASE_APPROVED` is **not** set.

### 3.4 Queue workers and scheduled jobs

- [ ] Cron every minute running `php artisan schedule:run` (insight refresh, retention pruning and cleanup depend on it).
- [ ] Workers for the queues the tested features use: `default`, `ai-copilot` (insights; three tries) and, if captures are tested, `ai-capture`. Hostinger shared hosting has no supervised long-running worker, so the practical form is a per-minute cron running `queue:work --queue=<name> --stop-when-empty --max-time=55`; replies and refreshes can lag by up to a minute, which the test plan allows for.
- [ ] `QUEUE_CONNECTION` is not `sync`.
- [ ] Workers are restarted after each deployment.
- [ ] The scheduler and worker are proven running (a heartbeat or a visible job result) before an AI refresh is tested.

### 3.5 Authentication and test accounts

All synthetic, with throwaway email addresses on a domain the team controls, and passwords kept only in the team's secret store.

| Persona | Used for |
|---|---|
| `owner-a` | The main tester: owns a personal workspace with data in two currencies, AI consent given |
| `owner-b` | The **ownership counter-party**: another person's conversations, notifications, accounts and categories, for the 404/403 tests |
| `inactive` | An account with `status` not `active` (the 403 tests) |
| `no-consent` | A user who never consented to the assistant (the consent refusals) |
| `member` (optional) | A workspace member with a restricted role, if shared workspaces are in scope |

- [ ] Sign-in through the staging API works with a Sanctum bearer token; the token is never copied into a document.

### 3.6 Migrations and seed data

- [ ] The staging database engine and version are the same family and version as production's (production is described as MariaDB 11.8 in one document and left open in another: **confirm it**); row-lock and `SIGNAL`/JSON-ordering behaviour is engine-specific.
- [ ] Deploy from a pinned commit (for the first evidence runs, the **production** commit, so the evidence concerns what users would get; later, `6b696d72` for the P0 fix). Record the commit hash in every evidence file.
- [ ] `php artisan migrate`, then the seed, then `php artisan about` and the readiness commands that exist (`php artisan ai-copilot:readiness --strict` and `ai-copilot:release-check`, from the AI runbook), output recorded.
- [ ] PHP version and extensions match production (`bcmath` is mandatory for money).

### 3.7 Logging and request correlation

- [ ] Laravel logs go to a daily file on staging with a short retention, readable over SSH, and contain no financial data or personal identifiers beyond the synthetic ones.
- [ ] **Web-server access logs** with timestamp, method, path, status, bytes sent, request duration and the upstream status, retained for the length of an evidence run. If the host does not expose them, say so: the 408 evidence then rests on row counts alone (see the 408 plan, which is built so that it can).
- [ ] Correlation, since the backend has no request id: every test request carries a **unique, recorded** `Idempotency-Key` or `client_request_id` (the registry keys already do) and, for the counting probes, a unique value in the body. Capturing the header in the access log needs a log format change at the web server; if that is not possible, the probe uses an endpoint whose rows count arrivals (the 408 plan's `POST /ai/conversations`).
- [ ] A **request-id middleware is a backend change** and is only *recommended* here; it was not made and must not be assumed.

### 3.8 Backup and recovery

- [ ] A backup (or snapshot) of the staging database before each evidence run, and a **restore drill** on staging, following the backup runbook's ordering, with the time taken recorded.
- [ ] Staging backups are separate from, and never restored into, production.
- [ ] After a destructive test (`ai.dataDelete`, conversation deletion) the run ends with a restore to the snapshot.

### 3.9 Frontend staging deployment

- [ ] A new workflow, `workflow_dispatch` only, in its own GitHub environment, building `--mode staging` from a **named staging branch or pinned commit** (never `development`), with the API-URL guard in 3.1. It does not touch `deploy-hostinger.yml`.
- [ ] The SPA fallback serves `index.html` for `/m/*` on the staging host; cache-control is `no-cache` for `index.html` and immutable for `/assets/*`; CORS allows exactly the staging web origin. (Checked by curl from the release checklist in `RELEASE-AND-ROLLBACK.md`.)
- [ ] The PWA, if built for staging, uses the retire worker procedure for rollback (`PWA-AND-DEVICE-QA.md`).

## 4. How a write is opened on staging (and why it cannot leak)

Opening a write is a one-line source change to `APPROVED` plus the test updates that pin it, in a **reviewed commit**. For a pilot:

1. Branch `staging/mobile-pilot-<operation>` from `integration/mobile`. Never from `development`; never merged.
2. The only change is that operation's name in `APPROVED`, with the tests that pin `APPROVED` updated in the same commit (this is the mechanism the code comments describe; the tests exist to make the change loud).
3. Build with `--mode staging` and the staging API URL, deploy with the staging workflow only.
4. Rollback is a redeploy of `integration/mobile` (or the previous staging commit). Deleting the branch ends the pilot.
5. The production workflow cannot see the branch (it deploys `development`), pins Mobile off and fails if Mobile is on.

## 5. Recommended execution order

1. **Owner decisions** (section 2, items 1, 3, 6, 9, 10) and a named person for each record below.
2. Build staging (sections 3.1 to 3.8). Record the 3.1 isolation verification output.
3. Run the **Mobile reads** against staging with the synthetic data (the list in `BACKEND-CONTRACT-GAPS.md`). No write is involved.
4. Collect the **HTTP 408 evidence** ([HTTP-408-EVIDENCE.md](HTTP-408-EVIDENCE.md)). It gates every write, including the harmless ones, and it needs nothing but a staging host and the probe endpoint.
5. **Pilot 1: `notifications.markRead`**, then `notifications.markAllRead` ([NOTIFICATION-PILOT.md](NOTIFICATION-PILOT.md)). Approve with the template in [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md).
6. Further harmless idempotent writes (the register's tier 1), one at a time, each with its own evidence and approval.
7. Non-financial creates and deletes with weaker dedup (tier 2), after deciding each risk explicitly.
8. The **AI writes** ([AI-STAGING-TEST-PLAN.md](AI-STAGING-TEST-PLAN.md)): feedback, dismiss, settings and conversation create/delete first; `ai.message` and `ai.insightsRefresh` last, because they spend provider quota.
9. **Financial writes** only after the backend fix is merged, deployed, and confirmed on the commit production runs, then re-verified on staging on that commit. Reversals and transfers (already atomic on `fd87531`) before the `key-fix-pending` group.
10. Real devices, then a recorded release approval (`SMARTSPEND_MOBILE_RELEASE_APPROVED`) for the Mobile experience itself, which is separate from, and does not imply, any write approval.

A step is complete when its evidence file exists and a named person has signed it. Passing automated tests is a precondition for starting a step, never the evidence that finishes it.

## 6. Open questions for the owners

1. Staging option A (same Hostinger plan) or B (a separate domain and account)? Who holds the staging SSH and database credentials?
2. What exactly does production run today: commit, PHP, database engine and version, web server?
3. Can the hosting provider tell us, in writing, the web server, its request-body and keep-alive timeouts, its maximum request time and whether the edge talks HTTP/1.1 or HTTP/2 to PHP?
4. Can access logs be exposed on staging, with the request headers we need?
5. Which AI strategy for staging (budget-capped provider key, or a provider stub the backend team adds)?
6. Who may approve a write, and where is the record kept?
7. Is a backend request-id middleware acceptable (a backend change, separate from this work)?
