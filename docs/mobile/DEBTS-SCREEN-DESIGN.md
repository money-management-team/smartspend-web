# Mobile — Debts screen design

The Debts list (`/m/planning/debts`, `src/mobile/debts/MobileDebts.jsx` with `DebtSummary.jsx`) and a debt's page (`/m/planning/debts/:id`, `MobileDebtDetail.jsx`) were refined visually to match the sign-in, Home, Activity, Accounts, Budgets and Savings goals screens (SIGN-IN-SCREEN.md, HOME-SCREEN-DESIGN.md, ACTIVITY-SCREEN-DESIGN.md, ACCOUNTS-SCREEN-DESIGN.md, BUDGETS-SCREEN-DESIGN.md, GOALS-SCREEN-DESIGN.md). Their data and behaviour are described in PHASE-6UI-5C5-DEBTS-RECURRING.md.

## What changed in markup

These changes use only figures already parsed, and existing strings:
- **`DebtRow`:**
  - The row carries `data-sm-direction` beside the existing `data-sm-status`.
  - The figures are marked `data-sm-figure="remaining" | "original" | "paid"`.
  - The outstanding amount comes first. A receivable debt labels it "Still to collect" (`debts.remainingReceivable`, the same label as its page).
  - The row now also shows **Paid**, the backend's `paid_amount`.
- **Debt page:**
  - The summary (hero) uses the shared `sm-detail-hero` and carries `data-sm-status` and `data-sm-direction`.
  - Under the outstanding figure, Original and Paid are now `.sm-debt-figures`, no longer an inline sentence.
  - The due date (or "No due date") and the backend's day count (days until due, due today, or days overdue) moved from the Details card into the summary as `.sm-debt-when`.
  - The Details card keeps the direction, currency, issued date, stored status, payments count, opening movement, owner and settled or archived dates.
  - The state note, notes, payments (with their paging, reversal and movement links) and the write tiles are unchanged and in the same order.

There is no model, loader, request, filter, pagination or calculation change. Every figure is still the backend's, in the debt's own currency. The summary still shows one block per currency and adds nothing across currencies. The write tiles still open their reviews, whose send stays closed by the write gate (`APPROVED` is empty).

## Styles

They are in the section "Mobile Debts and a debt, premium refinement" at the end of `src/mobile/styles/mobile.css`. Every rule is under `.sm-root [data-sm-screen="debts"]` or `.sm-root [data-sm-screen="debt"]`.

**List**
- **Where you stand:** each currency is a tinted block, with the currency code in brand blue. A positive net position is green; a negative one keeps its error colour.
- **Rows:** the name is extra-bold and clamped to two lines, then direction and due date, then the status chip.
- **Figures:** the outstanding amount, Original and Paid are label / figure lines on a tinted panel. The outstanding amount is first and largest.
- **Statuses:** they are told apart only by the backend's status word.
  - Overdue has a red edge on the panel and a red outstanding amount.
  - Paid has a green edge and a green chip.
  - Archived is dimmed.
  - Partly paid keeps its amber chip.
  - The edge is on the inline-start side, which is the right in Arabic.
- **Load more:** a full-width pill. The filters and the list's empty, error, stale and refresh states are unchanged in behaviour.

**Debt page**
- **Summary (hero):** the brand light and corner ring of the other heroes.
  - The label ("Remaining" or "Still to collect") is small uppercase (not in Arabic), and the figure is large.
  - Original and Paid sit side by side on a glass panel. The due date and day count sit under a hairline.
  - The status chip keeps its meaning: green for paid, amber for partly paid, red for overdue. For an overdue debt, the outstanding figure and the due line are a soft red.
- **State note:** a coloured edge: red when overdue, green when paid, blue when archived.
- **Details:** label / value lines with hairlines.
- **Payments:** hairlines between payments, a bold amount, and a green Posted chip. A reversed payment stays struck through and marked.
- **Links:** the write tiles are bordered tiles.
- **Cards:** the Home finish, rising in once (0.34s, staggered).

**Motion:** the entrance and the hover transition are off with `prefers-reduced-motion: reduce`. `tests/mobileBoundaries.test.mjs` passes.

## Not available

- **A progress bar:** the API sends original, paid and remaining amounts but no paid percentage, and Mobile does not divide one amount by another. Original and Paid are shown as figures instead.
- **A debt type** beyond its direction (I owe / Owed to me): the API has none.
- **Contact details for the other party:** the API sends only `counterparty_name`, which is the debt's title.
- **Related transactions** beyond the opening movement and each payment's movement and reversal: none are read on this page, as before.

## Checked

Headless Chrome on a local dev server, at 360, 390 and 430 px, English and Arabic, light, and dark at 390 px. Every `/api` request was answered in the page with data built by the repository's `tests/helpers/moreFixture.mjs` `debt()`, `payment()` and `summaryRow()`:
- a partly paid ILS debt with three payments, one of them reversed;
- an overdue USD receivable with no payments;
- a settled debt with an Arabic name;
- a USD debt over a million with a long name and no due date;
- a two-currency summary;
- an empty list.

The list (top and scrolled), an overdue debt (top and scrolled), a settled debt, a partly paid debt (top and scrolled) and the empty state each loaded with no horizontal overflow and no page errors.

Real devices were not checked.
