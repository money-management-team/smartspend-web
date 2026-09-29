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
| `size` | `small` (22px), `medium` (48px), `large` (72px) | `medium` |
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

## Themes, RTL and motion

- Dark theme: only the track changes (`:root[data-theme="dark"]`); the brand colors are the same in both themes.
- The message's highlight sweeps in the reading direction (reversed under `[dir="rtl"]`). There's no `letter-spacing`, because it breaks the joining of Arabic letters. The sweep is only enabled where `background-clip: text` is supported; elsewhere the text is plain.
- `prefers-reduced-motion`: no fade-in, pulse, glow or sweep; the ring keeps a slow 2.4s rotation so loading is still visible.
- Accessibility: `role="status"`, `aria-live="polite"`, `aria-busy="true"`; the decorative indicator is `aria-hidden`.
