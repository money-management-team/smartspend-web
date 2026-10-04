# Code splitting and CSS order

## What is lazy

Every page is loaded on first visit with `React.lazy` (declared in `src/routes/lazyPages.js`, used by `src/routes/Routes.jsx`): the auth pages, every dashboard page, and the experience pages. These stay in the main bundle on purpose:

- the layouts (`PublicLayout`, `AuthLayout`, `DashboardLayout`) and the route guards, so the navigation chrome never waits;
- the home page and the not-found page (the landing page must render at once);
- the public information route (it already lazy-loads its own page).

PDF generation was already lazy (`@react-pdf/renderer`, about 1.2 MB, loaded only when a PDF is exported).

`src/routes/RouteSuspense.jsx` wraps the page area of each layout in an error boundary plus `Suspense`. The fallback is the branded `<Loading variant="page" size="large" />`, which fades in after 150 ms so a cached chunk never flashes a spinner. Because it wraps only the page area, the sidebar and header stay mounted and the layout doesn't jump. The error boundary resets on navigation (see [error handling](../error-handling/error-boundary.md)), so a chunk that fails to download shows the fallback inside the layout and the user can still navigate.

## Why the CSS is still one file

All styles are global. Many page and component stylesheets share class names and rely on source order. With per-chunk CSS (Vite's default) the cascade would depend on which page happened to load first. `vite.config.js` therefore sets `build.cssCodeSplit: false`: one stylesheet, in a fixed order. The JavaScript is split; the CSS is not.

Two follow-ups were needed to keep the result identical to before:

- `features/Dashboards/User/financeExperience.css` overrides page styles and used to be bundled after them. Its rules are now nested in `:root { ... }` (one extra class of specificity) so they win over a page's single-class rules whatever the order. `@keyframes` stays outside the block.
- The home page preview and the dashboard summary cards both used `.dashboard-summary-card`. The home page copy is now `.home-preview-card`, so the two no longer override each other depending on load order.

When adding a page: add it to `lazyPages.js`, keep its stylesheet imported by the page as usual, and avoid class names that another feature already uses.

## Build sizes (`npm run build`)

| | Before | After |
| --- | --- | --- |
| Main JS (`index-*.js`) | 1,918.77 kB (500.13 kB gzip) | 318.99 kB (98.52 kB gzip) |
| CSS (one file) | 624.07 kB (89.16 kB gzip) | 647.68 kB (92.74 kB gzip) |
| `PdfText` chunk (lazy) | 1,201.63 kB (444.60 kB gzip) | unchanged |

The CSS grew by the new components' styles (search, dialogs, error and state blocks, the shared hero rules). Larger remaining chunks: `i18n` (both locale files, about 348 kB) and the charts library (`CategoricalChart`, about 255 kB), which loads with the pages that draw charts. The 500 kB warning that remains is the lazy PDF chunk.
