# Budgets — Business rules

## General vs category budget

- **General** (`category_id` omitted / `category: null`): covers all expenses in the budget's currency during the period.
- **Category** (`category_id` = an expense category): covers that category's expenses during the period.
- A general budget overlaps category budgets of the same period and currency. That is why the list page never adds budgets' money together (see [implementation.md](implementation.md#summary)).
- The create form offers only **active expense** categories returned by `categoriesApi.list` (system categories included, since the backend allows them). Income and inactive categories can't be picked.

## Editable vs immutable fields

| Field | Create | Edit |
| --- | --- | --- |
| `name` | ✓ | ✓ |
| `amount_limit` | ✓ | ✓ |
| `period_start`, `period_end` | ✓ | ✓ |
| `notes`, `metadata` | ✓ | ✓ |
| scope / `category_id` | ✓ | ✗ read-only |
| `currency_code` | ✓ | ✗ read-only |
| `workspace_id` | ✓ (from the session) | ✗ |
| `user_id`, `status` | ✗ never sent | ✗ never sent |

Category and currency define **what** the budget measures; changing them would silently change the meaning of its history. The edit form shows them in a read-only box that says so, and `budgetsApi.update` filters them out even if a caller passes them.

**Lowering the limit below what is already spent is allowed.** The form shows an informational note (not an error), the backend accepts it and recalculates the progress, e.g. limit `700`, spent `730` → remaining `-30.0000`, `percentage_used` `104.2857`, status `exceeded`.

## Budgets don't move money

A budget is a planning record. Creating, editing, archiving or listing budgets writes no ledger entry and changes no account balance, and the frontend never adjusts accounts or transactions because of budget data. Progress is derived by the backend from the user's real **expense** transactions.

## Progress and status

- Only the canonical progress fields are read: `amount_limit`, `spent`, `remaining`, `percentage_used`, `status`, `expenses_count`, `currency_code`. Aliases such as `amount_spent` or `percentage` are ignored, so no component mixes them (see [api.md](api.md#canonical-progress-fields)).
- The backend is the source of truth. Spent, remaining, percentage and status are **never** calculated in the frontend; there is no fallback math when `progress` is missing (the card shows the limit and "Progress isn't available").
- `status` comes from the backend: `safe`, `warning`, `near_limit`, `exceeded`. No thresholds are derived locally.
- `percentage_used` can exceed 100 and `remaining` can be negative. Both are shown with their real values (negative remaining and over-100 % percentages in the danger color). A negative `remaining` is **never clamped to zero**: limit `800`, spent `900` → remaining `-100.0000`, shown as "-₪100.00", which says exactly how far the budget is exceeded. Only the **width of the progress bar** is clamped to 0–100 %; its `aria-valuetext` carries the real percentage.
- The period state chip ("Not started yet" / "In progress" / "Period ended") comes from `has_started` / `has_ended`.
- Fresh progress: the details page's **Refresh progress** calls `GET /budgets/{id}/progress` and replaces only the progress. After an edit, the PATCH response already contains the recalculated progress (if it ever doesn't, progress is fetched).

## Archive semantics

- `DELETE /budgets/{id}` archives; nothing is permanently deleted. The confirmation dialog says exactly that: it stops being active and becomes read-only, its limit/period/progress history is kept, expense transactions aren't changed, and it can't be edited afterwards. The word "delete" is not used.
- A budget is archived when `status === "archived"`, `archived_at` is set, or `progress.is_archived` is true (`isArchivedBudget`).
- Archived budgets have **no Edit/Archive actions** anywhere (cards, details), and the list/details handlers refuse to open the form or dialog for them (`canManageBudget`).
- The backend answers `409` when an archived budget is modified or archived again. The message is shown in the form/dialog and the page refetches, so the UI catches up.

## Money

- Money travels as the backend's decimal strings (`"800.0000"`, `"-30.0000"`) and is never turned into a float for storage or comparison.
- `amount_limit` is validated as a string (positive, ≤ 4 decimals, `getAmountError`) and sent via `toMoneyString`.
- Comparisons (edit: did the limit change? is it below spent?) use `toMoneyString` equality and `subtractMoney` (BigInt minor units) + `isNegativeMoney`.
- Display uses the shared `formatMoney` with the budget's currency.
