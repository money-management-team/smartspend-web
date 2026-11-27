# Mobile — Budgets screen design

The Budgets list (`/m/planning/budgets`, `src/mobile/planning/MobileBudgets.jsx`) and a budget's page (`/m/planning/budgets/:id`, `MobileBudgetDetail.jsx`) were refined visually to match the sign-in, Home, Activity and Accounts screens (SIGN-IN-SCREEN.md, HOME-SCREEN-DESIGN.md, ACTIVITY-SCREEN-DESIGN.md, ACCOUNTS-SCREEN-DESIGN.md). Their data and behaviour are described in S04B3-planning-readonly.md and PHASE-6UI-5C4-BUDGETS-SAVINGS-GOALS.md.

## What changed in markup

These changes use only figures already parsed, and existing strings:
- **`BudgetRow`:** the figures are marked `data-sm-figure="spent" | "limit" | "remaining"`. The row now also shows **Remaining**: the backend's own `progress.remaining`, negative when over the limit, with the existing `planning.budgets.remaining` string. It appears only when the budget has progress.
- **Budget page:** Spent and Remaining moved from the Progress card into the summary, under the bar, as `.sm-budget-figures`. The Progress card keeps:
  - the expense count, days left and the not-started or ended state;
  - "See the expenses in this period".

There is no model, loader, request, filter, pagination or calculation change. Every figure is still the backend's, in the budget's own currency, and two budgets in two currencies are never added up.

## Styles

They are in the section "Mobile Budgets and a budget, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="budgets"]` or `.sm-root [data-sm-screen="budget"]`. Goals, Recurring and Home's planning cards, which share `.sm-plan-row`, `.sm-plan-figures` and `.sm-progress`, are unchanged.

**List**
- **Cards:** the Home finish, with hairline row separators.
- **Rows:** the name is extra-bold and clamped to two lines, the meta (scope and period) is smaller, then the status chip and the bar.
- **Figures:** Spent, Limit and Remaining are label / figure lines on a tinted panel. Remaining comes last and largest; when negative it is in the error colour.
  - Three columns were tried and dropped: they don't fit beside the chevron at phone widths and wrapped unevenly.
- **Load more:** a full-width pill. The filter tabs and the list's empty, error, stale and refresh states are unchanged in behaviour.

**Budget page**
- **Summary (hero):** the brand light and corner ring of the other heroes.
  - The label "Limit" is small uppercase (not in Arabic), and the limit figure is large.
  - The bar sits on a translucent track, with the percentage in white.
  - Spent and Remaining sit side by side on a glass panel; a negative remaining is in a soft red.
  - The status sentence is emphasised, and the period sits under a hairline.
- **Progress:** label / value lines with hairlines.
- **Links:** "See the expenses in this period" and Edit are bordered tiles. Edit still opens its review, whose send stays closed by the write gate.
- **Cards:** the Home finish, rising in once (0.34s, staggered).

**Motion:** the entrance and the hover transitions are off with `prefers-reduced-motion: reduce`. `tests/mobileBoundaries.test.mjs` passes.

## Not available

- **Category breakdown:** a budget covers either all spending or one category, and the API has no per-category breakdown for a budget. The page links to Activity, filtered to the budget's dates (and category), instead.
- **Related transactions inline:** none are read on this page. The same Activity link is the way to them, as before.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with budgets built by the repository's `tests/helpers/planningFixture.mjs` `budget()`:
- on track, warning, near the limit, and over the limit (with a negative remaining);
- a long English and a long Arabic name;
- a USD budget with figures over a million;
- an empty list.

The list (top and scrolled), an exceeded budget (top and scrolled), an on-track budget and the empty state each loaded with no horizontal overflow and no page errors.

Real devices were not checked.
