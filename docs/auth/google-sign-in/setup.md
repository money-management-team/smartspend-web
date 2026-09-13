# Google Sign-In — Setup

What has to be configured before the Google button works. The code needs no changes; only configuration is missing.

## 1. Frontend environment variable

| Variable | Value |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | The OAuth 2.0 **Web application** client ID, e.g. `1234567890-abc123.apps.googleusercontent.com` |

- Put it in `.env` (or `.env.local` / the hosting provider's build environment).
- Vite reads env files **only at startup** and bakes `VITE_*` values into the bundle at **build time**. So restart `npm run dev` after changing it, and set it in the environment where `npm run build` runs.
- A client ID is public (it ships in the bundle). It is still never hard-coded in the source.
- While it is empty:
  - the Google script is never loaded;
  - clicking Google shows `auth.common.googleUnavailable`;
  - in dev, the console logs a warning naming the variable.

## 2. Google Cloud Console

In **APIs & Services → Credentials**, open (or create) the **OAuth client ID** of type **Web application**:

- **Authorized JavaScript origins**: add every origin that serves the frontend, for example:
  - `http://localhost:5173` for Vite dev (add `http://localhost` too; Google recommends it for localhost testing);
  - the production origin, e.g. `https://app.example.com`.
  - Origins must match exactly: scheme, host, and port. `127.0.0.1` and `localhost` are different origins.
- **Authorized redirect URIs**: not needed. The popup flow returns the credential to the page through GIS.
- **OAuth consent screen**: configure the app name, support email, and scopes (`openid`, `email`, `profile`). While the app is in **Testing**, only the listed test users can sign in.

## 3. Backend

- The backend must verify ID tokens against the **same client ID** (the token's `aud`).
- CORS must allow the frontend origin for `POST /api/auth/google`. Staging currently allows `http://localhost:5173`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "Google sign-in isn't available right now" | `VITE_GOOGLE_CLIENT_ID` is empty, Vite wasn't restarted, or `accounts.google.com` is blocked (extension or network) |
| Popup shows "Error 401: invalid_client" / "The OAuth client was not found" | The client ID is wrong or was deleted |
| Popup shows "origin_mismatch" / "not a valid origin" | The current origin isn't in Authorized JavaScript origins |
| Popup shows "Access blocked: app is in testing" | The Google account isn't a test user on the consent screen |
| Alert "Server Error" after choosing an account | The backend threw while verifying the token. Staging returns HTTP 500 for a malformed token instead of a 422/401 |
| Popup opens and closes with no sign-in | The host sets `Cross-Origin-Opener-Policy: same-origin`. It must be `same-origin-allow-popups` (or unset) |
