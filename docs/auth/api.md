# Auth — API

Endpoint wrappers live in `src/features/Dashboards/User/api/authApi.js` and go through `apiRequest` in `apiClient.js`. That means every call gets the standard envelope handling, the `Accept-Language` header, and `ApiError` codes (see the API layer section of `CLAUDE.md`).

## Endpoints

| Method | Endpoint | Wrapper | Auth header | Used by |
| --- | --- | --- | --- | --- |
| `POST` | `/login` | `authApi.login(credentials)` | No (`auth: false`) | `AuthProvider.login` |
| `POST` | `/register` | `authApi.register(data)` | No (`auth: false`) | `AuthProvider.register` |
| `POST` | `/auth/google` | `authApi.loginWithGoogle(idToken)` | No (`auth: false`) | `AuthProvider.loginWithGoogle` |
| `POST` | `/auth/forgot-password` | `authApi.forgotPassword(email)` | No (`auth: false`) | `ForgotPassword.jsx` (directly; no session change) |
| `POST` | `/auth/reset-password` | `authApi.resetPassword({ token, identifier, password, passwordConfirmation })` | No (`auth: false`) | `ResetPassword.jsx` |
| `GET` | `/auth/email/verify/{id}/{hash}?expires=…&signature=…` | `authApi.verifyEmail({ id, hash, search })` | No (`auth: false`) | `VerifyEmail.jsx` |
| `POST` | `/auth/email/verification-notification` | `authApi.resendVerificationEmail()` | Yes | `EmailVerificationProvider.resend` (banner, verify page) |
| `GET` | `/auth/email/status` | `authApi.getEmailVerificationStatus({ signal })` | Yes | `EmailVerificationProvider` |
| `GET` | `/user` | `authApi.getCurrentUser({ signal, token })` | Yes (stored token, or the explicit `token`) | Session restore on load; `AuthProvider.login` right after `/login` |
| `PUT` | `/profile` | `authApi.updateProfile(payload)` | Yes | `Settings/components/ProfileSettings` |
| `PATCH` | `/profile/password` | `authApi.changePassword({ currentPassword, password, passwordConfirmation })` | Yes | `Settings/components/ChangePassword` |
| `POST` | `/logout` | `authApi.logout()` | Yes | `AuthProvider.logout` |

All paths are relative to `VITE_API_BASE_URL`, which already ends in `/api` (fallback `/api`). So `/login` resolves to `/api/login`, never `/api/api/login`.

### Login request body

```json
{ "identifier": "name@example.com", "password": "••••••••" }
```

`identifier` accepts an email or phone number. The page trims it before sending, and sends the password unmodified.

### Login success response

```json
{
  "status": true,
  "message": "تم تسجيل الدخول بنجاح",
  "data": { "user": { "...": "..." }, "token": "...", "token_type": "Bearer" }
}
```

It has no `workspace`, so the client follows up with `GET /user` before storing anything (see [flow.md](flow.md#login)). A 422 puts field messages under `errors.identifier` / `errors.password`.

### Current user payload (`GET /user`)

`normalizeCurrentUser(data)` in `authApi.js` returns `{ user, workspace }`. It accepts any of these shapes for `data`:

| `data` shape | `user` | `workspace` |
| --- | --- | --- |
| `{ user, workspace }` | `data.user` | `data.workspace` |
| User object with a nested `workspace` | `data` | `data.workspace` |
| Plain user object | `data` | `null` (the dashboard later resolves it from `/dashboard` via `resolveWorkspaceId()`) |

**`token` option:** passing `token` sends `Authorization: Bearer <token>` with `auth: false`. It is used right after login, before the token is stored. With `auth: false`, a 401 on this call doesn't clear storage or fire `smartspend:session-expired`; `login()` just throws the error to the page.

### Register request body

`POST /register` resolves to `<VITE_API_BASE_URL>/register`. The base URL already ends in `/api` (fallback `/api`), so the request goes to `/api/register`. The backend alias `/api/auth/register` is not used.

```json
{
  "name": "Rania",
  "identifier": "rania@example.com",
  "password": "password123",
  "password_confirmation": "password123",
  "terms_accepted": true,
  "privacy_accepted": true
}
```

| Field | Backend rules | Sent from |
| --- | --- | --- |
| `name` | required, string, max 255 | Full name (trimmed) |
| `identifier` | required, string, max 255, unique, email or supported phone format | Email or phone (trimmed) |
| `password` | required, min 8, at least one letter and one number, confirmed | Password (unmodified) |
| `password_confirmation` | must match `password` | Confirm password (unmodified) |
| `terms_accepted` | required, accepted | Consent checkbox |
| `privacy_accepted` | required, accepted | Same consent checkbox |

The backend is the source of truth for these rules. The page only does basic checks first (see [register/implementation.md](register/implementation.md#validation)).

### Register success response (HTTP 201)

```json
{
  "status": true,
  "message": "تم إنشاء الحساب بنجاح",
  "data": {
    "user": { "id": 1, "name": "Rania", "email": "rania@example.com", "phone": null, "...": "..." },
    "workspace": {
      "id": 1, "owner_id": 1, "type": "personal", "name": "Personal Workspace",
      "slug": "...", "base_currency_code": "ILS", "timezone": "Asia/Gaza", "status": "active"
    },
    "token": "...",
    "token_type": "Bearer"
  }
}
```

The user is authenticated as soon as this response arrives, so the client does **not** call `/login` afterwards. The backend creates a personal workspace during registration and returns it here. It is stored under `workspace` and is later picked up by `resolveWorkspaceId()`.

### Register validation error (HTTP 422)

```json
{
  "status": false,
  "message": "The provided data is invalid.",
  "errors": { "identifier": ["..."], "password": ["..."] }
}
```

`apiClient` throws this as `ApiError` with code `VALIDATION_ERROR` and puts the field messages in `error.errors`.

### Google sign-in (`POST /auth/google`)

```json
{ "id_token": "<Google ID token (JWT) from Google Identity Services>" }
```

It must be an **ID token** (the GIS `credential`), not an OAuth access token. The response is **200** for an existing user or **201** for a new one. Both return the same `data: { user, workspace, token, token_type }` and are handled the same way. The client does not rely on `is_new_user` / `user_created`. See [google-sign-in/implementation.md](google-sign-in/implementation.md) and [google-sign-in/setup.md](google-sign-in/setup.md).

Observed on staging:

- A missing `id_token` returns 422 with `errors.id_token`. The page shows that message.
- A malformed token returns **500** `{"message":"Server Error"}` instead of a 422/401. That's a backend issue; the page shows "Server Error".

### Forgot password (`POST /auth/forgot-password`)

```json
{ "identifier": "name@example.com" }
```

- `identifier` is required and must be an **email**. Phone numbers are rejected. The backend also accepts the key `email`; the client sends `identifier` to match `/login` and `/register`.
- **Success (200)** is identical whether or not the email is registered, so it reveals nothing about the account:

  ```json
  { "status": true, "message": "إذا كان هذا البريد مسجلاً لدينا فسيصلك رابط إعادة التعيين." }
  ```

  There is no `data`, no token, and no session change.
- The email links to the frontend at `/reset-password?token=…&identifier=…`.

Observed on staging:

- A missing value returns 422 with `errors.identifier` ("البريد الإلكتروني مطلوب"). A phone number or malformed email returns 422 with `errors.identifier` ("صيغة البريد الإلكتروني غير صحيحة").
- Messages are Arabic even with `Accept-Language: en`.
- Rate limit: `x-ratelimit-limit: 5`. Exceeding it returns 429 (`RATE_LIMITED`).
- The CORS preflight allows `http://localhost:5173`.

See [forgot-password/implementation.md](forgot-password/implementation.md).

### Reset password (`POST /auth/reset-password`)

`token` and `identifier` come from the emailed link `/reset-password?token=…&identifier=…`; the user never types them.

```json
{
  "token": "<from the link>",
  "identifier": "<email from the link>",
  "password": "abcdefg1",
  "password_confirmation": "abcdefg1"
}
```

| Field | Backend rules |
| --- | --- |
| `token` | required |
| `identifier` | the email the reset was requested for |
| `password` | required, min 8, letters and numbers, confirmed |
| `password_confirmation` | must match `password` |

- **Success (200):** `{ "status": true, "message": "تم تعيين كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة" }`. The backend revokes all of the account's access tokens, so the client clears any stored session and doesn't log in (see [flow.md](flow.md#session-after-a-password-reset)).
- Observed on staging:
  - an empty body returns 422 with `errors.token`, `errors.identifier` and `errors.password`;
  - a confirmation mismatch or a password without a number returns 422 under **`errors.password`**;
  - an invalid or expired token returns 422 `errors.token` ("رابط إعادة التعيين غير صالح أو منتهي الصلاحية.").

See [reset-password/implementation.md](reset-password/implementation.md).

### Change password (`PATCH /profile/password`)

Bearer-authenticated; the backend also accepts `PUT`, and the client uses `PATCH`.

```json
{ "current_password": "password123", "password": "newPassword456", "password_confirmation": "newPassword456" }
```

| Field | Backend rules |
| --- | --- |
| `current_password` | required, must match the stored password |
| `password` | required, string, min 8, letters and numbers, confirmed, different from `current_password` |
| `password_confirmation` | required, must match `password` |

- **Success (200):** `{ "status": true, "message": "تم تغيير كلمة المرور بنجاح", "data": { "id": 1, "name": "Rania", "…": "…" } }`.
- The backend revokes every **other** access token of the account. The token that made the request stays valid, so the client keeps the session exactly as it is.
- **422:** field errors under `current_password`, `password` or `password_confirmation`. An account created with Google that has no password is also rejected with 422.
- **401:** session-expired flow. **429:** rate limit.

See [change-password/implementation.md](change-password/implementation.md).

## Email verification

See [email-verification/implementation.md](email-verification/implementation.md) for the UI.

### Verify (`GET /auth/email/verify/{id}/{hash}?expires=…&signature=…`)

- A **signed URL**. The frontend page `/verify-email/{id}/{hash}?expires=…&signature=…` forwards `id`, `hash` and its raw query string unchanged, so the signature still matches. The backend email has to link to that frontend URL.
- Public: always `auth: false`, never a Bearer token.
- **Success (200):** `{ "status": true, "message": "تم تأكيد البريد الإلكتروني بنجاح.", "data": { "already_verified": false } }`. `already_verified: true` is also a success.

| Status | Meaning |
| --- | --- |
| 403 | Invalid or expired signed link. Staging: `{"message":"Invalid signature."}` |
| 404 | User not found |
| 422 | The hash no longer matches the account's current email |
| 429 | Verification rate limit |

### Resend (`POST /auth/email/verification-notification`)

- Bearer, **no body**. The backend uses the signed-in user's email.
- **Success (200):** `{ "status": true, "message": "تم إرسال رابط التأكيد إلى بريدك الإلكتروني", "data": { "already_verified": false } }`. `already_verified: true` means the email is already verified, which is not an error.
- 401 → session-expired flow; 422 → the account has no email; 429 → rate limit.

### Status (`GET /auth/email/status`)

- Bearer, no body. The source of truth for email-verification UI.

```json
{
  "status": true,
  "data": { "email": "rania@example.com", "requires_verification": true, "verified": false, "verified_at": null }
}
```

- `verified` is `true` (verified), `false` (has an email, not verified), or `null` (verification doesn't apply, e.g. no email). `null` is never treated as `false`.
- Normalized by `normalizeEmailVerificationStatus(data)` to `{ email, requiresVerification, verified, verifiedAt }`.
- Staging: without a token, both the resend and status endpoints return 401 `Unauthenticated.`

## Expected auth payload (`data` of `/login`, `/register`, and `/auth/google`)

| Field | Required | Notes |
| --- | --- | --- |
| `token` | Yes | Missing → `ApiError` `MALFORMED_RESPONSE` |
| `user` | Yes | Missing → `MALFORMED_RESPONSE`. `user.role` sets the session role (default `"user"`) |
| `token_type` | No | Defaults to `"Bearer"` |
| `workspace` | No | Returned by `/register` and `/auth/google`. For login, it comes from the follow-up `GET /user`. Stored when present; create calls later need its id (via `resolveWorkspaceId()`) |

Validation failures come back as `VALIDATION_ERROR`, with field messages in `error.errors`. The login form renders them per field directly. The register form first maps the backend field names to its own form fields (see [register/implementation.md](register/implementation.md#error-handling)).

## Browser storage

The keys are defined in `AUTH_SESSION_KEYS` in `apiClient.js`. They are written to `localStorage` or `sessionStorage` depending on "remember me", and cleared from both on logout, expiry, or a new login.

| Key | Content |
| --- | --- |
| `ACCESS_TOKEN` | Bearer token (current key) |
| `token` | Legacy token key; cleared, not written |
| `token_type` | Token type, usually `Bearer` |
| `user` | JSON-serialized user |
| `workspace` | JSON-serialized workspace (only if returned) |
| `ROLE` | User role |
| `remember_login` | `"true"` / `"false"`: the "remember me" choice used for this session |
