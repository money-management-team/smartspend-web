# Mobile — release and rollback

## Current state

- `VITE_MOBILE_ENABLED` is off unless it is exactly `"true"`.
- A production build with it on also needs the release approval in the build environment (`scripts/mobileBuildFlag.mjs`). An invalid value means off.
- A flag-off build contains no Mobile module (`scripts/mobileEntryPlugin.mjs`; `tests/mobileBundle.test.mjs`, `tests/mobileFlagOff.test.mjs`).
- Every Mobile write is closed in source (`data/writeGate.js`), whatever the flag.
- **Branch:** `integration/mobile` is backed up on `origin` (at `c7c4319` when this was written, 2026-11-13). It is **not merged** into `development` (which is an ancestor of the branch; the branch is 55 commits ahead) and **nothing from it is deployed**. Only a push to `development` deploys.
- Branch guards that live only on this unmerged branch do not protect production today.
- **Production workflow (`deploy-hostinger.yml`):** pins `VITE_MOBILE_ENABLED` off and fails if it is not; pins Smart Savings **on** with its approval (released 2026-10-24, `docs/savings-goals/smart-plans.md`). It runs lint and a build, no tests.
- **CI (`ci.yml`):** lint and `npm test` on pull requests and on `integration/**` pushes. No secrets, no deployment. It was added after the last full local run on Windows and **has not yet run on GitHub's Linux runner**; treat its first result as the first Linux evidence for the suite. It is deliberately not a step of the deploy workflow, so a test failure cannot block an unrelated production release.
- **Last local verification (Windows, Node, 2026-11-14, on top of `b1996e2`):** `npm test` 1,968 / 1,968 (342 suites), `npm run lint` clean. The suite includes the flag-off, flag-on and PWA bundle builds (`mobileBundle.test.mjs`). A flag-off production-mode build has no Mobile chunk; a production-mode build that asks for the PWA warns and emits no worker; `APPROVED` is still `Object.freeze([])`.
- **PWA readiness (local and staging only, never production):** the worker covers `/m` and `/m/` (script `/smartspend-mobile-sw.js`, scope `/m`), with 192/512/maskable/Apple icons, theme colour and `viewport-fit`. In headless Chrome: installability errors none, offline reload of `/m` and `/m/` shows the offline page, update waits for the Reload tap, rollback with the retire worker leaves nothing behind (30 of 30 checks; `PWA-AND-DEVICE-QA.md`). Real devices, the real host and screen readers remain unverified.

## Known release blockers

Mobile is **not ready for production**. Open items, by who can close them. None of them is a Frontend code defect, and none was changed by this documentation phase.

**Backend (outside this repository; not verified here):**
1. **Atomic idempotency completion (P0).** In `IdempotencyService::run()` the money is committed and the key is completed in a separate transaction. If completion fails, the client sees an error although the money moved, the key stays `processing` (a repeat gets 409), and a repeat after the 24-hour expiry can post the money again. It was reproduced on SQLite and MySQL (`SMARTSPEND-CURRENT-STATUS-AND-REMAINING-WORK.md` §8.1). It affects income, expense, correction, debt payment, import confirm and reverse and Smart Savings, and **Desktop in production too**, if production runs `fd87531`. A fix exists on the backend branch `fix/financial-idempotency-p0` (reviewed at `c18d4ea`, later `6b696d72`); it is **unmerged and undeployed**, and the production commit and database engine are unconfirmed. Until it is merged, deployed and confirmed, expense, income, correction and debt-payment writes (`key-fix-pending` in `WRITE-INTEGRATION.md`) must stay closed. Stuck-`processing` key recovery and the expiry policy are acknowledged by the backend team as open.
2. The other backend items in `WRITE-INTEGRATION.md` "Remaining backend API blockers" (creates with no duplicate protection, `skip-next`, password change, reversal 409 codes, import batches).

**Environment and validation (no staging or device evidence exists):**
3. **No staging environment.** Every Mobile read was run only against a local Laravel on fictional data. Nothing, including category writes, was run against staging.
4. **No real-device testing:** no iOS or Android, no installed-PWA run, no camera or microphone capture, no screen reader (VoiceOver, TalkBack). Browser checks used headless Chrome.
5. **Google sign-in is untested for real.** It is covered only by mocks; the Google client ID must allow the origin that serves `/m/signin`.

**Product and approvals:**
6. No release approval (`SMARTSPEND_MOBILE_RELEASE_APPROVED`), no per-write opening approval, Decision B (`funding-preview`) and the WhatsApp consent wording are pending.

**Known frontend limits (not blockers, tracked for a later phase):**
- The PWA is never built for production, so no user can install Mobile yet.
- Offline, a screen that was never opened or prefetched shows the "download failed" state with a Reload button; only the prefetched screens (Activity, Planning, More, Accounts, a transaction) work offline.
- A HEIC/HEIF receipt is refused in the picker (it is never uploaded), because the backend accepts only jpeg, png and webp. A HEIC photo renamed to `.jpg` is not detected on the device; the backend's file guard still refuses it.
- Mobile now sends `workspace_id` to `/financial-alerts`: `FinancialAlertController` (`fix/financial-idempotency-p0 @ 6b696d72`) reads `workspace_id`, and `id_workspace` appears nowhere in the backend. The full version's dashboard alerts card (`FinancialAlerts.jsx`) had the same mismatch and now sends `workspace_id` too (regression test `tests/financialAlerts.test.mjs`); it no longer returns the alerts of every workspace the user manages.
- The PWA icons (192, 512, maskable 512, Apple touch 180), the theme colour and `viewport-fit` exist in PWA builds only, which are never built for production. No CSP or Permissions-Policy is defined in the repository.

## Before a controlled rollout

1. Answer the backend questions in BACKEND-CONTRACT-GAPS.md, and run the Mobile reads against staging with fictional data.
2. Run a real-browser screenshot and regression pass on the final build:
   - Mobile at 320–430 px, in English and Arabic, light and dark, at 1.25×, 1.5× and 2× text;
   - Desktop flag-off against the baseline, and flag-on with Desktop selected.
3. Verify cross-tab sign-in and sign-out in two real browser tabs on both presentations (the shared AuthProvider change).
4. Check on real iOS and Android devices.
5. Check hosting:
   - the SPA fallback serves `index.html` for `/m/*`;
   - cache-control is `no-cache` for `index.html` and immutable for `/assets/*`;
   - CORS allows the web origin;
   - security headers are unchanged.
6. Get a release approval recorded in the build environment, on staging first.

## Rollback

- **Mobile:** rebuild with `VITE_MOBILE_ENABLED` unset. Every `/m/*` URL then reaches the app's NotFound through the catch-all route, and canonical `/dashboard/*` URLs are untouched. Deep links to `/m/*` do not break the app.
- **The PWA has never been built for production:** a production-mode build refuses it (`scripts/mobilePwa.mjs`).
  - If a staging origin ever ran the PWA build, the next non-PWA build removes the `/m/` worker and its caches on the first Mobile page load. This was tested in Chrome; see PWA-AND-DEVICE-QA.md.
  - On such an origin, `/smartspend-mobile-sw.js` (and `/m/sw.js` from the first builds) must then not be served as a real file from an old deploy.
  - **Flag-off rollback (resolved for staging):** a flag-off build has no Mobile code, so it cannot remove that worker itself. Build it with `SMARTSPEND_MOBILE_PWA_RETIRE=true` (build shell only; refused in production mode). That adds one static file, `m/sw.js`, a retire worker that deletes the `sm-pwa-*` caches and unregisters itself, and changes nothing else in the output. Verified in Chrome on the final source: the worker and its cache were gone on the first Mobile visit after the switch, and a control run without the option kept them (PWA-AND-DEVICE-QA.md). Serve it as JavaScript with `no-cache`, and keep it deployed until visitors have returned. Not yet verified on a real staging host or a device.
- **Mobile sign-in** (`9586419`) is Mobile-only: reverting it sends signed-out Mobile visitors to the full version's sign-in again, as before. The AuthProvider is not changed by it.
- **Google sign-in on Mobile** (`39db937`) imports two of the full version's plain-JS modules (`useGoogleSignIn.js`, `googleIdentity.js`); nothing in them changed. Reverting it restores the link to the full version's sign-in page. Before release, the Google client ID must allow the origin that serves `/m/signin` (handoff §6).
- **The test-loader fix** (`tests/helpers/loader.mjs`, `7205aad`) touches tests only.
- **The cross-tab auth change** is two commits (`9fe88c7`, `355ee62`) and can be reverted on its own. Reverting it brings back the cross-tab identity mismatch described in SECURITY-AND-FINANCIAL-GATES.md §4.
