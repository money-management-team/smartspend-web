# Savings Goals — Smart plans (frontend)

Smart savings plans are built on backend branch `feature/savings-reversal-integrity` (checkpoint `c0d77ed3`). The backend contract is in the backend repo's `docs/savings-goals.md`. This file covers how the frontend uses it, the release gate, the screen inventory, and the design direction.

A goal **without** an active plan is *flexible saving* and works exactly as before. A goal **with** one is a *smart plan*: Easy / Balanced / Intensive installments covering the remaining amount. A plan is intent, not money. **Nothing moves until the owner confirms an installment.**

## Release gate

Smart savings is unreleased and **off by default**.

- `SMART_SAVINGS_ENABLED` (`SavingsGoals/smartSavings.js`) is `true` only when the build sets `VITE_SMART_SAVINGS_ENABLED=true`. The tracked `.env` does not set it, and neither does the Hostinger workflow.
- When it is off, the overview makes no plan requests and renders exactly the original production page. Every visual change in the table below (header count, empty state, hover lift, chips, panel) is scoped under `.savings-goals-page--smart` or rendered only when the flag is on.
- Achieved and archived goals never get a plan chip: having no active plan doesn't make them flexible.
- `SavingsGoals` and `SavingsGoalDetails` take `smartSavingsEnabled` as a prop, defaulting to the flag. The routes pass nothing; tests pass `true`.
- With the flag off, the details page renders no smart-plan panel and calls no plan or installment endpoint.
- To try it locally, put `VITE_SMART_SAVINGS_ENABLED=true` in `.env.local` (untracked), never in `.env`.

## What F1 ships: the overview

| Element | Source | Notes |
| --- | --- | --- |
| Goal count in the header | `data.savings_goals.total` | Shown as "Total goals", or as "Matching goals" when filters are active. No money totals: goals may use different currencies, and the list is paginated |
| Plan chip on each card | `GET /savings-goals/{id}/plan` | 200 → **Smart plan · {intensity}**. 404 → **Flexible saving**. Any other failure → **Plan status unavailable**, so a goal is never called flexible on the strength of an error |
| Next installment strip | `savings_plan.next_installment` | Shows the amount and date as sent. **Overdue** comes from `is_overdue`. When `plan_health.executable` is false (paused goal), it reads "on hold". **Review suggested** comes from `replanning_recommended` |
| Upcoming installments | `getUpcomingInstallments` | The next installment of each executable smart plan **on the current page**, soonest first, capped at 4. Read-only; each row links to the goal |
| Smart-plan accent | `saving-goal-card--smart` | A blue → cyan hairline on the card edge |

### Lookup rules (`smartSavings.js`, `useGoalPlanSummaries.js`)

- Achieved and archived goals are not looked up, since neither can have an active plan: reaching the target completes the plan, and archiving discontinues it.
- At most `PLAN_LOOKUP_CONCURRENCY` (4) lookups are in flight at once, so a page of 12 goals won't burst into the rate limit.
- Lookups are keyed to the list request. Every new list result (filter change, page change, write, retry) looks the plans up again, and old lookups are aborted. A summary is therefore never older than the goal it sits beside.
- `toPlanSummary` treats a response as valid only if `savings_plan.status === "active"` and `savings_goal_id` matches the goal. A malformed `next_installment` is dropped rather than shown.
- Only `GET` requests are made, and no money is moved.

The backend list has no plan field, so the overview needs one `GET …/plan` per goal (N+1). This is a known cost of not changing the backend contract. A `has_active_plan` / `next_installment` summary on `GET /savings-goals` would remove it.

## Goal details (F2)

`SmartPlanPanel` sits under the progress panel of `SavingsGoalDetails`. It loads `GET …/plan`:

- 200 shows the panel.
- 404 renders nothing, because the goal is flexible and its page is unchanged.
- Achieved and archived goals are never looked up, so they are never called flexible.
- Any other error shows the panel with the message and a retry.

The plan is fetched again when money moves, when the goal's status changes, and after every installment action. While it refreshes, the last plan stays visible, marked "Updating…", with its actions disabled.

| Part | Source |
| --- | --- |
| Title, rhythm | `intensity`, `frequency` × `interval` |
| Saved / Remaining | `balance.saved_amount` / `balance.remaining_amount` (ledger) |
| Still scheduled | `plan_health.outstanding_amount`, `outstanding_count` |
| Per installment | `installment_amount`; `final_installment_amount` when the string differs |
| Plan health (`PlanHealth`) | `plan_health` signals: on hold, overdue (count, amount, oldest date), target at risk (`uncovered_amount`, or the schedule ending after the target), finishing later, skipped, partly reversed, ahead of schedule; otherwise "On track" |
| Funding | `funding_mode` + `funding_sources` in `priority` order; allocation shown as a percentage of `allocation_bps` |
| Schedule | `start_date`, `expected_completion_date`, `scheduled_completion_date` (when delayed), `target_date`, `installment_count` |
| Timeline (`InstallmentTimeline`) | `installments` in sequence. States: overdue, upcoming, confirmed, partly reversed (paid / reversed / short by), skipped, missed, cancelled. Postponed rows show the count and the original date struck through |

**Overdue rows** are the first `plan_health.overdue.count` open installments. The backend counts them on the workspace's calendar. Installments are in date order, and a postponement can't pass the next one, so this needs no client clock.

Rows show all resolved installments plus the first four open ones; "Show all" reveals the rest. Actions appear only on open installments, and only while the goal is active and the plan is executable:
- the next installment, and any overdue one, gets full buttons;
- later installments get compact icon buttons (labelled for assistive tech, 44px on touch).

### Confirm an installment (`ConfirmInstallmentDialog`)

1. Opening the dialog calls `GET …/confirmation-preview`. Nothing from before that request is shown, and opening it moves no money.
2. The dialog shows the goal, due date, scheduled amount and the **amount to move** (`suggested_amount`, exactly). It also shows warnings and any blocker; a blocker disables Confirm.
3. The account list is the preview's `accounts`, with their `available_balance`. The plan's account (`default_account_id`) is preselected when it can pay. Accounts that can't cover the amount are disabled. A single-account plan only ever lists its own account.
4. **Confirm and move money** sends `POST …/confirm` with `expected_plan_version`, `expected_lock_version`, `from_account_id` and `amount` from the preview. It uses one Idempotency-Key per payload (`createIdempotentAttempt`).
5. On success, the page merges the returned goal (its progress is refetched), refreshes the activity and shows a notice. The plan is fetched again.

Every failure except a final one (403, 429) refetches both the preview and the plan:
- **Stale** (any version / not-open / not-active 409, or 404): the key is dropped. The user sees what changed and reviews the current preview before confirming again.
- **Validation** (422, e.g. insufficient balance): the key is dropped. The backend's reason is shown.
- **Unknown outcome** (network, timeout, 5xx): the key is kept. If the money moved, the new preview shows the installment is no longer open. If not, the preview is unchanged, so **Try again** resends the identical payload with the same key, and the backend replays instead of moving money twice.

### Postpone (`PostponeInstallmentDialog`) and skip (`SkipInstallmentDialog`)

Both move no money. Both send `Idempotency-Key`, `expected_plan_version` and `expected_lock_version`. The write logic is shared in `useInstallmentWrite`.

**Postpone**
- The date picker is bounded by `getPostponeBounds`:
  - not before today (the user's or workspace's time zone) and after the current date;
  - before the next installment in sequence (any status);
  - not after the goal's target date.
- Dates outside the bounds are rejected before any request. The dialog lists the rules, the original date and how often the installment has been postponed.
- A `savings_installment_schedule_conflict` 409 narrows the picker to its `latest_allowed_date`.
- `…beyond_target_date` explains the target date.
- `…postpone_limit_reached` disables the dialog and points to revising the plan.

**Skip**
- An alert dialog explains:
  - no money moves;
  - the target and target date don't change;
  - the amount isn't spread over other installments;
  - a skip can't be undone.
- Its button uses the warning tone. The default focus is "Keep it".

**After success, or on a stale 409**
- On success, the dialog closes, the panel shows "Installment N moved to … / skipped. No money moved." and the plan is refetched.
- A stale 409 refetches the plan and keeps the dialog open, so the next attempt uses the current versions with a new key.
- If the installment is no longer open after a refresh, the dialog is withdrawn and a notice says so.

**Errors.** Known backend codes have their own translated sentence (`smartPlan.errors.codes.*`); the backend's English messages are not shown for them. A 403 explains that only the plan owner can act, a 404 that the installment is gone, and a 429 uses the standard rate-limit message.

## Screen inventory

The "API" column is the backend endpoint. Every write sends `Idempotency-Key`. Plan writes also send `expected_plan_version`, and installment writes send `expected_lock_version`.

| # | Screen / surface | API | Key states |
| --- | --- | --- | --- |
| 1 | **Overview** (F1, done) | `GET /savings-goals`, `GET …/plan` | loading, empty, filtered-empty, error + retry, plan unavailable |
| 2 | Create flexible goal | `POST /savings-goals` (unchanged) | validation 422 |
| 3 | Create smart plan: goal + timing | `POST /savings-plans/preview` | capacity `known` / `none` / `unknown` (unknown is never shown as 0) |
| 4 | Plan choice: Easy / Balanced / Intensive | preview `options[]`, `recommended_intensity`, `duplicate_of` | infeasible, `affordability.band`, recommendation `null` + reason |
| 5 | Funding: single / priority / allocated / at confirmation | part of `POST /savings-goals/with-plan` | allocation sums to 10000 bps; account eligibility 422 |
| 6 | Review & accept | `POST /savings-goals/with-plan` or `POST …/{id}/plan` | **409 `savings_plan_option_stale`** → show `current_option` and ask again |
| 7 | **Goal details + plan panel** (F2, done) | `GET …/{id}`, `GET …/plan` | flexible (404), paused (on hold), `plan_health` reasons |
| 8 | **Installment timeline** (F2, done) | `savings_plan.installments` | planned, fulfilled, partially reversed, skipped, missed, cancelled, postponed |
| 9 | **Confirm installment, one account** (F2, done) | `GET …/confirmation-preview` → `POST …/confirm` | `confirmable: false`, 409 version / not open / exceeds remaining, 422 balance |
| 10 | Confirm from several accounts | `POST …/funding-preview` → `POST …/confirm-accounts` | shortfall, 409 `savings_installment_intent_invalid` |
| 11 | Reverse a confirmation (one leg or all) | `POST …/reverse-legs` | 409 version conflict, partially reversed result |
| 12 | **Postpone / skip** (F2, done) | `POST …/postpone`, `POST …/skip` | 409 beyond target date / schedule conflict (`latest_allowed_date`) / limit reached |
| 13 | Revise schedule or funding | `GET …/plan-options` → `PATCH …/plan` | 409 version conflict, stale option; schedule changes are blocked while paused |
| 14 | Discontinue plan | `POST …/plan/discontinue` | 409 `savings_plan_not_active` |
| 15 | Plan history | `GET …/plans` (paginated) | superseded / completed / discontinued |
| 16 | Reminders | `GET /notifications` types `savings_installment_due` / `_overdue`; `GET/PATCH /notifications/preferences` → `savings_installment_reminders` | `savings_installment_reminders_available: false` → explain the global switch is off |

Cross-cutting states for every screen:
- 401: the session flow.
- 403: owner-only actions show as read-only.
- 404: "not available".
- 409: show what changed, refetch, and never retry automatically.
- 422: field errors plus the backend's message.
- 429: `Retry-After`.

A confirmation, preview or `confirmation_intent` is never shown after a refetch has replaced it.

## Design direction

- **Reuse the dashboard's system.** The page uses the dashboard tokens (`--color-*`, `--radius-*`, `--shadow-*`) and the dashboard fonts (Cairo for UI, Tajawal for values). The landing/auth fonts (IBM Plex Sans Arabic, Plus Jakarta Sans) were deliberately *not* introduced on one dashboard page, because a single page in different type would clash with the sidebar and every other page. Moving the whole dashboard to them is a separate, dashboard-wide decision.
- **Accent.** `.savings-goals-page` defines `--savings-cyan` and `--savings-ink`, with dark variants, matching the landing/auth blue → cyan palette. Cyan marks smart plans. Green stays reserved for success notices, and danger/warning are used only for overdue and review states.
- **Motion.** Cards lift by 2px on hover, and the loading chip shimmers. Both stop under `prefers-reduced-motion`.
- **RTL.** Gradients flip under `[dir="rtl"]`, and chevrons mirror. Amounts are `<bdi dir="ltr">` inside `PrivateMoney`, and padding uses logical properties.
- **Reusable pieces for F2+:**
  - `GoalPlanChip`: the mode and intensity chip;
  - `UpcomingInstallments`: the installment row pattern, reusable for the timeline;
  - `smartSavings.js`: the summary normaliser and lookup pool;
  - `savingsPlansApi`: grows with each write screen.
