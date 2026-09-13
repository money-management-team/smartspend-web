# Forgot Password — Implementation

Recovery step 1 at `/forgot-password`: `src/features/Auth/ForgotPassword/ForgotPassword.jsx`. It has no page stylesheet.

The user enters their account email. The backend emails a reset link if the email belongs to an account. See [../api.md](../api.md#forgot-password-post-authforgot-password) for the endpoint.

## Structure

```
AuthPromo (forgotPassword.promo.title / subtitle)      no extras

section.auth-panel
  AuthSteps current=1
  AuthHeading  icon = KeyIcon (forgotPassword.title / subtitle)
  form.auth-form
    AuthField  #forgot-email  type "email", name "identifier", MailIcon,
               autocomplete "email", required; errors = backend field errors
    AuthAlert                 general error (only on failure)
    AuthAlert variant=success confirmation (only after a 200)
    AuthButton submit         forgotPassword.submit / loading label forgotPassword.loading
  AuthBackLink → PATH.AUTH.SIGNIN
```

## Submitting

1. The input is `type="email"` and `required`, so the browser blocks an empty value or anything that isn't an email (including phone numbers) before any request is sent. This matches the existing pages, which rely on native `required`.
2. `handleSubmit` returns early if a request is already in flight, then clears the previous field errors, alert, and confirmation.
3. It calls `authApi.forgotPassword(email.trim())`, which sends `POST /auth/forgot-password` with `{ "identifier": "<email>" }`.
   - `identifier` rather than `email`, to match `/login` and `/register`. The backend accepts either.
   - `auth: false`: no `Authorization` header, even if a token happens to be stored.
4. The page calls `authApi` directly, not `AuthProvider`, because nothing about the session changes.

While the request is in flight, the input is disabled and `AuthButton` shows its spinner, `aria-busy`, and `auth.forgotPassword.loading`. Together with the early return, this means one request per submit.

## Success

- The backend returns the same 200 `{ status: true, message }` whether or not the email is registered. The page never infers anything about the account from it.
- The backend `message` is shown as-is in `AuthAlert variant="success"` (`role="status"`). If the message is missing, `auth.forgotPassword.success` is shown instead.
- The form stays in place with the email kept, so the user can see which address they used or send the link again. Editing the email clears the confirmation, since it referred to the previous address.
- Nothing is stored, the user is not signed in, no other endpoint is called, and the page doesn't navigate. The next step is the link in the email (see [Reset link](#reset-link)).

## Errors

The entered email is kept in every case.

| Case | Shown |
| --- | --- |
| 422 `VALIDATION_ERROR` | `errors.identifier` (or `errors.email`) under the input, with `aria-invalid` and `aria-describedby`. The backend `message` also shows in `AuthAlert`, as on Login |
| 429 `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After`. Staging allows 5 requests per window (`x-ratelimit-limit: 5`) |
| `NETWORK_ERROR`, `TIMEOUT` | `api.errors.network`, `api.errors.timeout` |
| `SERVER_ERROR` | The backend `message`, else `api.errors.server` |
| `MALFORMED_RESPONSE` | `api.errors.unexpected` |

All general messages come from `getApiErrorMessage(error, t)`. Editing the email clears the field error and the alert.

## Reset link

The backend's email links to `/reset-password?token=…&identifier=…` on the frontend.

- That URL matches the `PATH.AUTH.RESET_PASSWORD` route. React Router ignores the query string when matching and keeps it in `location.search`.
- The route is in the email-link route group (no `GuestOnly`), so it opens whether or not this browser has a session.
- Reset Password reads `token` and `identifier` from the link and completes the reset. See [../reset-password/implementation.md](../reset-password/implementation.md).
- Production hosting must serve `index.html` for `/reset-password` (the usual SPA fallback). The Vite dev server already does.

## i18n and RTL

- Copy lives under `auth.forgotPassword.*` in both locales. The subtitle, label, submit, and promo text describe an emailed reset link, not a verification code or a phone number, because the endpoint accepts only an email.
- Staging returns its messages in Arabic whatever `Accept-Language` says. `AuthAlert` uses `dir="auto"`, so an Arabic message in the English UI (or an English one in the Arabic UI) keeps its own direction and punctuation.

## Notes

- `AuthSteps` still shows step 1 of 4. The link-based flow skips the Verify Code step, so the step indicator no longer matches the real flow. It is unchanged because redesigning the recovery pages was out of scope.
