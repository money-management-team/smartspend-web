# Administrator UI preview

Run `npm ci`, `npm run dev`, and open `/admin` (direct navigation is supported).
The first screen follows the supplied SmartSpend reference. It lives entirely in
`src/features/Admin`, with a lazy route in `src/routes/AdminRoutes.jsx` and the
`PATH.ADMIN` constant. Existing personal and public layouts are unchanged.

The shell, details dialog, growth chart and overview have separate components.
All styles use the `admin-` prefix; theme tokens are scoped to `.admin-app`.
Translations live under `admin` in both existing locale files. The existing
ThemeProvider and LanguageProvider own persistence and document direction.

## Available interactions

- English/Arabic, light/dark, including RTL and remembered preferences.
- Responsive navigation with desktop collapse and mobile menu.
- Section search (Enter to open, Ctrl/Cmd+K to focus, Escape to dismiss).
- Priority details, notifications, profile and help in keyboard-accessible dialogs.
- Refresh updates the **demo** timestamp; export downloads a localized UTF-8 CSV.
- Planned navigation sections explicitly explain they are not implemented yet.

## Data and access

This is a public **synthetic-data preview**, not a production admin session.
It makes no admin API requests and never reads personal balances or transactions.
The displayed identity, metrics, chart and service statuses are demo fixtures.
Before connecting real data, add server-enforced administrator authorization and
a dedicated admin route guard; personal-user sign-in alone is insufficient.

## Verification

`npm test` checks translation availability and key parity (Node's built-in runner).
`tests/admin.browser.mjs` exports `runAdminSmoke(page)`, for a Playwright page
already on the running app origin. It checks four modes, persistence, metrics,
dialog dismissal, search Enter regression, translated status messages, CSV
contents, collapse and mobile/tablet overflow. It changes only browser test storage.

Run `npm run build` and lint changed files:

```sh
npx eslint src/features/Admin src/routes/AdminRoutes.jsx src/routes/Router.jsx src/routes/Path.js tests
```

Full-repository lint currently has four pre-existing errors: `set-state-in-effect`
in `src/contexts/auth/authProvider.jsx`, an unused import in the public
`DashboardPreview.jsx`, and two `only-export-components` errors in `src/i18n.jsx`.
The existing main bundle triggers Vite's size advisory. No dependencies were added
or upgraded; `npm ci` reports six high-severity dependency findings in the existing lockfile.
