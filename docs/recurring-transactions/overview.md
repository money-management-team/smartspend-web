# Recurring Transactions — Overview

A **recurring transaction** is a **rule**, not money: "pay 500 ILS rent from Cash every month starting 15 Aug". Creating, editing, pausing, resuming, skipping or archiving a rule never changes a balance.

Money moves only when an **occurrence** of the rule is **posted** as a real transaction:

- **manually**, when the user confirms the next occurrence (`POST …/confirm-next`), or
- **automatically**, by the backend scheduler on the due date, for rules with `processing_mode: "automatic"`.

The frontend never simulates the scheduler (no timers, no background jobs), never updates balances and never computes due dates: `next_due_date`, `status`, `schedule` and every occurrence come from the backend.

## Occurrences

Each due date of a rule is an occurrence with its own status: `scheduled`, `due`, `posted`, `skipped`, `failed`, `cancelled`. Open occurrences (`is_open`) are the ones that can still be confirmed or skipped; `is_overdue` is the backend's flag. An occurrence with a `transaction_id` produced a real transaction. The whole history — including skipped, failed and cancelled occurrences — stays visible.

## Documents in this folder

| File | What it covers |
| --- | --- |
| [overview.md](overview.md) | Domain model, routes, flow, key files (this file) |
| [api.md](api.md) | Endpoints, payloads, envelopes, pagination, error codes |
| [business-rules.md](business-rules.md) | Action matrix, editable vs structural fields, pause/resume, archive, validation |
| [confirm-and-skip.md](confirm-and-skip.md) | Confirm-next (moves money), idempotency decision, the special 422, skip-next |
| [implementation.md](implementation.md) | Pages, components, state after each write, error wording, i18n/RTL, verification |

## Routes

Both are in the `userRoutes` group, behind `RequireAuth` + `DashboardLayout`.

| Constant | URL | Page |
| --- | --- | --- |
| `PATH.USER.RECURRING` | `/dashboard/recurring` | `src/features/Dashboards/User/Recurring/Recurring.jsx` (list, filters, create) |
| `PATH.USER.RECURRING_DETAILS` | `/dashboard/recurring/:recurringTransactionId` | `src/features/Dashboards/User/RecurringDetails/RecurringDetails.jsx` |

Build links with `getRecurringDetailsPath(id)`. The details URL is nested under the list, so the sidebar's "Recurring" item stays highlighted. Create, edit and every action are modals.

## Flow

```
Recurring (GET /recurring-transactions, filtered + paginated)
 ├─ Add recurring income / expense ── POST ──▶ rule created (no money moves); list refetched, notice
 ├─ row ✓ Confirm ── POST …/confirm-next ──▶ MONEY MOVES; list refetched, notice + transaction link
 ├─ row ✎ Edit ── PATCH (editable fields only) ──▶ list refetched
 ├─ row ⏸ Pause / ▶ Resume ── POST …/pause | …/resume ──▶ list refetched
 ├─ row 🗄 Archive ── DELETE (= archive) ──▶ list refetched
 └─ name ──▶ Details (GET /recurring-transactions/{id})
               ├─ Next occurrence panel ── Confirm (moves money) · Skip next (no money, optional reason)
               ├─ Edit · Pause / Resume · Archive
               ├─ Details list (every field)
               └─ Occurrence history (GET …/occurrences, status filter, pagination)
```

## Key files

| Path | Role |
| --- | --- |
| `src/features/Dashboards/User/api/recurringTransactionsApi.js` | Every recurring request (list, get, create, update, archive, pause, resume, confirmNext, skipNext, listOccurrences) with field whitelists |
| `…/Recurring/recurringHelpers.js` | Enums, action matrix, schedule reader, URL filters, form values/validation/payloads, eligible accounts, occurrence filters, error wording, the special-422 reader |
| `…/Recurring/Recurring.jsx` | List page |
| `…/Recurring/components/RecurringHeader/` | Title + add income / add expense |
| `…/Recurring/components/RecurringFilters/` | Type, status, frequency, mode, account, due range |
| `…/Recurring/components/RecurringSection/`, `RecurringOperationRow/` | List container and one rule row |
| `…/Recurring/components/RecurringForm/` | Create / edit modal |
| `…/Recurring/components/RecurringActionDialog/` | Pause / resume / archive / confirm / skip confirmation |
| `…/Recurring/components/RecurringOccurrences/` | Occurrence history |
| `…/Recurring/components/RecurringBadge/` | Status, mode, occurrence status and overdue badges |
| `src/features/Dashboards/User/RecurringDetails/RecurringDetails.jsx` | Details page |
| `src/locales/{en,ar}/*.json` → `dashboard.recurring.*` | All copy |

Accounts and categories come from the existing `accountsApi` and `categoriesApi`; pagination parsing reuses `parsePage` from the savings-goal helpers; nothing is duplicated.

The dashboard's "Recurring commitments" widget (`commitments.recurring` of `GET /dashboard`) links to the details page — see [../dashboard/overview.md](../dashboard/overview.md).
