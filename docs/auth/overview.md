# Auth — Overview

The auth feature covers everything a guest does before reaching the dashboard: signing in, registering, and the password-recovery flow. It also owns the client-side session (token, user, workspace, role) that the rest of the app reads.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, guards, layout, key files (this file) |
| [flow.md](flow.md) | Session lifecycle, the recovery flow, and form error handling |
| [api.md](api.md) | Backend endpoints, expected payloads, and browser storage keys |
| [design-system.md](design-system.md) | Shared auth UI: tokens, layout, shared components, theming, responsive, RTL, motion |
| [login/implementation.md](login/implementation.md) | Sign-in page |
| [register/implementation.md](register/implementation.md) | Registration page |
| [google-sign-in/implementation.md](google-sign-in/implementation.md) | Google button (GIS ID token → `POST /auth/google`) on Login and Register |
| [google-sign-in/setup.md](google-sign-in/setup.md) | Google client ID, Cloud Console, and backend configuration; troubleshooting |
| [forgot-password/implementation.md](forgot-password/implementation.md) | Recovery step 1: request a reset link by email (`POST /auth/forgot-password`) |
| [verify-code/implementation.md](verify-code/implementation.md) | Recovery step 2: enter the code |
| [reset-password/implementation.md](reset-password/implementation.md) | Recovery step 3: new password from the emailed link (`POST /auth/reset-password`) |
| [password-changed/implementation.md](password-changed/implementation.md) | Recovery step 4: success |
| [email-verification/implementation.md](email-verification/implementation.md) | Email verification: signed-link page, shared status, dashboard banner, resend |
| [change-password/implementation.md](change-password/implementation.md) | Signed-in password change in Settings → Security (`PATCH /profile/password`), session kept, Google-created accounts |

## Routes

Auth pages are declared in `src/routes/Routes.jsx`. Most are in the `guestRoutes` group; the two pages opened from email links are in `emailLinkRoutes` (see [Route guards](#route-guards)). Refer to them through the `PATH.AUTH.*` constants in `src/routes/Path.js`, not string literals.

| Constant | URL | Page component |
| --- | --- | --- |
| `PATH.AUTH.SIGNIN` | `/signin` | `src/features/Auth/Login/Login.jsx` |
| `PATH.AUTH.REGISTER` | `/register` | `src/features/Auth/Register/Register.jsx` |
| `PATH.AUTH.FORGOT_PASSWORD` | `/forgot-password` | `src/features/Auth/ForgotPassword/ForgotPassword.jsx` |
| `PATH.AUTH.VERIFY_CODE` | `/verify-code` | `src/features/Auth/VerifyCode/VerifyCode.jsx` |
| `PATH.AUTH.RESET_PASSWORD` | `/reset-password?token=…&identifier=…` | `src/features/Auth/ResetPassword/ResetPassword.jsx` (email-link group) |
| `PATH.AUTH.PASSWORD_CHANGED` | `/password-changed` | `src/features/Auth/PasswordChanged/PasswordChanged.jsx` |
| `PATH.AUTH.VERIFY_EMAIL` | `/verify-email/:id/:hash?expires=…&signature=…` | `src/features/Auth/VerifyEmail/VerifyEmail.jsx` (email-link group) |

Sign-in, registration, Google sign-in, Forgot Password, Reset Password and Verify Email talk to the backend. Verify Code and Password Changed are UI-only. See [flow.md](flow.md#password-recovery-flow).

## Route guards

Defined in `src/routes/RouteGuards.jsx`:

- **`GuestOnly`** wraps the auth pages in `guestRoutes`. An already-authenticated user is redirected to `PATH.USER.DASHBOARD`.
- **No guard (`emailLinkRoutes`)** for Reset Password and Verify Email. They are opened from email links and must work whether or not this browser has a session: a reset clears a stale session, and verification can update a signed-in user's status. They still render inside `AuthLayout`.
- **`RequireAuth`** wraps the dashboard. An unauthenticated user is redirected to `PATH.AUTH.SIGNIN` with `state.from` set to the page they tried to open.
- Both render `<Loading message={false} />` while `AuthContext.initializing` is true, so nothing redirects before the stored session has been checked.

## Layout

Every auth page renders inside `src/layouts/AuthLayout/AuthLayout.jsx`:

- **Header:** a brand link to `PATH.HOME`, a theme toggle, and a language toggle.
- **Card:** `<main class="auth-card auth-card--{variant}">` hosts the page through `<Outlet/>`. The `--{variant}` class (from the pathname) is kept as a hook, but no styles currently depend on it.
- **Page content:** each page renders two siblings into the card, the brand panel (`AuthPromo`) and a `<section class="auth-panel">` with the form.
  - Above 900px they sit side by side.
  - At 900px and below, the brand panel is hidden and the card becomes a single centered form card.

The card, the shared tokens, and the column sizing live in `AuthLayout.css`. Everything else is composed from the shared components in `src/features/Auth/components/`. See [design-system.md](design-system.md).

## Key files

| Path | Role |
| --- | --- |
| `src/contexts/auth/authProvider.jsx` | Owns session state; exposes `login`, `register`, `loginWithGoogle`, `logout`, `updateUser`, `updateWorkspace` |
| `src/contexts/auth/useAuthContext.js` | Hook for consuming the auth context |
| `src/contexts/emailVerification/` | `EmailVerificationProvider` (single owner of `GET /auth/email/status`), `useEmailVerification`, `useResendVerificationEmail` |
| `src/layouts/DashboardLayout/components/EmailVerificationBanner/` | Dashboard warning while the email is unverified, with resend |
| `src/features/Dashboards/User/api/authApi.js` | Auth endpoint wrappers |
| `src/features/Dashboards/User/api/apiClient.js` | HTTP client plus session storage helpers (`persistAuthSession`, `clearAuthSession`, …) |
| `src/routes/RouteGuards.jsx` | `GuestOnly` / `RequireAuth` |
| `src/layouts/AuthLayout/` | Auth shell, card, `--auth-*` design tokens, column layout |
| `src/features/Auth/components/` | Shared auth UI components and icons |
| `src/features/Auth/<Page>/` | Individual auth pages. A page `.css` exists only when it has page-specific styles |
| `src/locales/{en,ar}/*.json` → `auth.*` | All auth copy, in both languages (`auth.common.*` holds shared strings) |
