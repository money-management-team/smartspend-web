# Categories — Overview

Categories label income and expenses. The section lets a signed-in user list the active categories of their workspace (their own and the built-in system ones), open one, create, edit, and archive their own.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, key files, domain rules (this file) |
| [api.md](api.md) | Endpoints, payloads, archive/DELETE semantics, workspace scope, error codes |
| [implementation.md](implementation.md) | Pages, components, state after mutations, form rules, errors, i18n/RTL |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.CATEGORIES` | `/dashboard/categories` | `src/features/Dashboards/User/Categories/Categories.jsx` |
| `PATH.USER.CATEGORY_DETAILS` | `/dashboard/categories/:categoryId` | `src/features/Dashboards/User/CategoryDetails/CategoryDetails.jsx` |

Build detail links with `getCategoryDetailsPath(categoryId)` from `src/routes/Path.js`. The sidebar has a "Categories" item (`LuTags`) at the top of the "Manage" group. It stays highlighted on the details page, because its `NavLink` isn't `end`.

## Flow

```
Categories list ── click a card ──▶ Category details
   │  filter: All / Expenses / Income   │  Edit (modal, PATCH)
   │  Add category (modal, POST)        │  Archive (confirm, POST …/archive) ──▶ back to the list with a notice
   │  Edit (modal, PATCH)               │
   └  Archive (confirm, POST …/archive) └  system / archived category → read-only, no actions
```

## Domain rules the UI respects

- **System categories** (`is_system === true`) are visible, readable and usable in transactions, but they are **never editable, archivable or deletable**. The UI renders no Edit/Archive controls for them: a "Read-only" badge on the card, a read-only note on the details page. The form and the archive dialog can't be opened for them, even programmatically, because `canManageCategory` guards both. The backend enforces the same rule (403).
- **Custom categories** (`is_system === false`) belong to one workspace and can be managed while active.
- **Archiving is not deleting.** It sets `is_active` to `false`. The category disappears from active lists, and old transactions keep it. `DELETE /categories/{id}` is only a backend alias for archive. The UI uses the explicit archive endpoint and never says anything is deleted.
- **Status is never changed through PATCH.** `is_active` is not an editable field; only `POST /categories/{id}/archive` changes it.
- **Changing the type** (income ↔ expense) changes what existing transactions under the category mean. The edit form shows a warning and requires an explicit confirmation before it can be saved.
- **A 404** means the category doesn't exist **or** isn't in a workspace the user can access. The UI shows the same "not available" message in both cases.

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/categoriesApi.js` | `list`, `get`, `create`, `update` (PATCH), `archive` |
| `src/features/Dashboards/User/Categories/categoryHelpers.js` | Types, preset colors/icons, icon and color helpers, `isSystemCategory` / `isActiveCategory` / `canManageCategory`, category error messages |
| `src/features/Dashboards/User/Categories/components/CategoryCard/` | Card in the list (opens the details page) |
| `src/features/Dashboards/User/Categories/components/CategoryForm/` | Create/edit modal |
| `src/features/Dashboards/User/Categories/components/ArchiveCategoryDialog/` | Archive confirmation |
| `src/locales/{en,ar}/*.json` → `dashboard.categories.*`, `dashboard.sidebar.categories` | All copy |

Budgets (`type: "expense"`) and Financial Operations also call `categoriesApi.list`; they are unchanged by this section.
