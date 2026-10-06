# Home — Overview

The public landing page at `/` (`PATH.HOME`), rendered inside `PublicLayout`. It is fully static: it makes no API calls.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Page composition, runtime behavior, CSS structure (this file) |
| [hero/implementation.md](hero/implementation.md) | Hero section: markup, styling, responsive, RTL, dark mode |

The other sections (Features, AI, Steps, Security, Dashboard preview, FAQ, Ready) are not documented yet. Add a subfolder here for a section the next time it changes.

## Composition

`src/features/PublicPage/Home/Home.jsx` renders, in order:

1. `HomeBackgroundDecor` (ambient background layer)
2. `<main>`:
   - `HeroSection`
   - `FeaturesSection`
   - `AISection`
   - `StepsSection`
   - `SecuritySection`
   - `DashboardPreview`
   - `FAQSection`
   - `Ready`

All components live in `src/features/PublicPage/Home/components/`. All copy comes from the `home.*` translation keys.

## Runtime behavior (Home.jsx)

- **Scroll reveal:** on mount, elements matching the `revealGroups` selectors get `home-reveal home-reveal--{variant}` and a staggered `--reveal-delay`. An `IntersectionObserver` then adds `is-visible` as each element scrolls into view.
  - With reduced motion, or without `IntersectionObserver`, everything is revealed immediately.
  - The hero is **not** in `revealGroups`. It uses its own CSS-only `hero-entrance` animations.
- **Parallax:** on precise-pointer devices without reduced motion, pointer movement sets `--home-parallax-x/-y` (and `-inverse`) on `.home-page`. Background layers consume these variables.

## CSS structure

All home styles, plus the public CTA and footer chrome, live in one file: `src/features/PublicPage/Home/Home.css`. It is **layered**: later "FINAL …" sections intentionally override earlier rules for the same selectors.

- Before changing a property, search the whole file for the selector.
- A new pass for a section goes at the end of the file, scoped under that section's root class (for example `.hero-section …`). The scope gives the new rules enough specificity to win regardless of earlier media queries.
- The page-level tokens are on `.home-page`: `--home-glass`, `--home-line`, the glow colors, `--home-container-width`, and `--home-edge-gap`. They have dark overrides under `:root[data-theme="dark"] .home-page`.
- A global `prefers-reduced-motion` block near the "REVEAL + ENTRANCE" section neutralizes all animations and transitions inside `.home-page`.

## Known issues (outside the hero)

- **Features section:** its eyebrow renders the raw key `HOME.FEATURES.EYEBROW` (the translation is missing).
- **Features section on phones:** the heading overlaps its paragraph at around 390px.

## Calls to action

Every visible button on the page does something real:

| Where | Control | Action |
| --- | --- | --- |
| Hero | Get started (`home-primary-button`) | `Link` to the account type page (register intent) |
| Hero | Watch demo | `#dashboard-preview` anchor: scrolls to the product preview |
| AI section | View insights (`ai-primary-button`) | `Link` to `PATH.USER.AI_ASSISTANT`; signed-out visitors sign in first and then arrive there ([redirect](../auth/post-auth-redirect.md)) |
| AI section | See recommendations | `Link` to `PATH.PUBLIC.FEATURES` |
| AI section mock composer | Send arrow | Decorative (`aria-hidden`), no longer a button |
| Ready section | Primary / Contact | `Link`s to register and `PATH.PUBLIC.CONTACT` |
| FAQ | Question buttons | Toggle the answer |

## Sample data and translations

The hero card, the dashboard preview, the AI example and the feature illustrations show example numbers. They are marked as examples (a "Sample data" tag on the hero card, "Illustrative example" on the AI card and the preview heading), and all their words come from `home.sample.*` (both locale files): category names, merchants, "6 months", "net", "used", "left", "spent", "Bank", "Wallet", the budget alert. Month labels on the preview chart come from `Intl` for the active language. The brand name "Smart Spend" and amounts are not translated. The preview's summary cards use `.home-preview-card` (formerly `.dashboard-summary-card`, which clashed with the dashboard).
