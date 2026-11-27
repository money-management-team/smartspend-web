# Mobile Activity and transaction details (S04B2)

Read-only Activity for Mobile: a transaction history with the filters the backend supports, server paging, day grouping and a transaction's own page, on top of S04A (foundation) and S04B1 (Home, Accounts, identity guard, money layer). See [S04A-foundation.md](S04A-foundation.md) and [S04B1-readonly-home-accounts.md](S04B1-readonly-home-accounts.md).

It does not create, correct, reverse or confirm anything; it has no service worker, manifest or offline copy; Mobile is still off in production; nothing is pushed or merged.

## 1. Architecture and scope

```
/m/activity                     MobileActivity            GET /transactions (page n, filters)
/m/activity/{id}                MobileTransactionDetail   GET /transactions/{id}
        both inside RequireAuth > IdentityBoundary > MobileAppShell, like Home and Accounts

data/readApi.js      the only file that makes requests, all GET (adds readTransactions, readTransaction, readCategories)
models/activity.js   filters, one row, a page of the list, a transaction's page, day keys
activity/            useActivityList (pages 1..n of one list), ActivityFilters (sheet + chips),
                     TransactionRow, StatusChip, TypeIcon, MobileActivity, MobileTransactionDetail
```

- **Scope** is the Activity list and a transaction's page, plus links from Home (recent activity, "View all") and from an account's movements. Planning, any write flow and PWA work are not started.
- **Shell change** (small, justified): a sheet opened by a *screen* now makes the rest of the frame inert, as the shell already did for its own sheets (`shell/modalContext.js`). Focus restore retries once after the frame is live again.
- **Fix to S04B1** found while writing the detail page: an account's page said "You don't have access to this" for a 403 and "may not exist, or you may not have access" for a 404, which contradicted S04B1's claim that it never says which. Both single-record pages now use the same words for both (`ErrorPanel hideExistence`), with a test.

## 2. Verified contract, and what was not invented

Taken from the repo's own documentation ([../transactions/api.md](../transactions/api.md), [../transactions/correction-and-reversal.md](../transactions/correction-and-reversal.md)) and the Desktop list and details that already read the API. **None of it was checked against the live backend in this phase.**

| # | Item | What the repo establishes | Mobile |
|---|---|---|---|
| 1 | List | `GET /transactions`, Laravel paginator in `data.transactions` (`data, current_page, last_page, per_page, total, from, to`) | used |
| 2 | Detail | `GET /transactions/{id}` → `data.transaction` | used |
| 3 | Types | `income`, `expense`, `transfer` are filterable; rows also carry `fee`, `reversal` and others (the account history lists `adjustment`, `refund`, `debt_*`) | unknown types are shown as sent |
| 4 | Statuses | `posted`, `pending_review`, `draft`, `reversed`, `failed` | anything else is "Unknown status: x", as sent |
| 5 | Income vs expense | the row's `type`; `amount` is a positive decimal string. A fee is expense-like. A transfer leg and a reversal entry have no direction | sign from the type, never from the amount's sign |
| 6 | Transfers | `transfer_id` on the legs; two ledger lines on two accounts; managed as a whole through `/transfers` | unsigned; a note says so |
| 7 | Reversal | `status: "reversed"` with `reversed_at`, `reversal_reason`; the reversal entry has `reversal_of_id` (or type `reversal`) | struck amount, notes, links |
| 8 | Correction | the replacement has `related_transaction_id` = the original's id and a new id; the original becomes `reversed` | "replaces #n" link. No pointer from the original to its replacement is documented, so none is shown |
| 9 | Account and category | `ledger_entries[]` (`account_id`, `account`, `entry_role`, `signed_amount`), `category`, `category_id`. The list sample shows `ledger_entries: []`, so an account may be missing in a row | shown only when present |
| 10 | Dates | `occurred_at`, `posted_at` ISO timestamps (the Desktop tests use `…Z` and `…+03:00`); the user's zone is `user.timezone ?? workspace.timezone` | §3 |
| 11 | Pagination | page/per_page (20), no cursor | "Load more" = next page |
| 12 | Filters | `type`, `account_id`, `category_id`, `status`, `date_from`, `date_to` (YYYY-MM-DD) | all six |
| 13 | Sorting | `occurred_at`, `amount`, `created_at` × `asc`/`desc` | **only the two `occurred_at` orders** (amount order across currencies means little, and the list is grouped by day) |
| 14 | Errors | 401, 403, 404, 422, 429, 5xx → `ApiError` codes | same kinds as the other Mobile screens |
| 15 | Authorization | the backend scopes transactions to the user's workspaces; `workspace_id` is never sent for the list | not sent |

**Not offered because the contract has none:** free-text search, a total across filters other than the paginator's own `total`, cursors, saved filters (the Experience store has device-local saved views, but their contract was not reviewed; deferred), "Needs review" as a separate entry (the **Pending review** status filter covers it; a shortcut would need real session state such as the WhatsApp pending count, which Mobile does not mount).

## 3. Dates

A transaction belongs to a day, and the day is computed without the device's zone (`models/activity.js: dayKey`):

- a bare date, or a time with no zone, is the day it says (nothing says which zone it is in, so nothing is converted);
- a time with an offset or `Z` is converted to the user's time zone when that is a valid zone; without one the written day is kept;
- an impossible value (`2026-02-30`, `25:00`) belongs to no day and is shown under "Date not available", never a made-up one.

Tested at midnight, month and year boundaries and a leap day: `2026-10-31T23:30:00Z` is November 1 in `Asia/Hebron`, October 31 in UTC and in Los Angeles; `2026-12-31T23:59:59.999999Z` is January 1 in Tokyo. Day headings are formatted from the day key in UTC (so they cannot shift) with Latin digits in both languages. A transaction's page shows date and time only for a value that says which instant it is; otherwise just the date.

Grouping is by consecutive rows of the same day across all loaded pages (the list is date-sorted by construction), so a day that continues onto the next page is one group (tested).

## 4. Financial status presentation

- **Amount:** the S04B1 money layer (decimal strings, BigInt grouping, Latin digits, a `<bdi dir="ltr">` run, spoken in words). Income `+`, expense and fee `−` from the type; transfer and reversal unsigned; an unknown type shown exactly as sent. In a list the minus is text only: **no amount is coloured**, and nothing is green because a value is positive.
- **Status chip:** none on a posted row (the normal case); `Pending review` (blue), `Draft` (neutral), `Reversed` (amber, amount struck through and spoken as reversed), `Failed` (red), anything else "Unknown status: x" (neutral). **Posted is the only success state**, and on a transaction's page the only chip that is green. A missing status says "Status not available".
- **Relations:** "Reversal" and "Correction" labels on rows; on the page a note and a link ("This entry reverses …", "replaces an earlier one that was corrected: #n").
- **Hidden amounts:** the full app's "hide amounts" preference applies (the S04B1 mechanism, read-only), including ledger lines.

## 5. Filter and pagination contracts

- Filters live in the **address** (`/m/activity?type=expense&status=posted&account_id=1&category_id=4&date_from=2026-10-01&date_to=2026-10-31&sort=occurred_at:asc`), with the Desktop list's parameter names, so the Mobile address and its Desktop counterpart carry the same query. Anything not documented is dropped before a request; a range that ends before it starts is dropped whole.
- **Sheet** (a labelled modal, page behind inert): type, status, account, category, from, to, order; **Apply** commits the draft (to the address, `replace`), **Reset** clears the draft (and still needs Apply), **Cancel** and Escape change nothing; an end date before the start date is refused with a message. Applied filters show as chips that each remove one filter, plus "Reset all". Account and category choices come from the two read-only lists, requested only when the sheet is used or an account/category filter is active.
- **Server paging:** every page is its own read keyed by (filters, page). "Load more" asks for page n+1; page 1 is read first and later pages are never inferred. A response can only land in the entry of the question it answered, so a late answer to old filters cannot overwrite new ones (tested with a held request), and the requests of filters the person left are cancelled. A transaction that shows up on two pages (the list moved while paging) appears once. Refresh returns to page 1 and forgets later pages. The count shown is the paginator's own `total`.
- **Back from a transaction:** the link carries the list's address and how many pages were open (router state, not storage); Back shows as much again, and the scroll offset is restored from memory.
- A malformed page (paginator numbers that disagree, a row without an id, a repeated id) is refused whole.

## 6. Routes and canonical behaviour

| Address | Mobile mode | Desktop mode |
|---|---|---|
| `/m/activity[?filters]` | Activity | → `/dashboard/financial-operations[?same query]` |
| `/m/activity/{id}` | the transaction | → `/dashboard/financial-operations/{id}` (query, hash kept) |
| `/m/activity/abc`, `/007`, `/1/x` | "Not available" / not found, **no request** | → `/dashboard` |
| `/dashboard/financial-operations`, `/dashboard/financial-operations/{id}` | **stay Desktop** | stay |

The Desktop financial operations page records, corrects and reverses money, so it is **never** redirected to read-only Mobile (resolver test, and in a real browser). `fromCanonical` stays false for Activity. Direct Mobile navigation to `/m/activity` works when Mobile is on. Signed email links and auth pages are untouched; a signed-out visit goes to sign-in and returns.

Navigation: Home recent row → transaction → Back to Home; Home "View all" → Activity; Accounts → account → movement → transaction → Back to the account; Activity (with filters, with pages) → transaction → Back to the same list; a related-transaction link keeps the original list as its Back. "Back" only follows a Mobile address from history state (anything else falls back).

## 7. Identity safety

Reuses the S04B1 `IdentityBoundary` unchanged. Added tests for Activity and a transaction's page (`mobileActivityIdentity.test.mjs`): another tab signs out; another tab signs in as B (records, the filter sheet and its choices go; B's token is never used); a list request in flight; a later page in flight; a refresh in flight; a detail request in flight; a 401 on the record; blocked storage; session-only vs "remember me"; a new session in the same tab (A's rows never reappear while B's load, B's list does not inherit A's count or pages, the same transaction id is asked again with B's token and is "not found"); a response after the screen was left. The browser run repeated switch, sign-out and an unrelated key with two real tabs.

Limits unchanged from S04B1: Desktop's AuthProvider still has no storage listener (not touched, needs separate approval); in the same tab the address (filters) is the browser's and survives a session change, but no record does.

## 8. Read-only enforcement

- The facade exports reads only (`readTransactions`, `readTransaction`, `readCategories` added) and the source scan still refuses every write name, `method:`/`body:`, idempotency, `fetch`/XHR/beacon, float conversion and shared money helpers; `categoriesApi` was removed from the "forbidden imports" list because the category filter reads `GET /categories`, nothing else from it.
- The fake backend throws on any non-GET at once and traps XHR, beacon, WebSocket and EventSource; tearing it down fails a test that swallowed a violation.
- Activity flows (load, load more, filter, open a transaction) made only `GET /transactions`, `/transactions/{id}`, `/accounts`, `/categories`; **no read-marking, notification or confirmation endpoint** is touched (a test checks the paths).
- Correct and Reverse do not exist on the page: no button at all, a sentence saying they are not available in Mobile yet, and a link to the same transaction in the full version.

## 9. Visual design compliance

Calm Financial Clarity with a navy anchor, in the existing scoped system (`.sm-root`, Cairo/Tajawal, navy/blue/cyan): day headings, flat ledger rows inside one surface (not a card per transaction), a single circular type icon, amount at the end, a navy header on a transaction's page. No chart, no balance, no summary figure, no invented record. Selectors stay under `.sm-root`; nothing from Desktop is imported.

## 10–11. RTL/LTR and accessibility results

Headless Chrome with touch emulation, a mock API with fictional data (a 60-transaction history with every kind of record, other currencies, a 123,456,789,012.3456 amount, long Arabic text and a record with no date), **218 jobs / 211 Mobile renders**: Activity at 320/360/390/430 px, English and Arabic, light and dark; 13 kinds of transaction page at 320 and 390 px in both languages and themes; the filter sheet open and a filtered list (including a filtered-empty one); empty, loading, error, not-found and hidden-amount states; "Load more" and a scrolled list; enlarged text at **1.25×, 1.5× and 2×** (root font 20, 24, 32 px) for the list, a transaction and the filter sheet at 320 and 390 px; account movement → transaction (both languages) and an Activity row → transaction → Back.

| Check | Result |
|---|---|
| JavaScript errors | **0** |
| Horizontal page scroll, any element past the viewport edge | **0** (a first run found 14 renders at 1.5× and 2× text at 320 px, and 2 in the filter sheet at 2×: a grid item that could not shrink widened the page. Fixed with `min-width: 0` on page and sheet children and by letting a row's amount wrap under its text; re-run clean) |
| Clipped amounts | **0** (the first run clipped the large amounts at 2×; fixed; a very long amount also steps down in size before it ever wraps) |
| Targets under 44 px | **0** (the first run found 118: account links in fact rows were 24 px high and "#4" links 21 px; now 44 px high and wide) |
| Headings | one `h1`, nothing deeper than `h2` (day headings are `h2`), every render |
| Compact bar (Menu + Add) | 30 renders (17rem or enlarged text); standard in the other 178 |
| RTL | right-to-left page, mirrored bar; chevrons follow the reading direction and "Back" points the other way; amounts stay one left-to-right run with Latin digits; Latin names inside Arabic rows and Arabic text inside Latin rows are isolated (`<bdi>`, `unicode-bidi: plaintext`); long Arabic descriptions wrap and are never cut |
| Both themes | status colours have dark variants; the navy header on a transaction's page is a step lighter in dark |
| Screen-reader text | each amount is spoken in words ("minus 45.25 Israeli New Shekel", "plus 3,000.00 …", reversed amounts end "Reversed"); a row's link reads title, kind, account, amount and status in that order; each filter chip is named "Remove filter: …"; **checked in jsdom, not with VoiceOver or TalkBack** |
| Filter sheet | labelled modal; page behind inert; Tab and Shift+Tab stay inside; Escape closes; focus returns to the Filters button (retries after the frame is live again); Apply/Reset/Cancel stay in view at the bottom |
| Keyboard, focus rings | S04A rings apply; "Back" and rows are links; the sheet is fully keyboard-operable (tests) |
| Reduced motion | the pulse and spinner stop (S04A/S04B1 rules) |

Two things found by looking at the screenshots and fixed: duplicate wording on a reversal row ("Reversal · Reversal") and a mixed-script "· ·" in an Arabic transfer row. **Not claimed:** WCAG 2.2 AA compliance, real-device or real-assistive-technology behaviour, design parity with S03.5 (a review package of 30 renders is prepared outside the repository for the product owner to compare).

## 12. Test counts

| Suite | Tests |
|---|---|
| New: `mobileActivityModels` (filters, day boundaries, row semantics, pages, detail, Back) | 52 |
| New: `mobileActivity` (list, empty, failing, Load more, filter sheet, race, read-only, leaving) | 49 |
| New: `mobileTransaction` (page, statuses and relations, failing, navigation, canonical, Arabic) | 34 |
| New: `mobileActivityIdentity` | 16 |
| Extended: resolver +2; the read-only, boundary, bundle, shell and screens suites updated | |
| **`npm test`** | **1271 / 1271** (1118 + 153), two consecutive runs of about 55 s; lint clean |

**Test stability (the S04B1 PARTIAL finding stays PARTIAL).** Environment: Node v24.20.0, Vite 8.2.1, React 19.2.8, Windows 11; the SSR test servers use the isolated cache with no optimizer (`tests/helpers/isolatedVite.mjs`). All full runs were sequential and no other build or browser run was active during them. In this phase there were three full runs (one failed on a new bundle-string check of my own, fixed; two clean). **The `experienceRendering` failure did not recur**, but a handful of clean runs does not prove a cause: the original trigger is still unexplained and the finding is not closed. If it returns, the first step is to save the full test output of that run (the optimizer log lines and the failing stack) before re-running.

## 13. Desktop regression evidence

Final flag-off and flag-on builds, 54 jobs (every signed-out and signed-in route, desktop 1366×900 English light and a 390×844 phone English dark), against two runs of the original baseline build:

- URL, title, language, direction, theme, visible text and DOM are identical in every comparison.
- **Flag on (Desktop presentation) vs flag off: 54 of 54 identical, pixels included.** Both differ from the baseline in 3–4 of 54 jobs by exactly the same 388-pixel patch at the logo (rows 17–44, columns 17–40, a 50/255 anti-aliasing flip) that the baseline also shows against itself (3 of 54).
- 0 JavaScript errors; 108 API calls, none but GET.
- The Desktop financial operations page (list and a transaction's page, with `?new=expense`) is **not redirected** in Mobile mode, and the Mobile chunk is not requested for it (real browser); a Desktop-mode visit to `/m/activity…` goes to the matching Desktop page with its query and hash.
- The S04B1 screens were re-run against the final build (188 jobs): 0 JavaScript errors, no overflow, no clipped amount; the only targets under 44 px are the three presentation radio inputs on More, each inside a 44 px row, as before.
- Stated plainly, as in S04B1: a Desktop-mode visitor who opens a Mobile address while the session is being restored loads the Mobile chunk once before being redirected.

## 14. Flag-off and flag-on bundle comparison

**Flag off vs the original baseline** (content hashes normalised): 149 of 150 files identical; only the entry chunk differs (413,058 bytes, the `Router.jsx` change). The stylesheet is **byte-identical** (`style-CdLHj2cm.css`, 824,885 bytes, same sha-256). 150 files, no Mobile chunk; `tests/mobileBundle.test.mjs` searches every file for 26 Mobile strings (now including `sm-tx`, `sm-day-title`, `sm-filter-form`, "Unknown status", "Reset all filters", `/m/activity`) and finds none.

**Flag on:** one lazy `MobileApp` chunk, **98.2 kB (26.7 kB gzip)**, never referenced by `index.html`; entry 417,700 bytes (+4.6 kB over flag off); stylesheet 843,264 bytes (+18.4 kB) with **173 Mobile rules**, every Desktop rule present, unchanged and in the same order (a test asserts it). Shared chunks the build creates because Mobile imports Desktop's API modules: `useAuthContext` (231 B), `financialAlertsApi`, `categoriesApi`, `transactionsApi`; Desktop chunks differ from flag off only by import specifiers and minified names. Presence of the wrappers' write methods in those shared chunks is not reachability (§8).

## 15. Remaining limitations

- **Not verified against the live API.** Every shape in §2 comes from the repo; the screens refuse what does not match, but have not seen real data. Whether the list includes ledger lines (and so account names) is unknown: a row without them shows no account.
- **Timezone semantics of `occurred_at`** are inferred from fixtures (`Z` or an offset); a value with no zone is shown as the day it says.
- **No search, no amount sort, no saved filters, no "Needs review" entry** (§2). Pagination is offset-based, so a list that changes while paging can repeat a row (shown once) or, after a deletion, skip one; Refresh starts again from page 1.
- **No totals** beyond the paginator's own `total`, no period summary, no export.
- The **filter state is in the address**: it survives a session change in the same tab (no record does).
- **Desktop AuthProvider** still has no cross-tab guard (separate approval needed); Mobile protects Mobile only. **S04B1's PARTIAL** (test instability) and the S04A/S04B1 production blockers (workflow guard only on this unmerged branch, stale `/m` bookmarks, no live-API verification, no real-device accessibility testing) are unchanged and not resolved here.
- A date input shows the browser's own format (`mm/dd/yyyy` in the test browser); the value sent is always `YYYY-MM-DD`.
- A transfer's two accounts are listed without a direction: the ledger's source/destination roles were not verified as a contract.
- Planning is still a placeholder; Add is informational.

## 16. Next recommended slice

**S04B3: read-only Planning** (budgets and their details, savings goals, recurring commitments' list) on the same pieces: `GET /budgets`, `/savings-goals`, `/recurring-transactions` through the facade (extend its allow-list and the source scan, nothing else), the money layer, the identity boundary. It needs each endpoint's contract verified first (as §2 did for transactions), a decision on `fromCanonical` (it stays off while Desktop's pages can create and change plans), and no money-moving action (contributions, withdrawals, recurring confirmations stay out). In parallel and independent of Mobile: approval for a `storage` listener in the Desktop `AuthProvider`, and a live-API check of the Home, Accounts and Activity shapes, before any production use of Mobile.
