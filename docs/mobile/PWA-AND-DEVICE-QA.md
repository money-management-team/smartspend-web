# Mobile — PWA and device QA

## PWA: not implemented

There is no web app manifest, service worker, offline shell or install flow. `tests/mobileReadOnly.test.mjs` still asserts there is no `serviceWorker`, `caches`, `manifest` or IndexedDB in `src/mobile`. It was not built in this sprint because:
- the time was spent on the write gate, the 408 investigation, the shared auth fix and the read screens;
- a service worker needs its own reviewed slice and an approval before any production origin sees it.

**Design constraints for that slice** (agreed requirements, not yet code):
- Emit `m/sw.js` and `m/manifest.webmanifest` only from `scripts/mobileEntryPlugin.mjs` when a separate PWA flag is on, so a flag-off build stays identical. The scope is `/m/`, so Desktop is never controlled.
- Inject the manifest link at runtime from Mobile code. `index.html` is shared and stays untouched.
- Cache only hashed `/assets/*` (cache-first) and a static offline page with no user data. Never cache `/api`, any non-GET request, any cross-origin request, auth pages or legal pages.
- Never queue or replay writes offline.
- Version caches per build and delete old `sm-*` caches on activate.
- Show "update available"; `skipWaiting` only on the user's tap.
- Rollback: deploy a self-unregistering `/m/sw.js` that clears `sm-*` caches.

## Device verification: none

No physical device was available. Nothing has been tested on:
- iOS Safari or Android Chrome;
- VoiceOver or TalkBack;
- installation, camera, microphone or file saving.

Export download uses a hidden `<a download>`. Whether a phone browser saves the file or opens it is UNVERIFIED.

## Browser evidence in this sprint

- **The 408 probe:** headless Chrome 156 (see SECURITY-AND-FINANCIAL-GATES.md §2).
- **jsdom:** the new screens are rendered through the real Mobile entry in jsdom by the test suites.
- **No screenshot pass:** the new screens were not given a real-browser screenshot pass at 320–430 px, in both languages, both themes and at 2× text. That pass is required before review. The earlier screens' browser evidence (S04B1–S04B4.1) still stands.
