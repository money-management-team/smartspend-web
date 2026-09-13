# Auth — Session Flow

How the client-side session is created, restored, and destroyed. All state lives in `src/contexts/auth/authProvider.jsx`; pages consume it through `useAuthContext()`.

## Session shape

```js
{ token, user, workspace, role }   // role falls back to "user" (or "guest" when signed out)
```

`isAuthenticated` is `Boolean(token)`.

## Login

1. `Login.jsx` submits `{ identifier: form.identifier.trim(), password }` with `{ remember: form.remember }`. "Remember" defaults to `true`.
2. `login()` calls `authApi.login` → `POST /login`.
3. The response must contain `data.token` and `data.user`. Otherwise the provider throws `ApiError` with code `MALFORMED_RESPONSE`.
4. The login response has no workspace, so `login()` then calls `authApi.getCurrentUser({ token })` → `GET /user`.
   - The new token is sent as `Authorization: Bearer <token>` directly. Nothing has been stored yet at this point.
   - `normalizeCurrentUser(data)` splits the payload into `user` and `workspace` (see [api.md](api.md#current-user-payload-get-user)). A missing user throws `MALFORMED_RESPONSE`.
   - If this request fails, the error is thrown to the page and **nothing is stored**, so there is no half-built session. The user can just submit again.
5. `applyAuthData({ ...loginData, user, workspace }, { remember })` persists the token, user, workspace, and role in one step, sets the session state, and marks initialization as finished.
6. The page navigates to `PATH.USER.DASHBOARD` with `replace: true`, so Back doesn't return to the sign-in form.

### Remember me

`persistAuthSession` first clears the session keys from **both** storages, then writes to:

- `localStorage` when `remember` is true, so the session survives browser restarts;
- `sessionStorage` when it is false, so the session ends when the tab or browser closes.

See [api.md](api.md#browser-storage) for the exact keys.

## Register

1. `Register.jsx` builds the backend payload from its camelCase form state (see [register/implementation.md](register/implementation.md#payload-mapping)) and calls `register(payload)`.
2. `register()` calls `authApi.register` → `POST /register`. No login request follows, because the registration response already authenticates the user.
3. The response must contain `data.token` and `data.user`. Otherwise the provider throws `ApiError` with code `MALFORMED_RESPONSE`.
4. `applyAuthData` persists the session with `remember: true` (always `localStorage`). It writes `ACCESS_TOKEN`, `token_type`, `user`, the returned personal `workspace`, and `ROLE`, then updates the in-memory session.
   - `ROLE` comes from `user.role`. The register response has no role, so it falls back to the standard `"user"`.
5. The page navigates to `PATH.USER.DASHBOARD` with `replace: true`. `GuestOnly` would redirect there anyway once `isAuthenticated` turns true.

## Google sign-in

`loginWithGoogle(idToken, { remember })` sends `POST /auth/google` and applies the returned `{ user, workspace, token }` directly with `applyAuthData`. It doesn't call `/login` or `GET /user`. Login passes its "remember me" value; Register uses `true`. See [google-sign-in/implementation.md](google-sign-in/implementation.md).

## Restore on page load

1. The initial state is read synchronously with `getStoredAuthSession()`.
2. If there is no token, `initializing` becomes `false` immediately.
3. If there is a token, the provider calls `GET /user` (abortable). It passes the result through `normalizeCurrentUser`, then applies it:
   - `updateUser` refreshes the stored user and role;
   - `updateWorkspace` refreshes the stored workspace, but only when the payload includes one.
   - **401:** the session is cleared, so the user is treated as a guest.
   - **Any other error:** kept in `initializationError`, and the stored session is left intact. A flaky network does not log the user out.
4. The route guards wait for `initializing === false` before redirecting.

The restore effect runs whenever `session.token` changes. `applyAuthData` records the token it just applied in `freshTokenRef`, and the effect skips a token that matches. So after login (already verified with `GET /user`), or after register or Google sign-in (the response has the full session), `/user` is not fetched a second time. `clearAuth` resets the ref.

## Session expiry

`apiClient` handles a 401 on any authenticated request:

1. It clears storage and dispatches the `smartspend:session-expired` window event (`AUTH_SESSION_EXPIRED_EVENT`).
2. `AuthProvider` listens for that event, calls `clearAuth()`, and ends initialization.
3. `RequireAuth` then redirects to `/signin`.

## Logout

`logout()` sends `POST /logout` only if a token exists. It always clears the session in a `finally` block, even when the request fails.

## Password recovery flow

The four recovery pages form a visual sequence. `AuthSteps` shows the current step (1 of 4 to 4 of 4).

The backend flow is link-based:

1. Forgot Password sends `POST /auth/forgot-password`.
2. The backend emails a link to `/reset-password?token=…&identifier=…`.
3. Reset Password reads `token` and `identifier` from that link and sends `POST /auth/reset-password`.
4. On success the app goes to Password Changed, and the user signs in with the new password.

Verify Code (step 2) isn't part of this flow and stays UI-only.

| Step | Page | Submit behavior | Links |
| --- | --- | --- | --- |
| 1 | Forgot password | `POST /auth/forgot-password`, then shows the backend confirmation in place. No navigation, no session change ([details](forgot-password/implementation.md)) | Back → `/signin` |
| 2 | Verify code | Logs the entered code; resend logs a message (not used by the link flow) | Edit phone number → `/forgot-password` |
| 3 | Reset password | `POST /auth/reset-password` with the link's `token` and `identifier`. On success it clears any stored session and navigates to `/password-changed` ([details](reset-password/implementation.md)) | Back → `/signin`; unusable link → "Request a new link" → `/forgot-password` |
| 4 | Password changed | No form | Primary button → `/signin` |

## Session after a password reset

The backend revokes every access token of the account when the reset succeeds.

- Reset Password is in the email-link route group (no `GuestOnly`), so it opens even when this browser holds a session.
- The reset request itself uses `auth: false`, so no stale Bearer token is sent.
- On success, `clearAuth()` removes the stored session keys from both storages and empties the in-memory session. The user is **not** logged in automatically; Password Changed sends them to sign-in.
- On failure the stored session is left as it was, because the backend hasn't revoked anything.

## Session after an in-app password change

`PATCH /profile/password` (Settings → Security) is different from a reset: the backend revokes every **other** token of the account and keeps the one that made the request.

- The client doesn't log out, doesn't clear storage, and doesn't replace the token. The user stays signed in on this device, and other devices are signed out by the backend.
- Only a real `401` ends the session, through the normal [session expiry](#session-expiry) path.
- An account without a password (created with Google) is pointed at the reset-link flow above, which *does* sign out everywhere. See [change-password/implementation.md](change-password/implementation.md).

## Email verification

- **Signed link:** the email links to `/verify-email/{id}/{hash}?expires=…&signature=…` (email-link route group). The page forwards these values unchanged to `GET /auth/email/verify/…`, without a Bearer token. It never creates a session or replaces the token.
- **Status:** `EmailVerificationProvider` fetches `GET /auth/email/status` once per signed-in session. `verified: false` shows the dashboard warning banner; `true` and `null` show nothing.
- **Resend:** `POST /auth/email/verification-notification` with the current session and no body, from the banner or the verification page's error state.

See [email-verification/implementation.md](email-verification/implementation.md).

## Form error handling (login, register, and forgot password)

Forgot Password follows the same rules with its single `identifier` field. See [forgot-password/implementation.md](forgot-password/implementation.md#errors).


- **Field errors:** on a `VALIDATION_ERROR`, `error.errors` (field → messages) is stored in state and passed to each `AuthField` / `PasswordField` as `errors`. Login uses the backend keys directly (`identifier`, `password`). Register first renames them to its form fields.
  - All messages render under the input inside `#<field-id>-error`.
  - The input gets `aria-invalid="true"`, and `aria-describedby` points at that container.
- **General message:** `getApiErrorMessage(error, t)` renders in `AuthAlert` (`role="alert"`). This covers network, timeout, rate-limit, and malformed-response errors too.
- **Register only:** the consent checkbox is checked locally before any request. If it is unchecked, `errors.termsAccepted` is set to `auth.register.terms.required` and rendered by `AuthCheckbox`.
- **Clearing:** editing a field removes that field's errors and the general message.
- **On failure:** the entered values, passwords included, are kept so the user can fix them and retry.
- **While submitting:** the inputs, checkbox, and submit button are disabled. Both pages also ignore a second submit while a request is in flight. The button shows a spinner, sets `aria-busy="true"`, and swaps its text for the page's `loading` key.
