# Accounts — API

All calls go through `accountsApi` (`src/features/Dashboards/User/api/accountsApi.js`) → `apiRequest`. That gives them:

- the Bearer token, `Accept-Language` and the `{ status, data, message, errors }` envelope handling;
- `ApiError` codes, and the 401 session-expired flow.

Paths are relative to `VITE_API_BASE_URL`, which already ends in `/api`, so `/accounts` resolves to `/api/accounts` (never `/api/api/…`). Account ids are URL-encoded.

| Method | Endpoint | Wrapper | Response |
| --- | --- | --- | --- |
| `GET` | `/accounts?id_workspace=…` | `accountsApi.list(query, { signal })` | `data.accounts` (active only) |
| `GET` | `/accounts/{id}` | `accountsApi.get(id, { signal })` | `data.account` |
| `POST` | `/accounts` | `accountsApi.create(payload)` | `data.account` |
| `PATCH` | `/accounts/{id}` | `accountsApi.update(id, payload)` | `data.account` |
| `POST` | `/accounts/{id}/archive` | `accountsApi.archive(id)` | `data.account` (`status: "archived"`) |

## List

`GET /accounts` returns **only active** accounts:

```json
{ "status": true, "data": { "accounts": [ { "id": 1, "workspace_id": 1, "name": "Cash", "type": "cash", "currency_code": "ILS", "opening_balance": "9000.0000", "current_balance": "9000.0000", "allow_negative_balance": false, "savings_goal": null, "color": null, "icon": null, "status": "active", "created_at": "…", "updated_at": "…" } ] } }
```

- **Workspace scope:** the Accounts page sends `id_workspace` = the session workspace (`getStoredWorkspace()?.id`). That is the same workspace `resolveWorkspaceId()` uses when creating accounts, so the list and create agree. When no workspace is stored, the parameter is omitted and the backend lists every workspace the user can access.
- Financial Operations still calls `list` without a workspace filter, as before. The savings-goal contribution/withdrawal form sends `id_workspace` = the goal's `workspace_id` (see `docs/savings-goals/business-rules.md`).

## Details

`GET /accounts/{id}` → `data.account`, which adds `created_by`, `low_balance_threshold`, `is_default`, `is_hidden`, `last_four_digits`, `sort_order`, and `archived_at` to the list fields.

A 404 means the account doesn't exist **or** doesn't belong to a workspace the user manages.

## Update

`PATCH /accounts/{id}` (PUT is also accepted, but the client uses PATCH). The body contains **only the fields the user changed**:

```json
{ "name": "Bank Renamed" }
```

| Field | Notes |
| --- | --- |
| `name` | string, max 255 |
| `type` | `cash`, `bank`, `wallet`, `savings`, `custom` |
| `currency_code` | e.g. `ILS` |
| `opening_balance` | 4-decimal string, e.g. `"3000.0000"` |
| `allow_negative_balance` | boolean |
| `color`, `icon` | supported by the backend, not edited by the current UI |

**409 Conflict:** `opening_balance` can't change once money has moved through the account. Because unchanged fields aren't sent, a 409 always means the user actually tried to change the opening balance.

## Archive

`POST /accounts/{id}/archive`, with no body. It returns the account with `status: "archived"` and `archived_at` set.

- The account disappears from `GET /accounts`, and can't receive new ledger activity.
- Its financial history is **kept**. Nothing is deleted.
- **422:** the account is already archived, or it is a savings-goal container that has to be handled through the savings-goal flow.

### DELETE alias

`DELETE /accounts/{id}` exists on the backend but is **not** a hard delete; it performs the same archive. The frontend doesn't use it and `accountsApi` has no `delete` method, so archive always goes through the explicit `/archive` endpoint. There is no frontend-only "delete".

## Create (unchanged)

`POST /accounts` with `{ name, type, currency_code, opening_balance, workspace_id }` (plus `allow_negative_balance: true` only when that box is ticked). `workspace_id` comes from `resolveWorkspaceId()`.

## Error codes

| HTTP | `ApiError.code` | Shown |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | apiClient clears the session; `RequireAuth` redirects to sign-in |
| 403 | `FORBIDDEN` | `dashboard.accounts.errors.forbidden` |
| 404 | `NOT_FOUND` | `dashboard.accounts.errors.notFound` (never says whose account) |
| 409 | `CONFLICT` | `dashboard.accounts.errors.openingBalanceLocked` |
| 422 | `VALIDATION_ERROR` | Field messages under the inputs; otherwise the backend `message` |
| 429 | `RATE_LIMITED` | `api.errors.rateLimited` with `Retry-After` |
| — | `NETWORK_ERROR`, `TIMEOUT`, `SERVER_ERROR`, `MALFORMED_RESPONSE` | `getApiErrorMessage` |

`CONFLICT` (409) was added to `apiClient`'s code mapping for this. Before, a 409 was reported as `REQUEST_FAILED`, and nothing depended on that.
