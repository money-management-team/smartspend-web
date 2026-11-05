# Phase 6UI.5C4 — Premium Budgets & Savings Goals (Mobile)

Read-only. `APPROVED = Object.freeze([])` is unchanged: nothing on these pages sends anything.
Backend reference: `fix/financial-idempotency-p0 @ 6b696d72`, read with `git show` only.

## Audit: Desktop vs Mobile

| Desktop feature | Mobile before | Mobile now |
|---|---|---|
| Budget limit, spent, remaining, % used, status, days left, expenses count | all present | unchanged values; bar moved onto the hero beside the limit |
| Budget status explained in words (safe / warning / near limit / exceeded) | chip only | the backend's status word plus Desktop's own sentence |
| Budget → its expenses | none | link to Activity filtered by type, the budget's dates and (category budgets) its category |
| Goal saved, target, remaining, %, status, target date, days left, contributions count | all present | unchanged values; bar moved onto the hero beside the saved figure |
| Goal's account | text | link to the account page |
| Goal contributions / withdrawals history (`GoalActivity`) | **missing** | "Money movements" card: All / Added / Withdrawn tabs, paging, reversed rows, link to each transfer |
| Smart Savings plan section | present, flag-gated | untouched (flag off by default; see `SMART_SAVINGS_RELEASE.md` in the backend) |
| Contribute / withdraw / edit / archive | draft links only | unchanged — still draft links, never sent |

## What was added

- `GET /savings-goals/{id}/activity[?type=withdrawal]` and `GET /savings-goals/{id}/contributions` (`readGoalMovements`, 10 per page).
  Shape per row: `GoalMovementResource` — id, `savings_goal_id`, type, amount, currency, `transfer_id`, `transfer_status`, `is_reversed`, from/to account, `occurred_at`.
- `models/goalMovements.js`: strict. A page is refused whole if any row names another goal, another currency, has a non-decimal amount or no id. Withdrawals are shown as negative amounts; reversed rows are struck through and carry a "Reversed" chip. Nothing is filtered, sorted or summed in the browser.
- Tab and page live in the address (`?movements=`, `?mp=`) and are `Link`s with `replace`, so Back leaves the goal in one step and a shared link shows the same slice.
- `models/budgets.js` carries `categoryId`; `models/goals.js` carries `accountId` (both from fields the backend already returns).
- Strings: `i18n/sections/planningDetails.js` (EN/AR, parity-checked).

## Limits (deliberate)

- No refresh/"recalculate" button: the pages must stay free of controls, and progress comes from the backend on load (60 s freshness, no polling).
- The movement history needs the goal's currency; a goal without one shows "Movements can't be shown" rather than guessing.
- Smart Savings was not changed: it is flag-gated and unreleased, so any gap there stays documented, not patched.
- The Activity link is a navigation only; whether Activity shows exactly the budget's counted expenses is Activity's (backend's) filter semantics.

## Safeguards kept

- Only GET requests; `tests/mobileReadOnly.test.mjs` allow-lists the new read and checks its method/endpoint/query.
- Currency is part of every figure; mixed-currency rows are refused, not converted.
- Flag-off builds still contain no Mobile code (`mobileBundle`).

## Tests

`tests/mobilePlanningDetails.test.mjs` (13 tests) plus the extended `mobileReadOnly` facade test. Fixture: `planningBackend({ movements })` and `movement()` in `tests/helpers/planningFixture.mjs`.
