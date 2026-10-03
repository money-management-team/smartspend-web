# Google Sign-In — Implementation

The Google button on the Login and Register pages signs the user in (or up) with a Google **ID token**. The backend verifies the token and returns a full session. Configuration (client ID, Google Cloud Console, backend) is in [setup.md](setup.md).

## Files

| Path | Role |
| --- | --- |
| `src/features/Auth/components/AuthSocial/googleIdentity.js` | Loads GIS (`https://accounts.google.com/gsi/client`) once, calls `google.accounts.id.initialize()` once (popup mode), and forwards each `credential` to the registered handler. Warns in dev when `VITE_GOOGLE_CLIENT_ID` is missing |
| `src/features/Auth/components/AuthSocial/AuthSocial.jsx` + `.css` | Renders Google's button invisibly over ours, fits it to our button, and passes the ID token up through `onGoogleCredential` |
| `src/features/Dashboards/User/api/authApi.js` | `authApi.loginWithGoogle(idToken)` → `apiRequest("/auth/google", { method: "POST", body: { id_token }, auth: false })` |
| `src/contexts/auth/authProvider.jsx` | `loginWithGoogle(idToken, { remember })` validates the response and creates the session through `applyAuthData` |
| `Login.jsx`, `Register.jsx` | `handleGoogleCredential`: loading state, errors, redirect |

## Flow

1. The user clicks our Google button. The click actually lands on Google's invisible button, which opens Google's account popup.
2. The user picks an account. GIS calls back with `credential`, the Google **ID token** (a JWT, not an access token).
3. `AuthSocial` passes it to the page's `handleGoogleCredential(idToken)`. The call is dropped if one is already pending (see [Loading and duplicates](#loading-and-duplicates)).
4. `loginWithGoogle` sends `POST /api/auth/google` with `{ "id_token": "<jwt>" }`: JSON, `Accept-Language` from i18next, and no `Authorization` header (see [../api.md](../api.md#google-sign-in-post-authgoogle)).
5. The response must contain `data.token` and `data.user`; otherwise the provider throws `MALFORMED_RESPONSE`.
   - `applyAuthData` persists `ACCESS_TOKEN`, `token_type`, `user`, `workspace`, `ROLE`, and `remember_login`, and updates the in-memory session.
   - **No `/login` and no `GET /user` follow.** `freshTokenRef` also stops the restore effect from fetching `/user` for this token.
   - **200 (existing user) and 201 (new user)** are handled the same way; `is_new_user` / `user_created` aren't read.
   - **Storage:** Login passes its "remember me" value, so the session goes to `localStorage` or `sessionStorage`. Register always uses `localStorage`, like email registration.
6. The page navigates to `PATH.USER.DASHBOARD` with `replace: true`.

## Why Google's button is layered over ours

GIS returns an ID token only from its own rendered button (`renderButton`) or from One Tap (`prompt()`). Browsers suppress One Tap after a user dismisses it, so it can't back a button. The GIS OAuth token and code clients return access tokens or codes, which the backend doesn't accept. So the only reliable GIS way to keep the Smart Spend button design is to render Google's button and make it invisible on top of ours.

`renderButton` draws the button as ordinary DOM inside our page (plus a 0×0 helper iframe). The click therefore goes straight to Google's own handler, which opens the popup.

| Concern | Handling |
| --- | --- |
| **Coverage** | The slot is absolutely positioned over our button, centered, clipped, and `opacity: 0`. Google's "large" button is 40px tall and ours is 44px, so `fitGoogleButton` sets `--auth-google-scale-x/y` and scales it over the whole slot (1.1 vertically). Without this, the bottom ~4px of our button did nothing |
| **Width** | A `ResizeObserver` re-renders Google's button whenever the slot width changes (max 400px). This covers the two-column and single-column (≤360px) layouts and RTL |
| **Ready state** | `googleStatus` becomes `"ready"` only once Google's button is actually in the slot. It becomes `"unavailable"` if there is no client ID, the script fails, or nothing renders |
| **Click-through** | The slot is `pointer-events: none` and only Google's rendered button is `auto`. While the slot is empty (loading or unavailable), clicks reach our button, which shows the "unavailable" message when appropriate |
| **Disabled** | `disabled` sets `hidden` on the slot. `.auth-social__google-slot[hidden] { display: none }` is needed because the slot's own `display: flex` would otherwise beat the browser's `[hidden]` rule |
| **Hover / focus** | `.auth-social__google:hover` mirrors hover onto our button. Keyboard focus on Google's button draws our focus ring via `:has(.auth-social__google-slot :focus-visible)`, so mouse clicks don't show it |
| **Accessibility** | While Google's button is active, ours is `tabIndex=-1` and `aria-hidden`, so there's one tab stop: Google's button, with its localized "Continue with Google" name. Enter opens the popup |
| **Locale** | Google's button uses the current i18next language and re-renders when it changes |
| **Single initialize** | `initialize()` runs once per page load, since GIS warns on repeats. The mounted `AuthSocial` swaps in its handler through `setGoogleCredentialHandler`, which uses `useEffectEvent` to always call the latest page callback |

## Loading and duplicates

- On the first credential, the page sets `isSubmitting`. The form inputs are disabled, `AuthButton` shows its spinner and loading label, both social buttons are disabled, and Google's button is hidden, so a second popup can't be opened.
- `AuthSocial` also keeps `credentialPendingRef` while the page's (async) handler runs. A second credential arriving before React re-renders is dropped.
- `handleGoogleCredential` returns early if `isSubmitting` is already true.

## Errors

Every failure lands in the page's `AuthAlert`. Form values are kept, and Google's button becomes usable again.

| Case | Message |
| --- | --- |
| 422 `VALIDATION_ERROR` | The first `errors.id_token` message (there is no field to show it under), else the backend `message` |
| 429 `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| `NETWORK_ERROR`, `TIMEOUT` | `api.errors.network`, `api.errors.timeout` |
| `SERVER_ERROR` | The backend `message` if present, else `api.errors.server`. Staging answers a malformed token with 500 `{"message":"Server Error"}`, which shows as "Server Error" |
| `MALFORMED_RESPONSE` (no `token`/`user`) | `api.errors.unexpected` |
| Google unavailable (no client ID, script blocked, offline) | `auth.common.googleUnavailable` when our button is clicked |

The request uses `auth: false`, so a 401 here doesn't fire the session-expired event. Closing Google's popup without choosing an account does nothing, because GIS doesn't call back.

## Verified behavior

These were checked in headless Chrome against the dev server:

- **With real GIS and a placeholder client ID:**
  - the script loads and `initialize` receives `VITE_GOOGLE_CLIENT_ID`;
  - clicking the center and all four edges of our button, on Login and on Register, in LTR and RTL, at 1280px and 360px, opens Google's popup with that `client_id`;
  - Tab and Enter do the same.
- **With a stand-in GIS and backend:**
  - `POST /api/auth/google` receives exactly `{"id_token": credential}`;
  - the session is stored (in `sessionStorage` when "remember me" is off) and the dashboard header shows the user;
  - the URL becomes `/dashboard`, and no `/login` or `/user` request is made;
  - three clicks, or two credentials in the same tick, produce one request;
  - 422 and 500 responses show in the alert and store nothing;
  - with no client ID, the script isn't requested and the unavailable message shows.

A real sign-in additionally needs the configuration in [setup.md](setup.md).

## Notes

- Register's consent checkbox isn't required for Google sign-up, because the backend contract takes only `id_token`. If consent must be recorded for Google accounts too, the backend contract and this flow need to change together.
- `CompanyLogin` / `CompanyRegister` don't render `AuthSocial`. Without `onGoogleCredential`, `AuthSocial` keeps the Google button as a plain placeholder.
- Apple is still a placeholder.
