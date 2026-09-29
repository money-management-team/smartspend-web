# Change password (signed in)

Lets a signed-in user change their password from **Settings → Security** (`PATCH /profile/password`). This is separate from the recovery flow ([forgot-password](../forgot-password/implementation.md) → [reset-password](../reset-password/implementation.md)), which the page reuses for accounts without a usable current password.

## Files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/authApi.js` → `changePassword({ currentPassword, password, passwordConfirmation })` | The request (PATCH; the backend also accepts PUT) |
| `src/features/Dashboards/User/Settings/components/ChangePassword/ChangePassword.jsx` + `.css` | The form, validation, errors, and the reset-link block |
| `src/features/Dashboards/User/Settings/Settings.jsx` | Renders it in the `security` tab (previously an empty placeholder) |
| `src/locales/{en,ar}/*.json` → `dashboard.settings.security.*` | All copy |

## Request

```
PATCH /profile/password            ← relative to VITE_API_BASE_URL (already ends in /api)
Authorization: Bearer <token>      ← added by apiClient
```

```json
{ "current_password": "password123", "password": "newPassword456", "password_confirmation": "newPassword456" }
```

Success is `200` with the `UserResource` in `data` and a message. The page shows its own translated success text, because backend messages can arrive in Arabic regardless of `Accept-Language`.

## Validation

The client runs the backend's rules before sending, so an obviously invalid form never leaves the browser. The backend stays the source of truth.

| Field | Rules | Client message key (`validation.*`) |
| --- | --- | --- |
| `current_password` | required; must match the stored password (backend only) | `currentRequired` |
| `password` | required, min 8, at least one letter (`\p{L}`) and one number (`\p{N}`), different from `current_password` | `newRequired`, `minLength`, `letters`, `numbers`, `different` |
| `password_confirmation` | required, equal to `password` | `confirmRequired`, `mismatch` |

- Passwords are never trimmed.
- A live checklist under the fields shows the four new-password requirements (length, letters, numbers, different). It only informs; it doesn't gate the button.
- Each input has a show/hide toggle, using the same pattern as the auth `PasswordField`: an `aria-pressed` button labelled `auth.common.showPassword`, `aria-controls` pointing at the input. A hidden `username` field lets password managers attach the new password to the account.

## Session behavior

- On success the backend **revokes every other personal access token** of the account, and the token that sent the request stays valid.
- The page therefore **does not log out, does not clear storage, and does not touch the session**. The user stays on Settings, and a reload restores the same session through `GET /user`.
- The only thing that ends the session is a real `401`. apiClient then clears storage and fires `smartspend:session-expired`, and `RequireAuth` redirects to sign-in. The form shows nothing extra in that case.

## Sensitive data

- The three values live only in the component's state. They are never written to `localStorage` / `sessionStorage`, never put in the URL, and never logged.
- After a success the state is reset to empty strings and the inputs remount (`formKey`), so every field is masked again.

## Double submit

A synchronous `pendingRef` guard plus disabled inputs and button while the request runs. A double click sends exactly one request.

## Errors

| Case | What the user sees |
| --- | --- |
| 422 on `password` / `password_confirmation` (policy, same as current, mismatch) | Backend messages under those fields + `errors.checkFields` |
| 422 on `current_password` (wrong password, or an account with no password) | Backend message under Current password + `errors.currentRejected`, and the reset-link block is highlighted |
| 422 with no field errors | The backend message (`getApiErrorMessage`), and the reset-link block is highlighted |
| 401 | Global session-expired flow (redirect to sign-in) |
| 429 | `api.errors.rateLimited` with the `Retry-After` seconds |
| Network / timeout / 5xx / malformed | `getApiErrorMessage` |

Field errors and the general message use `dir="auto"`, because backend messages can be in a different language from the UI.

## Google-created accounts

An account created with Google may have no password, and then the backend answers `422`. The frontend doesn't know in advance which accounts have one (the user payload carries no flag), so it never invents or assumes a password.

Below the form, a block titled "Signed up with Google, or forgot your current password?" offers **Email me a link**:

- it calls the existing `authApi.forgotPassword(user.email)` (`POST /auth/forgot-password`);
- the emailed link opens the existing **Reset Password** page, which is in the email-link route group and works while signed in;
- no second reset system exists.

The block is always available, and it is highlighted whenever a 422 is about the current password or the account itself.

The copy warns that setting the password through the link signs the user out on every device. That is the reset flow's documented behavior: `POST /auth/reset-password` revokes all tokens and the page clears the session (see [../flow.md](../flow.md#session-after-a-password-reset)).

Without an email on the profile, the button is hidden and the block explains that an email is needed to receive the link. `forgot-password` only accepts emails.

## i18n and RTL

- Keys under `dashboard.settings.security`: `changePassword`, `subtitle`, `fields.*`, `requirements.*`, `validation.*`, `submit`, `submitting`, `success`, `errors.checkFields`, `errors.currentRejected`, and `reset.*`. The unused placeholder key `security.title` was removed. English and Arabic stay in exact key parity.
- The password inputs are `dir="ltr"`. In RTL the toggle sits on the left (logical `inset-inline-end`), so a `[dir="rtl"]` rule moves the input's reserved padding to the physical left.
- The email in the "link sent" message is wrapped in `<bdi dir="ltr">`.
- Colors come from tokens (`--color-danger`, `--success-soft`, `--warning-soft`, `--primary-soft`, …), and transitions honor `prefers-reduced-motion`.
