# Accounts — Overview

Accounts are where money lives (cash, bank, wallet, savings, custom). The section lets a signed-in user list their active accounts, open one, edit it, and archive it.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, key files, domain rules (this file) |
| [api.md](api.md) | Endpoints, payloads, the archive/DELETE semantics, error codes |
| [implementation.md](implementation.md) | Pages, components, state updates after mutations, money, errors, i18n |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.ACCOUNTS` | `/dashboard/accounts` | `src/features/Dashboards/User/Accounts/Accounts.jsx` |
| `PATH.USER.ACCOUNT_DETAILS` | `/dashboard/accounts/:accountId` | `src/features/Dashboards/User/AccountDetails/AccountDetails.jsx` |

Build detail links with `getAccountDetailsPath(accountId)` from `src/routes/Path.js`. The sidebar's "Accounts" item stays highlighted on the details page, because its `NavLink` isn't `end`.

## Flow

```
Accounts list ── click a card ──▶ Account details
   │  Edit (modal, PATCH)             │  Edit (modal, PATCH)
   │  Archive (confirm, POST …/archive)│  Archive (confirm, POST …/archive) ──▶ back to the list with a notice
   └  Add account (modal, POST)
```

## Domain rules the UI respects

- **Balances come from the backend.** `current_balance` is never calculated or adjusted on the client, including after an edit.
- **The opening balance locks** once money has moved through the account. The backend answers a change with **409**, and the form shows that clearly. The frontend doesn't try to work around it.
- **Archiving is not deleting.** The account leaves the active lists and can't receive new activity, but all of its financial history is kept. `DELETE /accounts/{id}` is only a backend alias for archive. The UI uses the explicit archive endpoint and never says anything is deleted.
- **Savings-goal containers** can't be archived here. The backend returns 422, and the message is shown.
- **A 404** means the account doesn't exist **or** isn't in a workspace the user manages. The UI shows the same "not available" message in both cases.

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/accountsApi.js` | `list`, `get`, `create`, `update` (PATCH), `archive` |
| `src/features/Dashboards/User/Accounts/accountHelpers.js` | Types/currencies, icon and color helpers, sign check on money strings, account error messages |
| `src/features/Dashboards/User/Accounts/components/AccountCard/` | Card in the list (opens the details page) |
| `src/features/Dashboards/User/Accounts/components/AccountForm/` | Create/edit modal |
| `src/features/Dashboards/User/Accounts/components/ArchiveAccountDialog/` | Archive confirmation |
| `src/locales/{en,ar}/*.json` → `dashboard.accounts.*` | All copy |
