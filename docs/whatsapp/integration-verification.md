# WhatsApp integration verification (TASK 09A / 09B)

This records what was proven against a **real** Laravel backend and a real MySQL, what was not, and what still blocks activation. It supersedes the "not tested against the real backend" state in `task09-handover.md`.

References: backend `feature/whatsapp-availability-contract` @ `b7ca549` (Draft PR #3), frontend `feature/whatsapp-frontend-api-contract` (Draft PR #5). Neither is merged or deployed.

## What was run (2026-10-11)

A throw-away MySQL 8.4.7 on `127.0.0.1:3308` (own data directory outside both repositories), Laravel on `127.0.0.1:8000/8001`, Vite on `127.0.0.1:5173`, synthetic users and drafts, `WHATSAPP_ENABLED=false`, no Meta, no OpenAI, no staging. Nothing existing was modified.

| Level | Result |
| --- | --- |
| Real HTTP against Laravel (Bearer auth, 2 users, 41 drafts), real responses fed through the frontend parsers | 106 / 106 checks passed |
| Real browser (Edge) → real React → real Laravel → MySQL: EN/LTR 1440 px and AR/RTL 375 px | login, availability, inbox, filters, pagination, edit/save, confirm, discard, transaction view, pending indicators, deep links, lost-response recovery: all as expected |
| Backend automated suite, SQLite (TASK 09B.5, 2026-10-11) | 2012 tests: 1991 passed, 0 failed, 21 skipped |
| Backend automated suite, guarded disposable MySQL (TASK 09B.5) | 2012 tests: 2004 passed, 0 failed, 8 skipped (none in WhatsApp, concurrency or idempotency classes). Isolation: `docs/testing/MYSQL_TEST_ISOLATION.md` in the backend repository |
| Frontend (TASK 09B.5) | `npm test` 617 passed, 0 failed, 0 skipped; `npm run lint` clean; production-style build validated; `npm audit` 0 |

## Financial integrity evidence

| Property | Evidence |
| --- | --- |
| Editing a draft never posts | `PATCH` left `transactions`, `ledger_entries`, `idempotency_keys` and every balance unchanged (SQL before/after); `review_version` 1 → 2; stale version → 409; negative, 5-decimal and `1e3` amounts → 422 |
| Confirmation is explicit and exact | UI needs the dialog; API needs `review_version` and `Idempotency-Key` (missing/short key → 422); amount `25.2500` debited exactly: `1000.0000 → 974.7500` |
| One expense, one ledger posting | one `transactions` row (`expense`, `posted`, source `whatsapp`, metadata → draft id), one `ledger_entries` row (`-25.2500`, ILS, role `expense`); balance = opening + Σ ledger |
| Same key replays | same transaction id returned, no new rows |
| Different key after success | 409, no new rows |
| Lost response | server posted once; reload/GET reconciliation shows the one recorded expense; the UI does not resend |
| Concurrency | 8 simultaneous confirmations over two PHP processes: same key → 8×2xx with one transaction id; different keys → one 2xx and seven 409; exactly +1 transaction and +1 ledger entry; plus the backend's own MySQL concurrency tests |
| Business refusals post nothing | insufficient balance 422, archived account, incomplete draft, discarded draft |
| Workspace isolation | user B gets 404 on user A's draft for show, edit, confirm, discard; B's list and pending count contain only B's drafts |
| Disabled integration | `enabled:false`, `state:disabled`, `can_review_drafts:true`; link/preferences/unlink → 409 `whatsapp_disabled`; historical drafts remain reviewable |

Observation, not a defect: the confirm endpoint (and a same-key replay) answers **201**; the adapter accepts any 2xx.

## Not verified yet

- Anything involving Meta: sender verification (LINK), webhook signature path from the internet, outbound replies, the review link in a real WhatsApp reply.
- `WHATSAPP_ENABLED=true` from the UI (linking, preferences, unlink).
- A real queue worker and scheduler; `whatsapp:readiness --strict` on the target server.
- Hostinger SPA fallback for `/whatsapp/drafts/{id}` (local Vite fallback is not evidence).
- Dark theme and 768 px layouts, AR at 1440 px, EN at 375 px.
- Hostinger's database engine/version (tests ran on MySQL 8.4.7).

## External network review (documented, nothing changed)

| Item | Finding | Decision needed |
| --- | --- | --- |
| Google Fonts | `src/index.css:14` `@import`s Cairo and Tajawal from `fonts.googleapis.com`; every visitor's browser contacts Google. The same families exist locally (`src/assets/fonts`, `public/legal-fonts`) but only some weights (Cairo 400/600/700, Tajawal 700/800; the CSS asks for Cairo 500 and Tajawal 500 too) | Self-hosting is technically possible but changes rendered weights unless the missing ones are added: needs a visual review and an owner decision. Not changed |
| Google Identity Services | `accounts.google.com/gsi/client` loaded only for Google sign-in; disabled when `VITE_GOOGLE_CLIENT_ID` is empty | Already disclosed under "Google sign-in" in the policy |
| Hosting names | `policyContent.js` (ar and en) says "Laravel Cloud and Vercel"; production is Hostinger | Policy text correction needs owner/legal approval |
| WhatsApp / Meta | The Privacy Policy and Terms contain **no** WhatsApp or Meta disclosures: processing through Meta's WhatsApp Business platform, what is stored (sender number hash/encrypted, message payloads, drafts) and for how long (backend retention settings), consent | Must be written and approved before WhatsApp is enabled for users. **Blocker.** No legal approval is claimed anywhere |
| OpenAI | Already named in the policy for AI features | Unchanged |

## Remaining blockers before activation

1. Owner-approved privacy/terms text for WhatsApp, Meta, retention and hosting.
2. Meta app, business number, webhook registration over HTTPS and a live sandbox run (see `staging-plan.md`).
3. A supervised queue worker or an accepted cron-only latency trade-off, and the scheduler.
4. Backend PR #3 merged and deployed before the frontend change reaches `development`.
5. Hostinger SPA fallback confirmed with `curl -sI` on the three deep-link paths.
