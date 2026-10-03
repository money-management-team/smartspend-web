# Page hero card

The blue card at the top of a dashboard page (eyebrow "SMARTSPEND / FINANCE", title, subtitle, white primary action, decorative ring) is styled once, in `features/Dashboards/User/financeExperience.css`, by selector lists. A page joins by adding its header selectors to those lists (surface, flex layout, ring, eyebrow, title, subtitle, action button).

Pages using it: Accounts, Transfers, Recurring, Savings goals (+ details), Debts, Settings, AI captures (+ details), Budgets, Categories, Notifications, Calendar, Report exports, Imports, and the Experience pages (Attention, Monthly review, Templates, Getting started). Reports has its own equivalent band (`ReportsHeader.css`); the Dashboard, Financial operations and AI assistant headers have a different purpose and keep their own design.

## Cascade note

Pages are lazy, so their CSS loads after this global sheet. To keep these shared rules on top regardless of load order, every selector in the file starts with `:root` (extra specificity). Keep the prefix on new rules.

## Adding a page

Give the header a copy block (`h1`, `p`) and, optionally, one primary action button, then add the classes to the lists. Use logical properties; the colors are fixed because the card is dark in both themes.
