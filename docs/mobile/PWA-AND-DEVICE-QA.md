# Mobile — PWA and device QA

## What exists

The Mobile PWA is for local and staging builds only. It is built from these files:
- `scripts/mobilePwa.mjs`: the flag, the worker source and the manifest.
- `scripts/mobileEntryPlugin.mjs`: emits the files.
- `src/mobile/pwa/`: registration and clean-up, the offline and update notices, and the install card.

| Build | What it contains |
|---|---|
| Mobile off (all production today) | Nothing of the PWA. `tests/mobileBundle.test.mjs` checks for `smartspend-mobile-sw.js`, `m/sw.js`, `sm-pwa-`, `getRegistrations` and `apple-touch-icon`. |
| Mobile on, PWA not asked for | No worker file, no manifest, no registration code. Only the clean-up path, which removes an earlier worker. |
| `VITE_MOBILE_PWA=true` in a **production-mode** build | Refused with a warning; nothing is emitted. There is no approval switch: the Hostinger workflow builds in production mode, so it cannot produce a PWA. |
| `VITE_MOBILE_ENABLED=true VITE_MOBILE_PWA=true vite build --mode staging` (or `vite` in development) | `smartspend-mobile-sw.js` (at the root, scope `/m`), `m/manifest.webmanifest`, `m/icon-192.png`, `m/icon-512.png`, `m/icon-maskable-512.png`, `m/apple-touch-icon.png`, plus the registration code. |
| `SMARTSPEND_MOBILE_PWA_RETIRE=true vite build --mode staging` (any non-PWA build, Mobile on or off) | Only a static **retire worker**, at `smartspend-mobile-sw.js` and at `m/sw.js` (the first builds' address). The JS and CSS are byte-identical to the same build without it (151 files against 150; only `m/sw.js` differs). Refused in a production-mode build, with a warning, and nothing is emitted. |

The bundler removes the registration code from non-PWA builds because the build constant `MOBILE_PWA` alone selects `registerWorker` or `removeWorker`. This was checked on all four builds by searching their JavaScript for `m/sw.js`, `updateViaCache` and `manifest.webmanifest`.

### The worker

- **Script and scope:** the script is `/smartspend-mobile-sw.js` and the scope is `/m`, so `/m`, `/m/` and every `/m/...` page are controlled. It never controls a Desktop page, the sign-in pages, signed email links or legal pages.
- **Why the script is at the root.** A worker can only control the directory its script is in, or below. The first builds put it at `/m/sw.js` (scope `/m/`), which could never control `/m` itself: an offline reload of `/m` got the browser's own error page. A root script may register the narrower scope `/m` with no `Service-Worker-Allowed` header from the host, so nothing needs configuring on the host for the scope. The scope is a prefix, so it would also match a path like `/mobile`; the worker's fetch handler answers only `/m` and `/m/...` and leaves everything else to the network.
- **Upgrading from the first builds.** An origin that ran them still holds a registration with script `/m/sw.js` and scope `/m/`. Left alone it would be the more specific scope for every `/m/...` page. The new registration code unregisters it first.
- **What it never touches:**
  - `/api` (nothing is cached and requests are not intercepted);
  - any non-GET request;
  - any other origin.
- **Caching:** only hashed `/assets/*` files without a query string, cache-first, in a cache named after the build (`sm-pwa-<hash>`).
- **Navigations:** network-first and never cached. Offline, the worker answers `/m` and `/m/...` with a built-in page (HTTP 503, `no-store`, no user data, English and Arabic) instead of the browser's error page. The app itself is not cached, so there is no offline app shell: that is a decision, not a gap (nothing financial is stored on the device).
- **No queue:** there is no write queue, background sync or replay.
- **Activation** deletes only older `sm-pwa-*` caches.
- **Updates:** a new worker waits. The app shows "A new version is ready" with a Reload button, and only that tap activates the new worker, which reloads the page once.
- **Rollback:**
  - a later **Mobile-on** build without the PWA unregisters the `/m/` worker and deletes its caches on the next Mobile page load (its Mobile code runs `removeWorker`);
  - a later **flag-off** build has no Mobile code, so it cannot. For that, build it with `SMARTSPEND_MOBILE_PWA_RETIRE=true`: the browser re-fetches the worker (`/smartspend-mobile-sw.js`, or `/m/sw.js` for an origin from the first builds) when a Mobile page opens, finds the retire worker, which deletes the `sm-pwa-*` caches, unregisters itself and reloads the pages it controlled. It intercepts no request. Leave it deployed until visitors have come back (the browser checks at least once a day, and on every in-scope navigation).
- **Installation assets** (PWA build only):
  - `scripts/generateMobileIcons.ps1` makes the committed icons in `src/mobile/pwa/icons/` from `public/smart-spend-logo.png`: 192 and 512 (`any`, logo at 80% on white), a separate 512 `maskable` icon (logo inside the central 60%, so a circular or squircle mask never cuts it) and a 180 px opaque Apple touch icon. `any` and `maskable` are never combined in one entry.
  - The manifest has `id` `/m`, `start_url` `/m/`, `scope` `/m`, `display` `standalone`, theme colour `#07142B`, a description and the `finance` category.
  - The theme colour, `<link rel="manifest">`, the Apple touch icon, the `apple-mobile-web-app-*` tags and `viewport-fit=cover` are **added by the Mobile page at run time** (`src/mobile/pwa/worker.js`) and removed again when Mobile unmounts (the viewport is restored). `index.html` is not touched, so Desktop pages, and every build without the PWA, are exactly as before. `viewport-fit=cover` is safe because Mobile pads its content with `env(safe-area-inset-*)` (`styles/mobile.css`, `--sm-safe-*`); that padding is still unverified on a notched device.
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
  - `/smartspend-mobile-sw.js` and `/m/manifest.webmanifest` served as real files with correct MIME types (JavaScript, and `application/manifest+json` or `application/json`), and the four icons under `/m/` as `image/png`;
  - `no-cache` on `sw.js` and `index.html`;
  - immutable caching on `/assets/*`;
  - the SPA fallback must never serve `index.html` for `/smartspend-mobile-sw.js` (nor `/m/sw.js` in a retire build) in a PWA build or a retire build (it may in a Mobile-on non-PWA build: the registration update then fails and the clean-up path removes the worker);
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

## Final readiness pass (`integration/mobile`)

Headless Chrome 157 at 390 × 844 (touch, device scale 2) against a **local** static server (SPA fallback, `no-cache` on the worker and `index.html`, immutable `/assets/*`) and a **local fake API** made from the test fixtures (GET only, fictional data; it answers every write with 405). Nothing reached staging or production. Two PWA preview builds were used (`--mode preview`; the second with Smart Savings on only to change the asset names), plus a flag-off retire build. 30 of 30 checks passed on the final build; 0 JavaScript exceptions.

| Check | Result |
|---|---|
| Registers `/smartspend-mobile-sw.js`, scope `/m` | yes |
| `/m` and `/m/` are controlled after the first reload | yes |
| A Desktop page (the catch-all NotFound) is not controlled, has no PWA tag and keeps `width=device-width, initial-scale=1.0` | yes |
| On `/m/`: manifest link, `theme-color` `#07142B`, Apple touch icon, `apple-mobile-web-app-capable`, `viewport-fit=cover` | yes |
| `Page.getAppManifest` errors; `Page.getInstallabilityErrors` | none; none |
| Icons 192, 512, maskable 512, Apple touch icon | served as `image/png` |
| Install card in More (with a **synthetic** `beforeinstallprompt`: headless Chrome does not offer one) | shown |
| Server stopped, reload of `/m` and of `/m/` | the offline page, in English and Arabic |
| Cache contents after use | 90 entries, all `/assets/*`; no `/api`, no navigation |
| API calls while controlled | reach the server (26, all GET), none cached |
| New build available | waits; "A new version of SmartSpend is ready." with Reload; the page does not reload by itself |
| Tap Reload | one reload, the new `sm-pwa-*` cache is the only one left |
| Rollback `pwa` → flag-off retire build (`SMARTSPEND_MOBILE_PWA_RETIRE=true`) | registrations `[]`, caches `[]`, next `/m` load uncontrolled |
| HEIC receipt chosen (a 2 KB `IMG_0001.HEIC`), English and Arabic | refused with its own message, no file kept, no request |

Screenshots (kept in the session scratchpad, not in the repository): Home signed in, More with the install card, the offline page at `/m` and `/m/`, the update notice, the HEIC refusal in English and Arabic.

Not exercised in a browser: upgrading from a registration made by the first builds (`/m/sw.js`, scope `/m/`); it is covered by a unit test only. Still unverified, as before: real devices (the actual install prompt, standalone launch, safe areas, iOS Add to Home Screen), screen readers and the real host.
