# Loading indicator — Implementation

`src/components/Loading/Loading.jsx` + `Loading.css`: the shared loading state used by the route guards and every dashboard page, list, modal and form.

## API

```jsx
<Loading />                                        // translated "Loading..." (common.loading)
<Loading message={t("dashboard.budgets.states.loading")} />
<Loading message={false} />                        // no visible text; screen readers still hear "Loading..."
<Loading size="small" variant="inline" message={…} />
```

| Prop | Values | Default |
| --- | --- | --- |
| `message` | string, or `false` to hide the text | `t("common.loading")` |
| `size` | `small` (22px), `medium` (48px), `large` (92px, branded) | `medium` |
| `variant` | `inline` (in a row), `section` (min 220px tall), `page` (min 70vh) | `section` |
| `className` | extra class on the root | — |

The root keeps the `loading` class; page stylesheets use `.x > .loading` for spacing.

## Anatomy

| Element | Role |
| --- | --- |
| `.loading__halo` | Soft radial glow behind the ring, breathing (2.4s) |
| `.loading__track` | Faint full ring |
| `.loading__spinner` → `.loading__arc` | Conic gradient masked into a ring: transparent tail → `--primary` → `--insights`, rotating (1.1s, linear) |
| `.loading__spinner` → `.loading__head` | Rounded, glowing dot at the arc's brightest end |
| `.loading__core` | Gradient dot in the center, pulsing |
| `.loading__message` | Text with a highlight sweeping across it |
| `.loading__sr-only` | Visually hidden "Loading..." when `message={false}` |

- All dimensions derive from `--loading-size` (ring thickness: `--loading-ring`), and the colors from `--loading-from` / `--loading-to` / `--loading-track`, which default to the brand tokens.
- `small` shows the ring only (no halo or core), so it fits inside form fields and rows.
- The whole indicator fades in after 150ms, so fast requests don't flash a spinner.

## Branded variant

`size="large"` replaces the pulsing core with the Smart Spend logo (`src/assets/smart-spend-logo.png`, transparent PNG, readable on light and dark) inside the ring, with a soft glow. The logo breathes (1.8s; static under reduced motion). The route guards (`RouteGuards.jsx`, while the session is restored) use `<Loading variant="page" size="large" message={false} />`, so the first screen a user sees is the logo and ring. Use it for full-page waits only; sections and forms keep the compact ring.

## Themes, RTL and motion

- Dark theme: only the track changes (`:root[data-theme="dark"]`); the brand colors are the same in both themes.
- The message's highlight sweeps in the reading direction (reversed under `[dir="rtl"]`). There's no `letter-spacing`, because it breaks the joining of Arabic letters. The sweep is only enabled where `background-clip: text` is supported; elsewhere the text is plain.
- `prefers-reduced-motion`: no fade-in, pulse, glow or sweep; the ring keeps a slow 2.4s rotation so loading is still visible.
- Accessibility: `role="status"`, `aria-live="polite"`, `aria-busy="true"`; the decorative indicator is `aria-hidden`.

## Where each level is used

| Wait | Loader |
| --- | --- |
| Session restore (route guards), the main Dashboard's first load, and every detail page's first load (account, transaction, transfer, recurring, budget, category, savings goal, debt, AI capture) | Branded: `variant="page" size="large"` with the page's own translated message (`message={false}` for the guards and account details) |
| Lists and sections inside a page (Accounts grid, budgets, ledger, calendar, notifications, reports, …) | Default `medium` ring in the section |
| Forms, modals, rows | `small` ring (inline) or the `medium` ring for option loading |

Keep the branded loader to the first full-page wait so the logo isn't repeated inside lists.

## Route loading

Lazily loaded pages use the branded loader as their `Suspense` fallback through `src/routes/RouteSuspense.jsx`; see [code splitting](../performance/code-splitting.md).
