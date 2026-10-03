# Auth — Design System

All six auth pages share one visual system. The sign-in page was the reference, and every page is now composed from the same tokens, layout rules, and components. Page-specific CSS is limited to content that exists on only one page.

## Layers

| Layer | Where | Owns |
| --- | --- | --- |
| Global tokens | `src/index.css` | Brand colors, surfaces, text, shadows, radii, fonts, light/dark values |
| Auth tokens + layout | `src/layouts/AuthLayout/AuthLayout.css` | `--auth-*` tokens, the card, column sizing (`.auth-card > .auth-promo`, `.auth-panel`), `.auth-form` stack, breakpoints |
| Shared components | `src/features/Auth/components/<Name>/` | Every reusable piece of auth UI (below) |
| Page CSS | `src/features/Auth/<Page>/<Page>.css` | Only page-unique content (Register features, OTP inputs, password strength) |

Login, Forgot Password, and Password Changed have no page stylesheet at all.

## Auth tokens

The tokens are defined on `.auth-card`, with a `:root[data-theme="dark"] .auth-card` override block. They are derived from the global tokens (mostly `color-mix()`), so the brand palette stays in `index.css`.

| Token | Purpose |
| --- | --- |
| `--auth-card-border`, `--auth-card-shadow` | Card frame |
| `--auth-control-bg`, `--auth-control-bg-hover`, `--auth-control-border`, `--auth-control-border-hover` | Inputs, OTP boxes, checkbox, social buttons, strength panel |
| `--auth-label`, `--auth-muted` | Label and secondary text |
| `--auth-link`, `--auth-link-hover` | Links and text buttons |
| `--auth-danger`, `--auth-warning`, `--auth-success` | Status **text** colors, adjusted per theme for small-text contrast |
| `--auth-promo-bg`, `--auth-promo-highlight`, `--auth-promo-accent` | Brand panel gradient and glows |

**Dark-mode decisions:**

- **Controls:** these use a background *darker* than the card (a mix of `--color-background` and `--color-surface`) plus a more visible border, so they don't blend into the card.
- **Status text:** the danger, warning, and success text colors are lightened in dark mode and darkened slightly in light mode. The raw brand values (`#dc2626`, `#ea580c`, `#16a34a`) are below comfortable contrast for 12–13px text. Status *fills* (bars, badges, check circles) still use the raw `--color-*` tokens.
- **Brand panel:** switches to a deeper navy gradient with weaker glows.

## Layout and proportions

| Element | Value |
| --- | --- |
| Card | `--radius-xl` (28px), 14px inner padding, 48px column gap |
| Brand panel | `flex: 0 1 620px`, `min-height: 540px`, 20px radius, stretches to the form's height |
| Form panel (`.auth-panel`) | `flex: 0 1 432px`, `margin-inline: auto`, 32px/16px padding, vertically centered |
| Form stack (`.auth-form`) | Flex column, 18px gap (Register uses 16px), 32px below the heading |
| Controls | 46px inputs and buttons, 44px social buttons, `--radius-md` (12px) |

Because the brand panel has a shared minimum height and stretches, the card keeps the same proportions on every page. Short forms (Forgot Password, Password Changed) center inside it, and the long Register form grows the card while the panel stretches with it.

## Shared components

All are in `src/features/Auth/components/`. Each has a co-located `.css` file, except `PasswordField` (which reuses `AuthField.css`) and `AuthIcons`.

| Component | Used by | Notes |
| --- | --- | --- |
| `AuthPromo` | All pages | Brand panel: logo, `title` (also its `aria-label`), `subtitle`, and `children` for page extras. Also provides `.auth-promo__chips` / `.auth-promo__chip` (a dot marker, or an inline SVG icon when present) |
| `AuthHeading` | All pages | `h1` + subtitle. Optional decorative `icon` badge. `tone="success"` gives the green circular badge with a one-time pop-in |
| `AuthSteps` | Recovery pages | 4 bars filled from inline-start. `current` is wider. Includes a screen-reader-only "Step X of Y" (`auth.common.step`) |
| `AuthField` | Login, Register, Forgot | Label (`htmlFor`), input, optional `icon` / `action` / `labelAction`, `errors` list with `aria-describedby`, `invalid`, `describedBy`. Other props go to the `<input>` |
| `PasswordField` | Login, Register, Reset | `AuthField` + show/hide toggle (`aria-pressed`, `aria-controls`, label `auth.common.showPassword`) |
| `AuthCheckbox` | Login, Register | Rounded-square custom checkbox. Label content is `children` (may contain a link). Optional `errors` |
| `AuthButton` | All pages | Primary CTA. `<button>` by default, router `<Link>` when `to` is set. `loading` adds a spinner, disables the button, and swaps in `loadingLabel` |
| `AuthAlert` | Login, Register, Forgot, Reset, Verify email | Form-level message. Default: red error box (`role="alert"`). `variant="success"`: green box (`--auth-success` on `--success-soft`, `role="status"`). `dir="auto"`, so a backend message in the other language (staging answers in Arabic) keeps its own direction and punctuation |
| `AuthSocial` | Login, Register | Divider + Google / Apple buttons. With `onGoogleCredential`, Google's GIS button is layered transparently over the Google button ([google-sign-in](google-sign-in/implementation.md)). `disabled` disables both buttons. Apple is still a placeholder |
| `AuthSwitchPrompt` | Login, Register | "Don't have an account? / Already have an account?" line |
| `AuthBackLink` | Forgot, Verify, Reset | Secondary pill link with an arrow that mirrors in RTL |
| `AuthIcons` | Everywhere | Inline SVG icons (stroke icons use `currentColor`; Google keeps its brand colors) |

Only extract a new shared component when at least two pages need it. Single-page UI (Register's feature cards, the OTP inputs, the strength panel) stays in the page.

## Interaction states

| State | Treatment |
| --- | --- |
| Hover | Inputs: stronger border. Buttons: 1px lift + brighter/darker. Links: underline + hover color. Back link: soft pill background |
| Focus | Inputs and OTP boxes: primary border + 4px `--input-focus-ring`. Buttons and links: 2px primary outline (global `:focus-visible` or explicit) |
| Invalid | `aria-invalid="true"` → `--auth-danger` border; focus ring switches to `--danger-soft` |
| Disabled | Inputs 70% opacity; primary button 55% opacity, desaturated, no shadow |
| Loading | Primary button stays at 82% opacity, `cursor: progress`, with a spinner |
| Autofill | Repainted with an inset shadow so autofilled fields keep the theme colors |

## Responsive breakpoints

| Width | Behavior |
| --- | --- |
| > 1200px | Full two-column card |
| ≤ 1200px | Gap 32px, form panel 412px, promo title 27px |
| ≤ 1024px | Shell gutter 16px, gap 24px, form panel 380px, compact brand panel (smaller logo, 24px title) |
| ≤ 900px | Brand panel hidden. The card becomes a centered `min(100%, 520px)` form card with 40/36px padding |
| ≤ 560px | 20px card radius, 28/20px padding, 25px heading, 16px form gap |
| ≤ 360px | Social buttons stack |

A headless-Chrome sweep of every page × {1440, 1100, 820, 390, 320}px × light/dark × en/ar found no horizontal overflow.

## RTL and i18n

- Logical properties throughout (`inset-inline-*`, `padding-inline`, `margin-inline`), so icons, toggles, and the orbiting ring lights mirror automatically.
- **Explicit `[dir="rtl"]` rules** exist only for:
  - resetting heading `letter-spacing` to 0, since negative tracking breaks Arabic joining;
  - extra line-height on promo titles;
  - flipping the divider gradients;
  - mirroring the back-link arrow and its hover nudge;
  - the Verify page's users-pill padding.
- **LTR content inside Arabic text:** the OTP inputs are forced `dir="ltr"`, and the masked phone number is wrapped in `<bdi>`.
- **Copy:** every visible string and aria-label comes from `auth.*` keys in both locales. Shared strings live in `auth.common` (`showPassword`, `step`).

## Motion

- Brand panel rings rotate slowly (36–64s), and the success badge pops in once.
- Hover lifts and color transitions run at 160–240ms.
- Every one of these is disabled or reduced under `prefers-reduced-motion: reduce`. The loading spinner is kept, but slowed to 1.6s, because it is the only progress indicator.
