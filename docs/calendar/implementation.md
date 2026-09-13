# Financial Calendar — Implementation

## Files

| Path | Role |
| --- | --- |
| `api/calendarApi.js` | `get(query, { signal })` → `GET /calendar` |
| `Calendar/Calendar.jsx` + `.css` | Page: URL state, one keyed request, grid, agenda; defines the `--calendar-*` type colours |
| `Calendar/calendarHelpers.js` | Views/types constants, date math, URL ↔ filters ↔ query, range validation, response parser, grouping, grid days, actions reader, error wording |
| `Calendar/components/CalendarToolbar/` | Month / Week / Date range switch, previous · today · next, custom range form |
| `Calendar/components/CalendarFilters/` | Event type chips, status chips, owner select, clear |
| `Calendar/components/CalendarSummary/` | Backend `summary` counts |
| `Calendar/components/CalendarGrid/` | Month / week grid of day buttons |
| `Calendar/components/CalendarAgenda/` | Events grouped by day (all, or the selected day) |
| `Calendar/components/CalendarEvent/` | One event: type, status, severity, title, amount, links and actions |
| `routes/Path.js` | `PATH.USER.CALENDAR`, `getSubjectPath` (shared with Notifications) |

## URL state and loading

`readCalendarFilters(searchParams, { today, weekStart })` → `{ view, month, year, from, to, types, statuses, owner }`:

| URL | Meaning |
| --- | --- |
| *(nothing)* or `?month=9&year=2026` | Month view (default: the current month) |
| `?view=week&from=2026-09-06` | Week view; `from` is normalised to the week start, `to` = from + 6 |
| `?view=range&from=…&to=…` | Custom range; an invalid one falls back to the month view |
| `type=…` (repeated), `status=…` (repeated), `owner=mine` | Filters |

Unknown types are dropped; statuses only need to be well-formed (`[a-z0-9_]`) because the valid list is the backend's. Month/year outside 1..12 / 2000..2100 fall back to the current month.

The request follows the dashboard pattern: the request key is the normalised search string plus a retry counter, the result stores the key that produced it, and the page is loading while they differ (`AbortController`, `AbortError` ignored, no synchronous `setState` in the effect). Each period or filter change is exactly one request.

- **Today** is computed once per visit in the stored workspace's time zone (`workspace.timezone`, saved from `GET /dashboard`), falling back to the browser's.
- **Week start**: Saturday in Arabic, Sunday in English (`getWeekStart`).
- **Previous / next** move one month or seven days; month navigation stops at the backend's 2000..2100 limits.
- **View switch** keeps today in sight when it is in the current period, otherwise the period's first day. Switching to "Date range" pre-fills the current month or week; nothing is requested until **Apply**, and only for a valid range.

## Grid and agenda

- The grid (month and week views) covers the backend's `period` once loaded (the requested range before), padded to whole weeks. Padding days are dimmed and disabled. Custom ranges (up to 366 days) are shown as an agenda only.
- A month cell shows up to 3 event titles and "+N more"; a week cell shows all. On narrow screens titles become coloured dots.
- Each day is a button (`aria-pressed`, `aria-current="date"` for today, label "date: N events"). Selecting it narrows the agenda to that day; **Show all events** or selecting it again clears it. The selection belongs to the period it was made in.
- While a new period loads, the grid stays visible, dimmed and non-interactive, with the loading indicator in place of the agenda.
- Empty: "No events in this period." or, with filters, "No events match these filters." + Clear filters.

**Status filter options** are the statuses the backend has reported in `summary.by_status` during the visit, plus any selected in the URL, so the UI never offers a value the backend doesn't know. Their labels use `dashboard.calendar.statuses.*` when a key exists and are humanised otherwise.

**Owner**: "All visible events" (no `owner`, backend default) or "Only mine" (`owner=mine`).

**Workspace**: the app has no workspace switcher; the calendar sends the session workspace like the other workspace-scoped lists. A 403 means that workspace is outside the user's permissions.

## Summary

`CalendarSummary` renders `summary.total` and one chip group each for `by_type`, `by_status` and `by_severity`, straight from the response. It is never recalculated from the visible events (the agenda may be narrowed to one day; the summary still describes the whole period and filters).

## Event links and actions

`subject_type` + `subject_id` are references, not URLs. `getSubjectPath(subjectType, subjectId)` in `routes/Path.js` maps them to existing detail routes:

| `subject_type` | Route |
| --- | --- |
| `recurring_transaction` | `getRecurringDetailsPath` |
| `debt` | `getDebtDetailsPath` |
| `budget` | `getBudgetDetailsPath` |
| `savings_goal` | `getSavingsGoalDetailsPath` |
| `transaction`, `transfer`, `account`, `category` | Their details pages (mapped because the routes exist; not documented as calendar subjects) |

An unknown type or missing id returns `null`: the event is shown without a link or actions, and nothing crashes.

`actions` are read by `getEventActions` (strings, or objects with `key`/`type`/`name`/`action`). Each one renders as a link to the **subject's page**, labelled via `dashboard.calendar.actions.*` (humanised when unknown). The calendar never calls a resource endpoint itself: confirming or skipping a recurring occurrence happens on the recurring details page (`recurringTransactionsApi.confirmNext/skipNext`), a debt payment on the debt details page (`debtsApi.recordPayment`), and so on, with their existing idempotency and error handling.

## i18n and RTL

Copy lives in `dashboard.calendar.*` (title, views, nav, range, filters, types, statuses, severities, actions, summary, grid, agenda, event, states, errors) and `dashboard.sidebar.calendar`, with exact EN/AR key parity; plurals use `_one` / `_other` like the rest of the project.

Month names and weekday names come from `Intl` in the display locale. Dates and amounts are wrapped in `<bdi>` (amounts `dir="ltr"`), titles use `dir="auto"`, chevrons and the "open" arrow are mirrored in RTL, and the CSS uses logical properties (`border-inline-start`, `inset-inline`, `margin-inline-start`). Grid transitions are disabled under `prefers-reduced-motion`.

## Verification

- ESLint on the changed files: clean. `npm run build`: passes.
- A Node script with a mocked `fetch` checked: `/calendar` with a single `/api` prefix and no `/financial-calendar` call; month, week and range queries; `types[]` repetition; `owner` and `workspace_id`; URL fallbacks (invalid month, reversed or >366-day range); week start per language; response parsing (summary counts, grouping, optional fields, actions); 403 and 422 wording.
- Not run: a browser pass against the real backend with a signed-in account.
