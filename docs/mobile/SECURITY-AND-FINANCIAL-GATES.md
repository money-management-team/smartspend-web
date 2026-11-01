# Mobile — security and financial gates

## 1. The write gate (`src/mobile/data/writeGate.js`)

Every write Mobile has code for is listed in `MOBILE_WRITES`. A write may be sent only if its name is in `APPROVED`, which is an empty frozen array. No environment variable, storage key, URL parameter or global can open a write. Opening one is a visible source change, and the commit must cite the server-side evidence from section 3.

| Write | Endpoint | Server dedup | State |
|---|---|---|---|
| `category.create` | `POST /categories` | unverified | **closed** |
| `category.update` | `PATCH /categories/{id}` | unverified | **closed** |

The write facade (`data/writeApi.js`) checks the gate before calling the wrapper. If the write is closed, it throws `WriteClosedError` and no request is made. `classifyOutcome` maps that error to `rejected / WRITE_CLOSED`, meaning certainly not applied.

The screens never offer a closed write. The category list, a category's page and both form addresses show `WriteClosedNotice`, which links to the full version. The form addresses render no form and make no request.

### The forms (unblocked-feature pass)

Mobile now has a form for every change the full version makes that has a documented field list: 30 forms in `src/mobile/forms/workflows.js` (entries, corrections, reversals, accounts, budgets, goals and contributions, planned contributions, recurring rules and their confirm and skip, debts and payments, payment reversal, exports, receipt, voice and WhatsApp reviews, profile and password). Each validates against the documented rules, shows a review, and **ends at a send button that is disabled for good**:

- No file in `src/mobile/forms/` has request code, names an API wrapper, imports the write facade or touches storage (`tests/mobileForms.test.mjs`).
- None of the 30 operation names is in `MOBILE_WRITES`, so the gate answers "closed" for every one (`tests/mobileForms.test.mjs`). Opening one would need a reviewed send path, which does not exist, plus the evidence in section 3.
- Tested bypass attempts, all with the strict fake backend that fails on any non-GET: clicking the disabled button, removing `disabled` and clicking, Enter on it, `submit` on every form of the page, the browser's Back while a draft exists, another person signing in mid-draft (the draft is gone; it is in no storage).
- The other new controls that would write (the assistant's Send, receipt and voice upload, statement upload, WhatsApp disconnect, the notification preference's Save) are disabled buttons with no handler, next to a note saying nothing was sent.

Mobile has no code at all for any write but the two closed category writes. The PWA (PWA-AND-DEVICE-QA.md) queues nothing and caches no API answer.

### Closure pass: more reviews, still nothing sent

Added, all ending at a disabled button with no handler, next to a note that nothing was sent:
- Smart Savings: confirm, postpone and skip reviews of an open installment (the confirm review shows the backend's preview: amount, accounts that can pay, blocker, versions), and plan options with "Start this plan" disabled. Reviewing changes nothing about the installment.
- AI: feedback on answers and insights; the delete-conversation review (the conversation is not removed).
- Notifications: Mark as read and Mark all as read; the unread count is the server's and never changes optimistically.

New GETs: `GET …/plan-options` and `GET …/confirmation-preview` in the flag-only plan facade, and `GET /notifications/unread-count`. The guard tests pin every wrapper method each facade calls.

### Sign-in on Mobile

`/m/signin` and `/m/register` call the app's own AuthProvider (`login`, `register`). Mobile builds no request and stores no token: the provider makes the same calls, stores the session in the same keys and keeps the cross-tab protection of §4. This is the existing shared sign-in, not a financial write, and nothing in the write gate changes. One request per tap; nothing is retried. The return address is checked with the app's `getSafeRedirectPath` and must be a Mobile page other than sign-in or registration (no loop).

### How sign-in is tested (reconciling "GET only" with sign-in)

The earlier statement "every Mobile request is a GET" is about **Mobile's own code and the financial API**. It does not cover the shared sign-in contract, which is a set of POSTs made by the AuthProvider.

1. **Flows tested:**
   - email/phone and password sign-in: success, empty fields, refused 401;
   - registration: client checks, a server refusal, success going on to Profile (email status);
   - Google sign-in: credential, consent required then accepted or cancelled, failure, Google not loading or not configured;
   - the redirect after sign-in;
   - signed-out visits sent to `/m/signin`;
   - a signed-in visitor kept away from sign-in.
2. **Mocked at provider level:** in `tests/mobileAuthAndTrends.test.mjs` and the Google tests of `tests/mobileDecisions.test.mjs`, `login`, `register` and `loginWithGoogle` are fakes in the AuthContext. Those tests prove what the page calls, with which arguments, and where it goes after.
3. **Real HTTP dispatch:** in `tests/mobileDecisions.test.mjs`, "through the REAL AuthProvider", the app's real provider runs against a fake server.
   - Sign-in sends `POST /login` then `GET /user`. Registration sends `POST /register` with the full version's six fields.
   - No other non-GET request is made, and the session lands in the provider's usual key.
   - A 401 is shown, not retried, and stores nothing.
   - This test found and fixed a real defect: a successful registration skipped Profile.
4. **Permitted by the auth contract:** these are the existing shared auth requests (`authApi.login`, `register`, `loginWithGoogle`), used the same way by the full version. Mobile code does not build them; it calls the provider.
5. **Separate from the financial write gate:** yes. The gate lists financial and record writes only. Sign-in is not in it and is not affected by it. The guard tests (`tests/mobileReadOnly.test.mjs`) still find no request code, no `method:`, no `POST` string and no API wrapper import in Mobile outside the read facades.
6. **Redirect safety after sign-in:** tested (`mobileDestination`). Only a Mobile address that the app's `getSafeRedirectPath` accepts; never `/m/signin` or `/m/register`; `//host` and Desktop addresses fall back to `/m`. Google uses the full version's `getPostAuthPath`, and the presentation rules send `/dashboard` to Mobile Home.
7. **Registration errors and email verification:** client errors, a server refusal and success are tested. Profile's email status (verified, unverified, unknown, "Check again") is tested in `tests/mobileAssist.test.mjs`. The emailed link itself is the full version's page and is unchanged.
8. **Google:** only mocked coverage, with a fake Google Identity loader and a fake or real provider. **No real Google OAuth was exercised**, and none is claimed.

### Backend verification (2026-11-01)

The backend source was audited and tested locally (BACKEND-VERIFICATION-RESULTS.md). **The gate is unchanged:** `APPROVED` is still empty, and no write was opened, not even the two category writes the backend handles safely.

One Mobile change followed from the source: a category create refused 422 as a duplicate may be the second copy of a request whose first copy created the category (`CreateCategoryAction` refuses a duplicate and the losing side of a race identically). After such a refusal Mobile now drops its cached category list, so the next view reads the server, and the wording no longer says that nothing was saved, only that this request saved nothing (`useCategoryMutation.js`, `tests/mobileCategories.test.mjs`).

### Device storage

Mobile writes to browser storage in two places (`tests/mobileReadOnly.test.mjs`):
- `presentation/preference.js`: the one presentation word, as before;
- `preferences/deviceStore.js`: Mobile's own choices (Home layout, saved filters, quick-entry templates), under a key naming the person and the workspace. Only what the person chose or typed is kept; no token, no response, no draft. Unwritable storage leaves the choices working for the visit only.

Mobile also changes one value of the full version's own preference store: `hiddenMoney` (hide amounts), in `money/MoneyPrivacy.jsx` only.

## 2. Why the gate exists: the browser can send a write twice

This was reproduced locally with Chrome 156.0.8078.48 (headless, Windows) and Node 24 servers. The page called `fetch` once per case, confirmed with a page-level counter. DevTools reported one `requestWillBeSent` per case. Every arrival at the server was counted by a per-attempt nonce in the body. Each case ran 3 times, with the same result every time.

| Protocol | Server response | Arrivals at server (POST / PATCH) |
|---|---|---|
| HTTP/1.1 | 408 (keep-alive) | 3 / 2 |
| HTTP/1.1 | 408 + `Connection: close`, after 500 ms, empty body, JSON body | 2 / 2 |
| HTTP/1.1 | **408 first, then 201** | 2 / 2. The page saw a single 201. |
| HTTP/1.1 | socket destroyed after the body was read | 2 / 2. The page saw a network error. |
| HTTP/1.1 | 201, 409, 422, 429, 500, 503, 504 | 1 |
| HTTP/2 (TLS) | every case above | 1 |

What the evidence shows:
- On HTTP/1.1, Chrome itself resends a non-idempotent request each time, on a new socket and with the same body:
  - after a 408;
  - after a reused connection drops once the server has read the body.
- The server receives the full body each time, so it can commit each time.
- A client can see one success while the server processed two writes.
- No page code can prevent this.

**Hypothesis, not verified:** this is Chromium's documented retry-on-reused-socket and 408 behaviour. It is not known whether production runs HTTP/1.1 or HTTP/2 end to end, through Hostinger and Laravel Cloud.

The earlier S04B4.1 run recorded 7 arrivals. This one recorded 2–3. The count is not stable and must not be treated as a fixed number.

Desktop is exposed the same way. Its money writes send an `Idempotency-Key`, but the server's handling of that key is unverified. Its category writes send no key.

## 3. What opens a write

Opening a write needs:
1. **Server-side deduplication evidence** from the backend source and a staging test:
   - an `Idempotency-Key` the server stores and replays, scoped per user and with a defined retention;
   - or a uniqueness constraint that makes a repeat a no-op or a 409 without a second effect.
2. **Proof that proxies and the app server never answer 408** after accepting the body, or that the write is idempotent anyway.
3. **For money writes:** atomic ledger posting, and one-time reversal enforcement in the database (not only in application code).
4. **Mobile tests** for the key lifecycle:
   - the same key is reused for an unknown outcome;
   - a new key is used only after a definitive rejection;
   - no key or payload is persisted.

The open questions are listed in [BACKEND-CONTRACT-GAPS.md](BACKEND-CONTRACT-GAPS.md).

## 4. Shared authentication: cross-tab identity (shared change)

**The problem.** `apiRequest` reads the token from storage on every call, so another tab's sign-in changes the token this tab sends. Before the fix, in a real browser on the pre-fix build (`eff8fff`):
- A sign-in as user B in another tab left this tab showing user A, while its next requests would carry B's token.
- A sign-out in another tab left `/dashboard` showing user A, with no token behind it.

Mobile's own identity boundary already blanked its screens; Desktop had no such protection.

**Why a Mobile-only fix is not enough.** Every Desktop page reads the shared provider.

**The change.** Two commits, both in `src/contexts/auth/` (provider plus `crossTabSession.js`):

`9fe88c7`:
- The provider listens for `storage` events and for bfcache `pageshow`.
- **Signed out elsewhere:** this tab signs out. No logout request is sent, because the other tab did that.
- **Another token, or a different workspace id:**
  - this tab adopts the stored session and marks itself initializing, so the guards show Loading;
  - it re-reads `GET /user`;
  - it remounts everything under the provider (`key={generation}`).
- **Ignored:** a profile edit (same token), the same workspace written again, and unrelated keys.

`355ee62`, found by the browser check:
- After another tab's workspace switch, the re-read of `GET /user` was writing the server's workspace back to shared storage. That undid the other tab's choice and made it re-read too.
- A workspace-only switch now confirms the person and leaves the stored workspace alone.

### Automated tests

`tests/authCrossTab.test.mjs` has 9 tests against the real provider in jsdom. The full suite, with every Desktop auth, redirect and page test, passes 1,508 of 1,508.

### Real two-tab browser check

Setup:
- Headless Chrome 156, flag-on build at `355ee62`, fictional users A and B.
- A real second tab on the same origin changes `localStorage`, exactly as a sign-in or sign-out there does.
- The page's `fetch` was wrapped to record, at the moment of each request, its token and whether the screen showed A or B.
- Harness: scratchpad `shoot8.mjs`; results in `xtab-final_on3`.

| Scenario | Desktop (`/dashboard`, `/dashboard/accounts`) | Mobile (`/m`, `/m/accounts`) |
|---|---|---|
| Another tab signs in as B | A's screen is gone before B's first request. Then `GET /user` with B and Blake is shown. **0 requests with B's token while A was visible**; 0 requests with A's token after B's first. | same |
| Another tab signs out | Goes to `/signin`; no further request | same |
| Another tab switches workspace | Remount; `GET /user` re-read with A's token; stays A; the other tab's workspace kept | same |
| Unrelated key (theme) | Nothing happens | same |
| B signs in while A's slow request (4 s) is in flight | A's late answer never appears; 0 B-while-A | same, on `/m/activity` |
| JavaScript errors, writes | 0, 0 | 0, 0 |

To guard against an empty log hiding problems: the fetch log held 6, 4 and 9 B-token requests in three sample jobs, and none of them happened while A was shown.

**Re-run on the final build of the unblocked-feature pass** (`xtab-fin`, the same 18 jobs, Desktop and Mobile): every result is unchanged. There were 0 requests with B's token while A was on screen (the log held 3–9 B-token requests per switch job). Sign-out goes to `/signin`. A workspace switch and the theme key keep A. 0 errors, 0 writes.

### Not covered

- **`sessionStorage`-only sessions in other tabs:** browsers send no cross-tab events for them, and they cannot change this tab's token.
- **Google sign-in:** its lifecycle was not exercised in a browser; it needs Google's script, and all external hosts are blocked.
- **Blocked storage:** covered by the existing provider code, which treats unreadable storage as no token, not by a browser run.
- **Signed email links:** the reset and verify pages sit outside the provider's guarded routes. They were not re-run in the browser in this pass.

## 5. Financial integrity rules (unchanged, enforced by tests)

- Every figure is the backend's: balances, remaining amounts, statuses, report figures and percentages.
- There is no float arithmetic on money, and the guard test forbids `parseFloat`, `Number(` and `toFixed`. Report bar lengths are integer percentages computed with BigInt from the decimal strings.
- A missing or invalid amount shows as "Not available", never as 0.
- Currencies are never added together. Reports show one section per currency, and an event amount with no currency is shown as sent.
- A queued export is never shown as a file. Download appears only when `download_available` is true.
- An import in `confirmed` or `processing` is never shown as finished.
- An answer about a record other than the one in the address is refused: debts, transfers, imports and reports.
- Downloads are discarded if the identity changed before the file arrived.
