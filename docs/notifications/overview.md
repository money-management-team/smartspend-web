# Notifications — Overview

Notifications are **persistent, user-specific records**: each belongs to one user, is stored by the backend and has a read state (`is_read`, `read_at`). They form the user's inbox at `/dashboard/notifications`, with an unread badge on the header bell and the sidebar.

## Notifications vs financial alerts

| | Notifications | Financial alerts |
| --- | --- | --- |
| Endpoint | `GET /notifications` (+ unread-count, read, read-all) | `GET /financial-alerts` |
| Stored | Yes, one row per notification | No, calculated on each request from current budgets |
| Read state | Yes | No |
| Scope | The signed-in **user** (no `workspace_id`) | A workspace (`id_workspace`) |
| Module | `api/notificationsApi.js` | `api/financialAlertsApi.js` |
| UI | Notifications tab (`NotificationInbox`) | Financial alerts tab (`FinancialAlerts`, `full` variant) and the dashboard's compact card |

The two are never merged: separate API modules, separate data models, separate components. They only share the Notifications page, as two tabs. See [../dashboard/financial-alerts.md](../dashboard/financial-alerts.md) for alerts.

**User inbox.** Two members of the same workspace do not share an inbox. No notification request sends `workspace_id`.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Domain, alerts vs notifications, routes, flow (this file) |
| [api.md](api.md) | Endpoints, filters, pagination, envelopes, errors |
| [implementation.md](implementation.md) | Files, unread-count provider and badge, inbox behaviour, mark read / mark all, subject navigation, i18n/RTL, verification |

## Route

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.NOTIFICATIONS` | `/dashboard/notifications` | `Notifications/Notifications.jsx`: Notifications tab (default) |
| `getFinancialAlertsPath()` | `/dashboard/notifications?tab=alerts` | Same page, Financial alerts tab |

The page is in the `userRoutes` group (`RequireAuth` + `DashboardLayout`). The header bell and the sidebar entry link to it; the dashboard's compact financial alerts card links to the alerts tab.

## Flow

```
DashboardLayout ─ UnreadNotificationsProvider ── GET /notifications/unread-count ──▶ bell + sidebar badge

Notifications tab ── GET /notifications?status&severity&per_page=20&page ──▶ rows + unread_count ─▶ badge
 ├─ All / Unread / Read · Severity ── new request (page 1)
 ├─ ‹ page › ── new request
 ├─ Mark as read ── PATCH /notifications/{id}/read ──▶ row replaced + unread_count ─▶ badge
 ├─ Open (unread) ── PATCH …/read ──▶ row + badge ──▶ navigate to the subject's page
 ├─ Open (read) ──▶ navigate
 └─ Mark all as read ── POST /notifications/read-all ──▶ unread_count ─▶ badge, notice, list refetched
```
