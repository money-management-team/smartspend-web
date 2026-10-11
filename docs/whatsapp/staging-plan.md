# Staging plan: frontend side

The full plan (options, infrastructure, queue/scheduler, Meta sandbox, rollback, Hostinger limits) is in the backend repository: `docs/operations/WHATSAPP_STAGING_PLAN.md`. This file covers what the frontend needs.

## Why not "merge and look"

`development` deploys to production Hostinger on every push (`.github/workflows/deploy-hostinger.yml`), and the backend's `develop` does the same. Draft PRs #3 and #5 must not be merged to obtain a test server. Staging has to be a **separate** application that is deployed from a branch/commit you choose, by a workflow that cannot touch the production document root.

## Frontend requirements

| Item | Requirement |
| --- | --- |
| Build input | `VITE_API_BASE_URL=https://<staging-api-host>/api` (absolute, https), `VITE_GOOGLE_CLIENT_ID` empty or a staging OAuth client; built with `npm ci && npm run lint && npm run build` from the chosen commit |
| Where it is built | a **separate** workflow (manual `workflow_dispatch`, its own repository environment and variables) so the production workflow's check that the URL equals the production API URL stays untouched |
| Target directory | its own document root for the staging host; never the production root |
| SPA fallback | the host must answer `index.html` for deep links. Check `curl -sI https://<staging-web-host>/whatsapp/drafts/1`, `/dashboard/whatsapp/drafts`, `/dashboard/settings` return 200 HTML (the repository ships no rewrite rule) |
| CORS | the backend's `FRONTEND_URLS` must list exactly the staging web origin; `WHATSAPP_FRONTEND_URL` the same origin (https), so review links in replies open the staging app |
| Accounts | synthetic accounts only; no customer data in staging |
| Local confirmation | the local fail-closed dev server (`docs/dev-environment/local-api-target.md`) can point at staging only with `SMARTSPEND_ALLOW_REMOTE_API=true`, for test accounts |

## Order

1. Backend staging deployed and `php artisan whatsapp:readiness --strict` read.
2. Frontend staging built against it; SPA fallback checked.
3. Run the same integration checks as `integration-verification.md` through the staging URL, with `WHATSAPP_ENABLED=false`.
4. Only then the Meta sandbox steps described in the backend plan.

## Checklist and ownership

The numbered handover checklist (separate hosts, directories, database and user, keys, deployment, no production data, version parity, restricted access, queue/scheduler, webhook, Meta test number, backup/rollback, SPA fallback, logs, approvals) lives in the backend repository, `docs/operations/WHATSAPP_STAGING_PLAN.md`, so there is one list. The frontend items on it are 1, 2, 5, 8 and 13.
