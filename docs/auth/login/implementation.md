# Login — Implementation

Sign-in page at `/signin`: `src/features/Auth/Login/Login.jsx`. It has no page stylesheet; everything comes from the [shared auth design system](../design-system.md). The session behavior is in [flow.md](../flow.md#login).

## Structure

```
AuthPromo (login.promo.title / subtitle)
  .auth-promo__chips → 3 × .auth-promo__chip (login.promo.chips.0–2)

section.auth-panel
  AuthHeading (login.title / subtitle)
  form.auth-form
    AuthField      #login-identifier   MailIcon, autocomplete "username"
    PasswordField  #login-password     labelAction = "Forgot password?" → PATH.AUTH.FORGOT_PASSWORD
    AuthCheckbox   #login-remember     "remember" (default checked)
    AuthAlert                          only when there is a general error
    AuthButton     submit              loading → auth.login.loading
  AuthSocial                           login.social.*
  AuthSwitchPrompt                     → PATH.AUTH.REGISTER
```

## Behavior

- Controlled form state: `{ identifier, password, remember }`.
- Both text inputs are `required`. Browser validation runs before `handleSubmit`.
- The identifier is trimmed before sending. The password is sent unmodified.
- `login()` runs `POST /login` and then `GET /user`, and stores the session only after both succeed. See [flow.md](../flow.md#login).
- **Errors:**
  - On `VALIDATION_ERROR` (422), `error.errors.identifier` / `error.errors.password` render under their fields.
  - Every failure also shows `getApiErrorMessage(error, t)` in `AuthAlert`. That covers wrong credentials, rate limiting, network, timeout, server, and malformed-response errors, and any failure of the follow-up `GET /user`.
  - The entered values are kept.
- **While submitting:** the inputs, checkbox, and button are disabled. The button shows its spinner with `auth.login.loading`, and `handleSubmit` returns early, so the form can't be submitted twice.
- On success: `navigate(PATH.USER.DASHBOARD, { replace: true })`.

## Notes

- The page is the reference for the design system. Its look was preserved when it moved onto the shared components. The one visible change is that the password field's decorative lock icon became the shared show/hide toggle.
- Earlier versions had separate Arabic and English render branches that were identical. They were merged into one tree.
- The Google button signs in through `loginWithGoogle` using the "remember me" value. See [google-sign-in](../google-sign-in/implementation.md). The Apple button is a placeholder.
