# Email Verification — Implementation

Confirming a user's email address. This is **not** the password-recovery Verify Code page (`/verify-code`), which is an unrelated, UI-only OTP screen.

It has three parts:

| Part | Where |
| --- | --- |
| Verification page (the emailed signed link) | `src/features/Auth/VerifyEmail/VerifyEmail.jsx` at `/verify-email/:id/:hash?expires=…&signature=…` |
| Shared status (`GET /auth/email/status`) | `src/contexts/emailVerification/` (`EmailVerificationProvider`, `useEmailVerification`) |
| Warning banner and resend action | `src/layouts/DashboardLayout/components/EmailVerificationBanner/` and `useResendVerificationEmail` |

The endpoints are described in [../api.md](../api.md#email-verification).

## Verification page

### Route and link

- `PATH.AUTH.VERIFY_EMAIL` (`/verify-email`), declared as `${PATH.AUTH.VERIFY_EMAIL}/:id/:hash` in the **email-link** route group (`AuthLayout` without `GuestOnly`), so it works signed in or out.
- The backend's verification email must link to `<frontend>/verify-email/{id}/{hash}?expires=…&signature=…`, carrying the values of its signed API URL `/api/auth/email/verify/{id}/{hash}?expires=…&signature=…`.
- `authApi.verifyEmail({ id, hash, search })` sends `GET /auth/email/verify/{id}/{hash}` followed by the page's **raw query string** (`location.search`), untouched. Rebuilding the query could change its order or encoding and break the signature.
- The request always uses `auth: false`: no Bearer token, even when signed in. A 401 or 403 here therefore never ends the session.
- If `id`, `hash`, `expires` or `signature` is missing, the page shows the invalid-link state without sending anything.

### One request per link

Verifying twice would make the second response say `already_verified: true`, hiding the real outcome. React StrictMode runs effects twice in dev. So the in-flight or finished request is kept in a module-level map keyed by the link, and every effect run reuses it. A failed request is dropped from the map, so "Try again" sends a new one.

### States

| State | Shown | Actions |
| --- | --- | --- |
| Loading | `verifyEmail.loading.*`, a busy `AuthButton` | — |
| 200 `already_verified: false` | Success heading `verifyEmail.success.*` | Signed in → "Go to dashboard"; guest → "Go to sign in" |
| 200 `already_verified: true` | Success heading `verifyEmail.alreadyVerified.*`. Still a success | Same |
| 403, or incomplete link | `verifyEmail.errors.invalidLink` (invalid or expired) | Signed in → "Resend verification email" + back link to the dashboard; guest → "Sign in to get a new link" |
| 404 | `verifyEmail.errors.notFound` | Same as 403 |
| 422 | `verifyEmail.errors.emailChanged` (the hash no longer matches the account's email) | Same as 403; a resend goes to the current email |
| 429, network, timeout, server | `getApiErrorMessage(error, t)` | "Try again" (`common.retry`) + back link |

On success while signed in, the page calls `refresh()` on the shared status, so the dashboard warning disappears. No session is created, and the stored token is never replaced.

## Shared status: `EmailVerificationProvider`

Mounted in `main.jsx` inside `AuthProvider`, so it can read the session.

- It fetches `GET /auth/email/status` (Bearer) once per signed-in session, after `AuthProvider` has finished restoring. Consumers read the result; none of them fetch it themselves. Navigating between dashboard pages sends no extra requests.
- The result is tied to the token it was fetched for, so after logout or a new login the previous session's status is never shown.
- `normalizeEmailVerificationStatus(data)` returns `{ email, requiresVerification, verified, verifiedAt }`. `verified` stays **three-valued**:

  | `verified` | Meaning | UI |
  | --- | --- | --- |
  | `true` | Verified | Nothing |
  | `false` | Has an email that isn't verified | Warning banner with resend |
  | `null` | Verification doesn't apply (e.g. no email) | Nothing. Never treated as `false` |

- The context value is `{ status, error, loading, refresh, resend }`:
  - `refresh()` re-fetches the status;
  - `resend()` calls the resend endpoint and, when the response says `already_verified: true`, refreshes the status.
- The status endpoint is the source of truth. The UI doesn't read `user.email_verified_at`.
- **Refresh triggers:** a successful verification while signed in; a resend that reports "already verified"; a profile save that changes the email (`ProfileSettings`), because a new address starts unverified.
- A 401 on the status request goes through apiClient's session-expired flow.

## Resend: `useResendVerificationEmail`

Used by the dashboard banner and by the verification page's error state.

- `POST /auth/email/verification-notification` with the current Bearer token and **no body**. The backend uses the signed-in user's email.
- `pendingRef` allows one request at a time. The button is also disabled and shows `auth.emailVerification.sending`.
- The outcome is returned as `notice` (`{ tone, text }`):

  | Response | Notice |
  | --- | --- |
  | 200 `already_verified: false` | Success: the backend `message` (fallback `auth.emailVerification.sent`) |
  | 200 `already_verified: true` | Success: `auth.emailVerification.alreadyVerified`. Not a failure |
  | 401 | None. apiClient ends the session, and `RequireAuth` redirects to sign-in |
  | 422 (the account has no email) | Error: `errors.email[0]`, else the backend message |
  | 429 and others | Error: `getApiErrorMessage(error, t)` (429 includes `Retry-After`) |

## Dashboard banner

`EmailVerificationBanner` renders at the top of `DashboardLayout`'s content, above every dashboard page, while `status.verified === false`.

- It shows the title, the email (in `<bdi>`, so it stays LTR in Arabic, via `Trans`), and the resend button. Resend outcomes show as a line inside the banner (`role="status"` for success, `role="alert"` for errors, `dir="auto"`).
- When a resend reports "already verified", the refreshed status hides the warning. The banner then stays in its green "done" style with the confirmation and a "Close" button, and disappears when closed.
- Styles: `EmailVerificationBanner.css`. It uses warning tokens (`--color-warning`, `--warning-soft`) and success tokens in the done state, logical layout, dark-theme text overrides, and stacks the button full-width at ≤640px.

## i18n

- `auth.emailVerification.*`: the banner and resend (title, message with `<email>` markup, resend, sending, sent, alreadyVerified).
- `auth.verifyEmail.*`: the verification page (promo, loading, success, alreadyVerified, error, errors, actions).
- All keys exist in both locales.
