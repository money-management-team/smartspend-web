# Returning to the requested page after sign-in

A visitor who opens a protected page while signed out is sent to sign in, and after signing in lands on the page they asked for, with its query string intact.

```
Signed out:  /dashboard/reports?period=month&year=2026
   -> RequireAuth   Navigate to /signin, state { from: "/dashboard/reports?period=month&year=2026" }
   -> Login         successful email or Google sign-in
   -> navigate(getPostAuthPath(location.state), { replace: true })
   -> /dashboard/reports?period=month&year=2026
```

## Pieces

| File | Role |
| --- | --- |
| `src/routes/postAuthRedirect.js` | `toReturnPath(location)`, `getSafeRedirectPath(value)` and `getPostAuthPath(state)`; no React, unit tested |
| `src/routes/RouteGuards.jsx` | `RequireAuth` stores `from` = pathname + search + hash in router state. `GuestOnly` sends an already signed-in user to `getPostAuthPath(location.state)` |
| `src/features/Auth/Login/Login.jsx` | After `login()`, navigates to `getPostAuthPath(location.state)` |
| `src/features/Auth/components/AuthSocial/useGoogleSignIn.js` | Same, after `POST /auth/google` (used by Login and Register) |

The destination lives in the router's history state, so it survives a refresh of the sign-in page and needs no storage that could outlive the visit. There is a single mechanism: nothing else decides where a sign-in goes.

`GuestOnly` and the sign-in page agree on the same target, so the moment the session turns authenticated, both resolve to the same URL and there is no race between them.

## Cases

- **Direct link or bookmark:** a signed-out visit to a deep link is handled as above.
- **Expired session:** a 401 clears the session and dispatches `smartspend:session-expired`. `AuthProvider` logs the user out, `RequireAuth` redirects with the page they were on, and signing back in returns to it.
- **Logout:** the sidebar navigates straight to `/signin` without a destination, so signing in again starts at the dashboard.
- **Registration:** a new account lands on the dashboard (its page is reached from the sign-in page, which doesn't carry the destination).
- **Home page CTAs** such as the AI section button point at a protected page; signed-out visitors sign in and arrive there.

## Mobile (`/m/signin`)

Mobile has its own destination rule, `mobileDestination` (`src/mobile/auth/destination.js`): a remembered address that `getSafeRedirectPath` accepts **and** that is under `/m/*` (never `/m/signin` or `/m/register`), else Mobile Home `/m`. Email/password (`MobileSignIn`) and Google (`GoogleSignIn`, through `useGoogleSignIn`'s `destination` option) both use it. Desktop sign-in is unchanged: `getPostAuthPath`, default `/dashboard`.

The presentation gate (`PresentationGate`) sits above the routes and, for a signed-in visitor whose mode is "desktop" (an explicit choice, or "auto" on a non-touch browser), redirects every Mobile address to the dashboard. Signing in from a Mobile page is therefore treated as the choice of Mobile: `claimMobile()` stores it before the sign-in request resolves (the session appearing is what triggers the gate) and the failure path restores the previous value exactly. Registration is not covered by this.

## Safety

`getSafeRedirectPath` accepts a value only if it is a same-origin application path:

- it must be a string (at most 2048 characters) starting with a single `/`;
- `//host`, `/\host`, absolute URLs (`https://...`, `javascript:`) and control characters are rejected;
- paths of guest-only pages (`/signin`, `/register`, `/forgot-password`, ...) are rejected, so a sign-in can never loop back to a page that bounces away.

Anything rejected falls back to `PATH.USER.DASHBOARD`. The value is read from history state only, never from a query parameter, so a crafted link cannot supply a destination.

## Tests

`tests/mobilePostLoginRedirect.test.mjs` covers the Mobile and Desktop sign-in destinations in all presentation modes. `tests/postAuthRedirect.test.mjs` covers path, query and hash preservation, the fallback, external and protocol-relative rejection, and guest-only pages. The full browser flow (deep link, sign-in, expired session, a forged external target) was exercised against a mocked API.

Google sign-in on the published domain still needs one manual check: open a protected deep link in a private window and sign in with Google.
