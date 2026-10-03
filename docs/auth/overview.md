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
| `PATH.AUTH.RESET_PASSWORD` | `/reset-password?token=…&identifier=…` | `src/features/Auth/ResetPassword/ResetPassword.jsx` (email-link group) |
| `PATH.AUTH.PASSWORD_CHANGED` | `/password-changed` | `src/features/Auth/PasswordChanged/PasswordChanged.jsx` |
| `PATH.AUTH.VERIFY_EMAIL` | `/verify-email/:id/:hash?expires=…&signature=…` | `src/features/Auth/VerifyEmail/VerifyEmail.jsx` (email-link group) |

Sign-in, registration, Google sign-in, Forgot Password, Reset Password and Verify Email talk to the backend. Password Changed is UI-only. The old `/verify-code` OTP prototype was removed; `LEGACY_VERIFY_CODE_PATH` redirects old bookmarks to `/signin` (signed-in users are bounced to the dashboard by `GuestOnly`). The canonical email verification is the emailed link, see [email-verification/implementation.md](email-verification/implementation.md). See [flow.md](flow.md#password-recovery-flow).

## Route guards

Defined in `src/routes/RouteGuards.jsx`:

- **`GuestOnly`** wraps the auth pages in `guestRoutes`. An already-authenticated user is redirected to the saved return path (`?redirect=`), else `PATH.USER.DASHBOARD`.
- **No guard (`emailLinkRoutes`)** for Reset Password and Verify Email. They are opened from email links and must work whether or not this browser has a session: a reset clears a stale session, and verification can update a signed-in user's status. They still render inside `AuthLayout`.
- **`RequireAuth`** wraps the dashboard. An unauthenticated user is redirected to `/signin?redirect=<pathname+search+hash>`. See [Return to the original page](#return-to-the-original-page).
- Both render `<Loading message={false} />` while `AuthContext.initializing` is true, so nothing redirects before the stored session has been checked.

## Return to the original page

`src/routes/returnTo.js` holds the rules; `useReturnPath()` reads them from the URL.

- `RequireAuth` builds `/signin?redirect=<encoded path+query+hash>` with `getSigninPathFor(location)`. The target lives in the URL, so it survives a refresh of the sign-in page.
- Login, Register and Google sign-in (`useGoogleSignIn`) navigate to `useReturnPath()` after success. `GuestOnly` uses the same value, so its redirect for the newly signed-in user cannot disagree with the page's own navigation.
- The sign-in <-> register links carry the parameter through `withReturnTo`.
- **Open-redirect protection:** `sanitizeReturnPath` only accepts a string that starts with a single `/`, has no backslash or control characters, stays on the same origin once parsed, and whose pathname is `/dashboard` or under `/dashboard/`. Anything else (external URLs, `//host`, `javascript:`, auth pages, garbage) falls back to `PATH.USER.DASHBOARD`. Restricting to the dashboard also rules out redirect loops between auth pages.
- An explicit logout navigates to plain `/signin`; an expired session (`smartspend:session-expired`) keeps the current page as the return target.

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
