# Mobile — feature coverage matrix

**Real backend evidence is "none" in every row:** no backend repository or isolated backend was available. "Browser" means real headless Chrome with fictional mocked data, not a physical device; device verification is pending in every row.

Column key:
- **UI:** the Mobile screens for the feature.
- **GET:** whether its reads are integrated.
- **Write:** what happens to its writes on Mobile.
- **Gate:** the safety gate that applies.
- **Tests:** the automated test files that cover it.
- **Browser:** real-browser evidence. A sprint name (S04B1–S04B4.1) means earlier sprints; "this pass" means the 114-job Mobile matrix (390/320/430 px, English and Arabic, light and dark, 1.25×/1.5×/2× text, empty and error states) or the two-tab run.

| ID | Feature | UI | GET | Write | Gate | Tests | Browser | Status |
|---|---|---|---|---|---|---|---|---|
| P01 | Sign in / Google | shared Desktop pages | — | — | — | auth suites | two-tab run (sign-in elsewhere) | Not applicable to Mobile (shared pages) |
| P02 | Register | shared | — | — | — | auth suites | — | Not applicable to Mobile |
| P03 | Forgot / reset password | shared | — | — | — | auth suites | — | Not applicable to Mobile |
| P04 | Email verification | shared banner and pages | — | — | — | auth suites | — | Partially implemented (no Mobile banner) |
| P05 | Logout / session expiry | identity boundary, cross-tab fix | — | — | — | mobileIdentity, authCrossTab | two-tab run, Desktop and Mobile | Implemented and tested with mocks |
| P06 | Profile, password | link to the full version | — | none | — | — | — | Partially implemented |
| P07 | Theme, language | More | — | local | — | mobileScreens | S04B1–S04B4.1, this pass | Implemented and tested with mocks |
| P08 | Dashboard summary, periods | `/m` | yes | — | — | mobileScreens | this pass | Partially implemented (no period picker) |
| P09 | Attention, alerts | Home, Planning | yes | — | — | mobilePlanning | earlier sprints | Read-only complete with mocked contract |
| P10 | Monthly review, templates | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P11 | Accounts create / edit / archive | `/m/accounts` | yes | no code | write gate | mobileScreens | this pass | Partially implemented (read only) |
| P12 | Account details, movements | `/m/accounts/:id` | yes | — | — | mobileScreens | earlier sprints | Read-only complete with mocked contract (no statement PDF) |
| P13 | History, filters | `/m/activity` | yes | — | — | mobileActivity | this pass | Read-only complete with mocked contract |
| P14 | Expense / income | Add sheet (informational) | — | no code | write gate | — | — | Blocked by backend; form not built |
| P15 | Correct / reverse transaction | detail (read) | yes | no code | write gate | mobileTransaction | earlier sprints | Blocked by backend; forms not built |
| P16 | Receipt capture | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P17 | Voice capture | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P18 | Transfers | `/m/transfers`, `/m/transfers/:id` | yes | no code | notice | mobileMoreScreens | this pass | Read-only complete with mocked contract; writes blocked by backend |
| P19 | Categories | `/m/planning/categories…` | yes | code exists | **closed** | mobileCategories, mobileWriteGate | this pass | UI complete, write disabled |
| P20 | Budgets | `/m/planning/budgets…` | yes | no code | — | mobilePlanning | earlier sprints | Read-only complete with mocked contract |
| P21 | Savings goals | `/m/planning/goals…` | yes | no code | — | mobilePlanning | earlier sprints | Read-only complete with mocked contract; writes blocked |
| P22 | Smart plans | goal page (flagged) | yes | no code | — | mobileSavings | earlier sprints | Read-only complete with mocked contract (behind its flag) |
| P23 | Planned contributions | — | — | — | — | — | — | Blocked by backend |
| P24 | Debts | `/m/planning/debts…` | yes | no code | notice | mobileMoreScreens | this pass | Read-only complete with mocked contract; writes blocked |
| P25 | Recurring rules | `/m/planning/recurring…` | yes | no code | — | mobilePlanning | earlier sprints | Read-only complete with mocked contract |
| P26 | Calendar | `/m/planning/calendar` | yes | — | — | mobileMoreScreens | this pass | Read-only complete with mocked contract |
| P27 | Reports (ten) | `/m/reports`, `/m/reports/:type` | yes | — | — | mobileReports | this pass (all ten) | Read-only complete with mocked contract (summaries and documented items; no trend charts) |
| P28 | PDF export | — | — | — | — | — | — | Partially implemented (full version only) |
| P29 | CSV / Excel exports | `/m/exports` | yes, and download | create and cancel: no code | — | mobileReports | this pass | Partially implemented |
| P30 | AI assistant | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P31 | AI privacy settings | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P32 | AI capture review | — | — | — | — | — | — | Blocked by backend |
| P33 | Imports | `/m/imports`, `/m/imports/:id` | yes | no code | notice | mobileReports | this pass | Partially implemented (history and status only) |
| P34 | WhatsApp linking | — | — | — | — | — | — | Blocked by product decision (consent and legal) |
| P35 | WhatsApp drafts | — | — | — | — | — | — | Blocked by backend and product decision |
| P36 | Notifications | `/m/notifications` | yes | mark-read: no code | — | mobileMoreScreens | this pass | Read-only complete with mocked contract |
| P37 | Search | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| P38 | Display prefs, hide amounts | More, money privacy | — | local | — | mobileMoney | earlier sprints | Implemented and tested with mocks |
| P39 | Company sign-in | — | — | — | — | — | — | Not applicable (excluded) |
| X1 | Welcome dialog | shared | — | — | — | — | — | Not applicable to Mobile |
| X2 | Policy consent | shared | — | — | — | — | — | Not applicable to Mobile |
| X3 | Dashboard blocks | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| X4 | Savings reminder preference | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| X5 | Public and legal content | shared public pages | — | — | — | — | — | Not applicable to Mobile |
| X6 | Account statement PDF | — | — | — | — | — | — | Partially implemented (full version) |
| X7 | Saved report filters | — | — | — | — | — | — | Partially implemented (not on Mobile) |
| — | PWA (local and staging) | offline and update notices, install card | — | none | production refusal; `/m/` scope | mobilePwa, mobileBundle | this pass (lifecycle in Chrome) | Implemented and tested locally; device verification pending |

## Still open, and could be built without the backend

Each item below is UI or GET work that needs no server evidence. It was not done in this pass.

| Item | What is missing |
|---|---|
| P14, P15, P11, P20, P21, P24, P25 | Entry, review and simulated-result forms with the write gate closed |
| P30, P31 | AI insights, forecast and conversation-history reads |
| P16, P17 | Voice and receipt history reads, and their capture UIs |
| P34, P35 | WhatsApp status and draft reads |
| P06 | Profile display |
| P08 | Period picker |
| P37 | Search |
| P10 | Monthly review and templates |
| X3, X7 | Dashboard blocks, saved report filters |
| X4 | Notification preference read |
| P04 | Email-verification banner |
