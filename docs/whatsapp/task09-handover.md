# TASK 09 handover: WhatsApp frontend integration testing

State at delivery: the WhatsApp frontend (TASK 04–08) is committed on a feature branch and opened as a **Draft** pull request. It has **not** been merged, deployed or enabled, and it has not been tested against the real backend or Meta. This file says what exists and what must still be done, and keeps four levels of verification apart because none of them stands in for another.

## References

Frontend
- Repository: `https://github.com/money-management-team/smartspend-web`
- Feature branch: `feature/whatsapp-frontend-api-contract` (base: `development`, which deploys to Hostinger on every push; the branch was never pushed there)
- Commits: `88cf797` API adapter and contracts, `fd69804` linking, inbox, review, pending indicators. The branch tip also carries this handover. The Draft PR link is in the PR itself.

Backend (the dependency)
- Repository `money-management-team/smartspend-backend`, branch `feature/whatsapp-availability-contract`, reference commit `b7ca54934ad4881d8bea842b697dc77167791d71`, **Draft PR #3, unmerged**.
- The frontend needs from it: `GET /integrations/whatsapp` (`enabled`, `state`, `capabilities`, `integration`), link-challenge endpoints, preferences, unlink, the expense-draft endpoints (list, summary, show, PATCH, confirm, DELETE), the `whatsapp_disabled` 409 and `confirmation.ready` / `issues`.

## What exists (frontend)

| Route | Purpose |
| --- | --- |
| `/dashboard/settings?tab=integrations` | Linking, preferences, unlink, entry to the inbox |
| `/dashboard/whatsapp/drafts` | Inbox |
| `/dashboard/whatsapp/drafts/:draftId` | Review: edit, save, confirm, discard |
| `/whatsapp/drafts/:draftId` | The link the backend sends in WhatsApp replies; forwards after sign-in |

Where things are
- Adapter and contract: `src/features/Dashboards/User/api/whatsappApi.js`, `src/features/Dashboards/User/FinancialOperations/whatsappContract.js`
- Linking UI: `src/features/Dashboards/User/Settings/components/WhatsAppIntegration/`
- Inbox and review: `src/features/Dashboards/User/WhatsAppDrafts/` (`useWhatsAppDraftReview.js` holds confirmation, reconciliation and discard)
- Shared pending count: `src/contexts/whatsappPending/` (sidebar badge, Attention Center, inbox, Settings)
- Tests: `tests/whatsapp/`, `tests/whatsapp-ui/`, helpers in `tests/helpers/`; run with `npm test`
- Docs: `docs/whatsapp/` (`integration-overview.md`, `draft-review.md`, `production-readiness.md`, `testing.md`)

Key behaviors to exercise in TASK 09
- Confirmation: explicit dialog, `Idempotency-Key` stable per logical attempt, body `{review_version}` only, no automatic retry, unknown outcomes are reconciled by reading the draft, retry only with the same key. After a reload the key is gone; the backend refuses a different key on a confirmed draft (409) and the screen shows the one recorded expense (analysis in `production-readiness.md`).
- Pending count: one request shared by the dashboard, refreshed after confirm/discard, scoped to the signed-in user, not hidden when WhatsApp is disabled.
- Deep link: signed out → sign-in → back to the draft; foreign or missing draft → "not available".

## Verification levels (do not equate them)

1. **Local mocked verification: done.** `npm test` 597 passed / 0 failed / 0 skipped (63 suites), `npm run lint`, `npm run build` clean. Real-browser (Edge) runs against a mocked API with all non-localhost hosts blocked, at 1440 / 768 / 375 px, Arabic and English, light and dark. The fake draft server follows the backend source; it is not the backend.
2. **Real backend integration: not done.** Requires the backend branch deployed to staging. Checks: contract shapes match the parsers; PATCH/confirm/discard behave as modelled; `whatsapp_disabled` handling; the confirmation concurrency behavior (the backend has `WhatsAppExpenseDraftMySqlConcurrencyTest`; it was read, not run).
3. **Meta sandbox: not done.** Needs Meta staging credentials and a test number: LINK message → sender verified → explicit confirm; a WhatsApp expense becoming a draft; the review link in the reply.
4. **Production activation approval: not given.** Needs the items below.

## Release prerequisites

- [ ] Both Draft PRs reviewed. Backend PR #3 merged and deployed **before** the frontend change reaches `development` (the frontend degrades to "not available on this server yet" against an old backend, but should not ship ahead of it).
- [ ] Deployment order agreed: backend (migrations applied, `WHATSAPP_ENABLED=false`) → frontend.
- [ ] Backend environment: `WHATSAPP_FRONTEND_URL=https://smartspend.anasalharazeen.com` (https in production), CORS/`FRONTEND_URLS` for that origin, Meta credentials only on staging until approval.
- [ ] Queue worker and scheduler readiness (backend handover): a persistent worker on the WhatsApp queue and `schedule:run` every minute running `whatsapp:dispatch-outbox`, `whatsapp:recover`, `whatsapp:cleanup`; `php artisan whatsapp:readiness --strict` passes. This does not prove the worker or scheduler is actually running.
- [ ] SPA fallback on Hostinger: `curl -sI` on `/whatsapp/drafts/1`, `/dashboard/whatsapp/drafts`, `/dashboard/settings` returns 200 HTML (the repository ships no rewrite rule; see `production-readiness.md`).
- [ ] Authenticated flow with isolated test accounts only (no customer data): sign in, deep link, return to draft.
- [ ] Rollback ready: the frontend is a static build behind the existing deploy workflow, so rollback is redeploying the previous revision; the backend branch must be revertable without affecting existing finance endpoints; WhatsApp stays disabled by configuration.
- [ ] Privacy review and approval (see below).

## Outstanding release blockers (not changed in code, owner or legal decision)

- `src/components/AccessExperience/policyContent.js` still says SmartSpend uses hosting "such as Laravel Cloud and Vercel", which no longer matches the Hostinger deployment.
- The Privacy Policy and Terms contain no WhatsApp or Meta disclosures (processing through Meta's WhatsApp Business platform, what is stored and for how long, consent). These must be written and approved before WhatsApp is enabled for users. No legal approval is claimed anywhere in this work.

## Known limitations

- Visual checks are manual (harness described in `testing.md`).
- Unrelated, left alone: the existing 1.2 MB PDF chunk warning; the Arabic "Commitments and dates" heading wrapping letter by letter at 375 px in the Attention Center.
- `.env` is a tracked file that points local development at a staging backend; it was not modified. Use `VITE_API_BASE_URL=/api` for isolated sessions.
