# Budgets — Overview

A **budget** is a spending limit for a period (`period_start` → `period_end`, inclusive dates). How much of it is used is calculated by the backend from the user's real expense transactions; the frontend only displays it.

There are two kinds, fixed when the budget is created:

| Scope | `category` | Counts |
| --- | --- | --- |
| **General** | `null` | Every expense in the budget's currency during the period |
| **Category** | an expense category object | The expenses of that category (in the budget's currency) during the period |

A budget is never deleted. `DELETE /budgets/{id}` **archives** it: it stops being active, becomes read-only, and its limit, period and progress history are kept.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Scope, routes, flow, key files (this file) |
| [api.md](api.md) | Endpoints, payloads, responses, list parsing, error codes |
| [business-rules.md](business-rules.md) | Editable vs immutable fields, progress and status, archive semantics, money |
| [implementation.md](implementation.md) | Pages, components, state after each write, categories/workspace integration, i18n/RTL, verification |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.BUDGETS` | `/dashboard/budgets` | `src/features/Dashboards/User/Budgets/Budgets.jsx` (list + New budget) |
| `PATH.USER.BUDGET_DETAILS` | `/dashboard/budgets/:budgetId` | `src/features/Dashboards/User/BudgetDetails/BudgetDetails.jsx` |

- Build detail links with `getBudgetDetailsPath(id)`. The details route is nested under the list path, so the sidebar's "Budgets" item stays highlighted.
- The list keeps its filters and `?page=` in the URL, and the details page's back link returns to the same filtered page.
- The dashboard's "Budget progress" widget links each budget name to its details page.

## Flow

```
Budgets (GET /budgets: workspace + scope, category, status, progress, currency, period, active on, owner; paginated)
 ├─ New budget ── General | Category (+ expense category) ── POST /budgets ──▶ list refetched, "created" notice
 ├─ card ✎ Edit ── PATCH /budgets/{id} ──▶ card replaced (progress recalculated by the backend)
 ├─ card 🗄 Archive ── confirm ── DELETE /budgets/{id} ──▶ list refetched, "archived" notice
 └─ click a card ──▶ Budget details (GET /budgets/{id})
                      ├─ Refresh progress ── GET /budgets/{id}/progress ──▶ only the progress is replaced
                      ├─ Edit ── PATCH ──▶ budget + recalculated progress merged in
                      └─ Archive ── DELETE ──▶ stays on the page, now archived and read-only
```

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/budgetsApi.js` | `list`, `get`, `getProgress`, `create`, `update` (PATCH), `archive` (DELETE) |
| `src/features/Dashboards/User/Budgets/budgetHelpers.js` | List parsing, URL filters (`readBudgetFilters`, `budgetFiltersToQuery`, …), scope/archived checks, progress merging and display, form validation, error wording |
| `src/features/Dashboards/User/Budgets/Budgets.jsx` | List page: filters, summary, cards, pagination, notices, opens the modals |
| `…/Budgets/components/BudgetFilters/` | Filter bar (main row + "More filters") |
| `…/Budgets/components/BudgetForm/` | Create / edit modal |
| `…/Budgets/components/ArchiveBudgetDialog/` | Archive confirmation |
| `…/Budgets/components/BudgetList/` | Panel with loading / error / empty states, cards (`BudgetCard`), pagination |
| `…/Budgets/components/BudgetSummary/` | Status counts of the listed budgets |
| `…/Budgets/components/BudgetStatusBadge/`, `BudgetProgressBar/` | Shared status badge and progress bar (list + details) |
| `src/features/Dashboards/User/BudgetDetails/BudgetDetails.jsx` | Details page, progress refresh, edit, archive |
| `src/locales/{en,ar}/*.json` → `dashboard.budgets.*` | All copy |

Expense categories come from the existing `categoriesApi`, and the workspace from `resolveWorkspaceId()`; `budgetsApi` duplicates neither.
