# Categories — API

All calls go through `categoriesApi` (`src/features/Dashboards/User/api/categoriesApi.js`) → `apiRequest`. That gives them:

- the Bearer token, `Accept-Language` and the `{ status, data, message, errors }` envelope handling;
- `ApiError` codes, and the 401 session-expired flow.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api`, so `/categories` resolves to `/api/categories` (never `/api/api/…`). Category ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/categories?workspace_id=…&type=…` | `categoriesApi.list(query, { signal })` | `data.categories` (active only, system ones included) |
| `GET` | `/categories/{id}` | `categoriesApi.get(id, { signal })` | `data.category` |
| `POST` | `/categories` | `categoriesApi.create(payload)` | `data.category` |
| `PATCH` | `/categories/{id}` | `categoriesApi.update(id, payload)` | `data.category` |
| `POST` | `/categories/{id}/archive` | `categoriesApi.archive(id)` | `data.category` (`is_active: false`) |

`categoriesApi.update` used `PUT` before this section existed, but nothing called it. It now uses `PATCH`, and `get` was added.

## List

`GET /categories` returns **only active** categories, including system ones:

```json
{ "status": true, "message": "Categories retrieved successfully.", "data": { "categories": [ { "id": 2, "workspace_id": 1, "parent_id": null, "name": "Food", "slug": "food", "type": "expense", "icon": null, "color": null, "is_system": false, "is_active": true, "sort_order": 0 } ] } }
```

- **Workspace scope:** the Categories page sends `workspace_id` = the session workspace (`getStoredWorkspace()?.id`). That is the same workspace `resolveWorkspaceId()` uses when creating categories, so the list and create agree. When no workspace is stored, the parameter is omitted and the backend decides the scope.
- **Type filter:** the page's chips send `type=income` or `type=expense`; "All" omits it. Filtering is done by the backend.
- The response is read from `response.data.categories`. Anything that isn't an array is treated as `MALFORMED_RESPONSE`.

## Details

`GET /categories/{id}` → `response.data.category`. Detail responses may include `created_at` / `updated_at`; the page shows them when present.

## Create

`POST /categories`:

```json
{ "workspace_id": 1, "name": "Salary", "type": "income", "color": "#3366FF", "icon": "wallet" }
```

| Field | Rule |
| --- | --- |
| `workspace_id` | Required. From `resolveWorkspaceId()` (reads `/dashboard` scope, caches it in storage) |
| `name` | Required, trimmed, max 255 |
| `type` | Required, `income` or `expense` |
| `color` | Optional hex. Omitted when "No color" is chosen |
| `icon` | Optional icon name (see `CATEGORY_ICONS`). Omitted when "Default icon" is chosen |

## Update

`PATCH /categories/{id}` (PUT is also accepted by the backend, but the client uses PATCH). The body contains **only the fields the user changed**:

```json
{ "name": "Transport & Fuel" }
```

- Supported fields: `name`, `type`, `color`, `icon`.
- Clearing a color or icon that was set sends `null` for that field.
- `is_active` is **never** sent. Status only changes through the archive endpoint.
- System categories are rejected by the backend (403); the UI never offers the request.

## Archive

`POST /categories/{id}/archive`, with no body. It returns the category with `is_active: false`.

- The category disappears from `GET /categories`.
- Existing transactions **keep** the category. Nothing is deleted.
- **403:** system category, or a category the user can't manage.
- **422:** the category is already archived.

### DELETE alias

`DELETE /categories/{id}` exists on the backend but is **not** a hard delete; it performs the same archive. The frontend doesn't use it, and `categoriesApi` has no `delete` method, so archiving always goes through the explicit `/archive` endpoint. There is no frontend "delete", and no copy says anything is deleted.

## Error codes

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | apiClient clears the session; `RequireAuth` redirects to sign-in. Forms and dialogs don't show a message for it |
| 403 | `FORBIDDEN` | `dashboard.categories.errors.forbidden` (system category / outside the workspace) |
| 404 | `NOT_FOUND` | `dashboard.categories.errors.notFound` (never says whose category) |
| 422 | `VALIDATION_ERROR` | Field messages under the inputs (`errors.name`, `errors.type`, …) plus the backend `message`; in the archive dialog, the backend message (e.g. already archived) |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE`, `WORKSPACE_UNAVAILABLE` | `getApiErrorMessage` |

`getCategoryErrorMessage(error, t)` in `categoryHelpers.js` adds the 403/404 wording and falls back to `getApiErrorMessage` for everything else.
