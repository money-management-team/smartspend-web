# Mobile Foundation (S04A)

The smallest isolated Mobile layer: a build flag that is off by default, a `/m/*` route tree, a canonical-URL resolver, a shell with bottom navigation, and scoped CSS. It shows **placeholders only**. It contains no financial screen, no financial request, no service worker and no web manifest, and it is **not installable**. It does not match the S03.5 design yet: only the navy/blue/cyan tokens, the logo and the navigation pattern are in place.

Nothing here is released. The production workflow pins Mobile off.

> **Updated by S04B1** ([S04B1-readonly-home-accounts.md](S04B1-readonly-home-accounts.md)). The foundation described here is still the base, but four things changed and this document was corrected where it would otherwise be wrong: the entry (a small static `MobileEntry` decides the presentation and loads the Mobile screens lazily, only for a Mobile URL; §1, §2), Home is a real read-only screen and Accounts exists (§4), flag-on Desktop is no longer reordered or delayed (§11, §13), and `utils/formatters.js` is no longer an allowed import (§7).

## 1. Architecture

```
main.jsx → Root (Theme, Language, ErrorBoundary, Auth, EmailVerification) → App → routes/Router.jsx
                                                                                    │
                                          import { MobileEntry } from "virtual:smartspend-mobile"
                                                                                    │
                             Mobile OFF: null  ──────────► DesktopRouter  (the unchanged Desktop route table)
                             Mobile ON : static ─────────► MobileEntry({ desktop: <DesktopRouter/> })
                                                             └─ PresentationGate   (resolver, redirects)
                                                                  ├─ a Mobile URL (/m, /m/…) ► Suspense ► lazy MobileApp (mobileRoutes)
                                                                  └─ anything else           ► the `desktop` element, untouched
```

(S04A loaded the whole Mobile router lazily, Desktop routes included, behind a page-level `Suspense` for everyone. S04B1 moved the decision into the small static entry, so a Desktop URL renders exactly what a flag-off build renders: no `Suspense`, no Mobile element, no request for the Mobile chunk.)

- **Dedicated route tree** under `src/mobile/`, mounted at `/m`. Canonical URLs keep their current Desktop paths.
- **Shared providers.** Mobile sits inside the app's own providers. It holds no session, theme or language state of its own: `RequireAuth` (the app's guard), `useThemeContext`, `useLanguageContext` and the one i18next instance are reused.
- **No Desktop page, layout, shared component or CSS** is imported by Mobile (§7).
- **No shared domain logic is used yet.** S04B will bring API modules and helpers in through the allowed boundary.

## 2. Feature flag

`VITE_MOBILE_ENABLED`, resolved at build time by [scripts/mobileBuildFlag.mjs](../../scripts/mobileBuildFlag.mjs) and called from [vite.config.js](../../vite.config.js).

| Situation | Result |
|---|---|
| unset, or `"false"` | Off |
| exactly `"true"` | On, in `serve` and in non-production builds |
| `"TRUE"`, `"1"`, `"yes"`, `"true "` | **Never on.** A production build fails; other builds warn and stay off. The value is not trimmed, so the script and the bundle read the same string |
| `.env` / `.env.[mode]` sets it (even to false) | Build refuses |
| production build with `"true"` | Fails unless `SMARTSPEND_MOBILE_RELEASE_APPROVED=true` is in the **shell** (an env file cannot approve) |
| local testing | `VITE_MOBILE_ENABLED=true` in `.env.local` or the shell, with `npm run dev`; no deployment |

Differences from the Smart Savings pattern it follows: a polluted variable cannot block `npm run dev` (it warns instead of throwing), and the value is compared exactly, not trimmed.

The deploy workflow pins `VITE_MOBILE_ENABLED: "false"`, asserts it before building, refuses a tracked env file that sets it, and never sets the approval variable.

### Why a Vite plugin decides, not a conditional import

Two attempts that did not work, found by building and inspecting the output:

1. `const M = flag ? lazy(() => import("../mobile/…")) : null` in the router: with the variable unset the flag is an unknown value, so the Mobile chunk was emitted (and moved Desktop chunk hashes).
2. The same with the resolved value baked in through `define` as the literal `"false"`: the bundler still emitted an **unreferenced** Mobile chunk, because it records a dynamic import before it folds the dead branch.

So the Mobile code enters the build through one virtual module, `virtual:smartspend-mobile`, answered by [scripts/mobileEntryPlugin.mjs](../../scripts/mobileEntryPlugin.mjs): `export const MobileEntry = null;` when off (nothing exists to record), a plain re-export of `src/mobile/entry/MobileEntry.jsx` when on (that file holds the one lazy `import()` of the Mobile screens, and a flag-off build never reaches it). [tests/mobileBundle.test.mjs](../../tests/mobileBundle.test.mjs) builds both ways and checks the output.

## 3. Branch and commits

- Branch `integration/mobile`, local only, created from `development` at `33070de9d2a18af56eeea753d4d9cd82d293e8c6` (clean tree at the start).
- Not pushed, not merged, not deployed.
- The S04A commit hash is in the final report (a document cannot name its own commit).

## 4. Routing

| Route | Screen |
|---|---|
| `/m` | Home (S04A: placeholder; **S04B1: real, read-only**) |
| `/m/activity` | Activity placeholder |
| `/m/planning` | Planning placeholder |
| `/m/more` | Accounts link, theme, language, and the presentation switch |
| `/m/accounts`, `/m/accounts/{id}` | S04B1: read-only Accounts list and account page |
| `/m/enter` | S04B1: asks before switching a Desktop-mode visitor to Mobile |
| `/m/<anything else>` | "Not available", inside the shell |

All sit behind the app's `RequireAuth`, so a signed-out visit goes to sign-in remembering the address and returns after, as on Desktop.

**Add is a button**, not a route. It opens an informational sheet ("not available in this early preview"). It has no form, no input and makes no request.

## 5. Resolver

[src/mobile/presentation/resolver.js](../../src/mobile/presentation/resolver.js) is a pure function: `getRedirect(location, { enabled, authenticated, mode })`.

- **Never redirects** when Mobile is disabled (whatever the stored preference), when the visitor is signed out (the Desktop guards own that flow and remember the canonical address), or while the session is being restored.
- **Never touches** emailed links and sign-in pages (`/verify-email/…`, `/reset-password`, `/signin`, `/register`, `/forgot-password`, `/account-type`, `/password-changed`, `/verify-code`), the WhatsApp link (`/whatsapp/drafts/…`), static documents (`/privacy.html`, `/terms.html`, anything with a file extension) or `/api`. Matching is by whole path segment.
- **Mobile mode**: only a canonical page that has a Mobile equivalent *and* is marked `fromCanonical` goes to it. In S04A that is **Home only** (`/dashboard` → `/m`). Activity, Planning and More are placeholders, so the working Desktop pages stay (`/dashboard/financial-operations?new=expense` still opens the Desktop form). Everything else stays on its Desktop page.
- **Desktop mode**: a Mobile address goes back to its canonical page (`/m/more` → `/dashboard/settings`); an unknown `/m/…` goes to `/dashboard`.
- **Preserved**: pathname semantics, query string, hash, and the router state (where `RequireAuth` keeps the post-sign-in destination).
- **Replacement**, never a pushed entry.
- **Idempotent**: `resolve(resolve(x))` equals `resolve(x)` for every known path, mode, query and hash (tested). A loop breaker refuses a redirect straight back to the previous source within a second.

### Presentation preference

`auto | mobile | desktop`, stored as one word under `smartspend:presentation:v1` in localStorage (device-wide, harmless, no financial data; `auto` removes the entry). An explicit choice always wins. `auto` means Mobile only on a touch device whose **shorter screen side** is at most 600 CSS px, so rotating a phone never switches. It is read when a page renders, never watched. The redirect waits while `markPresentationBusy()` is held (for later dirty forms and in-flight writes; none exists in S04A). More shows the three choices and "Open the full version".

Leaving Mobile is available; there is no entry on Desktop to come back (that is S04B+ work). Installed-PWA behaviour is out of scope.

## 6. MobileAppShell

App bar (logo, one `h1` with the page title), a scrolling main region, the bottom navigation, and an overlay container inside `.sm-root`. Safe-area insets are honoured, light/dark come from `html[data-theme]`, direction from `html[dir]`.

- **Standard bar**: Home, Activity, **Add** (button), Planning, More. In RTL the bar mirrors (verified in a browser: Home is rightmost).
- **Compact bar** (Menu + Add) when the screen is narrower than **17rem** (`COMPACT_NAV_MAX_REM` in `navigation.js`, provisional, easy to change). It is measured in rem against the root font size, so enlarged text produces it on a normal phone. Menu opens a sheet listing **all four** destinations; nothing is hidden and no label-size cap is applied.
- The bar is re-measured on resize, rotation and when the page becomes visible. An open compact menu closes for good if the layout changes.

## 7. CSS isolation and import boundaries

**CSS** — plain CSS, one file, [src/mobile/styles/mobile.css](../../src/mobile/styles/mobile.css):

- every selector starts with `.sm-root` (or `:root[data-theme="dark"] .sm-root`); every class and keyframe starts with `sm-`; every custom property is `--sm-*`, defined on `.sm-root` only;
- no bare element, `html`, `body`, `:root` or universal rule, no global reset, no `@import`, no `!important`, no cascade layers (unlayered Desktop CSS would beat them);
- `.sm-root .sm-x` is (0,2,0): it beats Desktop's element rules that reach into Mobile (`a:hover` is (0,1,1); `button`, `p`, `h1…h6`, `label` are (0,0,1)), and the root neutralises them where needed;
- logical properties only (`inset-inline`, `padding-inline`, `border-start-start-radius`);
- overlays render inside `.sm-root` (the `.sm-portal` element), not into `document.body`.

**Imports** — enforced by [tests/mobileBoundaries.test.mjs](../../tests/mobileBoundaries.test.mjs):

| Allowed from `src/mobile/**` | Not allowed |
|---|---|
| `routes/Path.js`, `routes/postAuthRedirect.js`, `routes/RouteGuards.jsx` (reviewed exception: one `RequireAuth`, not a copy) | any Desktop page, layout or shared component |
| `contexts/{auth,language,theme}/use*.js`, `i18n.js` | any `.css` outside `src/mobile/styles/mobile.css` |
| `assets/smart-spend-logo.png` (unmodified) | `index.css`, `main.jsx`, `Root.jsx`, `App.jsx` |
| `features/Dashboards/User/api/*` (S04B1: named only in `data/readApi.js` and the identity guard; see `tests/mobileReadOnly.test.mjs`), `features/Dashboards/User/Experience/experienceStore.js` (S04B1, read-only: "hide amounts"). `utils/formatters.js` was allowed in S04A and is **no longer**: Mobile has its own money layer | `document.body` |
| `react`, `react-dom`, `react-router-dom`, `react-i18next`, `react-icons/lu` | any other package |

Desktop code imports nothing from `src/mobile` (the router reaches it only through the virtual module).

**Strings** live in their own i18next namespace (`mobile`), registered when the Mobile chunk loads, not in `src/locales/*.json`: those files are bundled into the main i18n chunk, so a Mobile section there would ship in builds with Mobile off. English and Arabic keys are kept in exact parity by a test. This departs from "add keys to both locale files" in CLAUDE.md for that reason.

## 8. Accessibility foundation

Demonstrated in desktop Chrome and jsdom, **not** on devices or with a screen reader. This is not a WCAG 2.2 AA claim.

| Behaviour | How it is checked |
|---|---|
| Links vs buttons: destinations are `<a>` (`NavLink`), Add/Menu are `<button type="button">` | test |
| `aria-current="page"` on the active destination | test |
| Labels: `nav` has `aria-label`; skip link; icons `aria-hidden` | test |
| Headings: one `h1` (page title), `h2` below, nothing deeper | test |
| Focus to the page title after navigation, not on first load | test |
| Sheets: `role="dialog"`, `aria-modal`, labelled; page behind `inert`; focus enters; Tab and Shift+Tab stay inside; **Escape** closes; **focus returns** to the opener (an explicit ref, because Safari does not focus a button on click); backdrop and Close button also close | tests, both layouts |
| Menu: Up/Down/Home/End move between destinations, wrapping | test |
| Targets ≥ 44px (`--sm-target: 2.75rem`) | browser: **0 targets under 44px** in 95 renders (radio inputs count by their 44px row) |
| Visible focus: 3px ring, cyan on the navy bar, inset on the bottom bar | screenshot |
| Text enlargement: 1.5× at 390px, 1.25× and 2× at 320px: compact bar, all four destinations reachable, **no horizontal overflow** | browser |
| Reduced motion: the sheet animation is off under `prefers-reduced-motion` | CSS |

Not done: Back-button/gesture closing a sheet, screen-reader checks, real OS text scaling, hardware keyboard and switch access, focus order on devices.

## 9. Baseline (before any change, `development` @ `33070de`)

| Item | Result |
|---|---|
| `npm test` | **811 / 811** pass |
| `npm run lint` | clean |
| `npm run build` | OK; 150 output files; the build is **deterministic** (two builds byte-identical) |
| Stylesheet | `style-CdLHj2cm.css`, 824,885 bytes, sha-256 `141bb8a9…eeee` |
| Desktop browser pass | 124 renders (19 signed-out + 12 signed-in routes × 4 views; fictional mocked API; zero JS errors; 232 API calls, all GET) |

## 10. After the change (flag off)

| Item | Result |
|---|---|
| `npm test` | **924 / 924** pass (811 existing + 113 new), twice in a row |
| `npm run lint` | clean |
| `npm run build` | OK |
| Stylesheet | **byte-identical** to the baseline (same name, size and hash) |
| Output files | the same 150, no Mobile chunk |
| Chunks after normalising content hashes | identical except the entry chunk |

Test suites added (113): flag (24), resolver/preference/guard (23), import and CSS boundaries (16), shell and routing in jsdom (37), flag-off routing on the real route table (5), real builds (8).

## 11. Build-output comparison

**Flag off vs baseline.** Compared with every content hash normalised: 149 of 150 files are identical. The entry chunk differs by +26 bytes. An unminified build of the baseline source and the current source, with paths and hashes normalised, differs in 16 lines, all of them the router: `useRoutes([...])` moved into a `DesktopRouter` component. The Mobile branch is folded away entirely. The hash differences elsewhere (every chunk that imports the entry) are the entry's new file name.

**Flag on** (local build, `--mode preview`), **as measured in S04A; superseded by S04B1 §12–§13**:

- one lazy `MobileRouter` chunk (15.95 kB, 5.65 kB gzip) holding the Mobile code; the entry chunk contains none of it (S04B1: the chunk is `MobileApp`);
- 61 Mobile CSS rules (about 7.5 kB), none of them in the flag-off stylesheet;
- every Desktop rule present and unchanged, with a bounded reordering: the `Loading` rules were emitted ahead of the first rules of `index.css` (**fixed in S04B1: now identical order**);
- brand-logo anti-aliasing: about 280 pixels along the logo edge differed in Desktop screenshots (**not present in S04B1's runs: the flag-on differences equal the baseline's own noise**).

## 12. Desktop and Mobile browser evidence

Headless Chrome against built output, a mocked fictional API (every call logged: **no non-GET request, no external host reached**).

- **Flag off, final build vs baseline** (the same 124 jobs, the same harness, on both sides): final URL, title, language, direction, theme, visible text and DOM are **identical in all 124**. The pixel hash is identical in **119**. The other 5 differ by 377–388 pixels (0.03%) in one 24×28 px patch at the logo position. The baseline differs from itself by the same patch, the same size, the same place, between two runs (a logo anti-aliasing flip that depends on timing), so it is not a difference between the builds. Zero JavaScript errors; 232 API calls, all GET.
  - A first comparison showed larger differences on phone-sized signed-in pages. That was the harness, not the product: the baseline had been captured before phone jobs used real touch emulation, and the Desktop CSS enlarges controls for `pointer: coarse`. The baseline was re-captured with the final harness.
- **Flag on, resolver in a real browser** (13 cases): Desktop in auto mode stays on `/dashboard`; `/dashboard?period=month#cards` with Mobile chosen goes to `/m?period=month#cards`; a phone (touch, 390×844) goes to `/m?x=1#y`; the same phone in landscape (844×390) still goes to `/m`; `/dashboard/accounts` and a verification link stay on Desktop; Mobile chosen off sends `/m/more?a=1#h` to `/dashboard/settings?a=1#h`; a signed-out visit goes to `/signin`.
- **Mobile shell**: 95 renders (320/360/390/430 px × English/Arabic × light/dark × four screens, plus the Add sheet, the compact menu, compact bars at enlarged text, focus rings, the unknown address): no JavaScript error, no overflow, no target under 44px, standard bar at normal text, compact at 1.25×, 1.5× and 2×.

Screenshots and result files stay outside the repository (scratch folder of the session); they are not committed.

## 13. Limitations

- Placeholders only; no data, no API request, no financial form.
- Not installable: no manifest, no service worker, no offline.
- No way back from Desktop to Mobile other than the stored choice or an `/m` address while `auto` resolves to Mobile. S04B1 adds `/m/enter` (an explicit, asked-first entry); there is still no control on a Desktop page, by design, until one is approved.
- ~~A flag-on build shows the page-level loading fallback while the Mobile chunk downloads (for every visitor of that build).~~ Fixed in S04B1: only a Mobile URL shows a (Mobile) loading state; a Desktop URL shows the Desktop tree at once.
- The Mobile strings are not in `src/locales`, by design (§7); CLAUDE.md should say so when Mobile is released.
- Fonts come from the existing Google Fonts import; offline, system fonts are used.
- The `workflow_dispatch` guard (`if: github.ref == 'refs/heads/development'`) is prepared on this branch. **It does not protect the workflow that is deployed from `development` until this change is itself merged through an approved release.** Branch-protection and environment rules on GitHub were not inspected.
- **Stale-`/m`-bookmark recovery** is not implemented (it would add an unconditional route and break flag-off route parity). When Mobile is first released, a rollback needs a plan for devices that have `/m/…` addresses saved: for instance a one-release `/m/*` → canonical redirect, or hosting-level rules.
- Real devices, screen readers, the Android back gesture, link capture and OS text scaling are untested.
- The test-suite instability described in §14 was investigated again in S04B1; the SSR tests now use a private Vite cache (S04B1 §14).

## 14. Rollback and feature disable

- **Disable**: leave `VITE_MOBILE_ENABLED` unset (the default) or `"false"`. The production workflow pins it. A flag-off build contains no Mobile code, strings or CSS.
- **Revert**: the change is additive; reverting the S04A commit removes the Mobile tree. The only edits to existing files are `Router.jsx`, `vite.config.js`, the deploy workflow, `.env.example` and `tests/helpers/loader.mjs`.
- **Test cache note** (S04A, kept for the record): five SSR tests (`experienceRendering`) failed while a stale `node_modules/.vite` cache from concurrent Vite processes existed (a duplicated React instance); they passed alone and with a fresh cache. S04B1 found the mechanism (a cache shared between differently configured Vite instances) but could not reproduce the failure, and isolated the cache per test server; see S04B1 §14 for the honest classification.

## 15. Reproducing the checks

```
npm test                                   # 924 tests, no network
npm run lint
npm run build                              # flag off; compare dist with a baseline build
VITE_MOBILE_ENABLED=true npm run dev       # Mobile on, locally (set the presentation to "mobile" in More, or use a touch device)
```

## 16. Next phase (was S04B)

S04B1 ([S04B1-readonly-home-accounts.md](S04B1-readonly-home-accounts.md)) delivered the first part: read-only Home and Accounts, the amount rule, a "GET only" test, the provider decisions, the way back to Mobile (`/m/enter`), and the flag-on CSS-order fix. Still open from this list: Activity list, Planning overview and their details (see S04B1 §16). No money-moving flow, no service worker.
