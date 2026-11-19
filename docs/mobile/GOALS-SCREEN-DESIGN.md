# Mobile — Savings goals screen design

The Savings goals list (`/m/planning/goals`, `src/mobile/planning/MobileGoals.jsx`) and a goal's page (`/m/planning/goals/:id`, `MobileGoalDetail.jsx`) were refined visually to match the sign-in, Home, Activity, Accounts and Budgets screens (SIGN-IN-SCREEN.md, HOME-SCREEN-DESIGN.md, ACTIVITY-SCREEN-DESIGN.md, ACCOUNTS-SCREEN-DESIGN.md, BUDGETS-SCREEN-DESIGN.md). Their data and behaviour are described in S04B3-planning-readonly.md and PHASE-6UI-5C4-BUDGETS-SAVINGS-GOALS.md.

## What changed in markup

These changes use only figures already parsed, and existing strings:
- **`GoalRow`:**
  - The row carries `data-sm-progress` (the backend's progress word) beside the existing `data-sm-status`.
  - The target date and the backend's `days_remaining` ("Days left") share one line, `.sm-goal-when`.
  - A passed deadline (`deadline_passed`) shows as a chip, the same one the goal's page already had.
  - The figures are marked `data-sm-figure="saved" | "target" | "remaining"`. The row now also shows **Remaining**, the backend's own `progress.remaining`, with the existing `planning.goals.remaining` string. It appears only when the goal has progress.
- **Goal page:**
  - The summary (hero) carries `data-sm-status`.
  - Under the bar it now shows Target and Remaining as `.sm-goal-figures`, then the target date and days left as `.sm-goal-when`.
  - The Progress card keeps the contributions count, the achieved date and the savings account link.
  - The money movements, notes, Smart plan, write tiles and the link to the full version are unchanged and in the same order.

There is no model, loader, request, filter, pagination or calculation change. Every figure is still the backend's, in the goal's own currency, and two goals in two currencies are never added up. Days left is shown whenever the backend sends it, as before. The write tiles still open their reviews, whose send stays closed by the write gate (`APPROVED` is empty).

## Styles

They are in the section "Mobile Savings goals and a goal, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="goals"]` or `.sm-root [data-sm-screen="goal"]`. Budgets, Recurring and Home's planning cards, which share `.sm-plan-row`, `.sm-plan-figures` and `.sm-progress`, are unchanged.

**List**
- **Cards:** the Home finish, with hairline row separators.
- **Rows:** the name is extra-bold and clamped to two lines, then the date and days left line, the status chips and the bar.
- **Figures:** Saved, Target and Remaining are label / figure lines on a tinted panel, with Saved slightly larger.
- **Statuses:** they are told apart only by the backend's status words, never by comparing figures.
  - Achieved has a green bar, a green chip and a green edge on the figures panel (the inline-start edge, which is the right in Arabic).
  - Paused and archived have a muted bar.
  - A passed target date is an amber chip.
- **Load more:** a full-width pill. The filter tabs and the list's empty, error, stale and refresh states are unchanged in behaviour.

**Goal page**
- **Summary (hero):** the brand light and corner ring of the other heroes.
  - The label "Saved" is small uppercase (not in Arabic), and the saved figure is large.
  - The bar sits on a translucent track (green when the goal is achieved), with the percentage in white.
  - Target and Remaining sit side by side on a glass panel.
  - The target date and days left sit under a hairline.
  - The achieved chip is green and the deadline-passed chip is amber.
- **Progress:** label / value lines with hairlines.
- **Money movements:** a contribution's icon is green, the rows have hairlines and the paging links are pills. The tabs, paging and rows behave as before.
- **Links:** the write tiles are bordered tiles.
- **Cards:** the Home finish, rising in once (0.34s, staggered).

**Motion:** the entrance and the hover transition are off with `prefers-reduced-motion: reduce`. `tests/mobileBoundaries.test.mjs` passes.

## Not available

- **A goal's purpose:** the API has a name and optional notes, and no separate purpose or category. The notes stay in their own card on the goal's page.
- **A time-remaining phrase** ("7 months left"): only the backend's day count is shown. Nothing is worked out from the date on the device.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with goals built by the repository's `tests/helpers/planningFixture.mjs` `goal()` and `movement()`:
- in progress, almost there, not started with no target date, and achieved;
- a USD goal over a million whose target date has passed;
- a long English name and an Arabic name;
- contributions, a withdrawal and a reversed contribution;
- an empty list.

The active list (top and scrolled), the achieved filter, an in-progress goal (top and scrolled), an achieved goal and the empty state each loaded with no horizontal overflow and no page errors.

Real devices were not checked.
