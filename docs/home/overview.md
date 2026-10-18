# Home — Overview

The public landing page at `/` (`PATH.HOME`). It is the approved SmartSpend landing design (Edition 03.2), integrated as source: plain JSX and scoped CSS, no Tailwind and no prebuilt bundle. It makes no API calls.

## Route and layout

`Routes.jsx` mounts `Home` under `PublicLayout variant="landing"`. That variant renders only the `<Outlet/>`: the landing brings its own header (the floating island) and footer, so the shared `PublicNavbar` / `PublicFooter` are not rendered on `/`. Every other public page (`/features`, `/about`, …, the not-found page) uses the default `PublicLayout` with the shared navbar and footer, unchanged.

`PublicLayout` still owns fragment scrolling for both variants: on `/#section` it scrolls the target to 110px below the top, smoothly unless the device asks for reduced motion or the landing's motion switch is off. Fragments of the previous home page (`#how-it-works`, `#security`, `#dashboard-preview`) are mapped to their current sections by `resolveHomeSection()` in `homeAnchors.js`.

## Composition

`src/features/PublicPage/Home/Home.jsx` wraps the page in `LandingProvider` and renders, in order:

| Section | Component | Id |
| --- | --- | --- |
| Header (island, mobile sheet) | `LandingHeader` | — |
| Hero: logo and name, headline, Gravity Stars background | `Hero` | `top` |
| Capability ribbon (decorative) | `Ribbon` | — |
| Interactive demo: overview, budgets, goals | `ProductDemo` | `experience` |
| Features bento | `Features` | `features` |
| Smart capture example | `Capture` | `capture` |
| Assistant example | `Insights` | `intelligence` |
| Clarity and control | `Trust` | `trust` |
| Business (in development) | `Business` | `business` |
| FAQ | `FAQ` | `faq` |
| Final call to action | `FinalCTA` (in `Closing.jsx`) | — |
| Footer | `LandingFooter` (in `Closing.jsx`) | — |

Plus `ExpenseDialog`, `InfoDialog` (business, control, about) and the "added to the demo" toast. Section ids are constants in `homeAnchors.js` (`HOME_SECTIONS`); link to them with `getHomeSectionPath(id)` or the `SectionLink` component, which go through the router.

## Where actions lead

`usePlatformDestination()` (`landingUi.js`) reads `useAuthContext()`; the route guards still decide what happens next.

| Control | Signed out | Signed in |
| --- | --- | --- |
| Hero, final CTA, About dialog: "Start with SmartSpend" | `/account-type?intent=register` | "Open SmartSpend" → `/dashboard` |
| Header island button | "Sign in" → `/account-type?intent=signin` | "Open SmartSpend" → `/dashboard` |
| Mobile menu | "Start with SmartSpend" (register) and "Sign in" | "Open SmartSpend" → `/dashboard` |
| Footer "Open the platform" | `/account-type?intent=signin` | `/dashboard` |
| Header and footer section links, "Try the interactive demo", "Back to the demo", toast "View it" | `/#experience`, `/#capture`, … | same |
| Footer bottom row | Contact `/contact`, Support `/support`, Terms `/terms.html`, Privacy `/privacy.html` | same |
| "About SmartSpend", "How we think about clarity and control", "Explore the concept" | Open `InfoDialog` | same |
| Language, theme, motion | App language and theme; landing motion switch | same |

The public navbar on the other pages links to `/#features`, `/#capture`, `/#trust` and `/#faq`.

## Preferences

`LandingProvider` exposes `useLanding()`, the interface the design was written against (`t`, `lang`, `theme`, `animated`, `reduced`, `toggleLanguage`, `toggleTheme`, `toggleMotion`):

- **Language** is the app's (`LanguageProvider` / i18next, stored as `i18nextLng`). Arabic is RTL, English LTR.
- **Theme** is the app's (`ThemeProvider`, stored as `theme`). The provider also sets `html[data-theme]` before the first paint so the landing never flashes the wrong theme.
- **Motion** is the landing's only own preference (`smartspend-landing-motion`). While the page is mounted, `html[data-motion]` is `on` or `off`; it is `off` when the switch is off or the device asks for reduced motion (the switch is then disabled). The attribute is removed when leaving the page.
- The page title, `meta[name=description]` and `meta[name=theme-color]` follow the language and theme, and the app's values come back on leaving.

## Copy

All landing copy is in the `landing` i18next namespace, `landingMessages.js` (Arabic and English), registered on the app instance like the `access` and `experience` bundles. Shared labels come from the main locale files: `home.nav.signIn` and `home.footer.links.*`.

- Figures inside Arabic sentences are wrapped by `ltr()` (left-to-right isolates) before interpolation. Keep that when editing sentences with amounts or percentages.
- Month counts use i18next plurals (`demo.goals.months_*`), including the Arabic forms (`شهر واحد`, `شهرين`, `8 أشهر`, `12 شهرًا`).
- The sample receipt is intentionally English in both languages.

## Demo data

`landingDemo.js` holds the illustrative figures and the arithmetic (`DEMO`, `demoTotals`, `parseAmount`, `monthsToGoal`, `money`, `monthAfter`). Expenses added in the demo, capture or dialog live in `Home.jsx` state only and reset on reload: no API module is imported, nothing is sent. Every example keeps its visible label ("Sample data", "Interactive example", "Illustrative response", "Illustrative goal"), and the business version is labelled "In development" wherever it appears.

## Styles

`styles/landing.css` imports, in order: `preflight.css`, `fonts.css`, `tokens.css`, `base.css`, `gravity-stars.css`, `components.css`, `header.css`, `hero.css`, `demo.css`, `sections.css`, `motion.css`, `signature.css`, `integration.css`.

- The design files were scoped once from the design source and are now edited here directly. Every selector sits under `.smartspend-landing`, after any `html[lang]`, `html[dir]` or `:root[data-theme]` compound, so the design's own cascade is unchanged and nothing reaches other screens.
- Document-level rules (scroll padding, background, scroll behavior) use `html[data-motion]`, which exists only while the landing is mounted.
- Keyframes are prefixed `landing-` because the app ships one global stylesheet (`cssCodeSplit: false`).
- `preflight.css` is Tailwind's reset scoped with `:where()`: it outranks `index.css` element rules (headings, links, inputs) without outranking any landing rule.
- Dialogs render into a `.smartspend-landing--layer` element appended to `<body>`, outside `#root` (which turns inert while a dialog is open), so their styles still apply.
- `gravity-stars.css` replaces the Tailwind utilities the background component used.
- `integration.css` has the app-only additions: the footer's help and policy row, the second mobile-menu button, and turning off `index.css` smooth scrolling when motion is off.

When adding rules, keep them under `.smartspend-landing` and give new keyframes the `landing-` prefix.

`publicShared.css` is not part of the landing: it holds the rules of the previous home stylesheet that the public navbar, footer, information pages and the not-found page still use. `Home.jsx` imports it first so the single CSS bundle keeps their order.

## Assets and licenses

- Logo: `src/assets/smartspend-logo-256.png`, a 256px resample of the supplied logo used by the design. The rest of the app keeps `smart-spend-logo.png`.
- Fonts (SIL Open Font License 1.1), woff2 in `src/assets/fonts` with their license texts: IBM Plex Sans Arabic 300–700 (`IBMPlexSansArabic-OFL.txt`), Plus Jakarta Sans 400–700 (`PlusJakartaSans-OFL.txt`), Instrument Serif 400 and italic (`InstrumentSerif-OFL.txt`). No CDN requests.
- Icons: `lucide-react` (1.59.0, the design's version); `.lucide` sets the 1.5 stroke weight.
- Background: Gravity Stars from SmoothUI by Eduardo Calvo (`github.com/educlopez/smoothui`, `packages/smoothui/components/gravity-stars`; also on 21st.dev as `@educalvolpz/gravity-stars`), MIT, Copyright (c) 2024 Eduardo Calvo. The supplied file matches that source at commit `1534f0d` except for the `cn` import path. `components/GravityStars.jsx` is a JSX port with the simulation unchanged; the full notice is `public/licenses/gravity-stars.txt`, deployed at `/licenses/gravity-stars.txt` (the minified bundle drops source comments, so the notice ships as its own file).

## Tests

`tests/landing.test.mjs` renders the real route table in jsdom and covers: one header and footer on `/` and the shared chrome elsewhere, every CTA destination signed in and out, protected-route redirect, the mobile menu, the legal links, language/theme/motion preferences and their storage keys, the demo arithmetic and its consistency across sections and languages (ported from the design's `verify-ui.mjs`), missing translation keys, and that no `fetch` happens.
