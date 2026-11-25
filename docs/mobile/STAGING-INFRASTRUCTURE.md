# Mobile — isolated staging infrastructure (Phase 2G.1)

**Status (2026-11-16): implemented in the two repositories, NOT provisioned.** The workflows, the server scripts, the isolation guards and their tests exist and pass. No staging domain, database, SSH credential, GitHub environment or server directory has been created, no workflow has run, and nothing has been deployed. Until the steps in section 8 are done and section 7's checks pass on the real host, **do not describe staging as ready**. `APPROVED` in `src/mobile/data/writeGate.js` is still `Object.freeze([])`; this phase opens no write.

Companion documents: [STAGING-READINESS.md](STAGING-READINESS.md) (what staging must satisfy and why), [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md), [RELEASE-AND-ROLLBACK.md](RELEASE-AND-ROLLBACK.md). The backend half is `docs/operations/STAGING_ENVIRONMENT.md` in the backend repository.

## 1. What was built

| Piece | Where | What it does |
|---|---|---|
| Frontend staging workflow | `.github/workflows/deploy-staging.yml` | Manual only. Builds Mobile in `--mode staging`, verifies the build, uploads it to a staging directory over SSH, runs the server script. |
| Isolation module | `scripts/stagingIsolation.mjs` | One set of rules used by the workflow preflight, the post-build check, `npm run staging:verify` and the tests. |
| Frontend server script (template) | `deploy/staging/frontend/deploy.sh` | Installed by hand on the host. Refuses unless it can prove it is not touching production; swaps a `current` link inside its own base. |
| GitHub environment shape | `deploy/staging/frontend/github-environment.example` | Names and shapes only. |
| Backend staging workflow | backend `.github/workflows/deploy-staging.yml` | Manual only. Same pattern for the Laravel app (production-only `vendor/`, no `.env`, no `storage`). |
| Backend server script (template) | backend `deploy/staging/deploy-staging.sh` | Runs the environment guard first, then links the host's own `.env` and `storage`, confirms Laravel reports `staging`, and only then (on request) migrates. |
| Environment guard | backend `deploy/staging/StagingEnvironmentGuard.php`, `verify-staging-env.php` | Pure PHP. Compares the staging `.env` with a denylist of what production owns. |
| Templates | backend `deploy/staging/env.staging.example`, `production-denylist.example.json`, `cron.example` | Safe defaults, no secret. |
| Tests | `tests/stagingIsolation.test.mjs` (30), backend `tests/Unit/StagingIsolationTest.php` (54) | See section 6. |

The production workflows are **unchanged**. The frontend's is pinned by SHA-256 in `scripts/stagingIsolation.mjs`; changing it on purpose means changing that pin in the same reviewed change.

## 2. Architecture

Two web hosts and one backend, all separate from production. The naming follows production's (a hyphen between product and role):

| | Production | Staging |
|---|---|---|
| Web | `smartspend.<domain>` | `smartspend-staging.<domain>` |
| API | `smartspend-api.<domain>/api` | `smartspend-api-staging.<domain>/api` |
| Frontend directory | production deploy directory | `<STAGING_REMOTE_BASE>` (contains `staging`) |
| Backend directory | production deploy directory | `<STAGING_REMOTE_BASE of the backend>` (contains `staging`) |
| Database | production schema and login | a separate schema and a separate login with no grant on production |
| `APP_KEY`, tokens, sessions | production's | generated for staging; sessions and cache use a `staging` prefix |
| Storage, logs, uploads | production's | the staging directory's own `shared/storage` |
| Queue and scheduler | production's cron and workers | staging's own cron entries, started from staging's `current` (which reads staging's `.env`) |
| AI provider | production key | empty (calls fail safely) or a staging-only key with its own spending limit |
| Mail | production mailer | `log` (never sends) |
| WhatsApp | production provider | off |
| Data | real users | synthetic only; **never** a copy of production |

The staging web build is built with `VITE_API_BASE_URL` = the staging API and **cannot** reach production: `npm run build -- --mode staging` is refused by the preflight if the URL is not an `https` staging host, and the post-build check fails if the production API host appears anywhere in `dist/`.

## 3. The frontend workflow

`workflow_dispatch` only, in the GitHub environment `staging`, concurrency group `smartspend-frontend-staging`, `permissions: contents: read`. Inputs: `ref` (a `staging/*` or `integration/*` branch, or a full commit hash; a production branch, `..` and `//` are refused before checkout) and `pwa` (off by default; the PWA is staging-only, see [PWA-AND-DEVICE-QA.md](PWA-AND-DEVICE-QA.md)).

Order: check the revision → checkout → **isolation preflight** (before anything is built or sent) → install → lint → build (`--mode staging`, Mobile on, no release approval) → add `.htaccess` and the revision file → **verify the build** → SSH (host key verified, `StrictHostKeyChecking=yes`) → upload to `incoming/<sha>` → run the server script.

It reads **only** `STAGING_*` secrets and variables, and nothing else:

| Kind | Name | Meaning |
|---|---|---|
| secret | `STAGING_SSH_KEY` | a private key created only for staging |
| secret | `STAGING_KNOWN_HOSTS` | the host's key line(s) |
| secret | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_PORT` | the SSH target |
| variable | `STAGING_API_BASE_URL` | `https://<staging API host>/api` |
| variable | `STAGING_WEB_ORIGIN` | `https://<staging web host>` |
| variable | `STAGING_REMOTE_BASE` | absolute path, contains `staging`, outside every production path |
| variable (optional) | `STAGING_GOOGLE_CLIENT_ID` | a Google client that allows the staging origin; empty disables Google sign-in |

### Why the names are `STAGING_*` and not the production names

GitHub resolves an **environment** secret first and falls back to a **repository** secret of the same name. If the staging environment simply lacked `HOSTINGER_SSH_KEY`, the production key would be used silently. So staging uses names production does not have, the workflow reads no other name, the preflight refuses a job that has any `HOSTINGER_*` variable, and the workflow check rejects any expression that falls back with `||`. Production's `HOSTINGER_*` secrets must also never be copied into the `staging` environment.

## 4. Isolation controls and what each one stops

| Control | Runs | Stops |
|---|---|---|
| Revision check | workflow, before checkout | building a production branch or a path-traversal ref |
| `stagingIsolation.mjs preflight` | workflow, before build and any connection | missing config; a production or non-staging URL; `http`; credentials in a URL; a remote base that is, is inside or contains a production path; a bad SSH value; a production-named variable; a production release approval; Mobile not exactly `"true"` |
| `stagingIsolation.mjs build dist` | workflow, after build | a build that lacks the staging API, carries the production API/web host in code, or has no Mobile chunk (the production site is tolerated only as the `canonical` link of the shared `privacy.html` and `terms.html`) |
| `StrictHostKeyChecking=yes` + known-hosts secret | every SSH call | connecting to an unverified host |
| `deploy.sh` (frontend) | on the host | a base that is not named `staging`, a missing denylist, a base inside/around a listed production path, a build that names a listed production host, no revision file |
| `StagingEnvironmentGuard` (backend) | on the host, before any `artisan` command | `APP_ENV` not `staging`, debug on, production `APP_KEY`/DB/cache prefix/bucket/credentials (by fingerprint), a non-staging or production URL, CORS wildcard, real mail, WhatsApp on, a path that is or contains production |
| `artisan env` must say `[staging]` | backend script, before migrating | an `.env` that looks right but is not what Laravel loads |
| Migrations | backend script | only with `--migrate` (an explicit workflow input), only after the guard |
| Tests | CI and `npm test` | a later edit that weakens any of the above (each rule has a mutation test) |

`npm run staging:verify` re-checks the staging workflow's structure and that the production workflow is unchanged.

### What these controls cannot do

They cannot see GitHub's settings, the host, or the database. They cannot tell that a `STAGING_SSH_KEY` is really a different credential from production's, or that a database login lacks a grant on production's schema. On a **shared Hostinger plan** one SSH account often reaches every site, so a leaked staging key could reach production files; isolation then rests on paths, the two denylists and discipline. Prefer a second SSH account or a separate plan. These are the manual verifications in section 7.

## 5. Mobile against the staging configuration

Staging does not exist, so this was checked on the staging-mode **build** in a real headless Chrome, with every request intercepted (Chrome's Fetch domain): requests to a fake staging API host (`smartspend-api-staging.example.test`) were answered with **synthetic** data, the static build was served locally, and any other host was blocked and counted.

Result (30 checks, all passing, 2026-11-16): sign-in through the real Mobile screen; Home, Accounts, Account detail, Activity, Transaction detail, Categories, Budgets, Goals, Debts, Recurring, AI Assistant and Notifications each reached a loaded state in English and Arabic with no horizontal overflow. 91 API calls: **all to the staging host, none to a production host, and the only non-GET request was the sign-in `POST /login`**.

Limits, so this is not over-read:

- It is a mock, not the Laravel backend; it proves where requests go and that the screens load, not that the backend answers as the mock does.
- Budgets, Goals, Debts, Recurring and Notifications were served valid but **empty** pages (their empty states). Accounts, Activity, Categories, Home and the AI settings carried a few synthetic rows.
- The app requests Google Fonts stylesheets (existing behaviour, `GET` only, no data). They were blocked to keep the run offline and are reported, not hidden.
- One mock gap was found and fixed along the way: the Mobile validator requires a paginator to echo the requested `per_page`, and rejects anything else ("data that can't be shown safely"). That is the product failing closed, as intended.

The same checks must be repeated against the real staging host once it exists (section 7).

## 6. Tests

- `tests/stagingIsolation.test.mjs`: production workflow pinned and shaped; staging workflow structure, every weakening mutated (a push trigger, a missing environment, a production secret, an `||` fallback, a hard-coded host or path, no preflight, a production-mode build, a release approval, `StrictHostKeyChecking=no`, a production branch, a shared concurrency group); every preflight rule and missing item; the build check; a real `vite build --mode staging`; templates hold no secret; no committable env file carries staging values; the frontend `deploy.sh` refuses (bad revision, missing denylist, base inside a production path, no build, a production host in the build) **before** the live link moves and deploys a clean build.
- Backend `tests/Unit/StagingIsolationTest.php`: the workflow and server script (guard before any `artisan`, one `migrate` and only under `--migrate`), every unsafe setting refused by name, path normalisation (`..`, `//`), fail-closed denylist, no value ever printed, and the command-line front run for real.

## 7. Verify on the real host (none of this has been done)

Run after provisioning, before anything is described as ready:

1. The staging web and API hosts resolve to staging directories (`<base>/current`, `<base>/current/public`), not production's.
2. As the staging DB login, confirm it **cannot** read production's schema (`SHOW GRANTS`, and a `SELECT` against a production table must fail).
3. `php verify-staging-env.php --env=… --denylist=… --path=…` prints `STAGING_ENV: OK`, and fails when you deliberately put a production value in a copy.
4. `GET https://<staging API>/api/…` answers from the staging database (a user created only on staging is not on production, and the reverse).
5. A token issued by staging is rejected by production (different `APP_KEY`).
6. Staging's cron entries run from `<base>/current`; production's queue shows no staging job and vice versa.
7. Repeat the section 5 browser pass against the real host, with a synthetic account holding real rows in every list.
8. Only then run the workflow with `ref=integration/mobile`.

## 8. Remaining manual setup (exact steps)

**GitHub (frontend repository):** Settings → Environments → new `staging`; restrict deployment branches to `staging/*` and `integration/*`; add the five secrets and the variables from section 3. Do **not** add `HOSTINGER_*` there. Do the same in the backend repository (secrets are the same five names; variables `STAGING_API_BASE_URL`, `STAGING_REMOTE_BASE`).

**Hostinger (hPanel / SSH):**
1. Create the two subdomains (`smartspend-staging.<domain>`, `smartspend-api-staging.<domain>`) with HTTPS.
2. Create a staging MySQL database and a **separate** login (granted on that database only).
3. Prefer a second SSH account or plan; create a separate key pair for staging and put its public half in `authorized_keys`; record the host key line for `STAGING_KNOWN_HOSTS`.
4. Frontend base (for example `~/deploy/smartspend-web-staging`): create it, install `deploy/staging/frontend/deploy.sh` as `deploy.sh` (chmod 700), create `never-deploy-to.list` (production's deploy directories and web roots) and `never-in-build.list` (production host names, mode 600). Point the **web** subdomain's document root at `<base>/current`.
5. Backend base (for example `~/deploy/smartspend-staging`): create it with `shared/` inside; install `deploy/staging/deploy-staging.sh` (chmod 700); create `shared/.env` from `env.staging.example` (a **new** `APP_KEY`, the staging DB password; nothing copied from production) and `shared/production-denylist.json` from the example. Get the fingerprints on the **production** host with `php verify-staging-env.php fingerprint < secret.txt`. Point the **API** subdomain's document root at `<base>/current/public`.
6. Add the cron entries from `cron.example` (scheduler and the three queue workers), with the staging base substituted.
7. Run the backend workflow with `migrate` **off** first; confirm the guard output; then run it with `migrate` on.
8. Seed **synthetic** data only. The existing demo seeders refuse to run outside `local`/`testing`; a staging seeder would be new backend code and needs its own review. Until then create the synthetic personas through the API or by a reviewed one-off script.
9. Run section 7.

Nothing in these steps opens a write. Opening any of the 50 writes on staging remains a per-write decision recorded in [WRITE-APPROVAL-REGISTER.md](WRITE-APPROVAL-REGISTER.md) and a rebuild; there is no runtime switch.

## 9. Rolling back or switching staging off

- Frontend: point `current` at a previous `releases/<sha>` (the last five are kept), or remove the web subdomain's document root.
- Backend: the same for `current`; the database is changed only by `--migrate`, so a rollback of code does not touch it. Restoring staging's database is a staging-only action.
- Stop the cron entries to stop staging's queue and scheduler.
- Production is unaffected by any of this, by construction and by the checks in section 4.
