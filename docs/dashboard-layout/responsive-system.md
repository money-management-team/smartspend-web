# Dashboard layout and responsive system

Applies to every route under `/dashboard/*` (`DashboardLayout` + pages).

## Ownership

| Concern | Owner |
|---|---|
| Sidebar width, header height, page gutter, content max-width, section/card gaps | Custom properties on `.dashboard-layout` in `src/layouts/DashboardLayout/DashboardLayout.css` |
| Page container (max-width, centering, no own padding) | One rule in `DashboardLayout.css`: `.dashboard-layout .dashboard-layout__content > :not(.email-verification-banner)` |
| Shared responsive fixes (form controls, dialogs, wrapping action rows, tap targets, focus ring) | `src/layouts/DashboardLayout/dashboardPrimitives.css` |
| Page-specific look (heroes, cards, tables) | The page's own co-located CSS and `features/Dashboards/User/financeExperience.css` |

Tokens: `--dashboard-sidebar-width` (218px), `--dashboard-header-height`, `--dashboard-content-max-width` (1280px), `--dashboard-page-padding-inline/block`, `--dashboard-section-gap`, `--dashboard-card-gap`, `--dashboard-card-radius`, `--dashboard-touch-target`.

**Rule for new pages:** do not set an outer `max-width`, `margin: 0 auto` or outer padding on the page root. The shell already does; the rule above has specificity (0,2,0) so legacy page roots that still declare them are neutralised. Before this change every page repeated `max-width: 1240px; padding: 28px 32px 50px` on top of the shell's own 24px, giving 50–56px gutters and inconsistent widths.

## Breakpoint scale

CSS variables cannot be used in `@media`, so use these literals:

| Name | Width | Behaviour |
|---|---|---|
| sm | 640px | phone: gutter 14px, dialogs near full-bleed, full-width hero buttons |
| md | 768px | tablet portrait |
| lg | 1024px | sidebar becomes an off-canvas drawer; gutter 24px; header menu button appears |
| xl | 1280px | wide desktop |

Older page files still contain other values (700, 720, 860, 960, 1120 …). They are component-specific reflow points and were left in place; new code should prefer the scale above.

## Shell behaviour

- Desktop: fixed 218px sidebar, `margin-inline-start` on `__main`.
- ≤1024px: sidebar is a drawer (`min(250px, 86vw)`), hidden with `visibility` when closed so it is skipped by keyboard and screen readers. An overlay button and the Escape key close it. The header menu button exposes `aria-expanded` / `aria-controls="dashboard-sidebar"`.
- The sidebar close button used to be nested inside the brand `<Link>`, so closing also navigated home. It is now a sibling.
- `__main` has `overflow-x: clip` as a safety net; it does not replace fixing real overflow (see below).
- Header: at ≤480px the search field collapses into a search button (it opens over the header; see [dashboard search](../dashboard-search/overview.md)) and `justify-content: space-between` keeps the menu at the inline start and actions at the inline end in both directions (an old RTL override that inverted this was removed).

## Overflow rules

- Single-column grids use `minmax(0, 1fr)`, not `1fr`, so wide children (tab rails, tables) cannot stretch the track. The Reports and Settings layouts overflowed at every width because of this.
- Wide tables keep their own `overflow-x: auto` scroller.
- Flex rows named `__actions`, `__pages`, `__head`, `__panel-head`, `__section-head` wrap; headings holding user data break anywhere.
- Inputs/selects/textareas default to `max-width: 100%; min-width: 0` through zero-specificity `:where()` rules.

## Dialogs

All dialogs (`.account-form-modal__dialog`, `.export-format-dialog__panel`, `.review-dialog__panel`, `.ai-feedback-dialog`) are capped at `100dvh - 32px` and scroll internally. On phones the modal backdrop padding is 10px and footer buttons become full-width 44px targets. The receipt review dialog keeps its own bottom-sheet layout.

## Accessibility

Icon-only header/sidebar buttons have translated `aria-label`s (`dashboard.header.openMenu|lightMode|darkMode|switchLanguage`, `dashboard.sidebar.close`, in both locales). Coarse pointers get 40px minimum control height. `:focus-visible` outlines use `--color-primary`.

## RTL / themes

Only logical properties are used in the new rules. Everything uses existing tokens, so dark mode follows `:root[data-theme="dark"]`.

## Verification

A headless-Chrome audit (mocked API with long Arabic/English names and 11-digit amounts) measured element bounds on all 27 dashboard routes at 360, 390, 430, 768, 820, 1024, 1280, 1440 and 1920px, in ar/en and light/dark, and found no element outside the viewport (excluding intentional scrollers and the closed drawer).

## Shared page hero

The dark-blue hero card (eyebrow "SMARTSPEND / FINANCE", heading, subtitle, white action button) is defined once in `features/Dashboards/User/financeExperience.css`. Accounts, Transfers, Recurring, Savings Goals, Debts, Settings and AI Captures use it, and so do Budgets, Categories, Calendar, Notifications and Report Exports (`.budgets-header`, `.categories-page__header`, `.calendar-page__header`, `.notifications-header`, `.report-exports-page__header`). To bring another page in, add its header, copy and button selectors to those lists. Reports keeps its own header band, and Imports and the main Dashboard are unchanged.

The same stylesheet gives every remaining dashboard page the Accounts frame (1320px max width, same padding) and extends the hero to Imports and the experience pages (`.exp-hero`: attention, monthly review, quick templates, getting started). Budget, Category and Transaction detail headers use the dark detail-page header shared with the Account, Transfer, Recurring and Debt details. Still bespoke: Dashboard (balance hero), Reports (own header band) and AI Assistant (chat layout).
