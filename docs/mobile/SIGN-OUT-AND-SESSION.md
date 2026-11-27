# Mobile sign-out and session handling

`APPROVED = Object.freeze([])` is unchanged. Signing out is **not** a financial write: it moves no money, so it does not go through `data/writeGate.js` and has no entry in it (a test asserts that). Desktop and the Backend are not changed. `POST /logout` is the existing contract (`authApi.logout`, documented in `docs/auth/api.md` and `docs/auth/flow.md`).

## What was there

- The shared `AuthProvider.logout()` (used by the full version's sidebar) sends `POST /logout` when a token exists and **always clears the session in a `finally`**, then rethrows a failed request. It also clears the full version's pending-write keys and drops welcome notices.
- Other tabs follow through the provider's `storage` listener (`crossTabSession.js`); Mobile's `IdentityBoundary` drops every figure it holds when the identity changes.
- Mobile's Profile said "Signing out isn't available in Mobile yet" and offered nothing.

## What it does now

A **Session** group, last on Profile, with one real button: **Sign out** (labelled, 44 px target, an icon marked `aria-hidden`). `auth/useSignOut.js` calls the provider's `logout()`; it adds no request, no endpoint and no auth logic of its own.

| Step | Behaviour |
|---|---|
| Tap | The button is disabled, `aria-busy`, reads "Signing out…", and a polite live region says "Signing you out". A ref (not only `disabled`) makes a second tap in the same frame do nothing: one `POST /logout`. |
| Server answers 200 | Outcome **confirmed**. |
| Server answers 401 | Outcome **ended**: SmartSpend says the session was no longer valid. |
| No network, timeout, 5xx, anything else | Outcome **unconfirmed**. The session is still cleared on this device (the provider's `finally`), and Mobile says so without claiming the server ended it. There is no automatic retry. |
| After | Mobile's own pending-write keys for this person are cleared (see below), the outcome is kept for the sign-in page, and the app goes to `/m/signin`, replacing the page the person left. |

The three notices on sign-in (EN and AR): "You have been signed out." / "…SmartSpend says the session had already ended." / "You have been signed out on this device, but SmartSpend did not confirm that it ended your session on its server. If this device is shared, sign in again and sign out while you are connected." The unconfirmed one has a warning outline.

## Where the outcome is kept, and why

The route guard redirects to sign-in the moment the session is cleared, with the page the person left as the return address, and that redirect can arrive after Mobile's own navigation and overwrite its state. So the outcome is not carried in navigation state: `auth/signOutNotice.js` holds one word in memory (`confirmed` / `ended` / `unconfirmed`), read by the sign-in page and dropped as soon as anyone is signed in again (`IdentityBoundary` mount). While it is set, whoever signs in next, the same person or another, goes to **Mobile Home**, not to the Profile page the previous person left (`MobileGuestOnly` and the sign-in page both apply this).

## What is cleared

| Where | What | By |
|---|---|---|
| `localStorage` / `sessionStorage` | `ACCESS_TOKEN`, `token`, `token_type`, `user`, `ROLE`, `workspace`, `remember_login` | provider (`clearAuthSession`) |
| `localStorage` | the full version's pending-write keys for this user | provider |
| `localStorage` | **Mobile's pending-write keys** (`smartspend:mobile:pending-write:…:u:{id}:…`) for this user | `useSignOut` (new; see below) |
| Memory | Mobile's resource store (every loaded figure), requests in flight | `IdentityBoundary` scope unmount |
| Memory | remembered list scroll positions | `IdentityBoundary` scope unmount (`clearScrollMemory`, new) |
| Memory | welcome notice, Google attempt counter | provider |

**A gap found and fixed:** Mobile's `clearPendingWritesForUser` existed and was documented as "mirrored at the app's single sign-out path", but nothing called it (the provider only clears the full version's key prefix). It is now called by the Mobile sign-out, for this person only, whatever the server answered. Session expiry and a sign-out in another tab are the provider's flows and are unchanged: their pending keys still expire on their own TTL.

**Kept on purpose:** device settings that are not the person's data (the presentation choice, language, theme) and the per-person, per-workspace device preferences (quick entries, saved filters, hide-amounts), which are keyed by user and workspace and are meant to be there when that person signs in again. The service worker caches only hashed `/assets/*` and never `/api`, so it holds nothing of the person.

## Back, reload, second account

- **Back** from sign-in lands on sign-in again (`MobileRequireAuth` redirects every Mobile page while signed out); no request is made for the old pages (tested by counting requests that carry the old token).
- **Reload:** storage holds no session, so the app starts at sign-in.
- **A second account:** a new token is a new identity scope, so nothing loaded for the first person is in memory; its pages read with its own token and show only its own data (tested end to end with the real `AuthProvider` against a local fake server for two fictional people).
- **Other tabs:** unchanged. A sign-out in another tab signs this one out with no logout request from here and no notice (this tab did not sign out). This tab's sign-out is seen by other tabs the usual way: the stored session is removed.

## Tests

`tests/mobileSignOut.test.mjs` (18): the button (labelled, one, in its own group, not a closed note, not a write-gate entry, Arabic); a confirmed sign-out (the request and its token, storage cleared, sign-in, notice, no identity panel); pending keys, scroll memory and loaded data; device settings kept; Back and reload; a second account and the same person (Home, own token, no old token after sign-out); a double tap (one request, busy, announced); a network failure and a 500 (signed out locally, no claim about the server, no retry); 401; the Arabic warning; a sign-out in another tab; storage removal; a tab-only session. Mutation checks: removing the double-tap guard or the pending-key clearing fails the suite. `mobileSettings` was updated (six groups; the closed note is gone). Everything runs against local fakes; no real server is contacted.

Browser check (headless Chrome, a local GET-only fixture that refuses writes with 405): the button and its Session group at 320 and 390 px, EN and AR, light and dark, no overflow; tapping it sends one `POST /logout` (refused by the fixture, as designed), clears the session and lands on sign-in with the "unconfirmed" notice.

## Limits

- The session can only be said to have ended on the server when `POST /logout` succeeds. When it does not, Mobile says it could not confirm, and the token may stay valid on the server until it expires. Mobile has no other way to revoke it (the contract it uses has no such endpoint).
- Another tab's sign-out and the session-expiry flow do not clear Mobile's pending-write keys (unchanged; they expire).
- Waiting for a hung request is bounded by the API client's 20 s timeout; the button stays busy until then, and the session is cleared when the request settles. That is the shared provider's behaviour; changing it is out of scope (it would touch the full version).
