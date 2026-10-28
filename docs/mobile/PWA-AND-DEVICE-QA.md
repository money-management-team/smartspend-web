# Mobile — PWA and device QA

## What exists

The Mobile PWA is for local and staging builds only. It is built from these files:
- `scripts/mobilePwa.mjs`: the flag, the worker source and the manifest.
- `scripts/mobileEntryPlugin.mjs`: emits the files.
- `src/mobile/pwa/`: registration and clean-up, the offline and update notices, and the install card.

| Build | What it contains |
|---|---|
| Mobile off (all production today) | Nothing of the PWA. `tests/mobileBundle.test.mjs` checks for `m/sw.js`, `sm-pwa-` and `getRegistrations`. |
| Mobile on, PWA not asked for | No worker file, no manifest, no registration code. Only the clean-up path, which removes an earlier worker. |
| `VITE_MOBILE_PWA=true` in a **production-mode** build | Refused with a warning; nothing is emitted. There is no approval switch: the Hostinger workflow builds in production mode, so it cannot produce a PWA. |
| `VITE_MOBILE_ENABLED=true VITE_MOBILE_PWA=true vite build --mode staging` (or `vite` in development) | `m/sw.js`, `m/manifest.webmanifest`, `m/icon-256.png`, plus the registration code. |

The bundler removes the registration code from non-PWA builds because the build constant `MOBILE_PWA` alone selects `registerWorker` or `removeWorker`. This was checked on all four builds by searching their JavaScript for `m/sw.js`, `updateViaCache` and `manifest.webmanifest`.

### The worker

- **Scope:** `/m/`. It never controls a Desktop page, the sign-in pages, signed email links or legal pages.
- **Home is outside the scope.** `/m` itself is not inside `/m/`, so Mobile Home is not controlled. The manifest's `start_url` is `/m/`, so an installed app starts inside the scope. To control `/m` itself, the worker would need a `Service-Worker-Allowed` header from the host and a wider scope. That was not done.
- **What it never touches:**
  - `/api` (nothing is cached and requests are not intercepted);
  - any non-GET request;
  - any other origin.
- **Caching:** only hashed `/assets/*` files without a query string, cache-first, in a cache named after the build (`sm-pwa-<hash>`).
- **Navigations:** network-first and never cached. Offline, the worker answers with a built-in page (HTTP 503, `no-store`, no user data, English and Arabic).
- **No queue:** there is no write queue, background sync or replay.
- **Activation** deletes only older `sm-pwa-*` caches.
- **Updates:** a new worker waits. The app shows "A new version is ready" with a Reload button, and only that tap activates the new worker, which reloads the page once.
- **Rollback:** any later build without the PWA unregisters the `/m/` worker and deletes its caches on the next Mobile page load. Navigations are network-first, so that page comes from the new build.
- **App side:** an offline notice ("nothing can be loaded or sent, and nothing is saved to send later"). In More, an Install card: the browser's own prompt where offered, Share → Add to Home Screen steps on iOS, nothing once installed.

### Evidence

**Unit tests** (`tests/mobilePwa.test.mjs`, 11 tests) run the worker's source against a fake service-worker global. They cover:
- the flag rules, including the production refusal and that no approval switch can override it;
- what the plugin emits;
- the worker leaving the API, writes, other origins and non-Mobile pages alone;
- asset-only caching, the offline page, cache clean-up and skip-waiting only on request;
- registration and rollback in the page.

**Real browser.** Headless Chrome 156 on a local origin, using the staging PWA build and then a non-PWA build on the same origin (scratchpad `pwatest.mjs`):

| Check | Result |
|---|---|
| Registers `/m/sw.js`, scope `/m/` | yes |
| `/m/accounts` controlled; `/dashboard/accounts` and `/dashboard` not; no manifest link on Desktop | yes |
| Cache contents after use | 32 entries, **all `/assets/*`**, none `/api`, none `/m` |
| API calls while controlled reach the server | yes (`/api/user`, `/api/auth/email/status`, `/api/accounts`) |
| Server down: Mobile navigation | the offline page |
| Server down: Desktop navigation | the browser's own error (not controlled) |
| New worker version | waits; the "ready" notice appears; only the Reload tap activates it |
| Rollback to a non-PWA build | worker unregistered and `sm-pwa-*` caches deleted on the first load; the next load is uncontrolled |
| JavaScript errors | 0 |

Chrome's offline emulation does not apply to the worker's own fetches. That is why the server was stopped for the offline checks.

## Not verified

- **Physical devices:** no iOS or Android device was available. Not tested: installation, standalone launch, safe areas on notched phones, iOS Add to Home Screen, Android's install prompt, camera, microphone, and file saving (export download uses `<a download>`).
- **Screen readers:** no VoiceOver or TalkBack testing.
- **Hosting:** no staging origin was available. The hosting requirements are:
  - `/m/sw.js` and `/m/manifest.webmanifest` served as real files with correct MIME types;
  - `no-cache` on `sw.js` and `index.html`;
  - immutable caching on `/assets/*`;
  - the SPA fallback must never serve `index.html` for `/m/sw.js` in a PWA build (it may in a non-PWA build: the registration update then fails and the clean-up path removes the worker).
