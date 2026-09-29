# Home Hero — Implementation

The first section of the landing page:

- `src/features/PublicPage/Home/components/HeroSection.jsx`
- The styles are in `src/features/PublicPage/Home/Home.css`. The authoritative block is **"FINAL HERO POLISH"** at the end of the file.

## Markup

```
section.hero-section
  .home-container
    .hero-section__grid                        2 columns > 980px, 1 column below
      .hero-section__content
        span.home-badge                        LuSparkles + home.hero.badge
        h1                                     titleStart + <span>titleHighlight</span>
        p                                      home.hero.description
        .hero-section__buttons
          Link.home-primary-button → PATH.AUTH.REGISTER
          button.home-secondary-button         FiPlayCircle + watchDemo (no handler yet)
        .hero-users                            3 decorative avatars + home.hero.users
      .hero-dashboard[aria-hidden]             decorative product preview
        DashboardMock
          .dashboard-mock__top                 3 dots (+ ::after address pill)
          .dashboard-mock__balance             total, then income / expenses / savings
          .dashboard-mock__bottom
            .dashboard-mock__chart             monthly budget + 6 × .fake-bars span
            .dashboard-mock__transactions      3 × p.dashboard-mock__tx-row (.is-positive for income)
    .hero-stats                                4 × Stat
      article.hero-stat(--success|--insights|--warning)
        span.hero-stat__icon + strong + small
```

Every element also carries its `hero-entrance hero-entrance--*` class, which gives a CSS fade-up on load. The global reduced-motion block disables it.

## Styling decisions

- **Scope:**
  - Every rule in the final block is prefixed with `.hero-section`, giving it specificity (0,2,x). It therefore beats the earlier hero passes, including their media queries.
  - Because of that, responsive sizes are restated in the final block itself.
  - RTL heading rules use `[dir="rtl"] .hero-section …` (0,3,x) so they still win.
- **Local tokens** (on `.hero-section`, overridden in dark mode):

  | Token | Purpose |
  | --- | --- |
  | `--hero-card-inset` | Background of the mock's inner cards and address pill. Lighter than the surface in light mode; *darker* inset in dark mode |
  | `--hero-bar` | Non-highlighted budget bars |
  | `--hero-success-text` | Income amount (contrast-adjusted per theme) |
  | `--hero-highlight` | Brand gradient (primary → insights) on the highlighted headline phrase |

- **Balance labels:** the global `small { color: var(--text-secondary) }` from `index.css` made the labels on the blue balance card nearly invisible in light mode. The final block sets them explicitly to light, semi-transparent white.
- **Budget bars:** their heights come from `nth-child` (44–90%), with the 4th bar highlighted as "current month". The earlier CSS expected a `--h` variable that the markup never set, so the chart used to render empty.
- **Motion:** the mock floats ±5px on an 8s loop (`hero-mock-float`, using the independent `translate` property so it doesn't fight the entrance `transform`), and a soft blurred brand glow sits behind it.

## Responsive behavior

| Width | Behavior |
| --- | --- |
| > 980px | Two columns. Copy is start-aligned (this overrides an older ≤1050px rule that centered it while still in two columns). Heading `clamp(46px, 3.6vw + 14px, 72px)` |
| ≤ 980px | Single column, centered copy. Preview capped at 680px. Heading `clamp(40px, 6.4vw + 8px, 62px)`. Stats in 2 columns |
| ≤ 680px | Full-width buttons, tighter mock padding, address pill hidden |
| ≤ 480px | Transactions card hidden (earlier rule). Compact balance chips and stats |

The home-page sweep in headless Chrome (1440, 1100, 820 and 390px, light/dark, en/ar) found no horizontal overflow.

## RTL and i18n

- All copy comes from `home.hero.*`, `home.stats.*` and `home.preview.*`. No keys were added in this pass.
- Money amounts in the mock are wrapped in `<bdi>` so the currency sign stays attached in Arabic.
- Headings drop negative letter-spacing and use a taller line-height in RTL. The layout mirrors through logical properties.
- The merchant names in the mock ("Salary", "Whole Foods", "Metro Card") are hard-coded English sample data, unchanged from before.

## Accessibility

- The dashboard preview is `aria-hidden="true"`: it is illustrative, and reading fake balances aloud would confuse screen-reader users.
- Decorative icons and avatars are `aria-hidden`. The redundant `aria-label` on the users row, which duplicated its visible text, was removed.
- Both CTAs have a visible `:focus-visible` outline.

## Known gaps

- "Watch the demo" has no handler.
- Much of the earlier hero CSS targets markup that doesn't exist in `HeroSection.jsx` (`hero-visual`, `hero-float-card`, sparkline, `hero-cta`, …). It is inert. It was left in place because it is part of in-progress, uncommitted work in `Home.css`.
