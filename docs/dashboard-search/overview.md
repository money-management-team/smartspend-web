# Dashboard search

The search field in the dashboard header finds **pages**, not records. Typing filters the dashboard's pages (Dashboard, Accounts, Transactions, Transfers, Budgets, Savings goals, Debts, Recurring, Reports, AI assistant, Notifications, Settings, and the rest of the menu); choosing one navigates there. Searching accounts, transactions or other data is intentionally out of scope for now (see [Extending it](implementation.md#extending-it-to-data)).

## Behaviour

- **Case-insensitive, partial matches:** `budg` finds Budgets. Every typed word must match.
- **Both languages whatever the interface language:** `الحسابات` finds Accounts while the UI is English, and `accounts` finds it in Arabic. Arabic spelling variants are unified (`اضافة` finds `إضافة`).
- **Synonyms:** each page also has keywords (`profile` and `password` find Settings, `income` finds Financial operations).
- **Keyboard:** typing opens the results. `ArrowDown` / `ArrowUp` move the active result (the first is active by default), `Enter` opens it, `Escape` closes the list (a second `Escape` clears the field). The field is an ARIA combobox with a listbox, `aria-activedescendant` and `aria-expanded`.
- **Mouse and touch:** a click or tap on a result navigates; the result list never steals focus from the field.
- **Navigation** goes through the router (no page reload). The query is cleared after a result is chosen.
- **No match:** an empty state names the query and suggests other words.
- **Mobile (480px and below):** the field is collapsed behind a search button. Opening it shows the field over the header; `Escape` closes it and returns focus to the button.
- **RTL / LTR:** the layout uses logical properties; the popup is anchored to both inline edges of the field.
- **Which pages:** only pages that exist in the sidebar menu (see below), so a user is never offered a page they can't open.
