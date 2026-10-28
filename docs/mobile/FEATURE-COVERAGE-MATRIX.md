# Mobile — feature coverage matrix

Status values:
- Complete and verified
- Implemented with mocked contract
- UI complete, write safely disabled
- Partially implemented
- Blocked by backend
- Blocked by product decision
- Not applicable

"Mocked contract" means tested against a fake backend shaped like `docs/`. **No row is backend-verified**, because no backend was available (see BACKEND-CONTRACT-GAPS.md). No row is verified on a physical device.

Column key:
- **Screens:** the Mobile routes for the feature.
- **GET:** whether its reads are integrated.
- **Write:** what happens to its writes on Mobile.
- **Gate:** the write-gate state.
- **Tests:** the test files that cover it.
- **Visual:** whether it was reviewed in a real browser in this sprint.

| ID | Feature | Screens | GET | Write | Gate | Tests | Visual | Status |
|---|---|---|---|---|---|---|---|---|
| P01 | Sign in / Google | Desktop auth pages (shared) | — | — | — | auth suites | earlier sprints | Not applicable to Mobile (shared pages) |
| P02 | Register | shared | — | — | — | auth suites | — | Not applicable to Mobile (shared pages) |
| P03 | Forgot / reset password | shared | — | — | — | auth suites | — | Not applicable to Mobile (shared pages) |
| P04 | Email verification | shared banner and pages | — | — | — | auth suites | — | Partially implemented (no Mobile banner) |
| P05 | Logout / session expiry | identity boundary, cross-tab fix | — | — | — | mobileIdentity, authCrossTab | earlier | Implemented with mocked contract |
| P06 | Profile, password | link to full version | — | none | — | — | — | Partially implemented |
| P07 | Theme, language | More | — | local only | — | mobileScreens | earlier | Complete (browser-checked in S04B1–S04B4.1) |
| P08 | Dashboard summary, periods | `/m` | yes | — | — | mobileScreens | earlier | Partially implemented (no period picker) |
| P09 | Attention, alerts | Home, Planning | yes | — | — | mobilePlanning | earlier | Implemented with mocked contract |
| P10 | Monthly review, templates | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P11 | Accounts create / edit / archive | `/m/accounts` (read) | yes | no code | n/a | mobileScreens | earlier | Partially implemented (read-only) |
| P12 | Account details, movements | `/m/accounts/:id` | yes | — | — | mobileScreens | earlier | Implemented with mocked contract (statement PDF not on Mobile) |
| P13 | History, filters | `/m/activity` | yes | — | — | mobileActivity | earlier | Implemented with mocked contract |
| P14 | Expense / income | Add sheet (informational) | — | no code | closed by design | — | — | Blocked by backend (dedup unverified) |
| P15 | Correct / reverse transaction | detail (read) | yes | no code | — | mobileTransaction | earlier | Blocked by backend |
| P16 | Receipt capture | — | — | — | — | — | — | Blocked by backend (writes, source preview has no signed URL) |
| P17 | Voice capture | — | — | — | — | — | — | Blocked by backend (writes) |
| P18 | Transfers create / details / reverse | `/m/transfers`, `/m/transfers/:id` | yes | no code | notice | mobileMoreScreens | not in this sprint | Implemented with mocked contract (read); writes blocked by backend |
| P19 | Categories | `/m/planning/categories…` | yes | code exists | **closed** | mobileCategories, mobileWriteGate | S04B4.1 | UI complete, write safely disabled |
| P20 | Budgets | `/m/planning/budgets…` | yes | no code | — | mobilePlanning | earlier | Implemented with mocked contract (read) |
| P21 | Savings goals, contribute, withdraw | `/m/planning/goals…` | yes | no code | — | mobilePlanning | earlier | Implemented with mocked contract (read); writes blocked |
| P22 | Smart plans | goal page (flagged) | yes | no code | — | mobileSavings | earlier | Implemented with mocked contract (read, behind flag) |
| P23 | Planned contributions | — | — | — | — | — | — | Blocked by backend |
| P24 | Debts, payments, reversal | `/m/planning/debts…` | yes | no code | notice | mobileMoreScreens | not in this sprint | Implemented with mocked contract (read); writes blocked |
| P25 | Recurring rules | `/m/planning/recurring…` | yes | no code | — | mobilePlanning | earlier | Implemented with mocked contract (read) |
| P26 | Calendar | `/m/planning/calendar` | yes | — | — | mobileMoreScreens | not in this sprint | Implemented with mocked contract |
| P27 | Reports (ten types) | `/m/reports`, `/m/reports/:type` | yes | — | — | mobileReports | not in this sprint | Implemented with mocked contract (summaries, documented items; no trend charts) |
| P28 | PDF export | — | — | — | — | — | — | Partially implemented (full version only) |
| P29 | CSV / Excel exports | `/m/exports` (history, download) | yes | create and cancel: no code | — | mobileReports | not in this sprint | Partially implemented |
| P30 | AI assistant, insights, forecast | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P31 | AI privacy settings | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P32 | AI capture review / confirm | — | — | — | — | — | — | Blocked by backend |
| P33 | Imports | `/m/imports`, `/m/imports/:id` | yes | no code | notice | mobileReports | not in this sprint | Partially implemented (history and status read-only) |
| P34 | WhatsApp linking | — | — | — | — | — | — | Blocked by product decision (consent and legal pending) |
| P35 | WhatsApp drafts | — | — | — | — | — | — | Blocked by backend and product |
| P36 | Notifications | `/m/notifications` | yes | mark-read: no code | — | mobileMoreScreens | not in this sprint | Implemented with mocked contract (read) |
| P37 | Dashboard search | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P38 | Display prefs, hide amounts | More, money privacy | — | local | — | mobileMoney | earlier | Implemented with mocked contract |
| P39 | Company sign-in / register | — | — | — | — | — | — | Not applicable (excluded) |
| X1 | Welcome dialog | shared | — | — | — | — | — | Not applicable to Mobile (shared) |
| X2 | Policy consent | shared register | — | — | — | — | — | Not applicable to Mobile (shared) |
| X3 | Dashboard blocks | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| X4 | Savings reminder preference | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| X5 | Public and legal content | shared public pages | — | — | — | — | — | Not applicable to Mobile (shared) |
| X6 | Account statement PDF | — | — | — | — | — | — | Partially implemented (full version) |
| X7 | Saved report filters | — | — | — | — | — | — | Partially implemented (not on Mobile) |

## Summary

- **New in this sprint**, read-only with mocked contracts: debts, transfers, notifications, calendar, the ten reports, export history and download, imports history and status.
- **Every write is closed**, or has no Mobile code at all.
- **Not started on Mobile:** AI, WhatsApp, profile and password editing, the Home period picker, search, monthly review, templates, saved report filters, dashboard blocks and the PWA.
