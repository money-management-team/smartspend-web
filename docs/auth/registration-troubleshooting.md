# Diagnosing a failed registration

The personal registration form sends `POST /api/register` with `name`, `identifier`, `password`, `password_confirmation`, `terms_accepted`, and `privacy_accepted`. The develop backend accepts that shape. A successful response is HTTP 201 with `status: true`, `data.user`, `data.workspace`, and `data.token`.

In the reported local failure, Network showed `POST register` returning **404** from `[::1]:5173`. That is the Vite development server, so the request never reached Laravel. The ZIP excludes the local `.env`; without `VITE_API_BASE_URL`, `apiClient` uses `/api`. The Vite config now proxies `/api` to the staging Laravel origin in local development. Restart `npm run dev` after taking this change. In Network, the browser still sees a localhost request (the proxy runs inside Vite), but it should receive Laravel's JSON response instead of an empty Vite 404. If `VITE_API_BASE_URL` is set to an absolute URL, the proxy is bypassed; confirm that URL and the backend CORS origins.

If the UI displays an error, open DevTools → Network, select the `register` request, and record **Request URL**, **Status**, and the `message`/`errors` fields of **Response**. Do not share the password, token, or full request body.

- 422: validation/duplicate identifier. The form displays field errors. Check password rules (at least eight characters with letters and numbers), matching confirmation, and consent.
- 429: auth throttle; wait for `Retry-After`.
- 403/419/other 4xx: inspect the exact HTTP status and response. A response with no JSON `message` now includes its HTTP status in the UI.
- Network error/no HTTP response with an absolute API URL: verify `VITE_API_BASE_URL` and allow the exact development origin `http://localhost:5173` in the backend `FRONTEND_URLS` list, alongside the Vercel origin. The Vite proxy removes the browser's cross-origin request when using the relative `/api` default.
- 5xx: inspect Laravel Cloud application logs. `AuthController::register` creates the user/workspace/token in a transaction and sends verification email **after** commit. A mail transport failure at that point can produce an error response even though the account exists; attempt login or password recovery before submitting the same registration again. This is a possible failure path, not proof it happened in staging.

Never diagnose the backend status solely from the generic error banner in a screenshot. The API client maps a failed fetch, a malformed success response, and an HTTP response to different error classes; the Network record is needed to identify which one actually occurred.
