# Phase 6UI.5C5 — Debts & Recurring (Mobile)

Read-only. `APPROVED = Object.freeze([])` is unchanged: nothing on these pages sends anything.
Backend reference: `fix/financial-idempotency-p0 @ 6b696d72`, read with `git show` only (resources, controllers, the summary service and the filter requests).

## Audit: Desktop vs Mobile against the backend's GET contracts

| Desktop feature | Backend GET | Mobile before | Mobile now |
|---|---|---|---|
| Debt summary: per currency what I owe, what is owed to me, paid so far, net position, open and overdue counts | `GET /debts/summary` → `data.summary.by_currency[]` | **missing** | "Where you stand" card above the Debts list, one block per currency |
| Debt list, direction and status filters, overdue | `GET /debts` | present | unchanged |
| Debt balances: original, paid, remaining, status, due date, opening movement | `GET /debts/{id}` | present | unchanged figures; due date in words; status sentence; "Recorded by" |
| Payment history | `GET /debts/{id}/payments` | first 10 only, "the rest is in the full version" | **whole history**, paged; reversed payments carry the day they were reversed, their note and a link to the reversal; the account is a link |
| Recurring list, status and type filters | `GET /recurring-transactions` | present | rows now carry the backend's overdue / due / failed state of the next occurrence |
| Rule: schedule, frequency, next due date, open count | `GET /recurring-transactions/{id}` | present | unchanged |
| Rule: next occurrence (date, status, overdue, amount, attempts, failure reason) | `data.recurring_transaction.schedule.next_occurrence` | **missing** (only the count) | "Next occurrence" card |
| Rule: occurrence history | `GET /recurring-transactions/{id}/occurrences` | **missing** | "Occurrences" card: seven tabs (All + the six statuses), paging, link to the posted transaction |
| Rule: account and category | `account.id`, `category.id` | text | links to the account and category pages |
| Contribute / record payment / reverse / edit / archive / confirm / skip / pause / resume | POST / PATCH / DELETE | draft links only | unchanged — still draft links, never sent |

## What was added

**Debts**

- `GET /debts/summary?workspace_id=` (`readDebtSummary`, `debtSummaryLoader`, store key `debtSummary`). `models/debts.js › buildDebtSummary` is strict: a bucket without a valid currency, a repeated currency, a missing side or an amount that is not a decimal refuses the whole summary (an error card with Retry; the list below is unaffected). The summary covers open debts only (active and partly paid): that is the backend's definition (`DebtSummaryService`), and the card says so. It does not follow the list's filters.
- Net position, the open-debt count and the overdue count are the backend's own. Nothing is added, subtracted or converted; two currencies are never merged. The net is shown with a sentence (more is owed to you / you owe more / even) chosen from its sign.
- The overdue count links to the list filtered with `status=overdue`; the card also links to the debts report.
- Payments are read page by page; the page is in the address (`?pp=`), as `Link`s with `replace`, like the goal movements. A payment in another currency than its debt, another debt's payment, or a duplicate id refuses the page whole (unchanged rule). `reversal_transaction_id` and `reversed_at` are now read; the reversal day is shown in the person's own time zone.
- Due date in words from the backend's `days_until_due` ("Days until due 34", "Due today", "Days overdue 5"); a settled or archived debt shows none. A one-line status note repeats the backend's flag (overdue / paid / archived).
- `owner.name` is shown as "Recorded by" when the backend sends it.

**Recurring**

- `schedule.next_occurrence` is read with the rule (list and detail already carried it) through the same occurrence reader as the history, so a next occurrence of another rule or in another currency is dropped rather than shown. Rows show "Overdue" only from the occurrence's own `is_overdue`, and the status chip only when it is not a plain "scheduled" (due, failed, …).
- `GET /recurring-transactions/{id}/occurrences[?occurrence_status=&page=&per_page=10]` (`readRuleOccurrences`). Tab and page are in the address (`?occ=`, `?op=`); changing the tab drops the page. Each row: due date, status, the backend's overdue flag, its own amount in the rule's currency, processed date, attempts (failed or more than one), the failure or skip reason, and a link to the transaction when it posted. A page with another rule's occurrence, another currency, a repeated id, or (with a status asked for) another status is refused whole.
- Status sentences for paused, completed and archived rules (the full version's wording).

Strings: `i18n/sections/planningDetails.js` (`debtView`, `ruleView`), EN and AR, parity-checked.

## Not built, on purpose

- **No repaid percentage or progress bar for a debt, no "total owed across currencies", no projected next dates.** The backend sends none of these, and deriving them would be Mobile doing finance. Every figure is the backend's.
- **No anchor day.** The backend sends `anchor_day`, but its meaning depends on the frequency (day of month vs weekday) and Desktop shows it unexplained; it is left out rather than mislabelled.
- No currency filter or counterparty search on the debts list (the backend supports both; the summary already separates currencies). Nothing in the audit needed them.
- No recurring-rule summary: the backend has none beyond `/reports/recurring`, which the Reports screen already offers.
- Smart Savings untouched (flag-gated).

## Safeguards kept

- Only GET requests. `tests/mobileReadOnly.test.mjs` allow-lists `debtsApi.summary` and the two new facade exports; the screens still render no button, input or form.
- Currency is part of every figure; mixed-currency rows are refused, not converted.
- A failed or malformed secondary read (summary, payments, occurrences) shows its own error with Retry and never takes the page down.
- Flag-off builds still contain no Mobile code (`mobileBundle`).
- RTL: dates and amounts are `bdi`; the new tabs wrap instead of clipping; the summary sides are label-left, figure-right rows that wrap instead of clipping; no media query.

## Tests

`tests/mobileDebtsRecurring.test.mjs` (40 tests): model strictness, the summary per currency, payment paging and reversal details, the due-date words, rule rows, the next-occurrence card, occurrence history (status tabs, paging, refusal, retry, no-currency, Arabic, read-only). Fixtures: `summaryRow` / `summarySide` in `tests/helpers/moreFixture.mjs`, `occurrence` and the `occurrences` option in `tests/helpers/planningFixture.mjs`. Existing expectations updated for the one new read per page (`mobileReadOnly`, `mobilePlanning`).

## Visual QA

Local GET-only fixture (fictional data, writes refused with 405), 320 px and 390 px, EN and AR (RTL), light and dark: 48 captures of the debts list with its summary, a debt with 12 payments (one reversed), an overdue debt, the rule list, a rule with 13 occurrences, and a failed rule. No horizontal overflow, no console error, direction matches the language in every capture. Captures live outside the repository in `SmartSpend-Mobile-QA/phase-6ui-5c5/`.

Found and fixed during QA: the two-box layout of the summary took the whole first screen at 320 px (now label-left rows); an "Overdue" chip repeated by a "Due" chip (the second is dropped); links in payment and occurrence rows wrapped and were indented.
