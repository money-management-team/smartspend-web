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
| `SMARTSPEND_MOBILE_PWA_RETIRE=true vite build --mode staging` (any non-PWA build, Mobile on or off) | Only a static **retire worker** at `m/sw.js`. The JS and CSS are byte-identical to the same build without it (151 files against 150; only `m/sw.js` differs). Refused in a production-mode build, with a warning, and nothing is emitted. |

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
- **Rollback:**
  - a later **Mobile-on** build without the PWA unregisters the `/m/` worker and deletes its caches on the next Mobile page load (its Mobile code runs `removeWorker`);
  - a later **flag-off** build has no Mobile code, so it cannot. For that, build it with `SMARTSPEND_MOBILE_PWA_RETIRE=true`: the browser re-fetches `/m/sw.js` when a Mobile page opens, finds the retire worker, which deletes the `sm-pwa-*` caches, unregisters itself and reloads the pages it controlled. It intercepts no request. Leave it deployed until visitors have come back (the browser checks at least once a day, and on every in-scope navigation).
- **App side:** an offline notice ("nothing can be loaded or sent, and nothing is saved to send later"). In More, an Install card: the browser's own prompt where offered, Share → Add to Home Screen steps on iOS, nothing once installed.

### Evidence

**Unit tests** (`tests/mobilePwa.test.mjs`, 14 tests) run the worker's source against a fake service-worker global. They cover:
- the flag rules, including the production refusal and that no approval switch can override it;
- what the plugin emits;
- the worker leaving the API, writes, other origins and non-Mobile pages alone;
- asset-only caching, the offline page, cache clean-up and skip-waiting only on request;
- registration and rollback in the page;
- the retire option's rules (exact string, never with the PWA, never in production) and the retire worker against fake globals (only `sm-pwa-*` caches deleted, unregistered, pages reloaded, no fetch handler).

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
| Rollback to a **flag-off** build with the retire worker (final source, `fin_pwa` → `fin_retire`) | first `/m/accounts` load: registrations `[]`, caches `[]`, uncontrolled; same on the next load |
| Control: rollback to a flag-off build **without** it (`fin_pwa` → `fin_stg`) | worker still active and controlling, cache `sm-pwa-111ed0022990` still there: the old gap, reproduced |
| JavaScript errors | 0 |

Chrome's offline emulation does not apply to the worker's own fetches. That is why the server was stopped for the offline checks.

## Not verified

- **Physical devices:** no iOS or Android device was available. Not tested: installation, standalone launch, safe areas on notched phones, iOS Add to Home Screen, Android's install prompt, camera, microphone, and file saving (export download uses `<a download>`).
- **Screen readers:** no VoiceOver or TalkBack testing.
- **Hosting:** no staging origin was available. The hosting requirements are:
  - `/m/sw.js` and `/m/manifest.webmanifest` served as real files with correct MIME types;
  - `no-cache` on `sw.js` and `index.html`;
  - immutable caching on `/assets/*`;
  - the SPA fallback must never serve `index.html` for `/m/sw.js` in a PWA build or a retire build (it may in a Mobile-on non-PWA build: the registration update then fails and the clean-up path removes the worker);
  - the retire worker must be served as JavaScript with `no-cache`, or browsers keep the old worker.

## Final source closure re-run (`f8003b3`)

The same Chrome lifecycle on the final builds (`g_pwa` → `g_retire` and → `g_stg`):
- registered with scope `/m/`; every cache entry is under `/assets/`; `/dashboard/accounts` is not controlled;
- the offline page is shown, and an update waits for the tap;
- with the retire worker: no registrations and no caches after rollback;
- without it (control): the worker and cache `sm-pwa-f9f135e83913` stay;
- 0 JavaScript errors.

Hosting and devices remain unverified.

## Product-decision re-run (`39db937`)

The same Chrome lifecycle on the final builds (`k_pwa` → `k_retire` and → `k_stg`):
- registered with scope `/m/`; all 38 cache entries are under `/assets/`;
- API calls reach the server and are never cached;
- `/dashboard` and `/dashboard/accounts` are not controlled;
- the offline page is shown for `/m`, and an update waits for the tap;
- with the retire worker: no registrations and no caches after rollback;
- without it (control): the worker and cache `sm-pwa-bc8189c930f8` stay;
- 0 JavaScript errors.

The cache now also holds the full version's Google sign-in chunk (decision C), a hashed asset like the others.

Hosting and devices remain unverified.
