# Reset Password — Implementation

Recovery step 3 at `/reset-password?token=…&identifier=…`, the link emailed by Forgot Password:

- `src/features/Auth/ResetPassword/ResetPassword.jsx`
- `src/features/Auth/ResetPassword/ResetPassword.css`, which holds the strength panel and the requirement list.

The endpoint is described in [../api.md](../api.md#reset-password-post-authreset-password).

## Structure

```
AuthPromo (resetPassword.promo.title / subtitle)
  .auth-promo__chips → 2 icon chips (ShieldIcon dataProtection, LockIcon encryption)

section.auth-panel
  AuthSteps current=3
  AuthHeading  icon = LockIcon (resetPassword.title / subtitle)
  form.auth-form
    PasswordField  #reset-password           describedBy = reset-password-strength; errors = backend `password`
    div.reset-strength--{0-3}#reset-password-strength
      heading: strength label + level text (aria-live="polite")
      3-segment meter (aria-hidden)
      ul.reset-requirements → 3 × li.reset-requirement(--passed)
    PasswordField  #reset-confirm-password   errors = [passwordMismatch] when mismatched, else backend `password_confirmation`
    AuthAlert      resetPassword.invalidLink (link incomplete)
    AuthAlert      general error
    AuthButton     submit (loading label resetPassword.loading)
                   — or, when the link is unusable, a link to PATH.AUTH.FORGOT_PASSWORD (resetPassword.requestNewLink)
  AuthBackLink → PATH.AUTH.SIGNIN
```

## Route

The route sits in the **email-link** route group (`emailLinkRoutes` in `Routes.jsx`): `AuthLayout` **without** `GuestOnly`. A user who still has a session in this browser can therefore use the link; under `GuestOnly` they would have been sent to the dashboard and could never reset. See [../overview.md](../overview.md#route-guards).

## Link parameters

- `token` and `identifier` are read with `useSearchParams`. The user never types them.
- `identifier` is sent exactly as received, except that spaces become `+`. An email can't contain spaces, but query parsing turns an unencoded `+` into one (`user+tag@…`).
- If either value is missing, the page shows `auth.resetPassword.invalidLink`, disables the inputs, and replaces the submit button with "Request a new link" → `/forgot-password`. No request is sent.

## Validation rules

These match the backend: at least 8 characters, letters **and** numbers, confirmed.

| Rule | Check |
| --- | --- |
| Length | `password.length >= 8` |
| Letter | at least one letter (`\p{L}`) |
| Number | at least one `\d` |

These rules previously required both upper and lower case, which the backend doesn't. That blocked valid passwords such as `abcdefg1`. The requirement is now "at least one letter".

**Strength levels** are informational only and don't gate submitting:

| Level | Condition | Meter |
| --- | --- | --- |
| 0 | Password empty | Label shows "—", no segments filled |
| 1 (weak) | Anything that isn't medium or strong | 1 segment filled |
| 2 (medium) | ≥ 8 characters, plus either a number with a letter or both letter cases | 2 segments filled |
| 3 (strong) | ≥ 8 characters, lower and upper case, and a number | 3 segments filled |

## Submitting

1. The submit button is enabled only when the link is usable, all three rules pass, and both fields are non-empty and equal (`canSubmit`). `handleSubmit` re-checks this and ignores a second submit while one is in flight.
2. `authApi.resetPassword({ token, identifier, password, passwordConfirmation })` sends `POST /auth/reset-password` with `{ token, identifier, password, password_confirmation }`, with `auth: false` (no Bearer, even when a session exists).
3. While in flight, both inputs are disabled and `AuthButton` shows its spinner and `auth.resetPassword.loading`.

### Success

- The backend revokes **every** access token of the account, so `clearAuth()` removes any stored session: the storage keys and the in-memory session. The user is **not** logged in.
- The page navigates to `PATH.AUTH.PASSWORD_CHANGED` with `replace: true`. That page is the success state; its button leads to sign-in.

### Errors

Typed passwords are kept, and the stored session is left untouched on failure.

| Case | Shown |
| --- | --- |
| 422 `errors.password` | Under the password field. Staging also reports a confirmation mismatch here, not under `password_confirmation` |
| 422 `errors.password_confirmation` | Under the confirmation field (unless the local mismatch message is showing) |
| 422 `errors.token` / `errors.identifier` | That message in `AuthAlert` (for example "رابط إعادة التعيين غير صالح أو منتهي الصلاحية."). The link is marked rejected: inputs are disabled and the button becomes "Request a new link" |
| Other 422 | The backend `message` in `AuthAlert` |
| 429, network, timeout, server, malformed | `getApiErrorMessage(error, t)` in `AuthAlert` |

Editing a field clears that field's backend error and the alert.

## Styling

- The strength panel sits 6px higher (a negative top margin) so it reads as part of the password field.
- Level colors are set via `--reset-strength-color` (segment fill, raw `--color-*` tokens) and `--reset-strength-text` (label, the contrast-adjusted `--auth-*` tokens).
- Passed requirements turn `--auth-success`, and their check circle fills with `--color-success` and animates in.

## Notes

- `AuthSteps` shows step 3 of 4. The link-based flow skips Verify Code (step 2).
- "Back to sign in" used to be `href="#login"`, which only changed the URL hash. It is now a router link.
