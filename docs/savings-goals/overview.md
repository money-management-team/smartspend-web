# Savings Goals — Overview

A **savings goal** is a target amount the user saves toward, optionally by a target date. The money is **real**: when a goal is created, the backend automatically creates a dedicated account of type `savings` for it (`goal.account`). The goal's saved amount *is* that account's ledger balance.

- **Contributions** move money from one of the user's accounts into the goal's account.
- **Withdrawals** move money from the goal's account back to one of the user's accounts.
- Both are real transfers recorded in the ledger, so they appear in the goal's activity and on the Transfers pages.

The frontend never calculates saved/remaining amounts, percentages or statuses: the backend recalculates the goal's `progress` after every money movement and every write, and the frontend shows what it returns.

A goal is never deleted. `DELETE /savings-goals/{id}` **archives** it, and only once its balance is zero: all money must be withdrawn first. The goal, its account and its history stay recorded.

## Two statuses

| | Field | Values | Meaning |
| --- | --- | --- | --- |
| **Lifecycle** | `goal.status` | `active`, `paused`, `achieved`, `archived` | What the goal accepts (see [business-rules.md](business-rules.md)) |
| **Progress** | `goal.progress.status` | `not_started`, `in_progress`, `almost_there`, `achieved` | How far the saved amount is from the target |

They are separate backend values and are shown as separate badges (a paused goal can be "almost there").

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Domain model, routes, flow, key files (this file) |
| [api.md](api.md) | Endpoints, payloads, response envelopes and pagination keys, error codes |
| [business-rules.md](business-rules.md) | Lifecycle and action matrix, pause/resume, archive, money movements, idempotency, eligible accounts |
| [implementation.md](implementation.md) | Pages, components, state after each write, error wording, i18n/RTL, verification |

## Routes

Both routes are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.SAVINGS_GOALS` | `/dashboard/savings-goals` | `src/features/Dashboards/User/SavingsGoals/SavingsGoals.jsx` (list, filters, create) |
| `PATH.USER.SAVINGS_GOAL_DETAILS` | `/dashboard/savings-goals/:savingsGoalId` | `src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx` |

- Build links with `getSavingsGoalDetailsPath(id)`. The details route is nested under the list path, so the sidebar's "Savings Goals" item stays highlighted.
- `getNewSavingsGoalPath()` (`/dashboard/savings-goals?new=1`) opens the create form once; the dashboard hero's "New goal" action uses it.
- Create, edit, contribute, withdraw, pause, resume and archive are modals (the dashboard's convention), not separate routes.
- The list keeps its filters and page in the URL (`?status=&progress_status=&currency_code=&page=`).
- The dashboard's "Savings goals" widget links each goal to its details page.

## Flow

```
Savings goals (GET /savings-goals, filtered + paginated)
 ├─ New goal ── POST /savings-goals ──▶ backend creates the goal + its savings account; list refetched, notice
 ├─ card ＋ Add contribution ── POST …/contributions (Idempotency-Key) ──▶ list refetched
 ├─ card ✎ Edit ── PATCH /savings-goals/{id} ──▶ card replaced with the backend's goal
 ├─ card 🗄 Archive ── (blocked while balance > 0) ── DELETE ──▶ list refetched
 └─ click a card ──▶ Goal details (GET /savings-goals/{id})
                      ├─ Refresh progress ── GET …/progress ──▶ only the progress is replaced
                      ├─ Add contribution ── POST …/contributions ──▶ goal from the response, activity refetched
                      ├─ Withdraw ── POST …/withdrawals ──▶ goal from the response, activity refetched
                      ├─ Pause / Resume ── POST …/pause | …/resume ──▶ status from the response
                      ├─ Edit ── PATCH ──▶ goal from the response (status may flip)
                      ├─ Archive ── DELETE (zero balance only) ──▶ stays on the page, read-only
                      └─ Activity: All (GET …/activity) · Contributions (GET …/contributions) · Withdrawals (GET …/activity?type=withdrawal)
```

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/savingsGoalsApi.js` | Every savings-goal request (list, get, getProgress, listContributions, listActivity, create, update, archive, contribute, withdraw, pause, resume) |
| `src/features/Dashboards/User/SavingsGoals/savingsGoalHelpers.js` | Statuses, action matrix, pagination parsing, URL filters, validation, eligible accounts, history sources, error wording |
| `…/SavingsGoals/SavingsGoals.jsx` | List page: filters, cards, pagination, notices, opens the modals |
| `…/SavingsGoals/components/SavingsGoalCard/` | One goal in the list (radial `GoalProgress`, badges, actions) |
| `…/SavingsGoals/components/SavingsGoalFilters/` | Lifecycle / progress / currency filters |
| `…/SavingsGoals/components/SavingsGoalForm/` | Create / edit modal |
| `…/SavingsGoals/components/GoalMovementForm/` | Contribution / withdrawal modal (money movement + Idempotency-Key) |
| `…/SavingsGoals/components/GoalActionDialog/` | Pause / resume / archive confirmation |
| `…/SavingsGoals/components/GoalActivity/` | Paginated history with All / Contributions / Withdrawals tabs |
| `…/SavingsGoals/components/GoalStatusBadge/`, `GoalProgressBar/`, `GoalProgress/` | Shared badges and progress visuals |
| `src/features/Dashboards/User/SavingsGoalDetails/SavingsGoalDetails.jsx` | Details page |
| `src/locales/{en,ar}/*.json` → `dashboard.savingsGoals.*` | All copy |

Accounts come from the existing `accountsApi`, the workspace from `resolveWorkspaceId()` / the session workspace, idempotency keys from `createIdempotentAttempt()`; none of these is duplicated.
