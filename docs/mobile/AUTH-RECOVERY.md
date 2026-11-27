# Mobile — account recovery and authentication (Phase 2H)

**Status (2026-11-16): implemented, behind the closed write gate.** Forgot password, reset password and the verification-email resend exist as Mobile screens with full validation, outcome handling, Arabic/English and RTL/LTR. The three operations that send are registered and **closed** (`auth.forgotPassword`, `auth.resetPassword`, `email.resend`); `APPROVED` in `src/mobile/data/writeGate.js` is still `Object.freeze([])`, so the product as built sends none of them. Nothing here was opened, nothing was sent to any server, and no backend file was changed. What is and is not possible is in section 7; what must happen before any of them is opened is in section 8.

Verified against the backend source at `develop` @ `fd87531` and `fix/financial-idempotency-p0` @ `6b696d72` (read with `git show`, never checked out). **The auth routes, controllers, requests, notifications and rate limiters are identical on both**; the only differences between the two commits are in `bootstrap/app.php` and `routes/api.php` for unrelated duplicate-transaction and budget handling.

## 1. What existed before, and what is new

| Area | Before Phase 2H | Now |
|---|---|---|
| Sign-in, registration, Google, sign-out | Mobile screens over the shared `AuthProvider` | Unchanged. "Forgot your password?" now opens `/m/forgot-password` instead of the full version. |
| Forgot password | Link to the full version's page | `/m/forgot-password` (new). Closed: says so, offers the full version. |
| Reset password (emailed link) | Full version's page only | `/m/reset-password` (new), plus a hand-off from the emailed link (section 5). Closed: the link keeps opening the full version's page. |
| Resend verification email | A note: "send it from the full version" | A resend control on Profile (new). Closed: disabled, with the note and the full-version link kept. |
| Email verification status | `GET /auth/email/status` via the shared provider, "Check again" | Unchanged. |
| Verification link return flow | none | **Not possible from the frontend** (section 4.4). |
| Password change | `/m/profile/password` form, review, closed (`profile.password`) | Unchanged (audited, section 6). |
| Session / device management | none | **Not supported by the backend** (section 6). Nothing implemented. |

## 2. The exact backend contract

All paths are under `/api`. Every response uses the envelope `{ status, message, data?, errors? }`; the `message` text is Arabic whatever the request's `Accept-Language`, so **Mobile never shows it** and chooses its own translated sentence from the error's code (`models/authRecovery.js`).

### 2.1 Forgot password

| | |
|---|---|
| Request | `POST /auth/forgot-password` |
| Auth | none (public) |
| Payload | `{ "identifier": "<email>" }` (the backend also accepts `email`, which Mobile does not send). Rules (`ForgotPasswordRequest`): `required`, `string`, `email`, `max:255`; lower-cased and trimmed server-side. |
| Success | `200 { status: true, message }`. **The same 200 whether or not the address has an account**: `PasswordResetController::sendResetLink` ignores the broker's result. |
| Refusals | `422 { errors: { identifier: [...] } }` for a malformed address only. `429` from the throttle (below). |
| Rate limit | `throttle:auth` (`RateLimitServiceProvider`): **5 per minute per identifier** (SHA-1 of the lower-cased `identifier`), **20 per minute per IP**, **100 per day per IP**. `Retry-After` is sent. Plus the broker's own throttle: `auth.passwords.users.throttle` = **60 s** per user. |
| Token | Created by the broker (`createNewToken`), stored hashed in `password_reset_tokens`, **expires after 60 minutes** (`auth.passwords.users.expire`). |
| Email | `ResetPasswordNotification`, **sent synchronously** (not `ShouldQueue`). The link is `{app.frontend_url}/reset-password?token=…&identifier=…` (`FRONTEND_URL`, else the first of `FRONTEND_URLS`, else `APP_URL`). Language: the user's `locale`, else Arabic. |
| Duplicate / replay | Inside the 60 s broker throttle a second request creates no token and sends no email (`RESET_THROTTLED`, answered with the same 200). After it, a copy creates a **new token that deletes the earlier one** (`DatabaseTokenRepository::create` → `deleteExisting`) and sends another email: the older link stops working. Nothing else changes. Registered `same-result`. |
| Unknown outcome | A lost answer may mean an email was sent. Mobile says so ("we couldn't tell whether your request reached SmartSpend; if an email arrives, use its link"), waits a minute and never retries on its own. A copy is harmless. |

### 2.2 Reset password

| | |
|---|---|
| Request | `POST /auth/reset-password` |
| Auth | none (public); the token is the credential |
| Payload | `{ token, identifier, password, password_confirmation }`. Rules (`ResetPasswordRequest`): `token` required string; `identifier` required, email, ≤255; `password` required, `confirmed`, **min 8, at least one letter and one number**. |
| Success | `200 { status: true, message }`. Effects (`PasswordResetController::reset`): the password is hashed, `remember_token` is rotated, **every access token of the account is deleted**, the `PasswordReset` event fires. The person is not signed in. |
| Refusals | `422 { errors: { token: [...] } }` for **any** broker failure: an unknown address, a wrong token, an expired token and a used token are all the same answer, so it reveals nothing about accounts. `422` with `errors.password` / `errors.identifier` for field validation. `429` from the throttle. |
| Rate limit | `throttle:auth`, keyed on `identifier` exactly as above (5/min per address, 20/min and 100/day per IP). |
| Token validity | 60 minutes from creation, **single use** (the broker deletes it after a successful reset), and replaced by any newer request for the same account. |
| Duplicate / replay | A copy after success is `422 errors.token`. Two requests racing each other can both succeed (the broker does not lock); both set the same password. Registered `once-only`. |
| Unknown outcome | **Cannot be resolved by retrying**: if the first request worked, the retry says "invalid or expired". Mobile never retries for the person. After an unknown outcome it keeps the form, says "we couldn't confirm that your password was changed; try signing in with the new password first", and if a later attempt is then answered "token invalid" it says "if you just set a new password, it worked: sign in with it" (`linkMaybe`) instead of calling it a failure. |

### 2.3 Resend the verification email

| | |
|---|---|
| Request | `POST /auth/email/verification-notification` |
| Auth | Bearer token (signed in) |
| Payload | none |
| Success | `200 { data: { already_verified: false } }` (an email was sent) or `200 { data: { already_verified: true } }` (nothing sent). |
| Refusals | `422` when the account has no email (`"لا يوجد بريد إلكتروني…"`); `401` without a session; `403` for an inactive account; `429`. |
| Rate limit | `throttle:verification`: **6 per minute per user**, **20 per hour per IP**. |
| Email | `VerifyEmailNotification`, synchronous. The link is `URL::temporarySignedRoute('verification.verify', now()+60 min, [id, sha1(email)])`: **a backend (API) address**, see 4.4. Expiry: `auth.verification.expire`, default 60 (the key is not set in `config/auth.php`). |
| Duplicate / replay | Every copy sends one more email with its own valid link; none invalidates another. Registered `same-result`. |
| Unknown outcome | An email may have been sent. Mobile says so, waits a minute before another, and offers "Check again". |

### 2.4 Verification link (read only here, for the record)

`GET /auth/email/verify/{id}/{hash}?expires=…&signature=…`: public, `signed` + `throttle:verification`. Idempotent: a second use answers `200 { already_verified: true }`. A wrong hash is `422`; a bad or expired signature is `403`. See 4.4 for why Mobile cannot receive it.

### 2.5 Related, read only

`GET /auth/email/status` (authenticated): `{ email, requires_verification, verified, verified_at }`, `verified` is `true`, `false`, or `null` when there is no email. Unchanged; owned by `EmailVerificationProvider`.

## 3. Unknown outcomes: the rule

A request whose answer was lost (no response, timeout, a 5xx, an unreadable 200) is **never** reported as failed or as done. `failureKind()` maps `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE` and a missing code to `unknown`; a refusal with a code (`422`, `403`, `404`, `409`) is a definite "not done". Nothing is retried automatically; a double tap, a double submit and a second click while the first is on its way all send one request (`useAuthWrite`). Mobile's own client timeout is the shared `apiRequest` default.

The browser itself can send a POST twice (HTTP/1.1 resend after a 408 or a reused connection that dropped; `HTTP-408-EVIDENCE.md`). For forgot and resend a copy is harmless. For reset a silent copy would be answered "invalid" even though the first worked, which is why the wording for a used link includes "was already used" and why the page never says the reset *failed* when it is not certain.

## 4. Security properties

1. **No account enumeration.** The "ask for a link" page says one sentence whatever the answer; the only refusal that can differ is the format check, and it is made first on the device with the same wording the backend's own `422` gets. The backend gives the same `200` for any address, and the same `422 errors.token` for every reset failure. Tested by comparing the two pages byte for byte.
2. **Token handling.** The reset page reads `token` and `identifier` once into component state and replaces its history entry so the address bar and Back never hold them; they are in no storage (`localStorage`, `sessionStorage`, cookies), no log and no request but the reset itself. The page renders `<meta name="referrer" content="no-referrer">` while open. A reload loses the token on purpose: open the email's link again (it still works until used or expired). The presentation gate's loop breaker keeps the redirect's address in a module variable until the next redirect (it only compares it within one second), in memory only and never in storage.
3. **Password handling.** Held in component state until the request is made, then cleared; never stored, logged or echoed. Show/hide on both fields; strength is a plain checklist (length, letter, number) with words as well as colour.
4. **The verification link cannot be received (frontend limitation, backend change needed).** `VerifyEmailNotification::verificationUrl()` signs the **API** route, so the email contains an address on the API host (`https://<api>/api/auth/email/verify/{id}/{hash}?…`). Opening it makes the backend verify the address and answer **JSON** in the browser; the web app is never involved, so there is nothing for Mobile to handle and no return flow to build. (The Desktop page `/verify-email/:id/:hash` and the docs in `docs/auth/` assume the email links to the frontend; the backend does not do that. This was read from source; what production's mail actually contains is unverified.) The fix is in the backend, not here: build the link to `{frontend_url}/verify-email/{id}/{hash}?expires=…&signature=…` (the signature stays valid when the frontend forwards the query untouched). Until then, Mobile offers the resend and **Check again**.
5. **Timing.** `sendResetLink` sends the email inside the request, so an address with an account answers measurably slower than one without. The same `200` hides the status but not the timing. Backend observation; not changed.
6. **Messages are fixed, translated sentences** chosen by the error's code. The backend's Arabic text is never displayed (and so can't contradict the language or leak detail).

## 5. The emailed reset link on a phone

The reset email links to the full version's `/reset-password` (an "email-link" route that works signed in or out). `presentation/resolver.js` `getHandoff()` hands that one address to `/m/reset-password`, query included, when **all** hold: Mobile is built in, the device's presentation is Mobile (a stored choice, or Automatic on a phone), and **`auth.resetPassword` is open**. It is decided without waiting for the session to restore. Every other emailed or authentication address stays protected and untouched.

**While the operation is closed (the product as built) there is no hand-off**: the link keeps opening the full version's page, so a closed gate can never strand someone recovering their account, and the Mobile page (which could only send them back to the full version) cannot loop with the rule. Signed in with the full version chosen, Mobile's two recovery addresses go to their full-version twins (the reset link's query preserved) instead of the dashboard.

## 6. Audit: password change and sessions (nothing new implemented)

**Change password** (`PATCH` or `PUT /profile/password`, authenticated, `throttle:write` 30/min): `{ current_password, password, password_confirmation }`; the current password must match (`422` otherwise), the new one must be `confirmed`, **different from the current one**, and min 8 with a letter and a number; success revokes **every other** access token of the account and keeps the caller's. An account created with Google has no password and gets a `422`. Mobile's form (`/m/profile/password`, `profile.password`) already applies length, letter-and-number, different-from-current and confirmation checks, reviews, and is closed; classification `unverified` (a copy after success fails on the current password). **Not changed.**

**Registration (live) validates length only on the device**, while the backend also requires a letter and a number (`RegisterRequest`). A weaker password is still refused by the backend and its field error is shown, so nothing is unsafe, but the device could say it first. Not changed here (it is the live sign-in path and out of this phase's scope); `models/authRecovery.js` `passwordError()` is ready to use if it is wanted.

**Sessions / devices:** the backend has **no** route to list, name or revoke sessions or personal access tokens (`routes/api.php` has none). The only session effects are `POST /logout` (this token), a password change (every other token) and a reset (every token). Nothing can be implemented without a backend change, so nothing was.

## 7. What was implemented

| File | Role |
|---|---|
| `src/mobile/models/authRecovery.js` | Pure: email, password and confirmation rules, the checklist, reading the reset link, `Retry-After`, `failureKind`. |
| `src/mobile/auth/useAuthWrite.js` | The one hook that sends these writes: gate state, one request per submit, outcome classification, a countdown. Returns `{ ok, data }` or `{ ok:false, kind, seconds }`, never an error object. |
| `src/mobile/auth/MobileRecovery.jsx` | `MobileForgotPassword` and `MobileResetPassword`. |
| `src/mobile/settings/MobileProfile.jsx` | `ResendVerification` on the email status. |
| `src/mobile/data/writeGate.js`, `writeApi.js` | Three registered, closed operations and their senders (each asserts the gate first and, for reset, before reading its argument). |
| `src/mobile/presentation/resolver.js`, `PresentationGate.jsx` | The reset-link hand-off and the twin mapping. |
| `src/mobile/routes.jsx`, `lazyScreens.js`, `navigation.js`, `auth/MobileAuth.jsx` | Routes `/m/forgot-password` and `/m/reset-password`; the sign-in link; the shared frame and password field exported. |
| `src/mobile/i18n/sections/auth.js`, `assist.js`, `styles/mobile.css` | English and Arabic sentences; the requirements list. |

Behaviour in short: forgot password validates the address, sends one request, shows the same sentence and a one-minute wait, handles a 429 with the server's own wait, and an unknown outcome. Reset reads the link, checks the new password and confirmation, sends one request, ends a stale local session only if it belongs to the reset account, and on success sends the person to `/m/signin` (no automatic sign-in). Expired, used and invalid links all say the same thing and offer a new link. A page opened without a usable link has nothing to send.

## 8. Gate, safety blockers and what opening needs

- **Closed gate:** each screen shows `data-sm-note="write-closed"`, disables its action, offers the full version, and `tests/mobileRecovery.test.mjs` proves zero requests, including a form submitted around the disabled button and each sender called directly (it throws `WriteClosedError` before reading its input).
- **Registry:** `auth.forgotPassword` `same-result`, `auth.resetPassword` `once-only`, `email.resend` `same-result`, all `moves: false`, `key: "none"`; rows in `WRITE-APPROVAL-REGISTER.md` (tier 2), all **Not approved**. There is no runtime switch; the test switch exists only when `import.meta.env.MODE === "test"`.
- **Not approvable yet, and why:** none of the three has staging evidence. Opening one needs: real mail on staging (the link's target and rendering, spam placement), the `FRONTEND_URL` the mail uses, the rate limits observed, the 408/resend evidence, and a named approval per write (`WRITE-APPROVAL-REGISTER.md` section 2). The **reset** write also needs the product decision on its unknown outcome (the person must sign in to find out), and the hand-off activates the moment it is opened.
- **Blockers outside the frontend:** the verification link's address (4.4), response timing (4.5), and no session management (6).
- Authentication itself (sign-in, registration, Google, sign-out) is not a gated write and was not changed (`mobileSignOut.test.mjs` pins that `auth.logout` is not registered).

## 9. Tests

`tests/mobileRecovery.test.mjs` (60): the model (emails, passwords, links, outcomes, `Retry-After`); the registry (classification, closed, senders throw first); the closed product (zero requests on all three screens and on Profile, sign-in link, the unchanged emailed link); forgot (payload and no credentials, validation, enumeration, 429, unknown outcomes, double submit); reset (link read and scrubbed, payload, validation, checklist, show/hide, invalid/used/expired token, refused identifier and password, missing or mangled link, 429, unknown then "link no longer works", double submit, signed in as the same or another account); the hand-off (unit and mounted, closed, desktop, session restoring); Profile resend (sent, already verified, 429, no email, forbidden, unknown, double tap, verified accounts); English/Arabic, `dir`, key and placeholder parity, dark rule, no stray full-version links; no logging or storage of the token, password or address through every outcome; the source has no `console`, storage or request of its own. Updated by design: `mobileReadOnly` (the facade's exports, the wrapper methods it may name, and the one new file allowed to import it), `mobileWriteGate` (registry and classifications), `mobileAuthAndTrends` (the link), the approval register and the count (50).

## 10. Opening one later, in the order that is safe

`auth.forgotPassword` and `email.resend` first (a copy sends one email), `auth.resetPassword` last (single-use token, unknown outcome, session revocation, and it turns on the hand-off). Each: staging evidence, a row marked approved in the register, and a reviewed change to `APPROVED`. None of this is done.
