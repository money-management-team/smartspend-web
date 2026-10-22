# Savings Goals — Smart plans (frontend)

Smart savings plans are built on backend branch `feature/savings-reversal-integrity` (checkpoint `c0d77ed3`). The backend contract is in the backend repo's `docs/savings-goals.md`. This file covers how the frontend uses it, the release gate, the screen inventory, and the design direction.

A goal **without** an active plan is *flexible saving* and works exactly as before. A goal **with** one is a *smart plan*: Easy / Balanced / Intensive installments covering the remaining amount. A plan is intent, not money. **Nothing moves until the owner confirms an installment.**

## Release gate

Smart savings is unreleased and **off by default**.

- `SMART_SAVINGS_ENABLED` (`SavingsGoals/smartSavings.js`) is `true` only when the build sets `VITE_SMART_SAVINGS_ENABLED=true`. The tracked `.env` does not set it, and neither does the Hostinger workflow.
- When it is off, the overview makes no plan requests and renders exactly the original production page. Every visual change in the table below (header count, empty state, hover lift, chips, panel) is scoped under `.savings-goals-page--smart` or rendered only when the flag is on.
- Achieved and archived goals never get a plan chip: having no active plan doesn't make them flexible.
- `SavingsGoals` takes `smartSavingsEnabled` as a prop, defaulting to the flag. The route passes nothing; tests pass `true`.
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
| 7 | Goal details + plan panel | `GET …/{id}`, `GET …/plan` | flexible (404), paused (on hold), `plan_health` reasons |
| 8 | Installment timeline | `savings_plan.installments` | planned, fulfilled, partially reversed, skipped, missed, cancelled, postponed |
| 9 | Confirm installment (one account) | `GET …/confirmation-preview` → `POST …/confirm` | `confirmable: false`, 409 version / not open / exceeds remaining, 422 balance |
| 10 | Confirm from several accounts | `POST …/funding-preview` → `POST …/confirm-accounts` | shortfall, 409 `savings_installment_intent_invalid` |
| 11 | Reverse a confirmation (one leg or all) | `POST …/reverse-legs` | 409 version conflict, partially reversed result |
| 12 | Postpone / skip | `POST …/postpone`, `POST …/skip` | 409 beyond target date / schedule conflict (`latest_allowed_date`) / limit reached |
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
