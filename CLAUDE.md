# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Smart Spend web frontend: a personal-finance SPA built with React 19 + Vite 8 in plain JavaScript (JSX, no TypeScript). It talks to a separate backend API and is fully bilingual (Arabic RTL / English LTR) with light/dark themes.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the built dist/
npm run lint      # ESLint over the whole repo
npx eslint src/path/to/File.jsx   # lint a single file
```

There is no test framework configured.

Environment variables (`.env`):
- `VITE_API_BASE_URL`: the backend URL. If unset, `apiClient` falls back to `/api`. There is no Vite dev proxy.
- `VITE_GOOGLE_CLIENT_ID`: the Google Identity Services client ID, read in `src/features/Auth/components/AuthSocial/googleIdentity.js`. If unset, the Google sign-in button is disabled and a warning is logged in dev.

ESLint uses the flat config with `eslint-plugin-react-hooks` v7 (recommended), which includes the stricter React Compiler–style rules, plus `react-refresh`.

## Architecture

### Bootstrapping and routing
- `src/main.jsx` imports `./i18n` first (side-effect init), then wraps `<App/>` in `BrowserRouter > ThemeProvider > LanguageProvider > AuthProvider > EmailVerificationProvider`.
- `src/routes/Routes.jsx` defines four route groups, all mounted at `/`, which `Router.jsx` merges via `useRoutes`:
  - **public**: `PublicLayout`, with `Home` and the catch-all `NotFound`.
  - **guest**: `GuestOnly` + `AuthLayout`, for signin, register, and the password flows.
  - **email-link**: `AuthLayout` with no guard, for pages opened from emails (reset password, verify email) that must work signed in or out.
  - **user**: `RequireAuth` + `DashboardLayout`, for everything under `/dashboard/*`.
- Always reference URLs through the `PATH` constants in `src/routes/Path.js`.
- The guards in `RouteGuards.jsx` render `<Loading/>` while `AuthContext.initializing` is true.

### API layer (important)
- The real HTTP client is `src/features/Dashboards/User/api/apiClient.js`: a fetch-based `apiRequest(endpoint, { method, query, body, headers, signal, auth, timeoutMs })`. The same file also exports the session-storage helpers, `toMoneyString`, and `createIdempotencyKey`.
  - `src/services/api.js` is a legacy axios instance that nothing imports. Don't build on it.
- The backend responds with a `{ status: true, data, message, errors }` envelope. Any non-OK response, `status !== true`, or unparseable body throws `ApiError` with a `code`: `NETWORK_ERROR`, `TIMEOUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (409), `VALIDATION_ERROR` (field errors in `error.errors`), `RATE_LIMITED`, `SERVER_ERROR`, `MALFORMED_RESPONSE`, or `WORKSPACE_UNAVAILABLE`.
- Show errors to users with `getApiErrorMessage(error, t)`, which maps codes to the `api.errors.*` translation keys.
- Every request sends `Accept-Language` taken from localStorage `i18nextLng`, or `ar` if nothing is stored.
- A 401 on an authenticated request clears the stored session and dispatches the `smartspend:session-expired` window event. `AuthProvider` listens for it and logs the user out.
- Each backend resource has a module next to the client (`budgetsApi`, `accountsApi`, `transactionsApi`, …) that wraps `apiRequest` and normalizes payloads.
- **Money**: send amounts as 4-decimal strings via `toMoneyString` (in `apiClient.js`). Do totals with `sumMoney` / `subtractMoney` in `features/Dashboards/User/utils/formatters.js`, which use BigInt minor units, instead of float math. `formatMoney` defaults to `ILS`.
- **Workspaces**: create calls require `workspace_id`. Get it from `resolveWorkspaceId()` in `api/dashboardApi.js`, which reads the `/dashboard` scope and caches the workspace in storage.
- **Idempotency**: money-moving writes (`POST /transfers`, `POST /transactions/income|expense`, `PATCH /transactions/{id}`) must send an `Idempotency-Key` header. Build keys with `createIdempotencyKey()`, or with `createIdempotentAttempt()` in `FinancialOperations/transactionHelpers.js`, which keeps one key per logical operation so a retry can't move the money twice. Exception: `POST /recurring-transactions/{id}/confirm-next` also moves money but sends no key, because the backend derives it from the occurrence (see `docs/recurring-transactions/confirm-and-skip.md`).
- For errors when creating, correcting, or reversing a transaction, use `getTransactionErrorMessage(error, t, context)` from `transactionHelpers.js`. `context` is `"create"`, `"correct"`, or `"reverse"`. It gives 403, 404, and 409 wording specific to transactions (idempotency conflict vs. already reversed), keeps the backend's domain message on a 422 (e.g. insufficient balance), and falls back to `getApiErrorMessage`.

### Auth
- `contexts/auth/authProvider.jsx` owns the session; consume it with `useAuthContext()`.
- The session is stored under the keys `ACCESS_TOKEN`, `user`, `workspace`, and `ROLE`:
  - in `localStorage` when "remember" is on;
  - otherwise in `sessionStorage`.
- On load, the provider restores the session through `GET /user`.
- `EmailVerificationProvider` (`contexts/emailVerification/emailVerificationProvider.jsx`) is the single owner of `GET /auth/email/status`:
  - it fetches once per session token;
  - `useEmailVerification()` exposes `{ status, error, loading, refresh, resend }`;
  - `useResendVerificationEmail()` wraps `resend` for UI buttons.
  - Read the status from here instead of calling the endpoint in a page.
- Auth pages are built from shared components in `src/features/Auth/components/` (`AuthPromo`, `AuthField`, `PasswordField`, `AuthButton`, …). The `--auth-*` design tokens and card layout live in `src/layouts/AuthLayout/AuthLayout.css`. Reuse these instead of adding per-page copies; see `docs/auth/design-system.md`.

### Page data-fetching pattern
Dashboard pages (e.g. `Budgets.jsx`) follow the same shape:
- a `useCallback` loader that takes an `AbortSignal`;
- a `useEffect` that creates an `AbortController` and aborts on cleanup;
- `AbortError` is ignored;
- errors are shown via `getApiErrorMessage`;
- `components/Loading/Loading` is shown while loading.

Not every dashboard page is wired to the backend yet. `Import` and `AIAssistant` are static UI with no API module. `Settings` uses `authApi` for Profile (`PUT /profile`) and Security (`PATCH /profile/password`, see `docs/auth/change-password/implementation.md`), but its Preferences tab is still a placeholder. Check a page for an `*Api` import before assuming it has backend support.

### i18n and RTL
- `src/i18n.jsx` sets up i18next with a single `translation` namespace. Resources are one file per language, `src/locales/en/en.json` and `src/locales/ar/ar.json`, with top-level sections `common`, `api`, `auth`, `dashboard`, and `home`. `fallbackLng` is `en`.
- Add every new key to **both** locale files. They are currently in exact key parity, and missing keys log a console warning in dev.
- The language is stored in localStorage `i18nextLng`. Changing it sets `<html lang>` and `<html dir="rtl|ltr">`, and `LanguageProvider` mirrors it into context.
- All UI must work in both directions:
  - prefer logical CSS properties (`inset-inline-*`, `margin-inline`, `padding-inline`);
  - add `[dir="rtl"]` overrides for physical transforms and icons;
  - avoid negative `letter-spacing` on Arabic text;
  - wrap LTR numbers or amounts in `<bdi>` inside RTL text.

### Styling
- Plain global CSS, with no CSS modules or Tailwind.
  - Each component imports its own co-located `.css` file.
  - Class names are BEM-style and prefixed with the component name (`budgets-page__state`, `hero-float-card--ai`). Because all CSS is global once imported, keep prefixes unique.
- Feature folder convention:
  - pages: `src/features/<Area>/<Page>/<Page>.jsx` + `.css`;
  - sub-components: `components/<Name>/<Name>.jsx` + `.css`.
- Design tokens live in `src/index.css`:
  - brand, gradient, surface, text, shadow, and font tokens on `:root`;
  - dark overrides under `:root[data-theme="dark"]`.
- `ThemeProvider` sets `data-theme` on `<html>` and persists it to localStorage `theme`.
- Use tokens instead of hard-coded colors (`--color-primary`, `--color-surface`, `--color-text-strong`, `--primary-soft`, `--gradient-primary`, `--font-heading`, …). Write theme-specific rules as `:root[data-theme="dark"] .selector`.
- Fonts: Tajawal for headings and large financial values; Cairo for the UI.
- `src/features/PublicPage/Home/Home.css` is large and layered: later "FINAL …" sections override earlier rules for the same selectors, so search the whole file before changing a property.
- `Home.jsx` adds `home-reveal*` classes to section selectors at runtime (IntersectionObserver) and drives the parallax CSS variables.
- Honor `prefers-reduced-motion`; `Home.css` has a global reduced-motion block.

## Documentation

Every feature, module, or major change must be documented in `docs/`, organized by feature.

- One folder per feature: `docs/<feature>/`, named in lowercase kebab-case (e.g. `docs/auth/`, `docs/savings-goals/`). Markdown (`.md`) only.
- Keep each file focused on one responsibility. Never put all documentation in one large file.
- Only create files that are useful for that feature, and never empty or duplicate ones.
  - A small feature may need only `overview.md` and `implementation.md`.
  - A complex feature can add focused files such as `requirements.md`, `flow.md`, `api.md`, `business-rules.md`, `validation.md`, or `edge-cases.md`.
- Where relevant, document architecture decisions, API behavior, validation rules, state management, RTL/i18n considerations, and important edge cases.
- Workflow for every task:
  1. Before implementing, inspect `docs/` and reuse the feature's folder if it exists.
  2. Decide which files to create or update.
  3. Implement.
  4. Update the docs so they match the final implementation.
- When changing an existing feature, update its existing docs rather than adding new ones, and keep them in sync with the code.
- Don't modify documentation for unrelated features.
