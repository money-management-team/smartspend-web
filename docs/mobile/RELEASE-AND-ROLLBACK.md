# Mobile — release and rollback

## Current state

- `VITE_MOBILE_ENABLED` is off unless it is exactly `"true"`.
- A production build with it on also needs the release approval in the build environment (`scripts/mobileBuildFlag.mjs`). An invalid value means off.
- A flag-off build contains no Mobile module (`scripts/mobileEntryPlugin.mjs`; `tests/mobileBundle.test.mjs`, `tests/mobileFlagOff.test.mjs`).
- Every Mobile write is closed in source (`data/writeGate.js`), whatever the flag.
- Nothing has been pushed, merged or deployed. The branch is local `integration/mobile`.
- Branch guards that live only on this unmerged branch do not protect production today.

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
  - On such an origin, `/m/sw.js` must then not be served as a real file from an old deploy.
  - **Flag-off rollback (resolved for staging):** a flag-off build has no Mobile code, so it cannot remove that worker itself. Build it with `SMARTSPEND_MOBILE_PWA_RETIRE=true` (build shell only; refused in production mode). That adds one static file, `m/sw.js`, a retire worker that deletes the `sm-pwa-*` caches and unregisters itself, and changes nothing else in the output. Verified in Chrome on the final source: the worker and its cache were gone on the first Mobile visit after the switch, and a control run without the option kept them (PWA-AND-DEVICE-QA.md). Serve it as JavaScript with `no-cache`, and keep it deployed until visitors have returned. Not yet verified on a real staging host or a device.
- **Mobile sign-in** (`9586419`) is Mobile-only: reverting it sends signed-out Mobile visitors to the full version's sign-in again, as before. The AuthProvider is not changed by it.
- **The test-loader fix** (`tests/helpers/loader.mjs`, `7205aad`) touches tests only.
- **The cross-tab auth change** is two commits (`9fe88c7`, `355ee62`) and can be reverted on its own. Reverting it brings back the cross-tab identity mismatch described in SECURITY-AND-FINANCIAL-GATES.md §4.
