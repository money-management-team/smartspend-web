# Mobile — security and financial gates

## 1. The write gate (`src/mobile/data/writeGate.js`)

Every write Mobile has code for is listed in `MOBILE_WRITES`. A write may be sent only if its name is in `APPROVED`, which is an empty frozen array. No environment variable, storage key, URL parameter or global can open a write. Opening one is a visible source change, and the commit must cite the server-side evidence from section 3.

| Write | Endpoint | Server dedup | State |
|---|---|---|---|
| `category.create` | `POST /categories` | unverified | **closed** |
| `category.update` | `PATCH /categories/{id}` | unverified | **closed** |

The write facade (`data/writeApi.js`) checks the gate before calling the wrapper. If the write is closed, it throws `WriteClosedError` and no request is made. `classifyOutcome` maps that error to `rejected / WRITE_CLOSED`, meaning certainly not applied.

The screens never offer a closed write. The category list, a category's page and both form addresses show `WriteClosedNotice`, which links to the full version. The form addresses render no form and make no request.

Mobile has no code at all for any other write:
- transactions, transfers and reversals;
- debt payments;
- savings contributions and installments;
- recurring confirm and skip;
- import steps, export creation and cancellation;
- marking notifications read;
- AI and WhatsApp actions.

Their pages are read-only. They show the same notice with `data-sm-write` set to a descriptive name.

Tests: `tests/mobileWriteGate.test.mjs` and `tests/mobileReadOnly.test.mjs`. The read-only test covers which wrapper methods each Mobile file may name, plus a runtime refusal of anything but GET.

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

**Problem.** `apiRequest` reads the token from storage on every call. Suppose another tab signs in as someone else. This tab still showed the first person, while its requests carried the second person's token. Mobile's identity boundary already protected Mobile screens, but Desktop pages were not protected.

**Why a Mobile-only fix is not enough.** The mismatch is in the shared provider that every Desktop page reads.

**Change.** This is the minimal diff, in `src/contexts/auth/authProvider.jsx` plus a new pure module, `src/contexts/auth/crossTabSession.js`:
- The provider listens for `storage` events and for bfcache `pageshow` restores.
- **Signed out elsewhere:** this tab is signed out. No logout request is sent, because the other tab already did that.
- **Another token, or a different workspace id elsewhere:**
  - this tab adopts the stored session and marks itself initializing, so the guards show Loading instead of the old pages;
  - it re-reads `GET /user`;
  - it remounts everything under the provider (`key={generation}`), so no page keeps figures read for the earlier identity.
- **Ignored:** a profile edit (same token), the same workspace written again, and unrelated keys.
- **Workspace changes:** these compare the event's old value with its new value, not with this tab's own state. Desktop's `resolveWorkspaceId` writes storage without telling the provider.

**Tests.** `tests/authCrossTab.test.mjs` (7 tests) runs against the real provider. The full suite, including every Desktop auth and page test, passed after the change (1,464 of 1,465 at that point; the one failure was an unrelated Mobile boundary rename, fixed in the next commit).

**Not covered:**
- `sessionStorage`-only sessions in other tabs. Browsers send no cross-tab events for them, and they cannot change this tab's token.
- Real-browser cross-tab behaviour. It was not re-run after this change and is UNVERIFIED in a real browser.

## 5. Financial integrity rules (unchanged, enforced by tests)

- Every figure is the backend's: balances, remaining amounts, statuses, report figures and percentages.
- There is no float arithmetic on money, and the guard test forbids `parseFloat`, `Number(` and `toFixed`. Report bar lengths are integer percentages computed with BigInt from the decimal strings.
- A missing or invalid amount shows as "Not available", never as 0.
- Currencies are never added together. Reports show one section per currency, and an event amount with no currency is shown as sent.
- A queued export is never shown as a file. Download appears only when `download_available` is true.
- An import in `confirmed` or `processing` is never shown as finished.
- An answer about a record other than the one in the address is refused: debts, transfers, imports and reports.
- Downloads are discarded if the identity changed before the file arrived.
