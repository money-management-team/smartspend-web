# Mobile Planning: budgets, savings goals, recurring rules (S04B3)

Read-only Planning for Mobile: an overview, budgets, savings goals and recurring rules, each with a list and a record page, on top of S04A (foundation), S04B1 (Home, Accounts, identity guard, money layer) and S04B2 (Activity). See [S04A-foundation.md](S04A-foundation.md), [S04B1-readonly-home-accounts.md](S04B1-readonly-home-accounts.md) and [S04B2-activity-readonly.md](S04B2-activity-readonly.md).

It does not create, edit, archive, contribute to, withdraw from, pause, resume, confirm, skip or post anything; it has no service worker, manifest or offline copy; Mobile is still off in production; nothing is pushed or merged.

## 1. Architecture and scope

```
/m/planning                       MobilePlanning            GET /financial-alerts + first page of budgets (active, over the limit), goals, rules
/m/planning/budgets               MobileBudgets             GET /budgets (page n, status, progress_status)
/m/planning/budgets/{id}          MobileBudgetDetail        GET /budgets/{id}
/m/planning/goals                 MobileGoals               GET /savings-goals (page n, status)
/m/planning/goals/{id}            MobileGoalDetail          GET /savings-goals/{id}   (+ GET …/plan, only in a Smart Savings build)
/m/planning/recurring             MobileRecurring           GET /recurring-transactions (page n, status, type)
/m/planning/recurring/{id}        MobileRecurringDetail     GET /recurring-transactions/{id}
        all inside RequireAuth > IdentityBoundary > MobileAppShell, like Home, Accounts and Activity

data/readApi.js        the only file that makes the Planning requests, all GET (adds readBudgets/readBudget/readGoals/readGoal/readRules/readRule)
data/readPlanApi.js    the one Smart Savings read (GET /savings-goals/{id}/plan), in its own file (§8)
models/planning.js     paginator reader, percentage reader, state reader
models/budgets.js, goals.js, recurring.js, plan.js   filters, one row, a page, one record
planning/              PagedListView + usePagedList + useListScreen (the three lists), RecordScreen (the three record pages),
                       PlanChip, Progress, FilterTabs, lists.js, the seven screens, SmartPlanSection (flag-gated)
```

- **Scope** is Planning only. Debts, Calendar, Categories and Reports are **links to the full version**, each said to be so; Mobile makes no request for them.
- **Shell change** (small): the app bar title for the six new addresses, the build marker (`SMARTSPEND_MOBILE_S04B3`), and the Planning destination is "current" on every page inside it.
- **Removed:** `screens/PlaceholderScreen.jsx` and its strings. Home, Activity and Planning are all real now; More's "Not available" page is a separate component.
- **Chosen** (the brief left these open): list and record pages for all three resources (the detail GETs exist); a recurring rule's **occurrences are not read** (an optional GET the brief did not require, and the only thing that would let Mobile say a rule is overdue); the Smart Savings plan is a **read-only section behind the build flag** (§8).

## 2. Verified contract matrix

Taken from the repo's own documentation ([../budgets/api.md](../budgets/api.md), [../savings-goals/api.md](../savings-goals/api.md), [../savings-goals/smart-plans.md](../savings-goals/smart-plans.md), [../recurring-transactions/api.md](../recurring-transactions/api.md), [../debts/api.md](../debts/api.md)), the API wrappers and the Desktop pages that already read them. **Evidence quality for every row: documented and source-verified in the repo. None of it was checked against the live backend in this phase** (the same limit as S04B1 and S04B2).

| # | Item | What the repo establishes | Mobile |
|---|---|---|---|
| 1 | Budget list | `GET /budgets?status=active\|archived&progress_status=safe\|warning\|near_limit\|exceeded&per_page&page` (also `category_id`, `scope`, `owner`, `currency_code`, `date_from/to`, `active_on`); paginator in `data.budgets`; each row carries `progress` | `status`, `progress_status`, `per_page` 20, `page`, session `workspace_id` |
| 2 | Budget detail | `GET /budgets/{id}` → `data.budget` with `progress` | used |
| 3 | Budget progress | `spent`, `remaining` (may be negative), `percentage_used` (may exceed 100), `status`, `expenses_count`, `days_remaining`, `has_started`, `has_ended`; the backend also sends aliases (`limit_amount`, `amount_spent`, …) that the full version never reads | canonical names only |
| 4 | Budget lifecycle | `status` `active` / `archived`; an archived budget has no `progress` in the archive response | unknown word shown as sent |
| 5 | Goals list | `GET /savings-goals?status=active\|paused\|achieved\|archived&per_page&page` (12 per page on Desktop; also `progress_status`, `currency_code`, `before_due`); paginator in `data.savings_goals`; each row carries `progress` | `status`, `per_page` 12, `page`, session `workspace_id` |
| 6 | Goal detail | `GET /savings-goals/{id}` → `data.savings_goal` | used |
| 7 | Goal progress | `saved_amount`, `remaining_amount`, `percentage_funded`, `status` (`not_started`, `in_progress`, `almost_there`, `achieved`), `contributions_count`, `days_remaining`, `is_achieved`, `deadline_passed`; "saved" is the goal's own savings account | as sent; never derived |
| 8 | Recurring list | `GET /recurring-transactions?status=active\|paused\|completed\|archived&type=income\|expense&per_page&page` (also frequency, processing_mode, account, due range, owner); paginator in `data.recurring_transactions`; a row may have `schedule: null` | `status`, `type`, `per_page` 15, `page`, session `workspace_id` |
| 9 | Recurring detail | `GET /recurring-transactions/{id}` → `data.recurring_transaction` with `account`, `category`, `schedule { next_occurrence, open_occurrences_count }` | used (`next_due_date` is the next date) |
| 10 | Recurring occurrences | `GET …/{id}/occurrences` (optional) | **not used** |
| 11 | Smart Savings plan | `GET /savings-goals/{id}/plan` → `savings_goal`, `balance`, `savings_plan` (with `next_installment`), `plan_health`; **404 = no active plan** | only with the flag on (§8) |
| 12 | Summaries and counts | there is no budget, goal or rule summary endpoint in the wrappers. `debtsApi.summary` exists but Debts are not a Mobile screen | the overview's counts are the paginators' own `total` |
| 13 | Feature flags | `VITE_SMART_SAVINGS_ENABLED` (exactly `"true"`; production workflow pins it off) | same rule (§8) |
| 14 | Errors | 401, 403, 404, 409, 422, 429, 5xx → `ApiError` codes | same kinds as the other Mobile screens |

**Not offered because the contract has none (or it is not needed read-only):** budget/goal/rule search, a total across currencies, "due this week" or "overdue" for rules (it would need computed dates or the occurrences read), a goals `before_due` filter (Desktop does not expose it either: its value format is undocumented), movement history of a goal (`/contributions`, `/activity`: left to the full version), installments, plan options, funding legs.

## 3. Planning overview

Follows the S03.5 direction: **what needs attention first, then the things you plan with as one group, then tools** (not six identical cards).

1. **Needs attention:** the backend's own alerts from `GET /financial-alerts` (the key Home already uses), up to three, severity chip in words; **the section does not exist when there are none**; a failed read shows a small "Alerts aren't available" with Try again.
2. **Plan:** Budgets (active count, and a red "Over the limit: n" chip when the backend says some are), Savings goals (active count), Recurring rules (active count), Debts (full version).
3. **Tools:** Calendar, Categories, Reports and exports, all "Open in the full version". (S04B4: Categories is now a Mobile screen, with a new-category and a rename form; see [S04B4-category-management.md](S04B4-category-management.md).)

Every number is a count the backend gave (a paginator's `total`) and **nothing is added up**: no combined budget, no total saved, because those would mix currencies. Each of the four reads is independent: a failing one says "Not available right now" on its own row (the row still links) and the rest stand. A response that does not hold together is "Not available", never a number. Refresh reads the alerts and the four lists again, nothing else. Reads: alerts, budgets (active), budgets (active and over the limit), goals (active), rules (active), each the **first page of the list it summarises through that list's own store key**, so opening the list afterwards finds the page already read. No fabricated events, no "upcoming" strip.

## 4. Budgets

A row: name, scope ("All spending" or "Category: name"), period, a state chip in words, a progress bar with the backend's percentage, and spent / limit in the budget's own currency. The page: navy header with the limit and period, a Progress card (spent, remaining, expenses, days left, "not started yet" / "ended" from the backend's flags), notes, and "Changes": a sentence saying editing and archiving are not available in Mobile yet, with a link to the same budget in the full version. No button, no form.

- **Every figure is the backend's `progress` for that budget.** Mobile adds nothing: no remaining, no percentage, no "over by". A negative remaining keeps its sign (U+2212) and is spoken as "minus".
- The state is the backend's progress `status`; `On track` / `Warning` / `Near the limit` / `Over the limit` are labels for `safe` / `warning` / `near_limit` / `exceeded`. An unknown word is "Unknown status: x". A missing state says so.
- A budget with no `progress` (an archived one) says its progress is not available; it never draws an empty bar.
- Lifecycle filter (Active, Archived) and progress filter (All, On track, Warning, Near the limit, Over the limit) are sent to the backend; nothing is filtered in the browser.

## 5. Savings goals

A row: name, target date, lifecycle chip (and the progress chip while active), progress bar with the backend's `percentage_funded`, saved / target. The page: navy header with saved and target, a Progress card (remaining, target date, days left, contributions, achieved on, the goal's savings account), notes, "Changes" ("Adding to or withdrawing from a goal moves money, and Mobile can't do that yet") with a link to the full version.

- **Mobile never decides a goal is achieved.** The lifecycle word and the progress word are shown as sent: a goal whose saved equals its target is still "Active" until the backend says otherwise (a test pins this).
- Status filter: Active (default), Paused, Achieved, Archived. An unknown lifecycle word is shown as sent, never as active or complete.
- Currency: the goal's own `currency_code`; if the goal, its progress and its account disagree, the currency is unavailable and no amount is shown rather than a guess.
- History, contributions and withdrawals are not read (§2).

## 6. Recurring rules

**A rule is not a transaction.** A row is not a ledger row: no posted look, no icon, no sign. Its amount is what it would post, **unsigned**, with the type in words ("Expense · Monthly", "Income · Weekly · repeats every 2"). The page says "This is a rule, not a transaction. Nothing has been posted by viewing it, and it doesn't change any balance."

- The next date is the backend's `next_due_date` (or "No next date"). **Mobile computes no date** from the frequency, interval, start date or end date (month ends, anchor days and end conditions are the backend's rules), and says nothing is overdue.
- No confirm, skip, pause or resume (confirm-next moves money; the others change the schedule). The page says so and links to the rule in the full version.
- Filters: status (Active default, Paused, Completed, Archived) and type (All, Income, Expense). Unknown frequency, type, mode and status words are shown as sent.

## 7. Models and money rules

- Money is the S04B1 layer: decimal strings in the format `^(-?)(\d{1,40})(?:\.(\d{1,4}))?$`, BigInt grouping, Latin digits in both languages, a left-to-right run, spoken in words, **"—" (unavailable) for anything else, never 0**. An amount needs a valid currency to be shown. Currencies are never added together; there is no total anywhere on these screens.
- **Percentages** (`models/planning.js: parsePercent`) are read from the decimal string without converting it to a number: the text keeps at most one decimal and **truncates, never rounds** (99.96 reads "99.9", never "100"); the bar width is made from the same digits and clamped (a negative value is an empty bar, a hundred or more a full one). A percentage that is not a decimal string is unavailable and the row says progress is not available.
- A progress block that names **another budget/goal or another currency** is refused; so is a record page whose response is about another id; a page whose paginator numbers disagree, with a row without an id or a repeated id, is refused whole.
- States (`readState`): the word as sent, plus whether it is one of the known words. **An unknown word is never mapped to a known one**: it is shown as "Unknown status: x".
- The tests that scan source for floats still apply (`Number(`, `parseFloat`, `toFixed`, `toLocaleString`, `Math.round|floor|trunc` in model and amount code): the new code passes them with no exception added.

## 8. Smart Savings flag

Smart Savings is unreleased. **Off (the default and the production setting):** a goal's page has no plan section, makes no plan request, and the plan code and strings are **not in the built Mobile chunk** (`tests/mobileBundle.test.mjs` searches the bundle). **On** (`VITE_SMART_SAVINGS_ENABLED=true`, a local build only): a read-only "Smart Savings plan" section loads as its own lazy chunk (4.2 kB), shows the next planned contribution (date and amount), and says in words "Overdue", "Plan review suggested" or "Can't be confirmed right now" when the backend says so.

- The flag rule is written out in `planning/smartSavingsGate.js` (exactly `"true"`), because Mobile imports nothing from the full version's `features` folder; a test asserts it always agrees with the full version's constant.
- The plan is shown **only when it is an active plan of this goal** (`buildPlanSummary`); another goal's or another state's plan is refused inside the section and the rest of the page stands. A goal with no plan answers 404, which is **"This goal has no Smart Savings plan"**, not an error. An archived goal makes no plan request.
- **No confirm, postpone, skip, funding preview, create or revise**: no control at all in the section, a sentence saying they are only in the full version, and a link to the plan in the full version. Only `GET …/plan` is requested (tested).
- The read lives in `data/readPlanApi.js`, away from the main facade, and its strings in `planning/smartPlanMessages.js`, registered when the section loads; the flag-on tests run in a child process with the flag on (`SMARTSPEND_TEST_SMART_SAVINGS=true`, read by `tests/helpers/loader.mjs`).

## 9. Routes and canonical behaviour

| Address | Mobile mode | Desktop mode |
|---|---|---|
| `/m/planning` | overview | → `/dashboard/budgets` |
| `/m/planning/budgets[?filters]`, `/{id}` | list, record | → `/dashboard/budgets[…]`, `/dashboard/budgets/{id}` (query and hash kept) |
| `/m/planning/goals[…]`, `/{id}` | list, record | → `/dashboard/savings-goals[…]`, `/dashboard/savings-goals/{id}` |
| `/m/planning/recurring[…]`, `/{id}` | list, record | → `/dashboard/recurring[…]`, `/dashboard/recurring/{id}` |
| `/m/planning/budgets/abc`, `/007`, `/7/x`, `/m/planning/debts` | "not available", **no request** | → `/dashboard` |
| `/dashboard/budgets`, `/dashboard/savings-goals`, their pages, `?new=1`, the smart-plan pages, `/dashboard/recurring`, `/dashboard/debts`, `/dashboard/calendar`, `/dashboard/categories`, `/dashboard/reports` | **stay Desktop** | stay |

Desktop's Budgets, Savings goals and Recurring pages create, edit, contribute, confirm and skip, so they are **never** redirected to read-only Mobile, in any mode (resolver tests, and in a real browser: the Mobile chunk is not even requested for them). `fromCanonical` stays false for Planning. There is no loop: a Desktop-mode result is never a Mobile address and resolving it again changes nothing. Links on Planning pages go only to Mobile Planning pages or to the full version (a test collects every `href`). Signed email links and auth pages are untouched.

Navigation: overview → list → record → Back to the same list with its filter and as many pages as were open (router state, not storage); "Back" only follows a Mobile address from history state. The Planning destination is current on the overview and every page inside it.

## 10. Identity and privacy

Reuses the S04B1 `IdentityBoundary` unchanged; no change to the shared AuthProvider. `mobilePlanningIdentity.test.mjs`: for each of the six lists/pages another tab signing in as B removes everything at once and B's token is never used; another tab signing out removes the overview's counts and alerts and requests nothing more; a list request, a later page, and a record request in flight when the identity changes (the answer is never shown); a new session in the same tab starts from nothing (B never sees A's cache). The browser run repeated switch, sign-out and an unrelated key with two real tabs for the overview, a list, a goal and a rule. The "hide amounts" preference of the full app applies to every Planning amount (read-only, never rewritten; tested on four screens and in the browser).

Limit unchanged: Desktop's AuthProvider still has no cross-tab listener (not touched, needs separate approval). The filters live in the address and survive a session change in the same tab; no record does.

## 11. Read-only enforcement

- The facade exports reads only (the test lists the exact exports); `data/readPlanApi.js` exports one read. The source scan was **narrowed, not loosened**: the budget, goal, plan and recurring wrappers may be imported **only** by those two files (a test asserts the exact set), and every write name, `method:`/`body:`, idempotency, `fetch`/XHR/beacon, float conversion and shared money helper is still refused everywhere. Debts, plannedSavings, transfers, imports, AI, WhatsApp, calendar, notifications and auth wrappers are still forbidden imports.
- The fake backend throws on any non-GET at once and traps XHR, beacon, WebSocket and EventSource. Every Planning screen was loaded and made GET requests only; no confirm, skip, pause, resume, occurrences, funding or plan-options path is touched (tests check the paths).
- The record pages have **no button and no form**: a sentence saying what Mobile cannot do and a link to the same record in the full version.

## 12. Visual design

Calm Financial Clarity in the existing scoped system (`.sm-root`, Cairo/Tajawal, navy `#07142B` / blue `#2563EB` / cyan `#22C3EE`, light and dark): a navy header card on each record, flat rows inside one surface on the lists, a thin progress bar with the percentage as text beside it, state chips that carry their meaning in words (blue "calm", amber "warn", red "over the limit", neutral; **nothing is green**). The overview is grouped, not a stack of identical cards. No chart, no invented total or event. Selectors stay under `.sm-root`; nothing from Desktop is imported (the flag file is not imported either: §8). **S03.5 parity is not claimed**: the Planning renders in `smartspend-design-preview` were compared by eye (alert banner first, a Plan group, a Tools group); a review package of 31 renders is prepared outside the repository for the product owner.

## 13. RTL/LTR and accessibility results

Headless Chrome with touch emulation, a mock API with fictional data (37 budgets including an over-limit one, an unknown state, an archived one, a 123,456,789,012,345.6789 limit and long Arabic and Latin names; goals in every lifecycle; 25 rules), **387 jobs / 378 Mobile renders** (plus 8 renders with Smart Savings on): the overview at 320/360/390/430 px, English and Arabic, light and dark; the three lists at the same sizes; 24 kinds of record page at 320 and 390 px in both languages and themes; filtered lists and "Load more"; empty, error, loading, not-found, goal-list-failing, no-alerts and hidden-amount states; enlarged text at **1.25×, 1.5× and 2×** (root 20, 24, 32 px) for the overview, budgets, and a budget, a goal and a rule page at 320 and 390 px; overview → list → Back; real two-tab identity runs; the routing cases.

| Check | Result |
|---|---|
| JavaScript errors | **0** |
| Horizontal page scroll, any element past the viewport edge | **0** |
| Clipped amounts | **0** |
| Targets under 44 px | **0** |
| Headings | one `h1`, nothing deeper than `h2`, every render |
| Compact bar (Menu + Add) | 50 renders (17rem or enlarged text) |
| API calls | 1,322 across the run, **all GET** |
| RTL | right-to-left page and mirrored bar; chevrons follow the reading direction, "Back" points the other way; amounts stay one left-to-right run with Latin digits; Latin names inside Arabic rows and Arabic names in English rows are isolated; long names wrap and are never cut |
| Screen-reader text | each amount is spoken in words ("minus 120.00 Israeli New Shekel"); each percentage is spoken ("124 percent of the limit used"); the decorative bar is hidden; **checked in jsdom, not with VoiceOver or TalkBack** |

One defect found by looking at the screenshots and fixed: at **2× text on a 320 px screen the filter button "Archived" broke inside the word** ("Archive / d"). The filter cards had too much padding for the width left; their padding was reduced and the wrap rule changed to break between words only; the 82 affected renders were re-run clean. **Not claimed:** WCAG 2.2 AA conformance (automated checks and jsdom do not establish it), real-device or real-assistive-technology behaviour.

## 14. Test counts

| Suite | Tests |
|---|---|
| New: `mobilePlanningModels` (percentages, pages, budgets, goals, rules, plan summary) | 24 |
| New: `mobilePlanning` (overview, lists, record pages, states, filters, paging, Arabic, hidden amounts, read-only) | 37 |
| New: `mobilePlanningIdentity` | 11 |
| New: `mobilePlanningRouting` (canonical safety, no loops, links) | 10 |
| New: `mobileSavings` (flag off in the run itself; flag on in a child process: 8 more) | 3 (+8) |
| Extended: bundle (+2, with a third build for Smart Savings), resolver, read-only, shell, screens | |
| **`npm test`** | **1358 / 1358** (1271 before), about 57 s; lint clean |

The `experienceRendering` instability from S04B1 **did not recur** in the full runs of this phase, which proves nothing about its cause: it stays **PARTIAL** (see S04B2 §12). Runs were sequential, with no other build or browser run active.

## 15. Desktop regression evidence

Final flag-off and flag-on builds, 54 jobs each (every signed-out and signed-in route, desktop 1366×900 English light and a 390×844 phone English dark), against two runs of the original baseline build:

- URL, title, language, direction, theme, visible text and DOM are identical in every comparison.
- **Flag on (Desktop presentation) vs flag off: 50 of 54 identical, pixels included.** The other 4 differ only by the same 388-pixel patch at the logo (rows 17–44, columns 17–40, a 50/255 anti-aliasing flip) that the baseline also shows **against itself** (5 of 54 between two baseline runs), plus, on the WhatsApp draft page, 101 pixels of difference of at most 1/255 in one comparison. That page was re-run twice on the baseline, twice on flag off and once on flag on: **the baseline itself produced two different images, flag off and flag on the same one both times**, so this is render noise in the baseline, not a change.
- 0 JavaScript errors; 108 API calls per build, none but GET; the Mobile chunk was not requested by any Desktop page.
- **Desktop Budgets, Savings goals, a recurring rule's page and Debts are not redirected** in Mobile mode, and the Mobile chunk is not requested for them (real browser). A Desktop-mode visit to `/m/planning/budgets?status=archived#x`, `/m/planning/budgets/3?q=1`, `/m/planning/goals/1` and `/m/planning/recurring/1` goes to the matching Desktop page with its query and hash; `/m/planning/budgets/abc` and `/m/planning/debts` in Mobile mode are "not available" with no request; a signed-out visit goes to sign-in.
- **Regression of the earlier Mobile screens against the final build:** S04B2 (Activity, transaction pages, filters; 218 jobs, 211 Mobile renders) and S04B1 (Home, Accounts, identity, flags; 188 jobs, 180 Mobile renders): **0 JavaScript errors, no overflow, no clipped amount, only GET requests (1,400 calls)**. The only targets under 44 px are the three presentation radio inputs on More (24×24 px, each inside a 44 px row), as before.
- Stated plainly, as in S04B1 and S04B2: a Desktop-mode visitor who opens a Mobile address while the session is being restored loads the Mobile chunk once before being redirected.

## 16. Flag-off and flag-on bundle comparison

**Flag off vs the original baseline** (content hashes normalised): 149 of 150 files identical; only the entry chunk differs (413,058 bytes: the resolver and route table). The stylesheet is **byte-identical** to the baseline (`style-CdLHj2cm.css`, 824,885 bytes, same sha-256). No Mobile chunk, no Mobile string in any JS, CSS or HTML file (`tests/mobileBundle.test.mjs` searches 33 strings, now including `sm-progress`, `sm-plan-row`, `sm-plan-link`, "Mobile shows your plan", "These are rules, not transactions", `/m/planning`).

**Flag on:** one lazy `MobileApp` chunk, **147.7 kB (36.9 kB gzip)** (S04B2: 98.2 kB; Planning adds the three API modules, seven screens and the English and Arabic strings), never referenced by `index.html`; entry 418,341 bytes (+5.3 kB over flag off); stylesheet 845,834 bytes with **202 Mobile rules** and every Desktop rule present, unchanged and in the same order (a test asserts it).

**Smart Savings on (Mobile on):** a separate lazy `SmartPlanSection` chunk (4.2 kB). **Smart Savings off:** no `SmartPlanSection` chunk and none of its strings in any Mobile file (tested).

## 17. Canonical routes: what is deliberately not redirected

`/dashboard/budgets`, `/dashboard/savings-goals`, `/dashboard/recurring` and their record pages (and Debts, Calendar, Categories, Reports) are never sent to Mobile: Desktop can write and Mobile cannot. Until there is write parity or an approved fallback, the only Planning entry in Mobile mode is `/m/planning` itself (the bottom navigation, the overview's links).

## 18. Remaining limitations

- **Not verified against the live API.** Every shape in §2 comes from the repo; the screens refuse what does not match, but have not seen real data. Notably unverified: the exact `progress` block in a list row (the Desktop pages read it, so it is expected), `schedule.next_occurrence`'s shape (not used), and whether `next_due_date` is a date-only value.
- **No write of any kind** (that is the point); Debts, Calendar, Categories and Reports are links.
- A rule's **overdue** state and **occurrences** are not shown (§6).
- No goal history, no installment view, no plan creation/revision, no budget creation, no summary across currencies.
- The overview needs five reads (alerts and four first pages): the backend has no count endpoint, so a count is a page's `total`.
- **Desktop AuthProvider** still has no cross-tab guard (separate approval needed); Mobile protects Mobile only. **S04B1's PARTIAL** (test instability) and the S04A/S04B1/S04B2 production blockers (workflow guard only on this unmerged branch, stale `/m` bookmarks, no live-API verification, no real-device accessibility testing) are unchanged and **not resolved here**.
- Add is still informational; More is a different page from Desktop Settings.

## 19. Next recommended slice

**S04C: the first Mobile write**, chosen with the product owner, on the same pieces (facade, money layer, identity boundary, idempotent attempts): the smallest money-moving action with the clearest recovery (for example recording one expense) rather than any Planning write, because Planning writes (contribute, confirm-next, plan revision) depend on idempotency, version conflicts and previews that the full version has spent a long time getting right. Before any production use of Mobile, and independent of it: approval for a `storage` listener in the Desktop `AuthProvider`, a live-API check of the Home, Accounts, Activity and Planning shapes, and a real-device accessibility pass. Still no service worker, manifest or offline financial cache until a write path exists to design them against.
