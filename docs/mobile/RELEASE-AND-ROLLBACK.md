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
- **No service worker exists,** so there is nothing to unregister.
- **The cross-tab auth change** is one commit (`9fe88c7`, `fix(auth): …`) and can be reverted on its own. Reverting it brings back the cross-tab identity mismatch described in SECURITY-AND-FINANCIAL-GATES.md §4.
