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

## Plan creation (F3)

`SmartPlanWizard` (`src/features/Dashboards/User/SmartPlanWizard/`) has four stages: **Goal → Plan → Funding → Review**. It is a lazy page on two routes, and both are registered only when the flag is on (`smartSavingsFlag.js` is import-free, so the route table doesn't pull in the feature).

| Route | Use | Preview | Create |
| --- | --- | --- | --- |
| `PATH.USER.SAVINGS_SMART_PLAN_NEW` `/dashboard/savings-goals/smart-plan` | New goal with a plan | `POST /savings-plans/preview` | `POST /savings-goals/with-plan` (goal, savings account and plan in one transaction) |
| `PATH.USER.SAVINGS_GOAL_SMART_PLAN` `/dashboard/savings-goals/:id/smart-plan` | Existing flexible goal | `GET /savings-goals/{id}/plan-options` | `POST /savings-goals/{id}/plan` |

Entry points (flag on only):
- **Overview header:** a "Smart plan" action. "New goal" still opens the existing form.
- **Details page:** an invitation card for an **active** flexible goal with money still to save. Paused, funded, achieved and archived goals get nothing.
- **Wizard stage 1:** "Free savings" leaves for the existing create form (`?new=1`), unchanged.

### Stages

1. **Goal.**
   - A new goal takes its name, target amount, currency, optional target date and notes.
   - An existing goal is shown read only: target, saved and remaining come from its ledger progress, and amount and date change through Edit goal.
   - Both choose a rhythm (weekly, every 2 weeks, monthly, every 3 months → `frequency` × `interval`) and an optional first-installment date.
   - Validated before continuing (`validateGoalStep`).
2. **Plan.**
   - The backend's options as cards: amount per installment, count, first → last date, last installment when it differs, and the full schedule on demand (`option.installments`, exactly).
   - Affordability is the backend's `band`, labelled **Estimate**. The capacity panel says "not a guarantee or financial advice". Unknown capacity is never shown as zero.
   - Infeasible options show their `status` and shortfall. Duplicate schedules say "Same schedule as …". Neither can be chosen.
   - The recommendation and its reason are the backend's. A preview 422 offers "Edit the goal"; other errors offer a retry.
   - When no option can be chosen (e.g. already funded), Continue is disabled.
3. **Funding.**
   - The four backend modes. Only eligible accounts are offered (active, same currency, not a goal's account; `getEligibleAccounts`).
   - **Single:** exactly one account.
   - **Priority:** two to five accounts, reorderable. Sources are sent in that order, first = priority 1.
   - **Allocated:** two to five accounts with percentages, parsed to whole basis points with string arithmetic (`percentToBps`). They must total exactly 10000; a note says split installments can't be confirmed in the app yet.
   - **At confirmation:** no sources.
   - Shape rules are checked before sending (`validateFunding`, mirroring `SavingsPlanFundingRules`). Eligibility is the backend's call.
4. **Review.**
   - The plan comes first, full width; goal and funding sit beside each other below it. Each has an Edit link.
   - The assurance reads "Accepting a plan moves no money".
   - An explicit checkbox is required before the create button is enabled.

### Rules that protect the user

- **Previews belong to their inputs.**
  - `getPreviewKey` covers amount, currency, target date, rhythm, first date and goal, plus a nonce.
  - Any change fetches a new preview, and the chosen option, read from that preview only, is cleared.
  - Nothing from an older preview can be sent.
- **The approval covers what is shown.** It is tied to the preview key, the option's two fingerprints, the funding and the name and notes. Changing any of them unticks it.
- **Fingerprints.** Creation sends the chosen option's `options_fingerprint` and `assessment_fingerprint`; amounts and installments are never sent.
- **Stale option.** On a 409 `savings_plan_option_stale` (verdict `schedule_changed`, `assessment_changed` or `unavailable`), the wizard returns to the Plan stage with a fresh preview, explains the verdict, and clears both the choice and the approval. The `current_option` in the 409 is **not** accepted on the user's behalf, and nothing is resent automatically.
- **Idempotency.** There is one key per payload (`createIdempotentAttempt("savings-plan")`). An unknown outcome (network, timeout, 5xx) keeps it, so "Try again" replays the same request; the backend returns the same goal. Any rejection drops it.
- **Other failures.**
  - A 422 shows the backend's reason, with a link to the stage that owns the field (`getErrorStep`: `funding.*` → Funding, fingerprints → Plan, the rest → Goal).
  - Other 409s (goal paused, archived, funded, or already planned) and a 403 (not the owner) show their message.
  - The existing-goal route checks first and explains instead of offering the form.
- **No money moves.** Previews and creation never create a transfer.
- **Guard.** `UnsavedChangesGuard` protects unsaved work. It is quiet while a request is in flight, so navigating to the new goal isn't blocked.
- **After success.** The wizard navigates to the goal's page with `state.smartPlanCreated`, and the plan panel shows "Your smart plan is ready. Nothing has moved yet".

### Goal-details header (flag on)

With the flag on, the details root gets `savings-goal-details--smart`, and the status badges on the blue header take the same translucent-white treatment as its other chips, so they are readable in both themes. With the flag off, the header is unchanged.

## Multi-account funding and reversal (F4)

Both live in the goal's smart plan panel, behind the same flag.

### Which dialog confirms an installment

| Plan `funding_mode` | Confirm opens | Can the user change the split? |
| --- | --- | --- |
| `single` | `ConfirmInstallmentDialog` (F2, unchanged) | No |
| `priority` | `ConfirmInstallmentDialog`, with **Pay from several accounts instead** → `FundingBreakdownDialog` | Yes, across the plan's accounts |
| `at_confirmation` | Same as priority | Yes, across every eligible account (required) |
| `allocated` | `FundingBreakdownDialog` directly (the single-account path rejects allocated plans) | No, the plan's fixed shares |

### `FundingBreakdownDialog` (`POST …/funding-preview` → `POST …/confirm-accounts`)

1. **Build.**
   - Opening the dialog sends `funding-preview` with no body, and the backend proposes the breakdown:
     - allocated: the plan's shares;
     - priority: filled in the plan's order;
     - at-confirmation: `problem: breakdown_required`, so the user writes the split.
   - Each part shows its account, exact amount and available balance, plus the preview's warnings, blocker, `problem` (`insufficient_balance` with `shortfall_amount`, `exceeds_remaining`, `breakdown_invalid`, `account_not_eligible`).
   - Where the mode allows editing, the user sets the account and amount per part, with at most five parts and no account twice. "Left to allocate" is `total − Σ parts`, worked out exactly in BigInt minor units with `subtractMoney`/`sumMoney`; nothing else is calculated.
   - **Check this split** sends `{ legs }`, and the backend validates and, when the split is confirmable, signs it.
   - Any edit after a check makes that preview stale, and it can't be approved until checked again (`getBreakdownKey`).
2. **Approve.**
   - Shows exactly the checked breakdown as account → goal transfers with the total, and explains them: separate transfers, all or nothing, balances re-checked.
   - An explicit checkbox is required.
3. **Confirm** sends `expected_plan_version`, `expected_lock_version`, `amount`, `legs` (in the order shown) and `confirmation_intent` **unchanged** (`buildConfirmAccountsPayload`), with one Idempotency-Key per payload.
4. **Any failure** goes back to Build with the **same** breakdown previewed again. The approval is cleared and nothing is resent automatically.
   - A 409 (e.g. `savings_installment_intent_invalid`, a version conflict) or 422 drops the key.
   - An unknown outcome (network, timeout, 5xx) keeps it. If nothing changed, the re-signed intent is identical, so the retry is the identical request and the backend replays it.
5. **Success:** the page merges the returned goal (its progress is refetched), refreshes the activity and shows a notice; the plan and its health are fetched again. The response's `funding_legs` are kept for reversal (see below).

Opening the dialog and previewing never move money. A failed preview is a read error with a retry; it never says "the money may have moved".

### `ReverseLegsDialog` (`POST …/reverse-legs`)

**Offered for** multi-account installments only: `status = fulfilled`, `fulfilled_goal_movement_id = null` (the backend names a single movement only for one-account confirmations) and a non-zero `effective_amount`. Single-account installments keep the existing transaction reversal from the goal's activity. Reversal is allowed while the goal is paused (the backend has no status gate; it is like a withdrawal).

**Fresh payments on every opening.** The dialog calls `GET …/funding-legs` each time it opens, including after a page reload. Nothing is cached between openings. Everything shown and sent comes from that response (`readFundingLegs`):
- **Amounts:** scheduled, originally paid (`confirmed_amount`), still in the goal (`effective_amount`) and already reversed (`reversed_amount`), all taken from the response's `installment`.
- **Current payment** (`current_confirmation`): its date and each leg (account, exact amount). Reversed legs are struck through with their reversal date.
- **What can be chosen:** a leg can be chosen only if its id is in `reversal.effective_leg_ids` (and `reversal.eligible` is true). The user can reverse **all remaining payments** (`all: true`) or **choose** one or several (`leg_ids`). The exact total being reversed is shown (`sumMoney` of the chosen legs, or `effective_amount`).
- **Earlier confirmations** (`history`): each cycle with its date and legs, listed last in a separate dashed panel, read only and never selectable.
- **Nothing to reverse:** when the response says reversal isn't possible, the dialog explains why ("paid from a single account; reverse it from the goal's activity", or "nothing is left to reverse") and offers only Close.

**`expected_lock_version`** comes from that response (`reversal.expected_lock_version`), never from the plan or a cached value.

**Required:** a reason (3–500 characters, per the contract) and an explicit acknowledgement. The button enables after the acknowledgement; a short reason or an empty choice is explained when pressed. A pending reversal blocks further presses, so one press sends one request.

**Failures**
- **409, 404 or 422** (`savings_installment_version_conflict`, `legs_changed`, `leg_already_reversed`, an old leg, …): the payments are read again, the plan is refetched, and the choice **and** the acknowledgement are cleared. The user reviews the current state; a different set is never reversed and nothing is resent automatically. The key is dropped, so the next attempt is a new request.
- **Unknown outcome** (network, timeout, 5xx): the key is kept and the payments are read again. If nothing changed, the same choice resends the identical request with the same key and the backend replays it. If the version changed, that is a new review.
- **403** (not the owner), **429** (rate limited) and read errors are explained in place; a failed read is never described as "the money may have moved".

**Success:** the goal is merged, the activity refreshed, a "payments reversed" notice shown and the plan fetched again. The next opening reads the payment history fresh. Partial reversals also show in the timeline (paid / reversed / short by) and in plan health.

### Reusable pieces

- `FundingLegs`: account → goal rows with exact amounts, an optional detail, reversed state and optional selection.
- `smartPlanHelpers.js`: `readFundingLegs`, `readFundingPreview`, `remainingToAllocate`, `validateDraftLegs`, `getBreakdownKey`, `buildConfirmAccountsPayload`, `isMultiAccountInstallment`, `canReverseLegs`, `buildReversePayload`.
- `useInstallmentWrite("reverseLegs")` is the same write hook as postpone and skip.

## Plan management and history (F5.1)

Revising, discontinuing and the plan history are documented in [plan-management.md](plan-management.md).

## Screen inventory

The "API" column is the backend endpoint. Every write sends `Idempotency-Key`. Plan writes also send `expected_plan_version`, and installment writes send `expected_lock_version`.

| # | Screen / surface | API | Key states |
| --- | --- | --- | --- |
| 1 | **Overview** (F1, done) | `GET /savings-goals`, `GET …/plan` | loading, empty, filtered-empty, error + retry, plan unavailable |
| 2 | Create flexible goal | `POST /savings-goals` (unchanged) | validation 422 |
| 3 | **Create smart plan: goal + timing** (F3, done) | `POST /savings-plans/preview` | capacity `known` / `none` / `unknown` (unknown is never shown as 0) |
| 4 | **Plan choice: Easy / Balanced / Intensive** (F3, done) | preview `options[]`, `recommended_intensity`, `duplicate_of` | infeasible, `affordability.band`, recommendation `null` + reason |
| 5 | **Funding: single / priority / allocated / at confirmation** (F3, done) | part of `POST /savings-goals/with-plan` | allocation sums to 10000 bps; account eligibility 422 |
| 6 | **Review & accept** (F3, done) | `POST /savings-goals/with-plan` or `POST …/{id}/plan` | **409 `savings_plan_option_stale`** → show `current_option` and ask again |
| 7 | **Goal details + plan panel** (F2, done) | `GET …/{id}`, `GET …/plan` | flexible (404), paused (on hold), `plan_health` reasons |
| 8 | **Installment timeline** (F2, done) | `savings_plan.installments` | planned, fulfilled, partially reversed, skipped, missed, cancelled, postponed |
| 9 | **Confirm installment, one account** (F2, done) | `GET …/confirmation-preview` → `POST …/confirm` | `confirmable: false`, 409 version / not open / exceeds remaining, 422 balance |
| 10 | **Confirm from several accounts** (F4, done) | `POST …/funding-preview` → `POST …/confirm-accounts` | shortfall, 409 `savings_installment_intent_invalid` |
| 11 | **Reverse a confirmation (one leg or all)** (F4, done) | `POST …/reverse-legs` | 409 version conflict, partially reversed result |
| 12 | **Postpone / skip** (F2, done) | `POST …/postpone`, `POST …/skip` | 409 beyond target date / schedule conflict (`latest_allowed_date`) / limit reached |
| 13 | **Revise schedule or funding** (F5.1, done) | `GET …/plan-options` → `PATCH …/plan` | 409 version conflict, stale option; schedule changes are blocked while paused |
| 14 | **Discontinue plan** (F5.1, done) | `POST …/plan/discontinue` | 409 `savings_plan_not_active` |
| 15 | **Plan history** (F5.1, done; closed plans' installments need a backend endpoint) | `GET …/plans` (paginated) | superseded / completed / discontinued |
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
