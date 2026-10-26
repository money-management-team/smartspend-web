# Mobile read-only Home and Accounts (S04B1)

The first real Mobile screens, on top of the S04A foundation ([S04A-foundation.md](S04A-foundation.md)): **Home**, an **Accounts** list and an **account's page**, all read-only, against the app's existing GET endpoints. Alongside them: a Mobile-only identity guard that has to hold before any private figure is rendered, a money layer that never turns a backend decimal into a JavaScript number, and the fixes S04A left open for Desktop when Mobile is built in.

What it is not: there is no way to record, change, move or reverse money, no service worker, no manifest, no offline copy of anything, no production enablement. It is on a local branch, not pushed.

## 1. Branch and base commit

- Branch `integration/mobile`, local only. Base: the S04A commit `17caa519a55f3873924d9f56b7583ca01ff8b0a2` (on `development` @ `33070de9d2a18af56eeea753d4d9cd82d293e8c6`).
- Not pushed, not merged, not deployed. The S04B1 commit hash is in the final report (a document cannot name its own commit).

## 2. Files added and modified

**Modified (existing files)**

| File | Change |
|---|---|
| `src/routes/Router.jsx` | Simpler: `MobileEntry ? <MobileEntry desktop={<DesktopRouter/>}/> : <DesktopRouter/>`. No `Suspense`, no `Loading` import, no route-table copy. |
| `scripts/mobileEntryPlugin.mjs` | The virtual module now answers `MobileEntry` (`null` when off; a plain re-export of `src/mobile/entry/MobileEntry.jsx` when on). |
| `tests/helpers/loader.mjs` | The virtual module resolves to `MobileEntry = null` in tests. |
| `tests/{accessExperience,dashboardSearch,experienceRendering,googleSignIn}.test.mjs` | One line each: they use the new isolated Vite server helper (§14). |
| `tests/mobile{Boundaries,BuildFlag,Bundle,Resolver,Shell}.test.mjs` | Updated for the new structure and tightened (§11, §13). |
| `src/mobile/**` (S04A files) | Shell title and "current page" handling for Accounts; More lists Accounts; resolver maps the new addresses; messages and CSS extended; `MobileRouter.jsx` replaced by `entry/MobileEntry.jsx` + `MobileApp.jsx`. |

No Desktop page, layout, style, API module, `formatMoney`, auth code, `CLAUDE.md` or backend contract is touched. `git diff` of `src/` outside `src/mobile/` is the `Router.jsx` change only.

**Added**

- `src/mobile/entry/` (`MobileEntry.jsx`, `MobileBoot.jsx`), `src/mobile/MobileApp.jsx`
- `src/mobile/identity/` (`guard.js`, `IdentityBoundary.jsx`, `storeContext.js`)
- `src/mobile/data/` (`readApi.js`, `loaders.js`, `resourceStore.js`, `useResource.js`, `errorKind.js`)
- `src/mobile/money/` (`decimal.js`, `format.js`, `Money.jsx`, `MoneyPrivacy.jsx`, `privacyContext.js`)
- `src/mobile/models/` (`values.js`, `home.js`, `accounts.js`, `movements.js`)
- `src/mobile/home/MobileHome.jsx`, `src/mobile/accounts/` (`MobileAccounts.jsx`, `MobileAccountDetail.jsx`, `AccountRow.jsx`, `typeKey.js`), `src/mobile/screens/MobileEnter.jsx`, `src/mobile/ui/` (`ErrorPanel`, `StaleNotice`, `Skeleton`, `Chevron`, `useOnline`)
- tests: `mobileMoney`, `mobileModels`, `mobileIdentity`, `mobileScreens`, `mobileEntry`, `mobileReadOnly`, plus helpers `mobileApi.mjs`, `mobileHarness.mjs`, `isolatedVite.mjs`.

## 3. Financial-data contract

What Mobile will show, and what it will not:

| Rule | How it is kept |
|---|---|
| Amounts are the backend's decimal strings, never numbers | `money/decimal.js` validates the shape and formats from the digits; the only `Number`-free path (a test scans `src/mobile` for `Number(`, `parseFloat`, `toFixed`, `toLocaleString`, rounding) |
| A valid four-decimal amount is never rounded to two | `0.0050` → `0.005`, `1.0049` → `1.0049`; only trailing zeros are dropped, never below two decimals |
| Null, missing or invalid is never `0.00` | the amount is "unavailable": `—` on screen, "Not available" for a screen reader |
| More than four decimals, `+5`, ` 5`, `1e3`, `5,00`, numbers, `NaN`, `Infinity` are refused | not guessed at |
| Never sum across currencies | no function adds amounts; Home lists each currency from `summary_by_currency` on its own |
| No balance is computed in the browser | the account balance is `current_balance` as sent; a movement's amount is the signed ledger lines of that account for that transaction (the same reading the Desktop account history uses), and nothing is accumulated across movements |
| No invented exchange rates | none exist |
| `total_balance`/`totals` is not assumed to be right for several currencies | `totals` is used **only** when the backend says `scope.is_multi_currency` is false and there are no per-currency rows, and only in its own `currency_code` |
| Contradictory currency data → unavailable | duplicate currency rows, a row without a valid currency, "several currencies" with one row, "one currency" with several rows, totals in another currency than the only row: the balance section says it is unavailable and shows no figure |
| Stale values only after a valid read of this session, clearly marked | §7 and the Home states below; never kept after a 401, 403, 404 or a lost workspace |
| Nothing persisted | the in-memory store only; a test checks storage before and after reads |
| Phone-computed estimates | none |

**Section states on Home.** Each section is `ready`, `empty` (the backend says there is nothing) or `unavailable` (missing, malformed or contradictory) on its own, so one bad part of a response does not take the others down. An empty list is empty; a missing list is *unavailable*, never silently empty.

**Period.** The period is fixed at the API's default, `month`, and shown as a label ("This month", with the dates the backend returned). It is not a button, link or input. A note says choosing another period is not available yet. If the response says it is another preset, the label says "Period not confirmed".

## 4. Mobile money formatter

`src/mobile/money/decimal.js`, with the exact expectations in `tests/mobileMoney.test.mjs`.

- `parseDecimal(value)`: `^(-?)(\d{1,40})(?:\.(\d{1,4}))?$` on a string, or `null`. Leading zeros are dropped, `-0.0000` is zero (no sign).
- `formatMoneyParts(value, currency, locale)`: the integer part goes through `Intl.NumberFormat(locale, { numberingSystem: "latn", useGrouping: true })` **as a BigInt** (exact at any size), the decimal mark comes from the locale, the fraction digits are the backend's own. The currency must be three capital letters, or the amount is unavailable.
- Latin digits in every language (the provisional policy), grouping and decimal marks of the locale. The sign is U+2212 "−".
- `<Money>`: the visible amount is one `<bdi dir="ltr" aria-hidden>` run, so digits keep their order inside Arabic text; a separate visually hidden text says it in words for assistive technology ("minus 125.50 Israeli New Shekel", currency name from `Intl.DisplayNames` in the reader's language, "موجب"/"سالب" in Arabic). Unavailable shows `—` and "Not available"; hidden shows `••••` and "Amount hidden".
- The shared `formatMoney` is not imported and not changed; a test refuses its import, and `sumMoney`/`subtractMoney`.
- Dates: `money/format.js`, Latin digits, the user's time zone when valid; a bare `YYYY-MM-DD` is shown as that day in every zone (a first version shifted it by a day in UTC+14; found by a test, fixed).

"Hide amounts" (the full app's device preference in Display preferences) is respected: Mobile reads that one setting through the full app's own `createExperienceStore` and **never** writes it (a test refuses any `.update` call). Without it a person who chose to hide their balances would see them in Mobile.

## 5. API endpoints used

All through `src/mobile/data/readApi.js`, the only Mobile file that imports the API wrappers (the identity guard imports one reader from `apiClient`). Those go through `apiRequest`: bearer token, `Accept-Language`, envelope checks, `ApiError`, the 401 session-expired flow. Only `list`/`get` are named; the wrappers' `create`/`update`/`archive`/`correct`/`reverse` are never imported or called.

| Screen | Request |
|---|---|
| Home | `GET /dashboard?period=month[&workspace_id]` |
| Home | `GET /financial-alerts[?id_workspace]` (note the name; alerts do not take `workspace_id`) |
| Accounts | `GET /accounts[?workspace_id]` |
| Account | `GET /accounts/{id}` |
| Account | `GET /transactions?account_id={id}&page=n&per_page=20&sort_by=occurred_at&sort_dir=desc` |

The session's workspace is read from storage as Desktop does and **never written back** (the Desktop dashboard stores it; a test checks Mobile does not). Nothing else is requested: no `resolveWorkspaceId()` (it writes), no notifications count, no WhatsApp summary, no email status of its own.

## 6. Backend response fields relied upon

Taken from the repo's own docs (`docs/dashboard/api.md`, `docs/accounts/api.md`, `docs/dashboard/financial-alerts.md`) and the Desktop code that already reads them. **None of this was checked against the live API in this phase** (no live calls were allowed); the screens refuse what does not match instead of guessing.

- `/dashboard`: `period.{preset,date_from,date_to,timezone}`, `scope.{is_multi_currency,primary_currency_code}`, `summary_by_currency[].{currency_code,current_balance,income,expense,net,accounts_count}`, `totals.{currency_code,accounts_count,…}` (single-currency fallback only), `accounts[]`, `recent_transactions[].{id,type,status,description,category.name,amount,currency_code,occurred_at}`.
- `/financial-alerts`: `alerts[].{severity,message}`.
- `/accounts`, `/accounts/{id}`: `id, workspace_id, name, type, currency_code, current_balance, status, archived_at, savings_goal` and, on the detail, `opening_balance, allow_negative_balance, low_balance_threshold, last_four_digits, is_default, created_at`.
- `/transactions`: Laravel paginator (`data, total, current_page, last_page, per_page, from, to`); each row `id, workspace_id, type, status, description, category.name, occurred_at, reversal_of_id, ledger_entries[].{id, workspace_id, transaction_id, account_id, currency_code, signed_amount, account.{id,name}}`.

A page of movements that does not hold together (paginator numbers that disagree, a line in another currency, a movement without a line for this account, a repeated id) is refused whole.

## 7. Cross-tab identity safety

**The problem (S03.6).** The AuthProvider keeps the signed-in user in memory. Every API request reads its token from browser storage when it is sent (localStorage first, then sessionStorage). Another tab can change storage under this one, so a screen could keep showing User A's figures while refreshing them with User B's token. Desktop does not guard against it and is **not changed**.

**What Mobile does** (`src/mobile/identity/`, no shared code touched):

- `IdentityBoundary` wraps everything in Mobile that shows or fetches data. It is keyed by a **fingerprint** of the session token plus the user id (a short non-cryptographic hash held in memory: the token itself is never kept, stored or sent). A different session is a different scope: the old one unmounts and takes its data with it.
- A guard compares what storage says now with that identity: `storage-unavailable`, `signed-out-elsewhere`, `changed-elsewhere`. It re-checks on a `storage` event for a session key, when the tab regains focus or visibility, on `pageshow`, **before each request is sent and again when its response arrives**.
- Once it fails it is a **latch**: the whole shell is replaced by "Your session changed" with one button, Reload; every figure is dropped from memory and every request in flight is cancelled before the screen re-renders; nothing is requested again; restoring the old token in storage does not bring the screen back. Reload starts the app from whatever storage says (signed out, or as the new user). Nothing is submitted by recovery.
- A response whose request was sent under another identity is thrown away, never stored, never shown.

| Scenario (tests in `mobileIdentity.test.mjs`, and in a real two-tab browser run) | Result |
|---|---|
| A, another tab signs out | figures removed, "signed out in another tab", no request after |
| A, another tab signs in as B | figures removed, no request ever carried B's token |
| A, same token slot rewritten with another user | fails closed |
| Request in flight when the identity changes | its response is never shown |
| Refresh in flight, then a switch | the figures already on screen go too |
| 401 during a read | figures removed, "session ended", no retry; Mobile follows the app to sign-in |
| New session in the same tab | nothing of the previous one; A's figures never reappear while B's load; A's token is not used after B's starts |
| Session restore | its own state: nothing requested and no shell until the app has restored the session |
| Persistent (localStorage) vs session-only (sessionStorage) | see below |
| Storage blocked | fails closed before any request |
| An unrelated storage key (theme) | no effect |

**In a real browser** (two tabs of headless Chrome on one origin; the second tab rewrites localStorage, the first hears a genuine `storage` event): sign-out and switch-to-B on Accounts (English and Arabic) and on an account's page replaced the whole shell with "Your session changed" within the 1.2 s observed; no figure was left in the page text; the screen made **no data request** afterwards, and none ever carried B's token (the only later requests were the second tab's own session restore). An unrelated key (theme) left the screen alone.

**Persistent vs session-only, stated plainly.** `storage` events are delivered for `localStorage` only; there is no cross-tab notification for `sessionStorage`, and Mobile does not claim one. What does matter: `getAuthToken()` prefers localStorage, so a "remember me" login in another tab changes the token a session-only tab sends, and a login in another tab clears the shared localStorage entries first. Both arrive as localStorage events and are caught. A session-only login elsewhere cannot touch this tab's sessionStorage, and nothing changes here.

**Limits.** The guard protects Mobile. A person who goes from Mobile to a Desktop page in the same tab is on Desktop, which still has the original behaviour. The proper fix is a `storage` listener in `AuthProvider` (shared code): **a separate approval is needed for it**; it is not made here. Same-user token renewal in another tab is also treated as a change (the person reloads).

## 8. Shared providers

| Provider | In Mobile? | Why |
|---|---|---|
| Theme, Language, ErrorBoundary, Auth, EmailVerification (Root) | inherited | shared state; Mobile holds none of its own |
| `ExperienceProvider` | **no** | a Desktop component that imports Desktop CSS and an i18n bundle. Mobile reads the one preference it needs (hide amounts) through `createExperienceStore`, read-only |
| `UnreadNotificationsProvider` | no | would call `GET /notifications/unread-count`; Mobile shows no bell |
| `WhatsAppPendingProvider` | no | would call the WhatsApp summary; nothing in Mobile shows it |
| `ModalAccessibility` | no | a document-wide modal manager for the Desktop layout; Mobile's sheets use the S04A overlay hook (inert background, Tab trap, Escape, focus restore) inside the scoped `.sm-portal` |
| `IdentityBoundary`, `MoneyPrivacyProvider` | new, Mobile-only | §7 and §4 |

Lifecycle: `IdentityBoundary` mounts with the Mobile shell and unmounts when the person leaves `/m/*`, signs out, or the identity changes; the store clears (React may replay effects in StrictMode: `clear()` is reusable, `dispose()` after an identity failure is not). `/m/enter` is outside the boundary and outside the shell.

## 9. Routing and canonical behaviour

Option D is unchanged: canonical URLs stay authoritative, Mobile lives under `/m`.

| Address | Mobile mode | Desktop mode |
|---|---|---|
| `/dashboard` | → `/m` (Home is real) | stays |
| `/dashboard/accounts[/{id}]` | **stays Desktop**: Desktop's Accounts can create, edit and archive, Mobile's cannot | stays |
| `/m`, `/m/accounts`, `/m/accounts/{id}`, `/m/activity`, `/m/planning`, `/m/more` | stay | → `/dashboard`, `/dashboard/accounts`, `/dashboard/accounts/{id}` (query and hash kept), …, `/dashboard/settings` |
| `/m/accounts/abc`, `/m/accounts/007`, `/m/accounts/1/x`, unknown `/m/…` | "Not available"/error in the shell, no request | → `/dashboard` |
| `/m/enter` | → Home (already Mobile) | **stays**, asks |
| emailed links, auth pages, `/whatsapp/drafts/…`, static documents, `/api` | never touched | never touched |

Query and hash survive redirects; every redirect replaces the history entry (a test walks Back from an account to the list and to Home, and finds no canonical address left behind). The resolver stays pure and idempotent (checked over every known path, query and hash, now including the new addresses). Auth redirects keep the intended destination (`RequireAuth` stores `state.from`; `/m/enter` and `/m/accounts?x=1` both return after sign-in).

**Returning from Desktop to Mobile (new).** `/m/enter` is an explicit, bookmarkable address: it asks "Open the Mobile version?", and **only a tap** on "Open Mobile" stores the choice and goes Home; "Stay on the full version" leaves the stored choice alone. Nothing links to it from a Desktop page (nothing is inserted into Desktop), nothing sends anyone to it, and opening it changes nothing. After the person chooses Desktop again in More, that choice is respected and nothing sends them back (tested, including a wait). If rollback ever disables Mobile, `/m/…` bookmarks have no recovery (S04A limitation, still true).

## 10. Visual and accessibility results

Headless Chrome (with touch emulation for phone jobs) against the flag-on build, a mocked fictional API, 188 jobs / 180 Mobile renders: Home, Accounts, an account's page and More at **320, 360, 390 and 430 px**, English LTR and Arabic RTL, light and dark; backend scenarios (several currencies, long names and 123,456,789,012,345.6789, no accounts, a failing dashboard, a slow dashboard for the loading state, hidden amounts); enlarged text at **1.25×, 1.5× and 2×** (root font 20, 24 and 32 px) at 320 and 390 px; the Add sheet; focus rings; "Load more".

| Check | Result |
|---|---|
| JavaScript errors | **0** |
| Horizontal page scroll, or any element past the viewport edge | **0** |
| Clipped amounts (an amount wider than its box or the screen) | **0** (very long amounts wrap; they are never cut) |
| One `h1`, nothing deeper than `h2` | every render |
| Compact bar (Menu + Add) | 40 renders (17rem or enlarged text), all four destinations reachable; the standard bar in the other 134 |
| Targets under 44 px | only the three presentation radio inputs on More (24 px), each inside a 44 px labelled row, as in S04A. Nothing else |
| Arabic | right-to-left page, mirrored bar, chevrons follow the reading direction, amounts stay one left-to-right run with Latin digits, Latin account names line up with the Arabic text around them (`unicode-bidi: plaintext`) |
| Both themes | the balance card is a step lighter than the page in dark so it stays the anchor of the screen |
| Screen-reader text | amounts are spoken as "minus 25.50 Israeli New Shekel" (tests); nothing checked with a real screen reader |
| Keyboard | the page title takes focus after navigation (S04A); "Load more" moves focus to the new rows; sheets trap focus; Escape closes (S04A tests) |
| Reduced motion | the skeleton pulse and the boot spinner stop |

The visual language follows S03.5 (navy anchor, blue actions, cyan highlights, no glass, no heavy shadows). Looking at screenshots found two bugs, both fixed: the "back" arrow pointed forward, and Latin names in Arabic rows were aligned to the wrong side. **Not claimed**: WCAG 2.2 AA compliance, real-device or real-screen-reader behaviour, full design parity with S03.5.

## 11. Read-only enforcement

Three layers, all tests:

1. **Source** (`mobileReadOnly.test.mjs`): only `data/readApi.js` imports the wrappers, and only `accountsApi, apiClient (getStoredWorkspace), dashboardApi, financialAlertsApi, transactionsApi`; the guard imports `getStoredAuthSession` and nothing else. No write method name, no `POST|PATCH|PUT|DELETE`, no `method:`/`body:` option, no idempotency, no `fetch`/XHR/beacon/WebSocket/EventSource, no `apiRequest`/`apiDownload`, no service worker/IndexedDB/cache/manifest, nothing about WhatsApp, AI, imports, transfers, recurring, savings or debts, no shared money helper, no float conversion or rounding. Browser storage is written in exactly one place: the single presentation word.
2. **Facade**: it exports `readDashboard, readAlerts, readAccounts, readAccount, readAccountMovements, isAccountId, DASHBOARD_PERIOD, MOVEMENTS_PER_PAGE`, each sending a GET to the endpoint in §5 with only the documented filters; an account id must be a plain positive integer or **no request is made**.
3. **Runtime**: the fake backend refuses anything but a GET **on the spot** (the call throws and is recorded), and also traps `XMLHttpRequest`, `sendBeacon`, `WebSocket` and `EventSource`, so a screen cannot get round it by not using `fetch`. Tearing the fake down fails the test if a forbidden request happened even when the screen swallowed the error. `mobileReadOnly.test.mjs` proves the instrument works by provoking POST, PATCH, PUT, DELETE and a GET with a body. Across every Mobile screen: five requests, all GET, none with a body, none outside §5.

The Add button opens an informational sheet and sends nothing. An account's page offers no button, form or input; "Editing, archiving and statements aren't available in Mobile yet" is text, with a link to the full version.

## 12. Desktop regression findings

**Flag on, Desktop presentation (what S04A left open):**

| S04A finding | S04B1 |
|---|---|
| A page-level loading fallback for every visitor while the Mobile chunk downloads | **Gone.** Desktop URLs render the `desktop` element directly: no `Suspense`, no Mobile element; a test with a DOM observer sees no `sm-` node at any moment |
| The Mobile chunk was requested for everyone | Requested only when a Mobile URL is shown. In a real browser: **0** requests for it on `/dashboard` (Desktop mode and auto) and on `/dashboard/accounts` (Mobile mode) |
| Desktop CSS reordered (the `Loading` rules hoisted ahead of `index.css`) | **Fixed.** The Desktop rules are identical and in the same order (6,463 rules; a test asserts it); the 129 Mobile rules form one block near the start. The cause was the Mobile chunk importing the router's guard module, which made the bundler restructure shared chunks; the static entry removed it |
| Logo anti-aliasing difference (~280 px) in flag-on screenshots | **Not present.** See below |

**Browser parity** (54 jobs: every signed-out and signed-in route, desktop 1366×900 English light and a 390×844 phone English dark; 2 baseline runs, 2 flag-off runs, 2 flag-on runs with the Desktop presentation chosen):

- URL, title, language, direction, theme, visible text and DOM are **identical in all 54**, in every comparison. (One flag-off run caught the Transfers page too early, on that run only; a second run matched.)
- Pixels: the **baseline differs from itself** in 5 of 54 jobs, always the same 388-pixel patch at the logo (rows 17–44, columns 17–40, a 50/255 anti-aliasing flip), plus on one page 101 invisible pixels (delta 1). Flag off vs baseline: 5 of 54, exactly those patches. **Flag on vs baseline: 3 of 54, the same patches.** Flag on vs flag off: 2 of 54, the same patch. No new difference of any size or place appears with Mobile built in. All phone views are pixel-identical.
- 0 JavaScript errors; 108 API calls, none but GET.

Flag off vs the original baseline: §13. Desktop API behaviour and authentication are untouched (no shared module changed; the one edited source file is `Router.jsx`).

**Stated plainly:** a Desktop-mode visitor who opens a Mobile address (a stale `/m/…` bookmark) while the session is still being restored loads the Mobile chunk once before being redirected (the redirect waits for the session). That is a Mobile URL, not a Desktop page.

## 13. Flag-off and flag-on bundle evidence

**Flag off vs the original `development` baseline** (every content hash normalised): **149 of 150 files identical**; only the entry chunk differs (413,058 vs 413,032 bytes: the `Router.jsx` change). The stylesheet is **byte-identical**: the same name (`style-CdLHj2cm.css`), 824,885 bytes, the same sha-256. No Mobile chunk, string, CSS or marker anywhere in the output (`tests/mobileBundle.test.mjs` searches every file for 19 Mobile strings, including `sm-money`, `sm-identity`, `/m/enter` and `--sm-`).

**Flag on** (a local build; a production build also needs the release approval variable):

- one lazy chunk, `MobileApp`: **60.9 kB, 17.6 kB gzip** (S04A: 16 kB), never referenced by `index.html`;
- the entry grows by 4.2 kB (the gate, the resolver, the preference reader, the boot state): 417,243 vs 413,058 bytes;
- stylesheet 838,665 bytes (+13.8 kB), **129 Mobile rules**; every Desktop rule present, unchanged and in the same order;
- Desktop chunks differ from the flag-off ones only by import specifiers and minified export names (the entry has more code), plus two small chunks that exist because Mobile shares their modules with Desktop: `useAuthContext` (231 bytes, one more `modulepreload` on every page of that build) and `financialAlertsApi`. An attempt to avoid the first by re-exporting the hook through a Mobile module changed nothing and was reverted. No Desktop behaviour or rule differs (§12);
- the shared chunks the facade imports carry the API wrappers' write methods (as for Desktop). Mobile never calls them (§11); presence in a chunk is not reachability.

## 14. Test results

| Run | Result |
|---|---|
| Existing suite before any change | **924 / 924** (one full run, then 3 more warm full runs and 6 cold-cache runs of the four SSR files); lint clean; flag-off and flag-on builds OK |
| `npm test` at the end | **1118 / 1118** (924 existing + 194 new), six consecutive runs; `npm run lint` clean |
| New | money 31, models 27, identity 41, screens 50, entry 19, read-only 18, isolation 3 (189); the resolver suite +4 and the bundle suite +1; the S04A shell, boundary and flag suites were updated for the new structure and tightened (a bundle test now requires the Desktop rules in **exactly** the same order; the boundary test no longer allows the shared formatters) |

**Test instability (S04A's five `experienceRendering` failures): investigated, not fully explained. Classification: PARTIAL.**

- *Found:* the four SSR test files each start a Vite dev server with `configFile: false` and the default cache `node_modules/.vite`, which `npm run dev` also uses (a different config, so a different cache hash: each rewrites the other's cache, and 14 stale `deps_temp_*` folders had piled up). Each server also starts the dependency optimizer, and `@vitejs/plugin-react` forces React, React DOM and the JSX runtimes into it (confirmed by printing the resolved config). Whether a test's first `ssrLoadModule` resolves `react` to the pre-bundled copy or to `node_modules` depends on a race, and two copies of React give exactly the reported `useContext` of null.
- *Not achieved:* reproducing it on purpose. 6 cold-cache runs, 3 warm full runs, 4 runs beside a concurrent `vite build`, 3 beside a running dev server, 4 with a dev server starting at the same moment, 3 full runs under 8 busy-loop processes: all green. It then happened once in 17 full runs (the browser harness had left about ten headless Chrome processes running), the same five tests, and not in the 18 runs after.
- *Changed:* `tests/helpers/isolatedVite.mjs` gives each SSR test server a private cache directory, **no optimizer** (the forced React include is emptied), and no HMR socket (several servers also fought over port 24678). `tests/testIsolation.test.mjs` asserts the cache stays empty and that a hook-using component renders with the test's own React.
- *Status:* the mechanism is strongly suspected and the ingredient is removed, but no failing run was ever captured with diagnostics, so "fixed" would overclaim. If it returns with this in place, the cause is something else. `experienceRendering.test.mjs` run alone has never failed.
- Housekeeping: empty `smartspend-vite-*` folders from earlier iterations are in the system temp directory (new runs clean up after themselves); a shared-temp sweep was not run.

## 15. Known limitations

- **Not verified against the live API.** Every response shape comes from the repo's docs and Desktop code and is tested with fictional mocks. A field the backend sends differently shows as unavailable, not wrong, but the screens have not seen real data.
- **Desktop still lacks the identity guard** (§7). It needs a shared `AuthProvider` change and a separate approval. Mobile protects Mobile only; a person who moves to a Desktop page in the same tab has the old behaviour. Same-user token renewal elsewhere is treated as a change.
- **Production is still blocked** by the S04A items: the workflow guard on `development` exists only on this unmerged branch, stale `/m/…` bookmarks have no rollback recovery, GitHub branch protection was not inspected.
- **No period choice.** Home is "this month" only; a period control needs a design and was deferred.
- **Not in Mobile:** the email-verification banner (the app still fetches the status once per session), the notification bell, the WhatsApp pending count, the Experience dashboard (templates, saved views, attention centre). `ExperienceProvider` and the other dashboard providers are deliberately not mounted.
- Stale figures exist only for reads that succeeded earlier in the same session; nothing survives a reload (by design: no persistence).
- A failed download of the Mobile chunk (offline on first open) falls to the app's generic error boundary.
- Activity and Planning are still placeholders; the Add sheet is informational.
- The 17rem compact-bar threshold, the Latin-digit policy and the "−"/"+" display are provisional product choices.
- Not tested: real devices, real screen readers, the Android back gesture, OS text scaling, forced-colours modes, slow networks beyond one 4 s delay.
- The browser runs use a mock server and fictional data only; no live API, production or staging host was contacted.
- One more small request on every page of a flag-on build (`useAuthContext`, 231 bytes), §13.
- CLAUDE.md is not edited. To record there when Mobile is released: strings in the `mobile` namespace instead of `src/locales` (S04A); `src/mobile` reading the Experience feature's preference store; Mobile-only money formatting that does not use `formatMoney`.

## 16. Next proposed slice

**S04B2: read-only Activity (a transactions list and a transaction's page)**, on the same pieces: `GET /transactions` (the paginator reader already exists for an account's movements), the money layer, the identity boundary and the read-only tests (extend the facade's allow-list and the source scan, nothing else). It needs the Activity filters decided (type, status, date range), and `fromCanonical` stays off for Activity, because Desktop's Financial operations page can record money and Mobile's cannot. The Desktop `AuthProvider` storage listener should be approved separately before any production use of Mobile. Planning (budgets, goals) after that. Still no write flow, service worker or manifest.
