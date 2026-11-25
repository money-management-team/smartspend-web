# Mobile — Home screen design

Mobile Home (`/m`, `src/mobile/home/MobileHome.jsx`) was refined visually to match the sign-in screen (SIGN-IN-SCREEN.md). It then gained two cards, Budgets and Savings goals (see "Budgets and savings goals" below). The screen's other data and behaviour are described in S04B1-readonly-home-accounts.md.

The visual refinement is **CSS only**: section "Mobile Home, premium refinement" at the end of `src/mobile/styles/mobile.css`.
- Every rule is under `.sm-root .sm-home`, the class on Home's own section. The detail pages, the Add sheet and the other screens that share `.sm-card`, `.sm-hero`, `.sm-add-choice`, `.sm-row` and `.sm-tx-list` are unchanged.
- The refinement itself changes no JSX, model, loader or API.

## What changed

- **Cards:** one finish for every card on Home:
  - a softer border (`--sm-border` at 72%), `--sm-radius-lg`, and a layered shadow (`--sm-home-card-shadow`);
  - in dark mode, a faint white border and an inset highlight;
  - titles are 1rem and extra-bold.
  - The period picker is a card drawn deliberately as nothing (`HomeControls.jsx`), so it stays borderless and shadowless.
- **Balance (`.sm-hero`):**
  - the brand light from the start corner (the same radial as the sign-in band) and a faint ring at the far corner, for depth;
  - the label is small uppercase (not in Arabic);
  - the leading figure is `clamp(2.25rem, …, 2.75rem)`;
  - the note sits under a hairline.
- **Add an expense:** the icons are tinted rounded squares instead of glowing gradient discs, so the balance stays the anchor.
  - On hover, the card lifts 1px and the icon fills with the brand colour; on press, a slight scale.
  - The section label isn't uppercased in Arabic.
- **Income and expenses:**
  - the arrows are solid marks (income in `--sm-in`, expense in `--sm-muted`);
  - the figures are extra-bold;
  - the net is its own line under a hairline.
- **Accounts:** the tiles have a subtle surface gradient and a 1px lift on hover. Balances are extra-bold.
- **Recent activity:** on Home only, each row is a grid (`"icon title end" / "icon meta meta"`).
  - The text wrapper (`.sm-row-main`) is `display: contents`.
  - The category and date use the full width of the second line, so the date no longer wraps under a wide amount.
  - The DOM, the links and the reading order are unchanged.
  - The title and meta are `justify-self: start`. User text keeps its own direction (`unicode-bidi: plaintext`), so without this a Latin name in Arabic sat beside the amount instead of at the reading start. The same rule is used on Activity (ACTIVITY-SCREEN-DESIGN.md).
- **Needs attention:** the cyan edge stays the only signal (no new hue, as the base styles decide). The card gets a faint cyan tint, and the severity chip a soft cyan.
- **Motion:** the sections rise in once, 0.36s, staggered about 30ms. With `prefers-reduced-motion: reduce` there is no entrance animation, no transitions, and no lift or press transforms.

## Constraints the CSS respects

`tests/mobileBoundaries.test.mjs` is the guard:
- every selector starts with `.sm-root` (and the guard's parser splits `:is()` lists, so selectors are written out);
- no media query other than reduced-motion;
- logical properties only.

The Arabic title and labels get no letter-spacing (`:lang(ar)`).

## Checked

In headless Chrome on a local dev server, every `/api` request was answered in the page with fictional data shaped like `tests/helpers/mobileApi.mjs`; nothing reached a backend. Coverage: 360, 390 and 430 px, English and Arabic, light, and dark at 390 px.
- Home reached its ready state, with no horizontal page overflow and no page errors.
- Top, middle and bottom of the screen were captured.

Real devices were not checked.

## Budgets and savings goals

Two cards come from the `planning` block that `GET /dashboard` already returns, so there is no new request.

**Source.** In `smartspend-backend`, `DashboardService` builds `planning` with `PlanningSummaryService`. It is identical on `develop` @ `fd87531` and on the fix branch. It has two parts.

**`planning.budgets`** covers budgets whose period includes today, **in the primary currency only**:
- `currency_code`, `active_count`;
- `total_limit`, `total_spent`, `total_remaining` (the backend's sums within that one currency);
- `by_status` (`safe`, `warning`, `near_limit`, `exceeded`);
- `items`: up to five budget progress rows, closest to the limit first.

**`planning.savings_goals`** covers active goals, **in the primary currency only**:
- `currency_code`, `active_count`;
- `total_target`, `total_saved`, `total_remaining`;
- `achieved_count`;
- `items`: up to five goal progress rows, nearest to done first.

**Model.** `models/home.js` `buildPlanning`:
- The rows are the same progress rows the Budgets and Goals screens read. They are parsed with those screens' own `buildProgress`, now exported from `models/budgets.js` and `models/goals.js`. It checks that the id and currency match, and that the amounts are decimals.
- A row that fails these checks is dropped. At most three rows are kept.
- Each part is in one of three states:
  - `empty` when `active_count` is 0;
  - `unavailable` when the block, its currency, its count or a total is missing or malformed;
  - `ready` otherwise.

**Nothing is calculated on the device.** The totals, the remaining amounts, the percentages and the statuses are the backend's. The response has no overall percentage, so the totals have no bar; each row has its own bar from `percentage_used` or `percentage_funded` (`planning/Progress.jsx`). An exceeded budget's negative remaining amount is shown as the backend sends it.

**Card (`MobileHome.jsx` `PlanCard`).**
- The active count and the per-status counts (budgets) or achieved count (goals), as chips with the app's own state labels (`planning.state.*`).
- The three totals as label / figure lines.
- Up to three rows, each linking to the existing Budget or Goal page (`/m/planning/budgets/:id`, `/m/planning/goals/:id`) with the state chip, the bar, and two figures (spent and remaining; saved and still to save).
- "Showing N of M" when the backend counts more.
- "All budgets" or "All goals" links to the existing list.

**States and edge cases.**
- *Loading and errors:* those of the whole dashboard (one request).
- *Empty:* a sentence naming the currency.
- *Unavailable:* a sentence, and no link.
- *Hidden amounts:* every figure is `Money`, so it follows the hide-amounts preference.
- *Several currencies:* when the dashboard scope is multi-currency, each card says the figures are the primary currency's only and that the list shows every currency. Currencies are never combined.

**Order.** `HOME_BLOCKS` (`preferences/deviceStore.js`) is now `balances, summary, budgets, goals, accounts, recent, attention`. A saved order that predates the cards gets them appended, and Arrange Home can move or hide them like any other card.

**Styles.** These are in the same Home section of `mobile.css`:
- the totals sit in a tinted panel;
- the bars use the brand gradient and fill once from the reading start (`sm-home-fill`, mirrored in Arabic; none with reduced motion);
- warn and bad tones keep the base colours.

**Strings.** `home.blocks.budgets`, `home.blocks.goals`, `home.budgetsCard.*` and `home.goalsCard.*`, in English and Arabic. Counts use the "Label: {{count}}" form, so no plural rules are needed.

**Tests.**
- `tests/mobileHomePlanning.test.mjs` covers the model (totals, counts, row checks, the three-row limit, empty and unavailable) and the cards (figures, chips, bars, links, empty and unavailable text, the multi-currency note, hidden amounts, hiding with Arrange Home, and no extra request).
- `tests/mobileTools.test.mjs` pins the new default order.
