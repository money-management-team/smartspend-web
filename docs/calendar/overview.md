# Financial Calendar — Overview

The financial calendar (`/dashboard/calendar`) shows the dates attached to the user's financial records on a month grid, a week grid or a custom date range, with the backend's summary for that period.

## Domain model

The calendar is a **read-only aggregation**. The backend does not store calendar events: on every request it builds them from existing dated records:

| Event type (`type`) | Source record | `subject_type` |
| --- | --- | --- |
| `recurring_occurrence` | An occurrence of a recurring transaction rule | `recurring_transaction` |
| `debt_due` | A debt's due date | `debt` |
| `budget_period_end` | The end of a budget period | `budget` |
| `savings_goal_target` | A savings goal's target date | `savings_goal` |

Consequences for the frontend:

- **No local copies.** Events are never built from local debt, budget or goal data, never cached across requests, and never edited. When a source record's date changes, the next request reflects it.
- **No writes through the calendar.** An event's `actions` are carried out by the source resource's own flow on its details page (see [implementation.md](implementation.md#event-links-and-actions)).
- **Backend figures only.** Status, severity, amount and the summary counts come from the response; nothing is derived or recounted in the browser.

## Canonical endpoint

The backend exposes `GET /calendar` and `GET /financial-calendar`. They are aliases of the same implementation and return the same data. The frontend uses **only `/calendar`**: one API module (`calendarApi`), one function (`get`) and one page. There is no second integration for the alias.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Domain model, endpoint decision, routes, flow (this file) |
| [api.md](api.md) | Query parameters, response, errors |
| [implementation.md](implementation.md) | Files, URL state, grid and agenda, links and actions, i18n/RTL, verification |

## Route

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.CALENDAR` | `/dashboard/calendar` | `src/features/Dashboards/User/Calendar/Calendar.jsx` |

It is in the `userRoutes` group (`RequireAuth` + `DashboardLayout`) and has a "Calendar" entry in the sidebar's Overview group, after Recurring.

## Flow

```
Calendar page ── GET /calendar (period + filters from the URL) ──▶ period, events, summary
 ├─ Month / Week / Date range ── new request
 ├─ ‹ Today › (month, week) ── new request
 ├─ Event types · Statuses · Owner ── new request (types[] / statuses[] / owner)
 ├─ Click a day in the grid ── agenda narrows to that day (no request)
 └─ Event title / Open / action ──▶ the source record's details page
```
