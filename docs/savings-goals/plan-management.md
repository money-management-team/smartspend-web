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

Actions are shown to anyone who can see the plan. The plan resource has no owner flag, so a non-owner's attempt gets the backend's 403, worded "Only the person who set up this plan can do this" (the F2 pattern).

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
- **Split payments warning.** When the current plan has installments paid from several accounts that can still be reversed (`countReversibleSplitPayments`), a schedule change warns before approval that reversing them from the app won't be available afterwards. See the missing contract below.
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
- **Installments and reversals.**
  - The active plan's card links to the plan panel, where its installments, payments and reversals already are.
  - A closed plan's card says its payments are in the goal's activity, where single-account payments can be reversed, and that opening a closed plan's installments, including reversing split payments, isn't available yet. The workflow gap is stated, not hidden. See below.
- **No writes.** Reading history writes nothing.

## Missing backend contracts (for F5.2)

1. **A closed plan's installments.**
   - `GET …/plan` returns only the active plan.
   - `GET …/planned-contributions` lists standalone contributions only (`->standalone()`).
   - `GET …/plans` returns counts only.
   - Goal activity movements carry no installment id.
   - So the frontend can't learn a completed, discontinued or superseded plan's installment ids. The backend already accepts them: `GET …/funding-legs` requires only `savings_plan_id`, and `reverse-legs` works on a closed plan (a fully reversed installment becomes `cancelled`). But they are unreachable.
   - A multi-account payment confirmed under a plan that later closed therefore can't be reversed from the app (its generic transaction reversal is refused with `savings_installment_leg_requires_domain_reversal`).
   - Needed: `GET /savings-goals/{goal}/plans/{plan}` (or `…/plans/{plan}/installments`) returning the plan's installments in the `SavingsPlanInstallmentResource` shape (`id`, `status`, `reversal_state`, `confirmed_amount`, `effective_amount`, `fulfilled_goal_movement_id`, `lock_version`), with the same scoping as `GET …/plans` (404 outside the workspace).
2. **What a plan actually saved.**
   - `SavingsPlanHistoryResource` has counts and `baseline_remaining` but no money totals.
   - Needed: `installments_summary.confirmed_amount`, `effective_amount` (confirmed minus reversed) and `reversed_amount`, summed by the backend, so a completed plan can show what it saved without the client adding money.
3. **Owner flag.** Neither plan resource says whether the viewer owns the plan. `can_manage` (or `is_owner`) would let non-owners see management actions as read only, instead of learning from a 403.

## RTL, i18n and design

- **Strings.** Copy lives in `dashboard.savingsGoals.planManagement.*` and `dashboard.savingsGoals.planHistory.*`, plus `notices.planDiscontinuedSuccess` and `smartPlanWizard.steps.schedule`. Both locales are in key parity. Counts use "Label: {{count}}" like the rest of the page, so no plural forms are needed.
- **Direction.** Amounts are `<bdi dir="ltr">` inside `PrivateMoney`, and dates are `<bdi>`. The comparison arrows, history date-range arrows and gradients mirror under `[dir="rtl"]`. Padding, borders and the rail use logical properties.
- **Tokens.** Dashboard tokens and fonts only: Cairo for UI, Tajawal (`--font-heading`) for titles and values. Cyan marks smart plans, green is used only for completion, and warning only for caution and gaps.
- **Responsive.** At 390px the toolbar becomes a 2 + 1 grid of 44px targets, the comparison table becomes labelled cards, and history facts take two columns. Visual QA covered desktop 1440 and mobile 390 in English and Arabic, light and dark, with no horizontal overflow.
- **Motion.** The refresh spinner and skeleton stop under `prefers-reduced-motion`, and "Go to the plan" scrolls without smoothing then.
