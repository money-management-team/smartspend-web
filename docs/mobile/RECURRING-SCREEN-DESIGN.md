# Mobile — Recurring screen design

The Recurring list (`/m/planning/recurring`, `src/mobile/planning/MobileRecurring.jsx`) and a rule's page (`/m/planning/recurring/:id`, `MobileRecurringDetail.jsx` with `RuleOccurrences.jsx`) were refined visually to match the other redesigned screens (BUDGETS-SCREEN-DESIGN.md, GOALS-SCREEN-DESIGN.md, DEBTS-SCREEN-DESIGN.md). Their data and behaviour are described in PHASE-6UI-5C5-DEBTS-RECURRING.md; confirming and skipping are in `docs/recurring-transactions/`.

## CSS only

This refinement changes **no markup and no logic**. Styles were added to the existing classes and `data-sm-*` attributes. None of the following was touched:
- the recurring components;
- the API wrappers and request payloads;
- `occurrence_id` handling;
- the confirm and skip workflows;
- idempotency;
- the write gate and `APPROVED`;
- the backend.

The recurring occurrence safety work is unchanged.

## Styles

They are in the section "Mobile Recurring and a rule, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="recurring"]` or `.sm-root [data-sm-screen="rule"]`. Every state shown is the backend's own word: `data-sm-status`, `data-sm-overdue`, and the chips' `data-sm-state`.

**List**
- **Cards:** the Home finish, with hairline row separators.
- **Rows:**
  - The name is extra-bold and clamped to two lines, and the amount is bolder.
  - The next due date is a tinted pill. It is red when the backend flags the next occurrence overdue. The pill is the line after type and frequency.
- **States:**
  - The paused chip is amber and the completed chip is green.
  - A paused, completed or archived rule's amount is dimmed.
- **Load more:** a full-width pill. The filters and the list's empty, error and refresh states are unchanged.

**Rule page**
- **Summary (hero):** the brand light and corner ring of the other heroes.
  - The label "Amount per occurrence" is small uppercase (not in Arabic), and the figure is large.
  - Type and frequency sit under a hairline.
  - The chips: active is cyan, paused amber, completed green, and overdue red.
- **Rule note:** a tinted callout with a brand edge. The paused, completed or archived sentence is bold.
- **Next occurrence:** a brand edge on the card. The due date is larger, and red when the backend says overdue.
- **Details:** label / value lines with hairlines.
- **History:** each occurrence has a status edge on its inline-start side (the right in Arabic):
  - green for posted;
  - red for failed or overdue;
  - blue for scheduled or due;
  - grey for skipped or cancelled.

  A skipped or cancelled amount is dimmed, and the posted chip is green.
- **Actions:**
  - Confirm, Skip and Edit are bordered tiles. Confirm, which would post money, has a blue border.
  - They still open their reviews, whose send stays closed by the write gate.
  - Pause and Resume are not offered on Mobile (they stay in the full version, as before), so there is nothing to style.
- **Cards:** the Home finish, rising in once (0.34s, staggered).

**Motion:** the entrance and the hover transition are off with `prefers-reduced-motion: reduce`. `tests/mobileBoundaries.test.mjs` passes.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with rules built by the repository's `tests/helpers/planningFixture.mjs` `rule()` and `occurrence()`:
- an active rent rule with scheduled, posted, skipped and failed occurrences;
- an overdue income rule;
- a yearly USD rule over a million with a long name;
- a paused rule with an Arabic name;
- a completed rule;
- an empty list.

The active, paused and completed lists, an active rule (four scroll positions), a paused rule and the empty state each loaded with no horizontal overflow and no page errors.

Real devices were not checked.
