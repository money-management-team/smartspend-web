# Dashboard sidebar — overview

`src/layouts/DashboardLayout/components/DashboardSidebar/DashboardSidebar.jsx` (+ `.css`). The sidebar of every `/dashboard/*` page: brand, navigation, log out. Routes are unchanged; every path comes from `PATH`.

## Structure

The menu is one config, `getNavigation(t, notificationsBadge)` in `src/layouts/DashboardLayout/dashboardNavigation.js` (also read by the [header search](../dashboard-search/overview.md)): sections (the existing Overview / Manage / More titles) holding **direct links** and **collapsible groups**. A group exists only where several related pages belong together; a single page stays a direct link.

| Section | Entry | Type | Children |
|---|---|---|---|
| Overview | Dashboard | link (`end`) | |
| | Accounts | link | |
| | **Transactions** | group | Financial operations · Transfers · Recurring · AI Receipts |
| | Calendar | link | |
| Manage | **Planning** | group | Categories · Budgets · Savings Goals · Debts |
| | **Reports** | group | Financial reports (`end`) · Export history |
| More | AI Assistant | link | |
| | Notifications | link | unread badge, as before |
| | Settings | link | |

"Export history" (`PATH.USER.REPORT_EXPORTS`) is an existing page that had no sidebar entry; it now sits under Reports. "Financial reports" is `end`, so it isn't also highlighted on the export history page.

Two small local components render entries: `SidebarItem` (a `NavLink`) and `SidebarGroup` (a toggle button + children panel).

## Active state

- A link is active on its path and everything below it (a budget's details page keeps **Budgets** active), unless it is `end`.
- A group is active when one of its children matches the current path (`matchPath`, same `end` rule).
- Active direct link: solid primary row (unchanged).
- Active child: tinted `--primary-soft` row, primary text, semibold, and a 2 px primary accent on the tree rule.
- Active parent: stronger label (`--color-text-primary`, 600) and primary icon, no background — the solid/tinted fill stays on the page itself.

## Open / closed

`useGroupChoices(pathname)` keeps the user's choice per group as `{ open, path }` (`path` = the page it was made on):

- The group holding the current page is **open**, unless the user closed it on this very page. Navigating into a group, or reloading, always reveals the active link.
- Other groups keep the user's choice; closed by default.
- Several groups can be open at once (no forced single-open accordion).
- Choices are stored in `sessionStorage` (`smartspend:sidebar-groups`, open flags only), wrapped in try/catch; they last for the tab session. No global state.

Clicking a group row only toggles it; it never navigates.

## Animation

- Panel height: CSS grid rows `0fr → 1fr` (220 ms), so there is no fixed `max-height` and no jump.
- Children fade in (180 ms); the chevron (`LuChevronDown`) rotates 180° (200 ms).
- All three are disabled under `prefers-reduced-motion`.

## Tree

Children have no icons (one consistent system), slightly smaller type and regular weight. They sit inside a list with `border-inline-start: 1px solid var(--color-border)` aligned under the parent icon, indented with `padding-inline-start`. Everything uses logical properties, so in Arabic the rule, the accent and the indent move to the right and the chevron to the left.

Labels are not clipped with `overflow: hidden`: Arabic letters such as a final "ي" draw past their box and would be cut off.

## Accessibility

- The group row is a `<button>` with `aria-expanded` and `aria-controls` pointing at the panel id `dashboard-sidebar-group-{id}`; Enter and Space toggle it.
- A collapsed panel stays in the DOM (for the animation) but is `inert`, so its links are skipped by Tab and screen readers.
- Links stay real `NavLink`s. Rows, toggles and children have a visible `:focus-visible` outline.

## Mobile

Unchanged drawer (≤ 1024 px, `dashboard-sidebar--open`). Groups work the same inside it; every link — direct or child — calls `onClose`, so the drawer still closes after navigating. Toggling a group does not close it. There is no compact icon-only desktop mode.

## Themes

Only existing tokens: `--text-muted`, `--color-text-primary`, `--color-primary`, `--primary-soft`, `--color-surface-hover`, `--color-border`, `--navigation-active-text`. Verified in light and dark.

## Translations

New keys, EN / AR: `dashboard.sidebar.groups.transactions` (Transactions / المعاملات), `dashboard.sidebar.groups.planning` (Planning / التخطيط), `dashboard.sidebar.financialReports` (Financial reports / التقارير المالية), `dashboard.sidebar.reportExports` (Export history / سجل التصدير). The Reports group reuses `dashboard.sidebar.reports`.
