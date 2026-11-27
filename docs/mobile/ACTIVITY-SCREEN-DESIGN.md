# Mobile — Activity and transaction screen design

The Activity list (`/m/activity`, `src/mobile/activity/MobileActivity.jsx`) and a transaction's page (`/m/activity/:id`, `MobileTransactionDetail.jsx`) were refined visually to match the sign-in and Home screens (SIGN-IN-SCREEN.md, HOME-SCREEN-DESIGN.md). Their data and behaviour are described in S04B2-activity-readonly.md and PHASE-6UI-5C3-ACCOUNT-TRANSACTION-DETAILS.md.

**CSS only.** The section "Mobile Activity and a transaction, premium refinement" is at the end of `src/mobile/styles/mobile.css`.
- Every rule is under `.sm-root [data-sm-screen="activity"]` or `.sm-root [data-sm-screen="transaction"]`, the screens' own attributes. Accounts, transfers and the other lists that share `.sm-tx`, `.sm-ledger`, `.sm-hero` or `.sm-link-row` are unchanged.
- There is no JSX, model, loader, filter, pagination or API change. The requests, the filters in the address, "Load more", the scroll memory, hide amounts and the multi-currency display behave exactly as before.

## Activity list

- **Toolbar:**
  - the Filters pill gets the card finish, a brand-coloured icon and a hover border;
  - applied filters are soft blue chips with a blue ×;
  - "Clear all" is a quiet text chip.
- **Days:** each day's heading is `position: sticky` inside the scrolling `#sm-main`, so the day stays in view while its transactions scroll. It has a frosted surface background and a hairline under it. The first heading takes the card's top corners.
- **Rows:** each row is a grid (`"icon title end" / "icon meta meta" / "icon chip chip"`).
  - The text wrapper (`.sm-row-main`) is `display: contents`.
  - The title and the amount share the first line.
  - The kind, category and accounts use the full width of the second line, so they no longer wrap under a wide amount.
  - A status chip (pending, draft, failed, reversed, unknown) sits on its own line below.
  - The DOM, the link, its accessible name and the reading order are unchanged.
- **Alignment in Arabic:** the title and meta are `justify-self: start`, so a Latin name sits at the reading start rather than beside the amount. User text keeps its own direction inside its cell.
- **Income versus expense:** this stays as the base styles decide. Income is brand blue with a plus sign; everything else is neutral; a reversed amount is struck through and says so. No green is added.
- **Load more:** a full-width quiet pill.

## A transaction

- **The amount is the focus:**
  - the hero has the same brand light and faint corner ring as Home's balance;
  - the label "Amount" is small uppercase (not in Arabic);
  - the figure is `clamp(2.25rem, …, 2.75rem)`;
  - the date and account sit under a hairline.
- **Notes** (reversed, reversal, correction, transfer, not posted, unknown status): one softly tinted card.
- **Details:** label / value lines separated by hairlines, at least 44px tall. "More about this record" keeps its disclosure.
- **Ledger entries:** a grid, with the account and the amount on one line and the role under it. The account link reads as a link, not underlined.
- **Changes:** Correct and Reverse are bordered tiles. Each still opens the review form, whose send stays closed by the write gate. "Open in the full version" stays a plain link below them.
- **Cards:** the Home finish (softer border, layered shadow, `--sm-radius-lg`), rising in once (0.34s).

## Motion and constraints

- The card entrance, the pressed row and the hover transitions are all off with `prefers-reduced-motion: reduce`.
- `tests/mobileBoundaries.test.mjs` passes: every selector is under `.sm-root`, there is no media query other than reduced-motion, and only logical properties are used.

## Not here

- **Text search:** Activity has none, because `GET /transactions` has no text-search parameter (`ActivityFilters.jsx`). Searching only the loaded page would miss most results, so none was added.
- **Category icons:** there are no category icons in the data Activity reads. Each row's icon is its kind (`activity/TypeIcon.jsx`), as before.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px.
- Every `/api` request was answered in the page with the repository's own browser-check fixture (`tests/helpers/activityFixture.mjs`: every record kind, long Arabic text, a very large amount, other currencies, 60 rows); nothing reached a backend.
- Pages checked: the list (top and scrolled), an income transaction (top and scrolled) and a reversed one.
- Each was ready with no horizontal overflow and no page errors.

Real devices were not checked.
