# Mobile — Accounts screen design

The Accounts list (`/m/accounts`, `src/mobile/accounts/MobileAccounts.jsx`) and an account's page (`/m/accounts/:id`, `MobileAccountDetail.jsx`) were refined visually to match the sign-in, Home and Activity screens (SIGN-IN-SCREEN.md, HOME-SCREEN-DESIGN.md, ACTIVITY-SCREEN-DESIGN.md). Their data and behaviour are described in S04B1-readonly-home-accounts.md and PHASE-6UI-5C3-ACCOUNT-TRANSACTION-DETAILS.md.

## What changed in markup

There are two small additions, using only data already on screen:
- **`MobileAccounts.jsx`:** each currency group's heading is a `.sm-card-head`, with the code in a `.sm-accounts-code` badge.
  - The workspace's primary currency group (`workspace.base_currency_code`, the group that already comes first) gets `data-sm-primary="true"` and a chip with the existing "Primary" string (`home.balance.primary`).
  - `GET /accounts` has no `is_default`, so the list doesn't single out an account. The account page still shows "Default account" when `GET /accounts/{id}` says `is_default: true`.
- **`AccountIcon.jsx`:** the icon carries `data-sm-kind` (`cash`, `bank`, `wallet`, `savings`, `savings_goal`, or `other`). Only the Accounts screens style it; Home's account tiles are unchanged.

There is no model, loader, request, balance or grouping change. Balances are still the backend's `current_balance` in each account's own currency, and currencies are never added together.

## Styles

They are in the section "Mobile Accounts and an account, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="accounts"]` or `.sm-root [data-sm-screen="account-detail"]`.

**List**
- **Group cards:** one card per currency, with the Home finish.
  - The heading is a navy currency-code badge plus the currency's name, over a hairline.
  - The primary group has a brand-colour edge on the inline-start side and a soft "Primary" chip.
- **Rows:** a grid (`"icon title end" / "icon meta end"`).
  - The name is clamped to two lines, so a long name never pushes the balance onto its own line.
  - The kind sits under the name.
  - The balance is extra-bold, in tabular figures.
  - The title and meta are `justify-self: start`, so a Latin name sits at the reading start in Arabic.
  - A negative balance keeps the base styles' colour.
- **Icons by kind:** a soft tint each, within the brand's blues:
  - cash: the default blue;
  - bank: navy;
  - wallet: cyan;
  - savings: violet;
  - savings goal: deep blue.

  In dark mode they are cyan, light blue and lavender. The kind is always written beside the icon.

**Account page**
- **Hero:** the same brand light and corner ring as Home's balance and the transaction page.
  - The label "Current balance" is small uppercase (not in Arabic).
  - The figure is `clamp(2.25rem, …, 2.75rem)`.
  - The note sits under a hairline.
- **About this account:** label / value lines with hairlines.
- **Archived note:** a tinted card with a muted edge.
- **Movements:** the same two-line grid rows as Activity. "Load more" is a full-width pill.
- **Changes:** Edit and Archive are bordered tiles. Each still opens its review, whose send stays closed by the write gate. "Open in the full version" stays a plain link.

**Motion:** the cards rise in once (0.34s, staggered). That, the pressed row and the hover transition are off with `prefers-reduced-motion: reduce`.

`tests/mobileBoundaries.test.mjs` passes: everything is under `.sm-root`, there is no media query other than reduced-motion, and only logical properties are used.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with fictional data shaped like `tests/helpers/mobileApi.mjs`:
- seven accounts in ILS, USD and EUR;
- a long English and a long Arabic name;
- a savings-goal account;
- a negative balance;
- a default bank account with four movements;
- an empty list.

The list (top and scrolled), the account (top and scrolled) and the empty state each loaded with no horizontal overflow and no page errors.

Real devices were not checked.
