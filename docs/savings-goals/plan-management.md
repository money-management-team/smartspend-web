# Savings Goals — Smart plan management and history (F5.1, frontend)

F5.1 lets the plan owner revise an active smart plan's schedule or funding, discontinue it, and see every plan the goal has had. It sits behind the same release gate as the rest of smart savings (`VITE_SMART_SAVINGS_ENABLED`, see [smart-plans.md](smart-plans.md)); with the flag off none of it renders and none of its endpoints are called.

Backend contract: branch `feature/savings-reversal-integrity` (checked at `13bb1fbf`), `PATCH /savings-goals/{id}/plan`, `POST …/plan/discontinue`, `GET …/plans`. **None of these moves money.**

## Entry points

The plan panel (`SmartPlanPanel`) has a **Manage plan** toolbar under its title, shown while the plan isn't refreshing:

| Action | Opens |
| --- | --- |
| Revise schedule | `PATH.USER.SAVINGS_GOAL_PLAN_REVISE` with `change=schedule` (`/dashboard/savings-goals/:id/smart-plan/revise/schedule`) |
| Change funding | The same route with `change=funding` |
| Discontinue | `DiscontinuePlanDialog` |

The route is registered only when the flag is on (`Routes.jsx`), and `SmartPlanRevision` redirects to the goals list when rendered with the flag off. An unknown `change` redirects to the goal.

Actions are shown only when the backend's `savings_plan.can_manage` is true (F5.2, below). The backend's 403 stays authoritative ("Only the person who set up this plan can do this").

## Revising a plan (`SmartPlanRevision`)

The page reuses the wizard's shell (`SmartPlanWizard.css`), `WizardStepper` (now taking a `steps` prop), `GoalStep` (existing-goal view: rhythm and first date only), `PlanStep` and `FundingStep`. It loads the goal, `GET …/plan` and the workspace's accounts.

| Change | Stages | Request |
| --- | --- | --- |
| Schedule | Schedule → Plan → Funding → Review | `GET …/plan-options` (frequency, interval, start date), then `PATCH …/plan` with `change: "schedule"`, `expected_plan_version`, `intensity`, `frequency`, `interval`, `start_date?`, both fingerprints and the full `funding` |
| Funding | Funding → Review | `PATCH …/plan` with `change: "funding"`, `expected_plan_version`, `funding` |

- **Drafts start from the plan.** The rhythm comes from `frequency × interval` (`getPlanRhythm`); the funding is the plan's mode and sources in priority order, with allocations as percentages (`getPlanFunding`). Accounts that are no longer eligible drop out once the account list is known.
- **The target date isn't changed here.** The options use the goal's own target date. Changing it is a goal edit, which the backend refuses while a plan is active (`savings_plan_revision_required`).
- **A funding "change" identical to the plan is refused in place** (`isSameFunding`: same mode, accounts, order and shares). The backend would record nothing for it.
- **A paused goal can't change its schedule.** The backend keeps a paused plan as it is (409). The page explains this and links to the funding change, which is allowed while paused.
- **No active plan** (404) shows "This goal has no active plan" with a link back.

### Review (`RevisionReview`)

- **Now vs after**, from the plan and the chosen option only, with nothing recomputed:
  - schedule: intensity, rhythm, per installment, open installments vs the new count, next installment, last installment, funding mode, accounts;
  - funding: mode and accounts, with per installment and next installment marked unchanged.
  - Changed rows carry a cyan marker. On phones each row becomes a small card with labelled "Now" and "After" values.
- **What this does.**
  - Schedule: the plan is closed as replaced and its open installments are cancelled (count shown). Confirmed installments keep their money in the goal. The new plan covers exactly what's left (`plan_options.goal.remaining_amount`). The old plan stays in history.
  - Funding: the schedule and amounts don't change, open installments use the new setup, confirmed ones keep their accounts, and the old setup is recorded in history.
- **Split payments note.** When the current plan has installments paid from several accounts that can still be reversed (`countReversibleSplitPayments`), the review notes that they stay in the goal and remain reversible from plan history.
- **Approval.** "No money moves" is shown, followed by an explicit checkbox. The approval is tied to `[change, plan_version, preview key, both fingerprints, funding]`, so any change to these unticks it.

### Safety rules

- **Version.** Every request sends the `plan_version` the user reviewed.
- **Idempotency.** There is one key per payload (`createIdempotentAttempt("savings-plan-revision")`). An unknown outcome (network, timeout, 5xx) keeps it, so "Try again" replays the identical request. Any rejection drops it.
- **409 `savings_plan_version_conflict`** (or `savings_plan_accounts_changed`):
  - the plan is fetched again and the approval cleared, and a banner says the plan changed and needs a fresh review;
  - a schedule change returns to fresh options;
  - nothing is resent automatically, and the next request uses the new version with a new key.
- **409 `savings_plan_option_stale`:** back to the Plan stage with fresh options and the verdict explained. The backend's `current_option` is never accepted for the user.
- **409 `savings_plan_not_active` / 404:** the plan is reloaded, and the page shows "no active plan".
- **Other failures:** a 422 shows the backend's reason and a link to the stage that owns the field (`getRevisionErrorStep`). 403 and 429 are explained in place.
- **On success** the page returns to the goal with `state.smartPlanRevised`, and the panel shows a one-time notice that nothing moved.

## Discontinuing a plan (`DiscontinuePlanDialog`)

- **Content.** An alert dialog shows the open installments count, the amount still scheduled, and what's saved in the goal (which stays). It lists what happens:
  - no money moves;
  - open installments are cancelled;
  - confirmed installments and the balance are untouched;
  - the goal becomes flexible saving;
  - the plan can't be reopened, but a new one can be created.
- **Focus.** The default focus is "Keep the plan".
- **Acknowledgement.** An explicit checkbox enables the caution button. It is tied to the `plan_version` shown, so a plan refreshed after a conflict asks again.
- **Request.** `POST …/plan/discontinue` with `{ expected_plan_version }` and an Idempotency-Key, through `usePlanWrite("discontinue")`. This is the plan-level twin of `useInstallmentWrite`, with the same key and failure rules.
- **Stale.** A version-conflict or not-active 409, or a 404, refetches the plan. The dialog stays open with the message. Nothing is resent.
- **Success.** The page applies the returned goal, shows "…was discontinued. No money moved", and refetches plan history. The panel refetches the plan; it gets a 404, so the goal shows the flexible-goal invitation.

## Plan history (`PlanHistory`)

On the goal's page under the plan panel, for every goal (also achieved and archived ones, which can have completed or discontinued plans). It renders nothing when the goal never had a plan.

- **Data.** `GET …/plans?per_page=5`, newest first. "Show older plans" appends the next page without repeats (`appendPlans`). It refetches with the page's refresh key (money moved, status change) and after a discontinue.
- **Card per plan.** Each card shows:
  - the status pill (active cyan, completed green, replaced blue, discontinued neutral) on a vertical rail;
  - accepted → ended dates (on the user's calendar, `toDateIn`);
  - per installment and rhythm;
  - **Set out to cover** (`baseline_remaining`, labelled as the plan's own figure);
  - the scheduled start → last date;
  - funding mode and accounts (with shares);
  - confirmed installments `fulfilled of total`, with open and cancelled counts and a bar by **count**;
  - how it ended (`closed_reason`);
  - funding changes (`funding_revisions`, owner only) in a disclosure.
- **Completed plans** open with a summary:
  - "Target reached on {date}";
  - the pace against the plan's own last installment date (`getCompletionPerformance`: early / on the planned date / late, in whole days);
  - a note that this is when the plan completed and that the goal's current balance lives in its progress and can change later. **No history figure is the ledger balance.**
- **Installments and reversals.** Any plan's installments open from its card, and split payments of closed plans can be reversed there (F5.2, below). The active plan's card also links to the plan panel.
- **No writes.** Reading history writes nothing.

## Complete history, closed-plan reversals and permissions (F5.2)

Backend checkpoint `eb21cc72` added `GET …/plans/{plan}/installments`, `financial_summary` on each history plan and `can_manage` on the plan, history and plan-installment resources.

### Installments of any plan (`PlanInstallments`)

- **Opening.** Each history card has a **Show installments (N)** toggle (`aria-expanded`, `aria-controls`). Opening it loads `GET …/plans/{plan}/installments?per_page=10`; "Show more installments" appends the next page without repeats (`appendById`). It refetches with the history's refresh key, so after a reversal the rows are current.
- **Rendering.** Rows use the plan panel's `InstallmentTimeline` with `canAct=false`. Every state shows: confirmed, partly reversed (paid / reversed / short by), postponed (count and struck-out original date), skipped, missed and cancelled. Cancelled rows say why (`resolution_reason`: plan revised, plan discontinued, goal archived, target reached).
- **Active plans.** These also open here, read only, with a link to the plan panel, where installments are confirmed.

### What a plan collected (`financial_summary`)

- **The figures.** A card section **Plan contributions** shows **Effective plan contributions** (`contributions.effective_amount`), **Confirmed plan contributions** (`confirmed_amount`) and **Reversed plan contributions** (`reversed_amount`, with the reversed-payment count). They are the backend's strings via `formatMoney`; nothing is added up client side.
- **Not the goal's balance.** These are contributions attributed to the plan's own installments. The note says so: the goal's balance also includes direct contributions, withdrawals and other plans, and is shown only where it comes from the goal's own balance response (its progress, `GET …/plan` `balance.saved_amount`). Completed plans add "Effective plan contributions: {amount}" to their summary.
- **Incomplete attribution.** When `attribution.complete` is false, `readFinancialSummary` returns no amounts (even if some were sent). The card explains that the totals can't be worked out reliably and that the installments below remain accurate.

### Reversing a closed plan's payments

- **Offered when** `savings_plan.can_manage === true` (from the installments response) and the installment holds a split payment (`canReverseLegs`).
- **The dialog** is the existing `ReverseLegsDialog`, unchanged. It reads `GET …/funding-legs` fresh on every opening; legs are selectable only if their id is in `reversal.effective_leg_ids`, and historical cycles stay read only. Its rules are unchanged:
  - "all remaining" or chosen legs;
  - `expected_lock_version` from that read;
  - a reason, an explicit acknowledgement and an Idempotency-Key;
  - a 409, 404 or 422 re-reads and asks for a fresh choice and approval;
  - an unknown outcome keeps the key;
  - nothing is sent automatically.
- **Single-account payments** stay with the goal's activity reversal, and a hint in the panel says so.
- **On success** the page applies the returned goal, refreshes activity and history, and the panel says the plan stays `{status}`. The backend keeps a closed plan's status; the client never changes it.

### Permission (`can_manage`)

`can_manage` is permission only: the plan owner who still manages the workspace's finances. Eligibility still comes from the plan's status, the goal's status, `plan_health.executable` and `reversal.eligible`, and the backend's 403 remains final.

| Where | `can_manage !== true` |
| --- | --- |
| Plan panel | No Manage toolbar and no confirm, postpone, skip or reverse buttons. A note says the plan is view only |
| Revision page | "Only the plan's owner can change it", with no stages |
| Discontinue dialog | Not rendered |
| History card | A "View only" pill |
| History installments | A view-only note and no reverse buttons |

### Savings reminders (F5.2.2: deep links)

- **Inbox.** `savings_installment_due` / `_overdue` notifications use the existing inbox and item, with translated type labels. Read and unread behaviour is unchanged.
- **Link.** It comes from `getNotificationPath`, which reads only the notification's **top-level `action`** (backend `651b217d`; validated there, `null` for every other type). `metadata` is never read.
  - flag off: no link (unchanged behaviour);
  - flag on, with `action.type === "review_savings_installment"` and positive integer ids (`savings_goal_id`, `installment_id`, and `savings_plan_id` when present): `/dashboard/savings-goals/{goal}?plan={plan}&installment={id}`;
  - flag on, with a null or malformed action: the savings goals overview.
  - The link is an internal route built from those ids. The action's `confirmation_preview` / `funding_preview` paths are never followed, and nothing from the payload is used as a URL.
- **The goal page.** Ids in the query are accepted only as positive integers; anything else is ignored.
  - **The active plan's installment** (`plan` absent or equal to the active plan's id): the plan panel reveals it even past the first four open rows (`InstallmentTimeline` opens the list instead of hiding it), highlights it (`aria-current`), scrolls to it and shows a banner.
    - An open installment that the user may act on gets **Review installment**. That opens the usual dialog, which first fetches a fresh `confirmation-preview` (or `funding-preview` for split plans).
    - Otherwise the banner says why it can't be confirmed, or gives its current state ("Installment 1 is Confirmed. There's nothing to confirm"). It never offers an invalid confirmation.
  - **An earlier plan** (completed, discontinued or superseded): the panel says the installment is in plan history and links there. `PlanHistory` reads older pages until it finds the plan and opens its card on its installments. `PlanInstallments` then reads pages of 50 until it finds the installment, highlights it and states its current status and the plan's ("installment 56 is Cancelled. This plan is Replaced, so there's nothing to confirm").
  - **Edge cases.** A plan or installment that isn't there is explained ("isn't in this goal's history" / "isn't in this plan"). An inaccessible goal shows the goal's own not-found state, and no plan is requested.
  - Opening a notification never moves money, and nothing opens a dialog by itself.
- **Preference (`SavingsReminders`, Settings → Preferences, flag on only).**
  - `GET /notifications/preferences`; the switch (a native checkbox with `role="switch"`) sends `PATCH` with `{ savings_installment_reminders }` only, so no other preference is touched, and then shows the response.
  - A failed save keeps the previous value and says so.
  - When `savings_installment_reminders_available` is false, the card explains that reminders are off for SmartSpend right now and that the choice will apply once they're on. The client never touches the scheduler switches.

## Remaining gaps (before F6)

- **Postponed rows** show the count and original date, but not when each postponement happened; there is no field for it.
- **Finding an earlier plan's installment** reads pages until it is found (50 installments and 5 plans per page). Paging always ends: it stops when the target is found, at the last page, on any error, on a response for a page other than the one requested (treated as malformed, with a retry), and after `MAX_SEEK_PAGES` (40) automatic pages. A very long history makes several read requests; a backend lookup by installment id would make it one.

## RTL, i18n and design

- **Strings.** Copy lives in `dashboard.savingsGoals.planManagement.*` and `dashboard.savingsGoals.planHistory.*`, plus `notices.planDiscontinuedSuccess` and `smartPlanWizard.steps.schedule`. Both locales are in key parity. Counts use "Label: {{count}}" like the rest of the page, so no plural forms are needed.
- **Direction.** Amounts are `<bdi dir="ltr">` inside `PrivateMoney`, and dates are `<bdi>`. The comparison arrows, history date-range arrows and gradients mirror under `[dir="rtl"]`. Padding, borders and the rail use logical properties.
- **Tokens.** Dashboard tokens and fonts only: Cairo for UI, Tajawal (`--font-heading`) for titles and values. Cyan marks smart plans, green is used only for completion, and warning only for caution and gaps.
- **Responsive.** At 390px the toolbar becomes a 2 + 1 grid of 44px targets, the comparison table becomes labelled cards, and history facts take two columns. Visual QA covered desktop 1440 and mobile 390 in English and Arabic, light and dark, with no horizontal overflow.
- **Motion.** The refresh spinner and skeleton stop under `prefers-reduced-motion`, and "Go to the plan" scrolls without smoothing then.
