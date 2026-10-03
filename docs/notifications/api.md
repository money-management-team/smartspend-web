# Notifications — API

Module: `src/features/Dashboards/User/api/notificationsApi.js`, wrapping `apiRequest` (Bearer token, `Accept-Language`, timeout and session expiry come from `apiClient`). `VITE_API_BASE_URL` already ends in `/api`, so paths are `/notifications…`, never `/api/api/notifications`. **No request sends `workspace_id`**: the inbox belongs to the user.

| Function | Request | Used by |
| --- | --- | --- |
| `list(query, { signal })` | `GET /notifications` | Notifications tab |
| `unreadCount({ signal })` | `GET /notifications/unread-count` | `UnreadNotificationsProvider` (bell + sidebar) |
| `markRead(id)` | `PATCH /notifications/{id}/read`, no body | Mark as read, open an unread notification |
| `markAllRead()` | `POST /notifications/read-all`, no body | Mark all as read |

The backend also accepts `POST /notifications/{id}/read`; the frontend uses `PATCH` only.

## List

Query (built by `notificationFiltersToQuery`):

| Param | Values | Notes |
| --- | --- | --- |
| `status` | `read` \| `unread` | Omitted for "All" |
| `severity` | `info` \| `warning` \| `critical` | Omitted for "All severities" |
| `type` | Backend `NotificationType` | Supported by the backend; the page has no type filter |
| `per_page` | 1..100 | Always `20` |
| `page` | ≥ 1 | Omitted for page 1 |

Response:

```json
{
  "status": true,
  "data": {
    "notifications": {
      "current_page": 1,
      "data": [
        {
          "id": 1,
          "type": "recurring_posted",
          "severity": "info",
          "title": "Apartment rent",
          "body": "An expense of 500.0000 ILS was posted for 2026-08-15.",
          "subject_type": "recurring_transaction",
          "subject_id": 1,
          "amount": "500.0000",
          "currency_code": "ILS",
          "is_read": false,
          "read_at": null,
          "created_at": "2026-08-15T09:00:00.000000Z"
        }
      ],
      "last_page": 1,
      "per_page": 20,
      "total": 1
    },
    "unread_count": 1
  }
}
```

- `data.notifications` is a **Laravel paginator**, never an array. `parseNotificationsPage` requires an object with a `data` array (anything else, including a plain array, is `MALFORMED_RESPONSE`) and reads `current_page`, `last_page`, `total`, `from`, `to` through the shared `parsePage`.
- `data.unread_count` is handed to the unread-count provider (see [implementation.md](implementation.md#unread-count)).

## Unread count

```json
{ "status": true, "data": { "unread_count": 1 } }
```

`data.unread_count` must be a non-negative integer (`toUnreadCount`); otherwise it is treated as malformed and no badge is shown.

## Mark one as read

`PATCH /notifications/{id}/read` → `data.notification` (the updated row, `is_read: true`, `read_at` set) and `data.unread_count`. The row is replaced with `data.notification` and the badge takes `data.unread_count`. The operation is idempotent: marking a read notification again succeeds (the UI simply doesn't send it for rows already read).

## Mark all as read

`POST /notifications/read-all` → `data.marked_count` and `data.unread_count`. `marked_count` may be `0` (nothing was unread); that is still a success ("All notifications were already read."). Repeating the request is safe.

## Errors

`getNotificationErrorMessage(error, t, context)` (`context`: `load`, `markRead`, `markAll`):

| Case | Shown |
| --- | --- |
| 401 | Handled by `apiClient` (session cleared, `smartspend:session-expired`); the inbox shows nothing extra |
| 404 on mark-read | "This notification no longer exists or doesn't belong to your account." (never says which) |
| 422 | The backend's message (invalid filter value); first field error or "Some notification filters are not valid." when empty |
| 429, network, timeout, 5xx, malformed | `getApiErrorMessage` (`api.errors.*`) |

A list error replaces the list with the message and **Try again**. A mark-read or mark-all error appears as a dismissible notice above the list, and the rows keep their last known state.
