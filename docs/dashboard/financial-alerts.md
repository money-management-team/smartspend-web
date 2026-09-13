# Financial Alerts

## What they are

`GET /financial-alerts` returns alerts the backend **calculates at request time** from the user's current budgets (exceeded, near the limit, …). They are not stored, have no read/unread state and cannot be dismissed. They are **not** the persistent Notifications feature (`GET /notifications`, see [../notifications/overview.md](../notifications/overview.md)), and the two are never merged: each has its own module, data model and components.

## Request — `financialAlertsApi.list(query, { signal })`

| Param | Value |
| --- | --- |
| `id_workspace` | Session workspace id (omitted when unknown). **Not `workspace_id`**, unlike most endpoints |

## Response (`data`)

| Key | Content |
| --- | --- |
| `generated_at` | When the alerts were calculated — shown as "Calculated {date}" |
| `alerts[]` | `{ type, severity, message, budget_id }` |
| `summary` | `active_budgets`, `by_status { safe, warning, near_limit, exceeded }`, `ended`, `without_expenses` |

- **Severity** comes from the backend (`critical`, `warning`, `info`) and drives the badge, icon and border colour. An unknown value is shown as `info`.
- **Type** is translated through `dashboard.financialAlerts.types.*` when a key exists (`budget_exceeded`, `budget_near_limit`, `budget_warning`); any other type is shown humanised (`translateEnum`).
- **Message** is the backend's text, shown as is (`dir="auto"`).
- `budget_id` becomes a "View budget" link (`getBudgetDetailsPath`).
- Summary counts are shown only when present.

A response without an `alerts` array is treated as malformed.

## UI — `Dashboard/components/FinancialAlerts/FinancialAlerts.jsx`

One component, two variants; it fetches on its own so an alerts failure never breaks the dashboard.

| Variant | Where | Behaviour |
| --- | --- | --- |
| `compact` | Dashboard, next to recent transactions | First 3 alerts, "+N more alerts" link, "View all" → `/dashboard/notifications?tab=alerts` (`getFinancialAlertsPath()`) |
| `full` | Notifications page, Financial alerts tab | Every alert and a **Refresh** button (refetches — there is nothing to mark as read) |

States: loading, error + "Try again", empty ("No financial alerts right now.").

The fetch is keyed by the workspace id: it does not refetch when the dashboard period changes (alerts don't depend on it).

## Notifications page

`/dashboard/notifications` has two tabs. The default **Notifications** tab is the persistent inbox (`GET /notifications`); the **Financial alerts** tab (`?tab=alerts`) renders the `full` variant. The old fake list (hard-coded items and a local "Mark all as read" that only changed component state) was removed earlier; the current `NotificationItem` belongs to the real inbox and has nothing to do with alerts.
