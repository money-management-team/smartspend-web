# Financial Calendar — API

Module: `src/features/Dashboards/User/api/calendarApi.js` → `calendarApi.get(query, { signal })`, a thin wrapper over `apiRequest("/calendar")`. The Bearer token, `Accept-Language`, timeout and session-expiry handling all come from `apiClient`.

`VITE_API_BASE_URL` already ends in `/api`, so the request is `{base}/calendar`, never `/api/api/calendar`. `/financial-calendar` (a backend alias) is not called.

## Query

| Param | Values | Sent by the page |
| --- | --- | --- |
| `month`, `year` | 1..12, 2000..2100 | Month view |
| `from`, `to` | `YYYY-MM-DD`, `to >= from`, at most 366 days | Week view and custom range |
| `view` | `month` \| `week` | `month` with month/year, `week` with the week's from/to; omitted for a custom range |
| `types[]` | `recurring_occurrence`, `debt_due`, `budget_period_end`, `savings_goal_target` | Only when some types are selected (none = all) |
| `statuses[]` | Backend statuses (incl. effective ones such as `overdue`) | Only when some are selected |
| `owner` | `mine` \| `all` | `mine` when "Only mine" is chosen; otherwise omitted (backend default) |
| `workspace_id` | integer | The session workspace (`getStoredWorkspace()?.id`) when one is stored |

Arrays are passed as `{ "types[]": [...] }`; `apiRequest` repeats the key (`types[]=debt_due&types[]=recurring_occurrence`).

Examples:

```
GET /calendar?month=9&year=2026&view=month&workspace_id=1
GET /calendar?from=2026-09-06&to=2026-09-12&view=week
GET /calendar?from=2026-09-01&to=2026-11-30&types[]=debt_due&statuses[]=overdue&owner=mine
```

## Response

```json
{
  "status": true,
  "data": {
    "period": { "from": "2026-08-01", "to": "2026-08-31", "view": "month" },
    "events": [
      {
        "id": "recurring_occurrence:1",
        "type": "recurring_occurrence",
        "title": "Apartment rent",
        "date": "2026-08-15",
        "status": "posted",
        "amount": "500.0000",
        "currency_code": "ILS",
        "severity": "info",
        "subject_type": "recurring_transaction",
        "subject_id": 1,
        "actions": [],
        "direction": "expense",
        "occurrence_status": "posted"
      }
    ],
    "summary": {
      "total": 1,
      "by_type": { "recurring_occurrence": 1 },
      "by_status": { "posted": 1 },
      "by_severity": { "info": 1 }
    }
  }
}
```

`parseCalendarResponse` (in `calendarHelpers.js`) reads it:

- `period.from` / `period.to` (date part only) drive the grid once loaded; until then the requested range is used.
- `events` must be an array, otherwise the response is treated as `MALFORMED_RESPONSE`. Non-object entries are dropped.
- `summary.total`, `by_type`, `by_status`, `by_severity` are kept as backend counts (non-numeric values are ignored). A missing summary hides the summary card.

**Optional event fields.** Event types don't share every field. `amount`, `currency_code`, `direction`, `occurrence_status` and `actions` may be absent and are rendered only when present. An amount without a currency is shown as sent instead of assuming ILS.

## Errors

`getCalendarErrorMessage(error, t)`:

| Case | Shown |
| --- | --- |
| 401 | Handled by `apiClient`: session cleared, `smartspend:session-expired`, redirect to sign-in |
| 403 | "You don't have access to this workspace's calendar." (workspace outside the user's permissions) |
| 422 | The backend's message (invalid filter, `to` before `from`, window over 366 days, unsupported type/status); first field error or a generic "filters not valid" when it has none |
| 429, network, timeout, 5xx, malformed | `getApiErrorMessage` (`api.errors.*`) |

Every error replaces the grid and agenda with the message and **Try again**, which repeats the same request.

The page validates a custom range before sending it (both dates, `to >= from`, ≤ 366 days inclusive), and a hand-edited URL with an invalid range falls back to the month view, so the common 422s never reach the backend.
