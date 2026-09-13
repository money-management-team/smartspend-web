# Notifications — Implementation

## Files

| Path | Role |
| --- | --- |
| `api/notificationsApi.js` | `list`, `unreadCount`, `markRead`, `markAllRead` |
| `contexts/notifications/unreadNotificationsProvider.jsx` | Single owner of the unread count (mounted in `DashboardLayout`) |
| `contexts/notifications/useUnreadNotifications.js`, `unreadNotificationsContext.js` | Hook + context |
| `Notifications/Notifications.jsx` + `.css` | Page: header, tabs (Notifications / Financial alerts) |
| `Notifications/notificationHelpers.js` | Constants, count reader, badge text, read-state reader, paginator parser, URL ↔ filters ↔ query, error wording |
| `Notifications/components/NotificationInbox/` | Inbox: toolbar with Mark all as read, filters, notice, list, pagination |
| `Notifications/components/NotificationFilters/` | All / Unread / Read chips, severity select, clear |
| `Notifications/components/NotificationItem/` | One notification row |
| `Notifications/components/NotificationsHeader/` | Title + subtitle (unchanged component) |
| `layouts/DashboardLayout/…/DashboardHeader`, `…/DashboardSidebar` | Bell badge, sidebar badge |
| `routes/Path.js` | `getSubjectPath`, `getFinancialAlertsPath` |

## Unread count

`UnreadNotificationsProvider` follows the `EmailVerificationProvider` pattern and is mounted in `DashboardLayout`, so it only runs in the signed-in area and wraps the header, sidebar and pages.

- Calls `GET /notifications/unread-count` **once per session token**; the result is tied to that token, so a previous session's count never shows after logout or a new login.
- `useUnreadNotifications()` → `{ count, error, loading, refresh, setCount }`.
- `setCount(value)` takes the `unread_count` that other responses already carry (list, mark-read, mark-all). The badge therefore always shows a backend figure; it is **never decremented locally**. A value set this way wins over a count request that was already in flight. An unusable value triggers `refresh()` instead.
- **No polling.** Besides the first load, the count is refreshed only when the browser tab becomes visible again after at least 60 seconds, and by the Notifications page's own responses. There is no interval, WebSocket or Reverb.
- The badge never needs `GET /notifications`: the full list is only fetched by the Notifications tab.

Badge display (`formatUnreadBadge`): hidden at 0 or while unknown, the number otherwise, `99+` above 99. The bell's accessible name is "Notifications, N new"; the sidebar badge is `aria-hidden` with the same text for screen readers in a visually hidden span.

## Inbox

`NotificationInbox` follows the list-page pattern (Debts): filters and page in the URL (`?status=unread&severity=critical&page=2`), a request key made of the normalised search string plus a retry counter, `AbortController`, `AbortError` ignored.

- Changing a filter goes back to page 1; the pagination footer (shown when `last_page > 1`) reuses the `dashboard.transactions.pagination.*` wording.
- States: loading (`Loading`), error + Try again, empty ("No notifications yet.", "No unread notifications…", "No read notifications.", "No notifications match these filters." + Clear filters), and an empty page past the end + "Go to the first page".
- The toolbar shows the backend's unread count ("N unread notifications" / "All notifications read").

### Row

`NotificationItem` shows the severity (icon, left border, badge — same visual language as financial alerts), the type (`dashboard.notifications.types.*`, humanised when unknown), a "New" marker when unread, the title (`dir="auto"`), the body, `created_at`, the amount with its currency when the row has one (no currency → the amount as sent), and "Read {date}" for read rows. Unknown severities are shown as `info`; no severity value is invented.

### Mark one as read

**Mark as read** (unread rows only) sends `PATCH /notifications/{id}/read`, replaces the row with `data.notification` and passes `data.unread_count` to the provider. A ref of pending ids blocks a second request for the same row while one is in flight, and the button is disabled. If the response has no notification row, the list is refetched instead of guessing.

With the **Unread** filter on, a row marked read stays visible (now read) until the next load, so the list doesn't jump under the pointer.

### Opening a notification

When `getSubjectPath(subject_type, subject_id)` returns a route, the title and an **Open** button link to it.

- Read notification: plain navigation.
- Unread notification, plain click: mark it read (as above), then navigate. If marking fails for any reason other than an expired session, the subject still opens: the read state is secondary to getting to the record.
- Ctrl/⌘/middle-click: the browser opens the link elsewhere; the row is marked read in place without navigating.
- No known route: no link, the row is still displayed and can be marked read.

### Mark all as read

**Mark all as read** sends `POST /notifications/read-all` (one request at a time). On success the provider takes `data.unread_count`, a notice reports `marked_count` ("N notifications marked as read." or, for 0, "All notifications were already read."), and the list is refetched so every row shows the backend's read state and `read_at`. The button is disabled while the backend count is 0.

## Subject navigation

`getSubjectPath` in `routes/Path.js` is shared with the calendar (see [../calendar/implementation.md](../calendar/implementation.md#event-links-and-actions)): `recurring_transaction`, `debt`, `budget`, `savings_goal`, `transaction`, `transfer`, `account`, `category` map to their existing detail routes; anything else returns `null`. `subject_type` is never used as a URL.

## Financial alerts tab

`?tab=alerts` renders the existing `FinancialAlerts` component (`full` variant, `GET /financial-alerts`, workspace-scoped, refresh button, no read state). Switching tabs clears the other tab's URL state. The dashboard's compact alerts card links there via `getFinancialAlertsPath()`.

## i18n and RTL

Copy lives in `dashboard.notifications.*` (tabs, bell, inbox, filters, severities, types, item, notices, states, errors), with exact EN/AR key parity and `_one` / `_other` plurals. Dates and amounts are in `<bdi>` (amounts `dir="ltr"`), backend texts use `dir="auto"`, the "open" arrow and pagination chevrons are mirrored in RTL, and badges are positioned with `inset-inline-end` / `margin-inline-start`.

## Removed / replaced

- The Notifications page no longer shows only financial alerts under a "notifications" title: the inbox is the default tab and alerts moved to their own tab.
- `dashboard.notifications.subtitle` now describes both tabs.

## Verification

- ESLint on the changed files: clean. `npm run build`: passes.
- A Node script with a mocked `fetch` checked: paths (`/notifications`, `/unread-count`, `/{id}/read`, `/read-all`) with a single `/api` prefix; `PATCH` / `POST` without a body; no `workspace_id` even when present in the page URL; paginator parsing (and rejection of a plain array); unread-count validation; row replacement from the mark-read response; `marked_count: 0`; 404 wording.
- Not run: a browser pass against the real backend with a signed-in account (the badge, mark-read and navigation flows need real notifications).
