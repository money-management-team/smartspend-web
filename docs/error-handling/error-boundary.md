# Error boundary

Unexpected rendering errors (a bug, malformed data that crashes a component, a lazy chunk that fails to download) no longer leave a blank page.

## Where it sits

| Boundary | File | Covers | Resets |
| --- | --- | --- | --- |
| App | `src/Root.jsx` (`<ErrorBoundary variant="app">` around the auth providers and `<App />`) | Everything inside the theme and language providers | Reload |
| Page | `src/routes/RouteSuspense.jsx` (`variant="page"`, `resetKey={pathname}`) | The page area of the dashboard and auth layouts | Navigating to another route, or "Try again" |

The page boundary keeps the sidebar and header on screen, so one broken page never traps the user.

## The fallback (`src/components/ErrorBoundary/`)

`ErrorFallback` shows an icon, "Something went wrong", a short reassurance and three actions: **Reload page**, **Try again** (page boundary only, re-renders without reloading) and **Go to dashboard** (a plain link, a full page load, because router state may be what broke). Nothing from the error (message, stack) is ever rendered. It uses the brand tokens, so it follows light and dark themes, uses logical properties for RTL, and stacks full-width buttons below 480 px. Copy: `common.errorBoundary.*` (EN and AR).

In development the error and its component stack are logged with `console.error`; in production they are not printed.

## What it does not do

It catches errors thrown while rendering or in lifecycle methods. It does not replace the normal states for expected failures: API errors, validation and permission problems are handled by each page (see [states](states.md)), and errors inside event handlers or promises are handled where they occur.

## Routing note

`src/main.jsx` now mounts a data router (`createBrowserRouter` with one splat route rendering `Root`) instead of `<BrowserRouter>`. The route table is unchanged (`Router.jsx` still uses `useRoutes`); the data router is what makes `useBlocker` available for [unsaved-changes protection](../unsaved-changes/implementation.md).
