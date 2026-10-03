# App shell: router, code splitting, error boundary

## Router

`main.jsx` uses `createBrowserRouter` + `RouterProvider` with one splat route (`path: "*"`) whose element holds the providers and `<App/>`. The real route table is still `routes/Router.jsx` (`useRoutes`). A data router is needed for `useBlocker` (see [../unsaved-changes/implementation.md](../unsaved-changes/implementation.md)).

Provider order: `ErrorBoundary(app) > ThemeProvider > LanguageProvider > AuthProvider > EmailVerificationProvider > App`.

## Route-level code splitting

- `routes/lazyPage.js` wraps `React.lazy`. Every page in `Routes.jsx` is lazy except `Home` and the three layouts, which stay in the entry bundle.
- If a chunk import fails (a tab running an old build after a deploy), the page reloads **once** (`sessionStorage` flag `smartspend:chunk-reload`, cleared after a successful import). A second failure reaches the error boundary instead of looping.
- Each layout wraps its `<Outlet/>` in `components/PageBoundary`, so the sidebar and header stay while a page chunk loads (`<Loading variant="page"/>`).
- Guards are unchanged (`RequireAuth`/`GuestOnly` wrap the layouts).
- Build comparison (production build, uncompressed / gzip): the entry `index-*.js` went from 1,918.39 kB / 499.98 kB to 319.66 kB / 98.81 kB. The large chunks that remain load on demand: `PdfText` (react-pdf) 1,201.63 kB, `i18n` 345.36 kB, charts `CategoricalChart` 255.24 kB.

## Error boundary

- `components/ErrorBoundary/ErrorBoundary.jsx` catches **render** errors (not API errors, which pages show with `getApiErrorMessage`).
- `variant="app"` (around the providers) fills the screen: Retry, Reload page, Go to home. `variant="page"` (inside `PageBoundary`) replaces only the page area and resets when the route changes. In the dashboard layout its third action goes to `/dashboard`.
- The message is localized (`common.errorBoundary.*`). The technical message is shown only in development; the stack goes to `console.error` only.
