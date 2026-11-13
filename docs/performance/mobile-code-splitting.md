# Mobile: route-level code splitting

Mobile performance phase. No backend, API or financial change; the flag-off build is **byte-identical** to before (150 files, 0 differences, no Mobile-named file, no Mobile string, style or font). Desktop is untouched.

## What was measured, and what it showed

Builds: `vite build --mode preview` with `VITE_MOBILE_ENABLED=true` (the repo's own way to build Mobile locally; a production-mode build refuses Mobile without a release approval). Sizes are the files' real raw and gzip bytes. "Mobile Home JS" is what a Mobile Home visit downloads: the entry chunk's static import closure plus the Mobile chunk's (dynamic imports, i.e. the lazy screens, are not followed).

**Before:** every one of the forty-odd Mobile screens was a static import of `routes.jsx`, so `MobileApp-*.js` was one chunk of **680.5 kB (167.4 kB gzip)** holding every screen, plus **156 kB of strings** for both languages. Opening Home downloaded all of it.

| What | Before | After |
|---|---|---|
| `MobileApp` chunk | 680.5 kB raw / 167.4 kB gzip | **54.8 kB raw / 14.4 kB gzip** (shell, Home, route table) |
| JS the Mobile chunk adds to Home (static closure beyond the entry) | 717.1 kB raw / 184.3 kB gzip | **322.9 kB raw / 96.6 kB gzip** |
| Mobile Home JS in total (entry + Mobile) | 1,807 kB raw / 499.0 kB gzip, 38 files | **1,413 kB raw / 411.4 kB gzip**, 63 files |
| On-demand screen chunks | 0 | 41 screen chunks (largest: workflow forms 22.9 kB, assistant 21.1 kB, reports 21.0 kB) plus shared pieces: 111 new files, 691 kB raw, none of it requested for Home |
| Entry chunk (`index-*.js`) | 414.4 kB | 414.4 kB (unchanged: the Mobile code in it is still only the presentation gate) |
| Whole build, flag **off** | 150 files | 150 files, **byte-identical** |

Total emitted JavaScript grows (4,518 → 4,577 kB raw) because shared modules are now separate files; what a visitor downloads for Home falls.

### Loading, measured

Headless Chrome, cold cache, a throttled phone profile (about "Slow 4G": 1.6 Mbit/s, 150 ms RTT, CPU x4), a signed-in fictional session against a local fixture API, both builds served with gzip, **5 alternating rounds, median**, Chrome restarted for every trial (an earlier run with leftover Chrome processes was discarded: it contaminated the CPU).

Served over **HTTP/2** (how the production host serves):

| | Before | After |
|---|---|---|
| Time to the first Mobile Home screen | 5,569 ms | **4,791 ms (−14 %)** |
| Time to Home with its data | 6,060 ms | **5,361 ms (−12 %)** |
| JS transferred for Home (gzip) | 500.5 kB | **413.7 kB (−17 %)** |
| All bytes transferred for Home | 675 kB | **588 kB (−13 %)** |
| Tap Dock → Activity, 100 ms after Home | 112 ms | 105 ms |
| Tap Dock → Activity, after the idle prefetch | 97 ms | 99 ms |

Served over **HTTP/1.1** (6 connections; a worst case for the 25 extra files): Home timing was **flat** (5.12 s → 5.19 s to the first screen, +1 %, within noise) despite 17 % less JS; a tap 100 ms after Home takes 373 ms instead of 103 ms (the screen's chunk has to be fetched), and 100 ms once the idle prefetch has run. These figures are from one machine and one fixture; they show direction, not a guarantee. The size figures above are exact.

## What was done

- `src/mobile/lazyScreens.js` (new): the screens are loaded on first use. `SCREEN_LOADERS` is the single list of those modules; screens that live in one module share a loader. **Eager, on purpose:** Home (the first screen), the shell with its dock and Add sheet, the route guards, the identity boundary and the not-available page.
- `routes.jsx`: the same route table (a test compares all 70 paths with the table from before), with the screens imported from `lazyScreens.js`. The three screens outside the shell (sign-in, register, enter) get their own boundary.
- `shell/ScreenBoundary.jsx` (new), around the shell's outlet: while a screen loads, the page area shows the usual loading state (`data-sm-state="loading"`, `aria-busy`) and the app bar and dock stay where they are. If the download fails it says so and offers a reload; **only** a failed download is caught here, every other error still goes to the app's own error boundary. It is keyed by the address, so going elsewhere clears it. Strings: `i18n/sections/screenBoundary.js`, EN and AR.
- **A preloaded screen renders at once.** `React.lazy` suspends on a component's first render even if its module is already there; measured, that made a tap on a prefetched destination slower than the old single chunk (100 → 380 ms). Each screen is now a small wrapper that, if its module has arrived (prefetch or earlier use), renders the real component immediately; each instance decides at mount and keeps its choice, so nothing remounts later.
- **Idle prefetch** (`prefetchLikelyScreens`, started by the shell): Activity, Planning, More, Accounts and a transaction's page, once, in the browser's idle time (`requestIdleCallback` with a 4 s timeout; a 2 s timer where it does not exist). It asks for nothing while offline, on Save-Data, on a 2G connection or in a hidden page, and ignores any failure.
- Test harness: `mobileHarness.mjs` and `mobileShell.test.mjs` warm every module in `SCREEN_LOADERS`, as they always warmed the single chunk.

## Offline and the PWA

The service worker (`scripts/mobilePwa.mjs`) is unchanged: it caches hashed `/assets/*` as they are fetched and never `/api`. So a screen is available offline once it has been opened, or prefetched, while online. A screen never fetched and opened offline fails to download: the boundary says so and offers a reload (a failed dynamic import is remembered by the browser until the page loads again, so a reload, not a retry of the import). Nothing is fetched at install, as before.

## Tests

- `tests/mobileSplitting.test.mjs` (19): the route table is exactly the 70 paths from before; every lazy screen resolves through its own preload to a real component (catches a misspelt module or export); Home, the shell and the guards are not lazy; a preloaded screen never shows the loading state; the boundary's loading state, a failed download (and that it does not catch other errors), Arabic, and clearing on navigation; the shell asks for the prefetch once; the prefetch's politeness rules.
- `tests/mobileBundle.test.mjs`: the Mobile chunk is under 120 kB, the JS Mobile adds to Home is under 400 kB (it was 717 kB), screen-only markup is absent from Home's closure and present in an on-demand chunk, at least 30 screen chunks exist and none is in Home's closure, and the chunk's route table requests them on demand and the entry and HTML do not. The Smart Savings assertion now looks in the goal page's own chunk. The flag-off assertions (no Mobile file, string or style; every chunk reachable; the PWA absent) are unchanged and pass.
- All 48 Mobile test files plus the auth cross-tab and pending-write suites: 1,109 tests pass. (One run showed a single failure in a pending-write source audit while a build was running in parallel; it did not reproduce alone, in two further full Mobile runs or in a rerun of the same command.)

## Limits, and what is left

- **The biggest remaining costs are not Mobile's to move in this phase.** The entry chunk (414 kB, with the full version's route table and landing page) and the full version's locale files (471 kB raw, 124 kB gzip) are loaded for every route, Mobile included, because both live in the shared entry; making them lazy for Mobile URLs would change the full version's loading.
- **Mobile's own strings (193 kB raw, 53 kB gzip, both languages) are still loaded before Home.** They are one registration (`i18n/register.js`) used by every screen with partly dynamic keys, so splitting them by screen risks showing raw keys, and loading one language at a time would make a language switch asynchronous. Both are the next candidates and need their own phase.
- The single stylesheet still carries Mobile's rules for full-version visitors in a Mobile-on build (`cssCodeSplit: false`, kept so the cascade does not depend on load order). The flag-off build carries none.
- Chunk grouping was not tuned (no build-config change, so the full version's chunks cannot move): the screens produce 25 more small files on Home's path, which is why HTTP/1.1 shows no gain.
- Timings are from throttled headless Chrome on one machine; real devices and networks will differ.
